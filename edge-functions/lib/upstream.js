// Upstream client for gztv5.com backend API
// Domain rotation: domestic + overseas fallback

const BASES = [
  'https://haiwaiapi.1fc8ab0.com',
  'https://api.txxhuc.com'
];

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';

let preferredIdx = 0;

export async function postUpstream(path, body, opts = {}) {
  const bases = [
    BASES[preferredIdx],
    BASES[(preferredIdx + 1) % BASES.length]
  ];

  let lastErr = null;
  for (let i = 0; i < bases.length; i++) {
    const base = bases[i];
    const url = `${base}${path}`;
    const ctrl = new AbortController();
    const timeout = opts.timeout ?? 8000;
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
        lastErr = new Error(`HTTP ${res.status}`);
        continue;
      }
      const data = await res.json();
      // Switch preferred base if this one worked and wasn't first choice
      if (i === 1) preferredIdx = (preferredIdx + 1) % BASES.length;
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
  const d = await postUpstream('/Pc/Search/GetConditionList', body);
  return d;
}

// Full vod metadata (includes first-episode play_url as `play_url`)
export async function getVodInfo(vodId) {
  const d = await postUpstream('/Pc/Resource/GetVodInfo', { vod_id: vodId });
  return d;
}

// All episodes of a vod — paginated (24 per page)
export async function getOnePlayList(vodId, opts = {}) {
  const out = [];
  const page_size = 24;
  let page = 1;
  let total = 0;
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
    if (opts.maxPages && page >= opts.maxPages) break;
    page++;
  } while (out.length < total);
  return { urls: out, total };
}

// Category tree from upstream (for /class discovery)
export async function getCondition() {
  const d = await postUpstream('/Pc/Search/GetCondition', {});
  return d;
}
