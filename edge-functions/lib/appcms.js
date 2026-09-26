// AppCMS V10 formatting utilities
// Aligns with hongniu / bfzy / dyttzy standard response:
//   top-level: { code:1, msg, page, pagecount, limit, total, list, class }

export const TYPE_MAP = {
  1:  1,   // 电影
  2:  2,   // 连续剧 / 电视剧
  3:  3,   // 综艺
  4:  4,   // 动漫
  30: 30,  // 少儿
  39: 39,  // 短剧解说
  40: 40,  // 体育
  64: 64,  // 短剧
  70: 70,  // 电竞解说
  71: 71,  // 体育解说
  72: 72,  // 音乐
  73: 73,  // 电影解说
  74: 74   // AI 漫剧
};

export const TYPE_NAMES = {
  1: '电影', 2: '电视剧', 3: '综艺', 4: '动漫', 64: '短剧',
  30: '少儿', 39: '短剧解说', 40: '体育',
  70: '电竞解说', 71: '体育解说', 72: '音乐',
  73: '电影解说', 74: 'AI漫剧'
};

// Convert upstream list item -> AppCMS V10 minimal list item (8 fields)
export function formatListItem(item) {
  const typeId = TYPE_MAP[item.t_id] ?? item.t_id;
  const typeName = TYPE_NAMES[item.t_id] || TYPE_NAMES[typeId] || '';
  return {
    vod_id: String(item.vod_id),
    vod_name: item.vod_name || '',
    type_id: typeId,
    type_name: typeName,
    vod_en: '',
    vod_time: item.vod_filmtime || item.vod_year || '',
    vod_remarks: item.new_continue || item.vod_continu || item.vod_remarks || '',
    vod_play_from: 'gztv5'
  };
}

// Convert upstream vodInfo + playList[] -> AppCMS V10 detail item (83 fields)
// vod_play_from: $$$-separated sources
// vod_play_url: source$$$episode1#episode2#...  each "name$url"
export function formatDetailItem(vodInfo, playList, typeIdOverride) {
  let typeId;
  if (typeIdOverride && typeIdOverride > 0) {
    typeId = typeIdOverride;
  } else {
    typeId = TYPE_MAP[vodInfo.t_id] ?? vodInfo.t_id;
  }
  const typeName = TYPE_NAMES[typeId] || TYPE_NAMES[vodInfo.t_id] || '';

  const eps = playList || [];
  const playFrom = 'gztv5';
  const playUrl = eps
    .map(e => `${e.name || e.sort || ''}#${e.url || ''}`)
    .join('#');

  const vodActor = typeof vodInfo.vod_actor === 'string'
    ? vodInfo.vod_actor
    : Array.isArray(vodInfo.vod_actor) ? vodInfo.vod_actor.join(',') : '';

  const vodDirector = typeof vodInfo.vod_directed === 'string'
    ? vodInfo.vod_directed
    : Array.isArray(vodInfo.vod_directed) ? vodInfo.vod_directed.join(',') : '';

  const vodTags = (vodInfo.videoTag || []).join(',');

  //vod_class: strip the leading/trailing zero entries (",98,0," -> "98")
  let vodClass = vodInfo.d_class || '';
  if (vodClass) {
    const parts = vodClass.split(',').filter(p => p && p !== '0');
    vodClass = parts.join(',');
  }

  return {
    vod_id: String(vodInfo.vod_id),
    vod_name: vodInfo.vod_name || '',
    type_id: typeId,
    type_id_1: typeId,
    type_name: typeName,
    vod_en: '',
    vod_time: vodInfo.vod_year || vodInfo.vod_filmtime || '',
    vod_year: vodInfo.vod_year || '',
    vod_area: vodInfo.vod_area || '',
    vod_class: vodClass,
    vod_score: vodInfo.vod_scroe || '',
    vod_blurb: vodInfo.vod_title || '',
    vod_remarks: vodInfo.vod_continu || '',
    vod_actor: vodActor,
    vod_director: vodDirector,
    vod_content: vodInfo.vod_use_content || '',
    vod_pic: vodInfo.pic || '',
    vod_play_from: playFrom,
    vod_play_url: playUrl,
    vod_douban_id: '',
    vod_douban_score: vodInfo.vod_scroe || '',
    vod_hits: '',
    vod_hits_updatetime: '',
    vod_play_from2: '',
    vod_play_url2: '',
    vod_groups: '',
    vod_tags: vodTags,
    vod_total: vodInfo.vod_total || '',
    vod_continu: vodInfo.vod_continu || '',
    is_end: vodInfo.is_end ? '1' : '0',
    vod_updatetime: '',
    vod_addtime: vodInfo.vod_addtime || ''
  };
}

// Build the /class list exposed on every AppCMS V10 response
export function buildClassList() {
  const ids = Object.keys(TYPE_NAMES).map(k => parseInt(k, 10));
  const priority = [1, 2, 3, 4, 64];
  ids.sort((a, b) => {
    const ai = priority.indexOf(a);
    const bi = priority.indexOf(b);
    if (ai >= 0 && bi >= 0) return ai - bi;
    if (ai >= 0) return -1;
    if (bi >= 0) return 1;
    return a - b;
  });
  return ids.map(id => ({
    type_id: id,
    type_name: TYPE_NAMES[id],
    type_pid: 0,
    type_img: '',
    type_desc: '',
    type_seq: id,
    type_sort: id,
    type_count: '',
    type_check: ''
  }));
}

// Top-level response envelope.
//   code=1: success (list)     msg="数据列表"
//   code=1: success (detail)   msg="详细信息"
//   code=0: not found / error  msg=custom
export function envelope({ code = 1, msg = '数据列表', page = 1, pagecount = 1, limit = 20, total = 0, list = [] }) {
  return {
    code,
    msg,
    page: String(page),
    pagecount: String(pagecount),
    limit: String(limit),
    total: String(total),
    list,
    class: buildClassList()
  };
}

export function detailEnvelope({ ids, msg = '详细信息', page = 1, pagecount = 1, limit = 1, total = 1, list = [] }) {
  return envelope({ code: 1, msg, page, pagecount, limit, total, list });
}

export function errorEnvelope({ msg = '资源不存在或已下架', page = 1, pagecount = 1, limit = 20, total = 0 }) {
  return envelope({ code: 0, msg, page, pagecount, limit, total, list: [] });
}

// Parse AppCMS-style query params
export function parseQuery(url) {
  const u = new URL(url);
  const q = Object.fromEntries(u.searchParams.entries());
  const ids = q.ids || q.movie || '';
  return {
    ac: q.ac || (ids ? 'detail' : 'list'),
    ids,
    type_id: q.type_id ? parseInt(q.type_id, 10) : (q.t ? parseInt(q.t, 10) : 0),
    wd: q.wd || q.word || q.keyword || '',
    page: q.page ? parseInt(q.page, 10) : 1,
    limit: q.limit ? parseInt(q.limit, 10) : 20,
    by: q.by || 'time',
    t: q.t ? parseInt(q.t, 10) : 0,
    raw: q.raw === '1'
  };
}

// CORS headers helper
export function corsHeaders(extra = {}) {
  return {
    ...extra,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  };
}
