// Integration test — real upstream calls through the AppCMS handlers.
// Run: node tools/integration_test.mjs
// Requires: Node 18+ (built-in fetch), network access to gztv5 upstream.

import assert from 'node:assert/strict';

const handlers = await import('../edge-functions/lib/appcms_handlers.js');

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${name}: ${e.message}`);
  }
}

async function parseJSON(res) {
  const data = await res.json();
  assert.equal(res.headers.get('access-control-allow-origin'), '*');
  return data;
}

console.log('\n=== /health (via handleHealth) ===');
await test('returns ok status', async () => {
  const res = handlers.handleHealth();
  const data = await parseJSON(res);
  assert.equal(data.status, 'ok');
  assert.equal(data.service, 'gztv-api');
});

console.log('\n=== AppCMS V10 list ===');
await test('GET list returns AppCMS envelope', async () => {
  const req = new Request('https://x.test/?ac=list&page=1&limit=10');
  const res = await handlers.buildAppCmsHandler(req);
  const data = await parseJSON(res);
  assert.equal(data.code, 1);
  assert.equal(data.msg, '数据列表');
  assert.ok(Array.isArray(data.list));
  assert.ok(Array.isArray(data.class));
  assert.ok(data.list.length > 0, `expected items, got 0`);
  const item = data.list[0];
  assert.ok(item.vod_id);
  assert.ok(item.vod_name);
  assert.ok(item.type_id != null);
  assert.equal(item.vod_play_from, 'gztv5');
});

await test('filters by type_id=1 (电影)', async () => {
  const req = new Request('https://x.test/?ac=list&type_id=1&limit=30');
  const res = await handlers.buildAppCmsHandler(req);
  const data = await parseJSON(res);
  assert.equal(data.code, 1);
  assert.ok(data.list.some(i => i.type_id === 1), 'expected at least one 电影');
});

await test('search by wd=肖 returns results', async () => {
  const req = new Request('https://x.test/?ac=list&wd=' + encodeURIComponent('肖') + '&limit=10');
  const res = await handlers.buildAppCmsHandler(req);
  const data = await parseJSON(res);
  assert.equal(data.code, 1);
  assert.ok(Array.isArray(data.list));
});

console.log('\n=== AppCMS V10 detail ===');
await test('GET detail returns full record with play URL', async () => {
  const req = new Request('https://x.test/?ac=detail&ids=3');
  const res = await handlers.buildAppCmsHandler(req);
  const data = await parseJSON(res);
  assert.equal(data.code, 1);
  assert.equal(data.list.length, 1);
  const d = data.list[0];
  assert.equal(d.vod_id, '3');
  assert.equal(d.type_id, 4);
  assert.equal(d.type_name, '动漫');
  assert.equal(d.vod_play_from, 'gztv5');
  assert.ok(d.vod_play_url.length > 0, 'expected play_url');
  const parts = d.vod_play_url.split('#');
  assert.ok(parts.length >= 4, `expected at least 2 episodes, got ${parts.length} parts`);
});

await test('detail with unknown id returns error envelope', async () => {
  const req = new Request('https://x.test/?ac=detail&ids=99999999');
  const res = await handlers.buildAppCmsHandler(req);
  const data = await parseJSON(res);
  assert.equal(data.code, 0);
  assert.equal(data.list.length, 0);
});

console.log('\n=== /play resolver ===');
await test('returns m3u8 URL for episode 1', async () => {
  const req = new Request('https://x.test/play?vod_id=3&episode=1');
  const res = await handlers.handlePlay(req);
  const data = await parseJSON(res);
  assert.equal(data.source, 'gztv5');
  assert.equal(data.episode, 1);
  assert.ok(/^https:\/\//.test(data.url));
  assert.ok(data.url.includes('.m3u8'));
});

await test('returns 404 for missing vod_id', async () => {
  const req = new Request('https://x.test/play');
  const res = await handlers.handlePlay(req);
  const data = await parseJSON(res);
  assert.match(data.error, /Missing/i);
});

console.log('\n=== /api/catalog ===');
await test('returns upstream category tree', async () => {
  const res = await handlers.handleCatalog();
  const data = await parseJSON(res);
  assert.equal(data.code, 200);
  assert.ok(data.data);
});

console.log(`\n${'='.repeat(40)}`);
console.log(`passed: ${passed}, failed: ${failed}`);
console.log(`${'='.repeat(40)}\n`);

if (failed > 0) process.exit(1);
