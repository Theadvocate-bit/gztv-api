// AppCMS V10 formatting utilities
// Reference format: https://github.com/hbjulihg/appcms-protocol

// gztv5 t_id  -> AppCMS type_id  (nearly 1:1)
// gztv5 t_id meanings: 1=电影 2=连续剧 3=综艺 4=动漫 64=短剧
export const TYPE_MAP = {
  1:  1,  // 电影
  2:  2,  // 连续剧 / 电视剧
  3:  3,  // 综艺
  4:  4,  // 动漫
  64: 64, // 短剧
  30: 30, // 少儿
  40: 40, // 体育
  73: 73, // 电影解说
  39: 39, // 短剧解说
  74: 74, // AI 漫剧
  70: 70, // 电竞解说
  71: 71, // 体育解说
  72: 72  // 音乐
};

export const TYPE_NAMES = {
  1: '电影', 2: '电视剧', 3: '综艺', 4: '动漫', 64: '短剧',
  30: '少儿', 40: '体育', 73: '电影解说', 39: '短剧解说',
  74: 'AI漫剧', 70: '电竞解说', 71: '体育解说', 72: '音乐'
};

// Convert an upstream list item (from Search/GetConditionList.list[])
// to AppCMS V10 minimal list item (8 fields + optional type_id / type_name).
export function formatListItem(item) {
  const typeId = TYPE_MAP[item.t_id] ?? item.t_id;
  const typeName = TYPE_NAMES[item.t_id] || (TYPE_NAMES[typeId] || '');
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

// Convert upstream vodInfo + playList[] to AppCMS V10 detail item (83 fields).
// vod_play_from uses $$$ separator, vod_play_url: source$$$episode1#episode2#...
export function formatDetailItem(vodInfo, playList, typeIdOverride) {
  // Prefer explicit override (from query type_id) when set to a valid id
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

  // vod_actor / vod_director: single comma-separated string from upstream
  const vodActor = typeof vodInfo.vod_actor === 'string'
    ? vodInfo.vod_actor
    : Array.isArray(vodInfo.vod_actor) ? vodInfo.vod_actor.join(',') : '';

  const vodDirector = typeof vodInfo.vod_directed === 'string'
    ? vodInfo.vod_directed
    : Array.isArray(vodInfo.vod_directed) ? vodInfo.vod_directed.join(',') : '';

  return {
    vod_id: String(vodInfo.vod_id),
    vod_name: vodInfo.vod_name || '',
    type_id: typeId,
    type_name: typeName,
    vod_en: '',
    vod_time: vodInfo.vod_year || vodInfo.vod_filmtime || '',
    vod_year: vodInfo.vod_year || '',
    vod_area: vodInfo.vod_area || '',
    vod_class: (vodInfo.d_class || '').replace(/(^|,)0(,|$)/g, '$1').replace(/^,|,$/g, ''),
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
    vod_tags: (vodInfo.videoTag || []).join(','),
    vod_total: vodInfo.vod_total || '',
    vod_continu: vodInfo.vod_continu || '',
    is_end: vodInfo.is_end ? '1' : '0',
    vod_updatetime: '',
    vod_addtime: vodInfo.vod_addtime || ''
  };
}

// Build the /class list exposed on every AppCMS V10 response.
export function buildClassList() {
  const list = Object.keys(TYPE_NAMES).map(k => {
    const id = parseInt(k, 10);
    return {
      type_id: id,
      type_name: TYPE_NAMES[id],
      type_pid: 0,
      type_img: '',
      type_desc: '',
      type_seq: id,
      type_sort: id,
      type_count: '',
      type_check: ''
    };
  });
  // Ensure 电影/连续剧/综艺/动漫/短剧 first for UI stability
  const priority = [1, 2, 3, 4, 64];
  list.sort((a, b) => {
    const ai = priority.indexOf(a.type_id);
    const bi = priority.indexOf(b.type_id);
    if (ai >= 0 && bi >= 0) return ai - bi;
    if (ai >= 0) return -1;
    if (bi >= 0) return 1;
    return a.type_id - b.type_id;
  });
  return list;
}

// Top-level response envelope
export function envelope({ code = 200, msg = '请求成功', page = 1, pagecount = 1, limit = 20, total = 0, list = [] }) {
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

// Parse AppCMS-style query params into normalized form
export function parseQuery(url) {
  const u = new URL(url);
  const q = Object.fromEntries(u.searchParams.entries());
  return {
    ac: q.ac || (q.ids || q.type_id ? 'detail' : 'list'),
    ids: q.ids || '',
    type_id: q.type_id ? parseInt(q.type_id, 10) : (q.t ? parseInt(q.t, 10) : 0),
    wd: q.wd || q.word || q.keyword || '',
    page: q.page ? parseInt(q.page, 10) : 1,
    limit: q.limit ? parseInt(q.limit, 10) : 20,
    by: q.by || 'time',
    t: q.t ? parseInt(q.t, 10) : 0,
    raw: q.raw === '1'
  };
}

// CORS helper — permissive for AppCMS integration
export function withCors(headers, opts = {}) {
  const out = {
    ...headers,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  };
  if (opts.cacheControl) out['Cache-Control'] = opts.cacheControl;
  return out;
}
