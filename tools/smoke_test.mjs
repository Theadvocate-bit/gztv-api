// Local smoke test — validates AppCMS V10 formatter, cache, and edge-function
// route dispatch. Does NOT hit the network.
// Run: node tools/smoke_test.mjs

import assert from 'node:assert/strict';

// Import the pure-logic lib modules (they don't depend on fetch).
const { formatListItem, formatDetailItem, envelope, buildClassList, TYPE_MAP, TYPE_NAMES, parseQuery } =
  await import('../edge-functions/lib/appcms.js');
const { getCached, clearCache, cacheStats } =
  await import('../edge-functions/lib/cache.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${name}: ${e.message}`);
  }
}

async function atest(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${name}: ${e.message}`);
  }
}

console.log('\n=== TYPE_MAP / TYPE_NAMES ===');
test('maps 电影/连续剧/综艺/动漫/短剧 to 1/2/3/4/64', () => {
  assert.equal(TYPE_MAP[1], 1);
  assert.equal(TYPE_MAP[2], 2);
  assert.equal(TYPE_MAP[3], 3);
  assert.equal(TYPE_MAP[4], 4);
  assert.equal(TYPE_MAP[64], 64);
  assert.equal(TYPE_NAMES[1], '电影');
  assert.equal(TYPE_NAMES[2], '电视剧');
  assert.equal(TYPE_NAMES[3], '综艺');
  assert.equal(TYPE_NAMES[4], '动漫');
  assert.equal(TYPE_NAMES[64], '短剧');
});

test('preserves extended categories', () => {
  assert.equal(TYPE_MAP[30], 30);
  assert.equal(TYPE_MAP[40], 40);
  assert.equal(TYPE_MAP[73], 73);
  assert.equal(TYPE_MAP[74], 74);
});

console.log('\n=== formatListItem ===');
test('produces 8-field AppCMS list item', () => {
  const item = formatListItem({
    vod_id: '3',
    vod_name: '宝可梦地平线',
    vod_year: '2023-04-14',
    vod_continu: '更新至133集/全200集',
    t_id: 4,
    new_continue: '更新至133集/全200集'
  });
  assert.equal(item.vod_id, '3');
  assert.equal(item.vod_name, '宝可梦地平线');
  assert.equal(item.type_id, 4);
  assert.equal(item.type_name, '动漫');
  assert.equal(item.vod_time, '2023-04-14');
  assert.equal(item.vod_remarks, '更新至133集/全200集');
  assert.equal(item.vod_play_from, 'gztv5');
});

test('falls back to vod_year when vod_filmtime missing', () => {
  const item = formatListItem({
    vod_id: 1, vod_name: 'X', vod_year: '2020', t_id: 1
  });
  assert.equal(item.vod_time, '2020');
});

test('coerces numeric id to string', () => {
  const item = formatListItem({ vod_id: 123, vod_name: 'n', t_id: 2 });
  assert.equal(item.vod_id, '123');
  assert.equal(typeof item.vod_id, 'string');
});

test('unknown t_id passes through', () => {
  const item = formatListItem({ vod_id: 9, vod_name: 'n', t_id: 999 });
  assert.equal(item.type_id, 999);
  assert.equal(item.type_name, '');
});

console.log('\n=== formatDetailItem ===');
test('builds $$$ / # separated play URL', () => {
  const vodInfo = {
    vod_id: 3,
    vod_name: '宝可梦地平线',
    t_id: 4,
    pic: 'https://pic.jpg',
    vod_area: '日本',
    vod_year: '2023',
    vod_scroe: '7.9',
    vod_continu: '更新至133集',
    vod_actor: ['铃木实里', '寺崎裕香'],
    vod_directed: '传沙织',
    vod_use_content: '剧情简介',
    d_class: ',98,0,',
    videoTag: ['动漫', '日本动漫'],
    vod_addtime: '2026-06-06'
  };
  const plays = [
    { name: '01', sort: 1, url: 'https://a.m3u8' },
    { name: '02', sort: 2, url: 'https://b.m3u8' }
  ];
  const d = formatDetailItem(vodInfo, plays, 0);
  assert.equal(d.vod_id, '3');
  assert.equal(d.type_id, 4);
  assert.equal(d.type_name, '动漫');
  assert.equal(d.vod_play_from, 'gztv5');
  // Two episodes separated by #, each with name#url
  assert.equal(d.vod_play_url, '01#https://a.m3u8#02#https://b.m3u8');
  assert.equal(d.vod_actor, '铃木实里,寺崎裕香');
  assert.equal(d.vod_director, '传沙织');
  assert.equal(d.vod_tags, '动漫,日本动漫');
});

test('accepts string actor / director', () => {
  const d = formatDetailItem({
    vod_id: 1, vod_name: 'x', t_id: 1,
    vod_actor: 'a,b',
    vod_directed: 'd'
  }, [], 0);
  assert.equal(d.vod_actor, 'a,b');
  assert.equal(d.vod_director, 'd');
});

test('handles empty play list', () => {
  const d = formatDetailItem({ vod_id: 1, vod_name: 'x', t_id: 1 }, [], 0);
  assert.equal(d.vod_play_url, '');
});

test('respects typeIdOverride', () => {
  const d = formatDetailItem({ vod_id: 1, vod_name: 'x', t_id: 4 }, [], 64);
  assert.equal(d.type_id, 64);
  assert.equal(d.type_name, '短剧');
});

test('normalizes vod_class comma separators', () => {
  const d = formatDetailItem({ vod_id: 1, vod_name: 'x', t_id: 1, d_class: ',98,0,' }, [], 0);
  // Should strip leading/trailing commas
  assert.equal(d.vod_class, '98');
});

console.log('\n=== envelope ===');
test('returns AppCMS V10 top-level envelope (code=1, msg=数据列表)', () => {
  const e = envelope({ page: 1, pagecount: 25, limit: 20, total: 500, list: [{ vod_id: '1' }] });
  assert.equal(e.code, 1);
  assert.equal(e.msg, '数据列表');
  assert.equal(e.page, '1');
  assert.equal(e.pagecount, '25');
  assert.equal(e.limit, '20');
  assert.equal(e.total, '500');
  assert.equal(e.list.length, 1);
  assert.ok(Array.isArray(e.class));
  assert.ok(e.class.length > 0);
});

test('supports error code and custom msg', () => {
  const e = envelope({ code: 404, msg: 'not found' });
  assert.equal(e.code, 404);
  assert.equal(e.msg, 'not found');
});

console.log('\n=== buildClassList ===');
test('always returns non-empty class list', () => {
  const c = buildClassList();
  assert.ok(c.length >= 5);
});

test('priority categories (1,2,3,4,64) come first', () => {
  const c = buildClassList();
  const ids = c.slice(0, 5).map(x => x.type_id);
  assert.deepEqual(ids, [1, 2, 3, 4, 64]);
});

test('every class has required fields', () => {
  const c = buildClassList();
  for (const cls of c) {
    assert.ok(cls.type_id != null);
    assert.ok(cls.type_name);
    assert.ok('type_seq' in cls);
    assert.ok('type_sort' in cls);
  }
});

console.log('\n=== parseQuery ===');
test('parses full query string', () => {
  const q = parseQuery('https://example.com/?ac=detail&ids=3&page=1&limit=20&by=time');
  assert.equal(q.ac, 'detail');
  assert.equal(q.ids, '3');
  assert.equal(q.page, 1);
  assert.equal(q.limit, 20);
  assert.equal(q.by, 'time');
  assert.equal(q.raw, false);
});

test('infers ac=detail when ids present', () => {
  const q = parseQuery('https://example.com/?ids=3');
  assert.equal(q.ac, 'detail');
});

test('accepts type_id / t / keyword aliases', () => {
  const q = parseQuery('https://example.com/?ac=list&t=1&keyword=肖&raw=1');
  assert.equal(q.ac, 'list');
  assert.equal(q.type_id, 1);
  assert.equal(q.wd, '肖');
  assert.equal(q.raw, true);
});

test('defaults to list with page 1, limit 20', () => {
  const q = parseQuery('https://example.com/');
  assert.equal(q.ac, 'list');
  assert.equal(q.page, 1);
  assert.equal(q.limit, 20);
  assert.equal(q.type_id, 0);
});

console.log('\n=== getCached ===');
await atest('returns fetcher value on miss', async () => {
  clearCache();
  let calls = 0;
  const v = await getCached('k1', 1000, async () => {
    calls++;
    return { x: calls };
  });
  assert.equal(v.x, 1);
  assert.equal(calls, 1);
});

await atest('serves from cache on hit', async () => {
  clearCache();
  let calls = 0;
  const v1 = await getCached('k1', 100000, async () => {
    calls++;
    return { x: calls };
  });
  const v2 = await getCached('k1', 100000, async () => {
    calls++;
    return { x: calls };
  });
  assert.deepEqual(v1, v2);
  assert.equal(calls, 1);
});

await atest('evicts expired entries', async () => {
  clearCache();
  let calls = 0;
  const v1 = await getCached('k1', 0, async () => {
    calls++;
    return { x: calls };
  });
  // ttl 0 => already expired by the time we read (Date.now() > Date.now() + 0)
  const v2 = await getCached('k1', 0, async () => {
    calls++;
    return { x: calls };
  });
  assert.notEqual(v1.x, v2.x);
  assert.equal(calls, 2);
});

await atest('cacheStats returns size info', async () => {
  clearCache();
  await getCached('a', 100000, async () => 1);
  await getCached('b', 100000, async () => 2);
  const s = cacheStats();
  assert.equal(s.size, 2);
  assert.ok(s.capacity >= 2);
  clearCache();
});

console.log('\n=== edge-functions import boundary ===');
await atest('all lib files stay within edge-functions/', async () => {
  const { readFileSync, readdirSync, statSync } = await import('node:fs').then(m => m.default);
  const { resolve, dirname } = await import('node:path');

  const walk = (dir, out = []) => {
    for (const name of readdirSync(dir)) {
      const p = `${dir}/${name}`;
      const s = statSync(p);
      if (s.isDirectory()) walk(p, out);
      else if (p.endsWith('.js')) out.push(p);
    }
    return out;
  };
  const files = walk('edge-functions');
  assert.ok(files.length >= 4, `expected ≥4 edge files, got ${files.length}`);

  const root = resolve('edge-functions');
  // No import should escape the edge-functions/ tree — EdgeOne only bundles files
  // inside this directory, so any sibling-of-parent reference would break at deploy.
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    const imports = [...src.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(m => m[1]);
    for (const imp of imports) {
      if (imp.startsWith('.')) {
        const resolved = resolve(dirname(f), imp);
        assert.ok(resolved.startsWith(root + '/'),
          `${f} escapes edge-functions/ via '${imp}' -> ${resolved}`);
      }
    }
  }
});

console.log(`\n${'='.repeat(40)}`);
console.log(`passed: ${passed}, failed: ${failed}`);
console.log(`${'='.repeat(40)}\n`);

if (failed > 0) process.exit(1);
