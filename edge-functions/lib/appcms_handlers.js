import { getCached, cacheStats } from '../lib/cache.js';
import { searchCondition, getVodInfo, getOnePlayList } from '../lib/upstream.js';
import {
  formatListItem,
  formatDetailItem,
  envelope,
  errorEnvelope,
  detailEnvelope,
  parseQuery,
  corsHeaders
} from '../lib/appcms.js';

const LIST_TTL = 10 * 60 * 1000;      // 10 min
const DETAIL_TTL = 30 * 60 * 1000;    // 30 min

function jsonBody(data, opts = {}) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: corsHeaders({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=600',
      ...opts
    })
  });
}

function okBody(data, cacheControl) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8'
  };
  if (cacheControl) headers['Cache-Control'] = cacheControl;
  return new Response(JSON.stringify(data), { status: 200, headers: corsHeaders(headers) });
}

function notFound(text = '资源不存在或已下架') {
  return okBody(errorEnvelope({ msg: text }));
}

async function fetchSearch({ page, limit, keyword, typeId }) {
  const body = { page, pageSize: limit };
  if (keyword) {
    body.wd = keyword;
    body.name = keyword;
    body.keyword = keyword;
  }
  if (typeId) body.column = typeId;
  const raw = await searchCondition(body);
  const data = raw.data || {};
  let items = data.list || [];

  // Client-side filter when upstream column param is ignored
  if (typeId) {
    items = items.filter(v => {
      const mapped = (typeof v.t_id === 'number' ? v.t_id : parseInt(v.t_id, 10));
      return String(mapped) === String(typeId);
    });
  }

  return {
    items,
    total: data.total != null ? parseInt(data.total, 10) : items.length
  };
}

async function handleList(query) {
  const { type_id, wd, page, limit } = query;
  const pageSize = Math.min(Math.max(limit, 1), 100);
  const cacheKey = `list:${type_id || 0}:${wd || ''}:${page}:${pageSize}`;

  try {
    const data = await getCached(cacheKey, LIST_TTL, async () => {
      const { items, total } = await fetchSearch({
        page, limit: pageSize,
        keyword: wd || '',
        typeId: type_id || 0
      });

      // Top up if client-side filter reduced items below pageSize
      if (type_id && items.length < pageSize) {
        const extraPages = 4;
        for (let i = 1; i <= extraPages && items.length < pageSize; i++) {
          const extra = await fetchSearch({
            page: page + i, limit: pageSize,
            keyword: wd || '',
            typeId: type_id || 0
          });
          if (!extra.items.length) break;
          items.push(...extra.items);
        }
      }

      const list = items.map(formatListItem);
      const pagecount = Math.max(1, Math.ceil(total / pageSize));

      return envelope({
        code: 1, msg: '数据列表',
        page, pagecount, limit: pageSize, total, list
      });
    });

    return okBody(data, 'public, max-age=600');
  } catch (e) {
    return okBody(errorEnvelope({
      msg: '上游暂不可用：' + (e && e.message || 'unknown')
    }), 'public, max-age=60');
  }
}

async function handleDetail(query) {
  const id = query.ids;
  if (!id) return notFound('缺少 ids 参数');

  const cacheKey = `detail:${id}`;

  try {
    const data = await getCached(cacheKey, DETAIL_TTL, async () => {
      const [info, plays] = await Promise.all([
        getVodInfo(id).catch(() => null),
        getOnePlayList(id, { maxPages: 20 }).catch(() => ({ urls: [], total: 0 }))
      ]);

      const vodInfo = info && info.data && info.data.vodInfo;
      if (!vodInfo) {
        return errorEnvelope({ msg: '资源不存在或已下架' });
      }

      const episodes = plays.urls || [];
      const item = formatDetailItem(vodInfo, episodes, query.type_id || 0);
      return detailEnvelope({ page: 1, pagecount: 1, limit: 1, total: 1, list: [item] });
    });

    return okBody(data, 'public, max-age=1800');
  } catch (e) {
    return okBody(errorEnvelope({
      msg: '上游暂不可用：' + (e && e.message || 'unknown')
    }), 'public, max-age=60');
  }
}

export async function buildAppCmsHandler(request) {
  const url = new URL(request.url);
  let searchStr = url.search;

  // Accept POST body as query params
  if (request.method === 'POST') {
    try {
      const raw = await request.text();
      if (raw) {
        const params = new URLSearchParams();
        for (const kv of raw.split('&')) {
          const [k, v] = kv.split('=');
          if (k) params.set(k, decodeURIComponent(v || ''));
        }
        searchStr += (searchStr.includes('?') ? '&' : '?') + params.toString();
      }
    } catch (_) { /* fall through with existing query */ }
  }

  const q = parseQuery(url.origin + url.pathname + searchStr);
  if (q.ac === 'detail' || q.ids) return handleDetail(q);
  return handleList(q);
}

// --- Standalone handlers for other routes ---

export async function handlePlay(request) {
  const params = new URL(request.url).searchParams;
  const vodId = params.get('vod_id') || params.get('vodId') || params.get('movie') || params.get('id');
  const source = params.get('source') || 'gztv5';
  const episode = params.get('episode') ? parseInt(params.get('episode'), 10) : 1;

  if (!vodId) return okBody({ error: 'Missing vod_id' });
  if (source !== 'gztv5') return okBody({ error: `Unknown source: ${source}` });

  const cacheKey = `play:${vodId}`;
  const { urls } = await getCached(cacheKey, DETAIL_TTL, () =>
    getOnePlayList(vodId, { maxPages: 20 })
  );

  const ep = urls.find(u => Number(u.sort) === episode) || urls[0];
  if (!ep) return okBody({ error: 'Episode not found' });

  return okBody({
    source,
    episode,
    name: ep.name,
    url: ep.url,
    resolution: ep.resolution || ''
  }, 'public, max-age=1800');
}

export async function handleM3u8(request) {
  const params = new URL(request.url).searchParams;
  const target = params.get('url');
  if (!target || !/^https:\/\//.test(target)) {
    return new Response('Missing or invalid url param', {
      status: 400, headers: corsHeaders({ 'Content-Type': 'text/plain; charset=utf-8' })
    });
  }
  try {
    const res = await fetch(target, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
      }
    });
    const text = await res.text();
    const base = new URL(target);
    const dir = base.pathname.slice(0, base.pathname.lastIndexOf('/') + 1);
    const host = base.origin + dir;
    // Rewrite relative TS/MP4 segment paths to absolute
    const rewritten = text.replace(/^([^\s#]+\.(?:ts|mp4|m4s))\s*$/gm,
      (m, seg) => seg.startsWith('/') ? host.replace(/\/$/, '') + seg : host.replace(/\/$/, '') + '/' + seg
    );
    return new Response(rewritten, {
      status: 200,
      headers: corsHeaders({
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'public, max-age=600'
      })
    });
  } catch (e) {
    return new Response('Upstream fetch failed: ' + e.message, {
      status: 502,
      headers: corsHeaders({ 'Content-Type': 'text/plain; charset=utf-8' })
    });
  }
}

export function handleHealth() {
  return okBody({
    status: 'ok',
    service: 'gztv-api',
    upstream: 'gztv5.com',
    cache: cacheStats(),
    ts: new Date().toISOString()
  });
}

export async function handleCatalog() {
  const { getCondition } = await import('../lib/upstream.js');
  const CACHE_TTL = 24 * 3600 * 1000;
  const data = await getCached('catalog:conditions', CACHE_TTL, () => getCondition());
  return okBody(data);
}
