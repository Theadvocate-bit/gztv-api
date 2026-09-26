import { getCached, cacheStats } from './lib/cache.js';
import { searchCondition, getVodInfo, getOnePlayList, getCondition } from './lib/upstream.js';
import {
  formatListItem,
  formatDetailItem,
  envelope,
  parseQuery,
  withCors,
  TYPE_MAP,
  TYPE_NAMES
} from './lib/appcms.js';

const LIST_TTL = 10 * 60 * 1000;      // 10 min
const DETAIL_TTL = 30 * 60 * 1000;    // 30 min
const CONDITION_TTL = 24 * 3600 * 1000; // 24 h

function jsonBody(data, opts = {}) {
  return new Response(JSON.stringify(data), {
    status: data && data.code && data.code !== 200 ? 200 : 200,
    headers: withCors({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=600'
    }, opts)
  });
}

function textBody(text, headers) {
  return new Response(text, { headers: withCors(headers) });
}

async function fetchSearch({ page, limit, keyword, typeId }) {
  const body = { page, pageSize: limit };
  if (keyword) {
    body.wd = keyword;
    body.name = keyword;
    body.keyword = keyword;
  }
  if (typeId) body.column = typeId; // upstream may ignore; we filter client-side
  const raw = await searchCondition(body);
  const data = raw.data || {};
  let items = data.list || [];

  // Client-side filter by t_id when column param is ignored by upstream
  if (typeId) {
    items = items.filter(v => {
      const m = TYPE_MAP[v.t_id] ?? v.t_id;
      return String(m) === String(typeId);
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

  const data = await getCached(cacheKey, LIST_TTL, async () => {
    const { items, total } = await fetchSearch({
      page, limit: pageSize,
      keyword: wd || '',
      typeId: type_id || 0
    });

    // If client-side filter reduced items below pageSize, top up from next page(s)
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
      page: page,
      pagecount,
      limit: pageSize,
      total,
      list
    });
  });

  return jsonBody(data, { cacheControl: 'public, max-age=600' });
}

async function handleDetail(query) {
  const id = query.ids;
  if (!id) {
    return jsonBody(envelope({ code: 400, msg: '缺少 ids 参数' }));
  }
  const cacheKey = `detail:${id}`;

  const data = await getCached(cacheKey, DETAIL_TTL, async () => {
    const [info, plays] = await Promise.all([
      getVodInfo(id).catch(() => ({ data: null, code: 0, msg: 'info fail' })),
      getOnePlayList(id, { maxPages: 20 }).catch(() => ({ urls: [], total: 0 }))
    ]);

    const vodInfo = info && info.data && info.data.vodInfo;
    if (!vodInfo) {
      return envelope({
        code: 404,
        msg: '资源不存在或已下架',
        list: []
      });
    }

    // Prefer the play URL returned by GetVodInfo for episode 1
    // then union with GetOnePlayList (which contains all episodes)
    let episodes = plays.urls || [];

    const item = formatDetailItem(vodInfo, episodes, query.type_id || 0);
    return envelope({
      page: 1,
      pagecount: 1,
      limit: 1,
      total: 1,
      list: [item]
    });
  });

  return jsonBody(data, { cacheControl: 'public, max-age=1800' });
}

// Standard AppCMS handler
export async function handleAppCms(query) {
  const q = parseQuery(query.url);
  if (q.ac === 'detail' || q.ids) return handleDetail(q);
  if (q.ac === 'videolist') return handleDetail({ ...q, ids: q.ids });
  return handleList(q);
}

// /play resolver — returns JSON with playable m3u8 (AppCMS-friendly)
export async function handlePlay(query) {
  const q = parseQuery(query.url);
  const params = new URL(query.url).searchParams;
  const vodId = params.get('vod_id') || params.get('vodId') || params.get('movie') || params.get('id') || q.vod_id || q.movie;
  const source = params.get('source') || 'gztv5';
  const episode = params.get('episode') ? parseInt(params.get('episode'), 10) : 1;

  if (!vodId) {
    return textBody('Missing vod_id', { 'Content-Type': 'text/plain; charset=utf-8' });
  }
  if (source !== 'gztv5') {
    return textBody(`Unknown source: ${source}`, { 'Content-Type': 'text/plain; charset=utf-8' });
  }

  const cacheKey = `play:${vodId}`;
  const { urls } = await getCached(cacheKey, DETAIL_TTL, () =>
    getOnePlayList(vodId, { maxPages: 20 })
  );

  // Episodes are 1-indexed by sort
  const ep = urls.find(u => Number(u.sort) === episode) || urls[0];
  if (!ep) {
    return textBody('Episode not found', { 'Content-Type': 'text/plain; charset=utf-8' });
  }

  return jsonBody({
    source,
    episode,
    name: ep.name,
    url: ep.url,
    resolution: ep.resolution || ''
  }, { cacheControl: 'public, max-age=1800' });
}

// /api/m3u8?url=... — pass-through proxy so players with referrer restrictions work
export async function handleM3u8(query) {
  const u = new URL(query.url);
  const target = u.searchParams.get('url');
  if (!target || !/^https:\/\//.test(target)) {
    return textBody('Missing or invalid url param', { 'Content-Type': 'text/plain; charset=utf-8' });
  }
  try {
    const res = await fetch(target, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
      }
    });
    const text = await res.text();
    // Rewrite relative segments to absolute
    const base = new URL(target);
    const dir = base.pathname.slice(0, base.pathname.lastIndexOf('/') + 1);
    const host = base.origin + dir;
    const rewritten = text.replace(/(?<!:)(?:\/[^:\s]+\.(?:ts|mp4|m4s))/gi, m =>
      m.startsWith('/') ? host.replace(/\/$/, '') + m : m
    ).replace(/^(?!\s|#|\n)([^#\s]+\.(?:ts|mp4|m4s))\s*$/gm, (m, seg) =>
      seg.startsWith('/') ? host.replace(/\/$/, '') + seg : host.replace(/\/$/, '') + '/' + seg
    );
    return textBody(rewritten, {
      'Content-Type': 'application/vnd.apple.mpegurl',
      'Cache-Control': 'public, max-age=600'
    });
  } catch (e) {
    return textBody('Upstream fetch failed: ' + e.message, {
      'Content-Type': 'text/plain; charset=utf-8'
    });
  }
}

// /catalog — quick browse endpoint
export async function handleCatalog() {
  const cacheKey = 'catalog:conditions';
  const data = await getCached(cacheKey, CONDITION_TTL, () => getCondition());
  return jsonBody(data);
}

// /health
export function handleHealth() {
  return jsonBody({
    status: 'ok',
    service: 'gztv-api',
    upstream: 'gztv5.com',
    cache: cacheStats(),
    ts: new Date().toISOString()
  });
}
