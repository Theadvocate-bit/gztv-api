// Generate data/snapshot.json — static fallback for EdgeOne when upstream is blocked.
// Run locally where upstream is reachable:
//   node tools/gen_snapshot.mjs
//
// Note: the upstream Search/GetConditionList IGNORES all filter params
// (column / t_id / id / type_id are all treated as no-ops). So we fetch
// a large page of the default list and filter client-side, exactly as
// the edge runtime does.

import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';

const BASE = 'https://haiwaiapi.1fc8ab0.com';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'https://gztv5.com',
      'Referer': 'https://gztv5.com/',
      'User-Agent': UA
    },
    body: JSON.stringify(body || {})
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const TYPES = [1, 2, 3, 4, 64, 30, 39, 40, 70, 71, 72, 73, 74];
const PER_TYPE = 30;
const PAGE_SIZE = 50;   // upstream caps pageSize at 50 regardless of request
const MAX_PAGES = 40;   // safety bound; fetch stops early once every type is filled
const DETAIL_TOP_N = 5;
// Minimum items across all types for a snapshot to be considered valid.
// Guards against upstream partial failures overwriting a good snapshot with
// an empty/near-empty one and silently breaking the EdgeOne fallback.
const MIN_TOTAL_ITEMS = 20;

const snapshot = {
  generated_at: new Date().toISOString(),
  upstream: BASE,
  list: {},
  detail: {},
  catalog: null
};

// Fetch a big default list, then client-side filter by t_id.
// The upstream ignores all filter params (column / type / pageSize caps), so we
// iterate the full default feed. Niche types (64/30/40/70-74, and 39) appear
// late or not at all in the feed, so we must NOT stop early — stopping after
// the popular types fill would silently drop them from the fallback snapshot.
async function fetchAll() {
  const items = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const raw = await post('/Pc/Search/GetConditionList', {
      page, pageSize: PAGE_SIZE
    });
    const list = (raw.data && raw.data.list) || [];
    items.push(...list);
    console.log(`  page ${page}: +${list.length}, total=${items.length}`);
    if (list.length === 0) break;
  }
  return items;
}

console.log('Fetching upstream default list…');
const all = await fetchAll();
console.log(`Total fetched: ${all.length}`);

// Client-side filter by type
for (const type of TYPES) {
  const filtered = all
    .filter(v => parseInt(String(v.t_id), 10) === type)
    .slice(0, PER_TYPE);
  snapshot.list[String(type)] = {
    total: filtered.length,
    items: filtered
  };
  console.log(`  type ${type}: ${filtered.length} items`);
}

// Detail for first N of each type
console.log('\nFetching details for top items…');
const detailIds = new Set();
for (const type of TYPES) {
  for (const it of (snapshot.list[String(type)]?.items || []).slice(0, DETAIL_TOP_N)) {
    detailIds.add(String(it.vod_id));
  }
}
console.log(`Unique detail ids: ${detailIds.size}`);

for (const vid of detailIds) {
  try {
    const infoRaw = await post('/Pc/Resource/GetVodInfo', { vod_id: vid });
    // Paginate playlist to grab all episodes
    const playList = [];
    let page = 1;
    while (page <= 20) {
      const pl = await post('/Pc/Resource/GetOnePlayList', {
        vod_id: vid, page, page_size: 50
      });
      const urls = (pl.data && pl.data.urls) || [];
      playList.push(...urls);
      if (urls.length < 50) break;
      page++;
    }
    snapshot.detail[vid] = {
      vodInfo: infoRaw.data && infoRaw.data.vodInfo,
      playList
    };
  } catch (e) {
    console.error(`  detail ${vid}: FAILED - ${e.message}`);
  }
}

// Catalog / condition tree — used by /api/catalog when upstream is blocked
try {
  const catRaw = await post('/Pc/Search/GetCondition', {});
  snapshot.catalog = catRaw;
  console.log('\nCatalog snapshot: fetched');
} catch (e) {
  console.error(`\nCatalog snapshot: FAILED - ${e.message}`);
}

mkdirSync('data', { recursive: true });

// Validity gate: refuse to write a degenerate snapshot that would silently
// break the EdgeOne fallback. Compare against the existing snapshot on disk.
const totalItems = Object.values(snapshot.list).reduce((n, b) => n + b.items.length, 0);
const existingPath = 'data/snapshot.json';
let existingTotal = 0;
try {
  const existing = JSON.parse(readFileSync(existingPath, 'utf8'));
  existingTotal = Object.values(existing.list || {}).reduce((n, b) => n + (b.items?.length || 0), 0);
} catch (_) { /* no existing snapshot */ }

if (totalItems < MIN_TOTAL_ITEMS) {
  console.error(`\nABORT: snapshot has only ${totalItems} items (< ${MIN_TOTAL_ITEMS}). ` +
    `Upstream likely partial/blocked. Keeping existing snapshot (${existingTotal} items).`);
  process.exit(1);
}
if (existingTotal > 0 && totalItems < existingTotal * 0.5) {
  console.error(`\nABORT: new snapshot (${totalItems}) is <50% of existing (${existingTotal}). ` +
    `Likely upstream degradation. Keeping existing snapshot.`);
  process.exit(1);
}

const raw = JSON.stringify(snapshot);
writeFileSync('data/snapshot.json', raw);
// Also emit a JS module for the EdgeOne bundle.
writeFileSync('edge-functions/lib/snapshot.js',
  `/* AUTO-GENERATED by tools/gen_snapshot.mjs. Do not edit manually. */\nexport const SNAPSHOT = ${raw};`);
console.log(`\nSnapshot written:`);
console.log(`  data/snapshot.json (${(raw.length / 1024).toFixed(1)} KB)`);
console.log(`  edge-functions/lib/snapshot.js (bundled)`);
console.log(`  types: ${Object.keys(snapshot.list).length}`);
console.log(`  details: ${Object.keys(snapshot.detail).length}`);
