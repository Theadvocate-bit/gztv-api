// Upstream client for gztv5.com backend API
// Primary: haiwaiapi.1fc8ab0.com (Cloudflare, stable globally)
// Failover list is checked in order; if a base returns HTTP error we skip it.

const BASES = [
  'https://haiwaiapi.1fc8ab0.com'
];

// If extra bases are provided via env var, they get added.
// Format: CACHE_UPSTREAM_BASES=https://a.example.com,https://b.example.com
function getBases() {
  try {
    const env = (typeof process !== 'undefined' && process.env) || globalThis.env || {};
    const extra = env.CACHE_UPSTREAM_BASES || '';
    if (extra) {
      const list = extra.split(',').map(s => s.trim()).filter(Boolean);
      return [...list, ...BASES];
    }
  } catch (_) { /* ignore */ }
  return BASES;
}

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';

export async function postUpstream(path, body, opts = {}) {
  const bases = getBases();

  let lastErr = null;
  for (let i = 0; i < bases.length; i++) {
    const base = bases[i];
    const url = `${base}${path}`;
    const ctrl = new AbortController();
    const timeout = opts.timeout ?? 10000;
    const tid = setTimeout(() => ctrl.abort(), timeout);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://gztv5.com',
          'Referer': 'https://gztv5.com/',
          'User-Agent': UA
        },
        body: JSON.stringify(body || {}),
        signal: ctrl.signal
      });
      clearTimeout(tid);

      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status} from ${base}`);
        continue;
      }
      const data = await res.json();
      return data;
    } catch (e) {
      clearTimeout(tid);
      lastErr = e;
    }
  }
  throw lastErr || new Error('upstream failed');
}

// Search — list with filtering
export async function searchCondition(body) {
  return await postUpstream('/Pc/Search/GetConditionList', body);
}

// Full vod metadata (includes first-episode play_url as `play_url`)
export async function getVodInfo(vodId) {
  return await postUpstream('/Pc/Resource/GetVodInfo', { vod_id: vodId });
}

// All episodes of a vod — paginated (24 per page)
export async function getOnePlayList(vodId, opts = {}) {
  const out = [];
  const page_size = 24;
  let page = 1;
  let total = 0;
  const maxPages = opts.maxPages || 20;
  do {
    const d = await postUpstream('/Pc/Resource/GetOnePlayList', {
      vod_id: vodId,
      page,
      page_size
    });
    const data = d.data || {};
    total = parseInt(data.total_vod_vurl, 10) || 0;
    const urls = data.urls || [];
    for (const u of urls) out.push(u);
    if (urls.length < page_size) break;
    if (page >= maxPages) break;
    page++;
  } while (out.length < total);
  return { urls: out, total };
}

// Category tree from upstream
export async function getCondition() {
  return await postUpstream('/Pc/Search/GetCondition', {});
}
