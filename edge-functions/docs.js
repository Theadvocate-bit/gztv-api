// edge-functions/docs.js — GET /docs
// Human-readable API documentation page

import { corsHeaders } from './lib/appcms.js';

const HTML = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>gztv-api · 苹果 CMS V10 · EdgeOne Makers</title>
<style>
:root{--bg:#0d1117;--fg:#e6edf3;--muted:#8b949e;--card:#161b22;--border:#30363d;--accent:#2fe6af;--code:#0b1220}
*{box-sizing:border-box}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif;background:var(--bg);color:var(--fg);line-height:1.6}
.wrap{max-width:920px;margin:0 auto;padding:32px 20px 80px}
h1{font-size:28px;margin:0 0 4px}
h1 span{color:var(--accent)}
.sub{color:var(--muted);margin-bottom:32px}
h2{margin:32px 0 12px;font-size:18px;padding-bottom:6px;border-bottom:1px solid var(--border)}
h3{margin:20px 0 8px;font-size:15px;color:var(--muted)}
.card{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:16px 20px;margin:12px 0}
.pill-row{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}
.pill{background:#0b1220;border:1px solid var(--border);padding:6px 12px;border-radius:999px;font-size:13px;color:var(--fg);text-decoration:none}
.pill:hover{border-color:var(--accent);color:var(--accent)}
code,pre{font-family:"SF Mono",Menlo,Consolas,monospace}
code{background:#0b1220;padding:2px 6px;border-radius:4px;font-size:13px}
pre{background:#0b1220;padding:14px 16px;border-radius:6px;overflow:auto;font-size:13px;border:1px solid var(--border)}
.kv{display:grid;grid-template-columns:1fr 2fr;gap:8px 20px;font-size:14px}
.kv b{color:var(--muted);font-weight:500}
table{width:100%;border-collapse:collapse;margin:8px 0;font-size:14px}
th,td{padding:8px 12px;border-bottom:1px solid var(--border);text-align:left}
th{color:var(--muted);font-weight:500}
.tag{display:inline-block;background:#0b1220;padding:2px 8px;border-radius:4px;color:var(--accent);font-size:12px;margin-right:4px}
</style>
</head>
<body>
<div class="wrap">
<h1>🎬 <span>gztv-api</span> · 苹果 CMS V10</h1>
<div class="sub">瓜子影视上游 <code>https://gztv5.com</code> · 直链解析 · EdgeOne Makers 边缘部署</div>

<div class="pill-row">
  <a class="pill" href="/?ac=list">列表</a>
  <a class="pill" href="/?ac=list&type_id=1">电影</a>
  <a class="pill" href="/?ac=list&type_id=2">连续剧</a>
  <a class="pill" href="/?ac=list&type_id=3">综艺</a>
  <a class="pill" href="/?ac=list&type_id=4">动漫</a>
  <a class="pill" href="/?ac=list&type_id=64">短剧</a>
  <a class="pill" href="/?ac=detail&ids=3">详情示例</a>
  <a class="pill" href="/api/catalog">分类树</a>
  <a class="pill" href="/health">健康检查</a>
</div>

<h2>快速接入</h2>
<div class="card">
<p>苹果 CMS V10 采集地址：</p>
<pre>https://${'$HOST'}/api.php/provide/vod</pre>
<p>TVBox 直链地址（返回 m3u8）：</p>
<pre>https://${'$HOST'}/play?vod_id=3&amp;episode=1</pre>
</div>

<h2>AppCMS V10 接口规范</h2>
<div class="card">
<div class="kv">
<b>端点</b><span><code>/</code> <code>/api.php/provide/vod</code> <code>/api/appcms</code></span>
<b>方法</b><span><code>GET</code> / <code>POST</code></span>
<b>动作</b><span><code>ac=list</code> 列表 · <code>ac=detail</code> 详情 · <code>ac=videolist</code> 视频列表</span>
</div>
</div>

<h3>参数</h3>
<table>
<thead><tr><th>参数</th><th>说明</th></tr></thead>
<tbody>
<tr><td><code>ac</code></td><td>动作。<code>list</code> / <code>detail</code> / <code>videolist</code>。省略时按 <code>ids</code> 或 <code>type_id</code> 推断。</td></tr>
<tr><td><code>ids</code> / <code>movie</code></td><td>详情 id，AppCMS 主键 <code>vod_id</code>。等价于上游 <code>vod_id</code>。</td></tr>
<tr><td><code>type_id</code> / <code>t</code></td><td>分类 id。<code>1</code>=电影 <code>2</code>=连续剧 <code>3</code>=综艺 <code>4</code>=动漫 <code>64</code>=短剧。</td></tr>
<tr><td><code>wd</code> / <code>word</code> / <code>keyword</code></td><td>搜索关键词。</td></tr>
<tr><td><code>page</code></td><td>页码，从 1 起。</td></tr>
<tr><td><code>limit</code></td><td>每页条数，默认 20，最大 100。</td></tr>
<tr><td><code>by</code></td><td>排序：<code>time</code>(默认) / <code>score</code> / <code>hits</code>。</td></tr>
</tbody>
</table>

<h3>示例请求</h3>
<pre># 全部列表
curl 'https://${'$HOST'}/?ac=list&amp;page=1&amp;limit=20'

# 电影分类
curl 'https://${'$HOST'}/?ac=list&amp;type_id=1&amp;page=1'

# 搜索「肖」
curl 'https://${'$HOST'}/?ac=list&amp;wd=肖'

# 详情
curl 'https://${'$HOST'}/?ac=detail&amp;ids=3'</pre>

<h2>响应格式（AppCMS V10 标准）</h2>
<div class="card">
<p>顶层：</p>
<pre>{
  "code": 1,
  "msg": "数据列表",
  "page": "1",
  "pagecount": "25",
  "limit": "20",
  "total": "500",
  "list": [...],
  "class": [...]
}</pre>
<p>列表项（8 字段，逗号分隔源）：</p>
<pre>{
  "vod_id": "3",
  "vod_name": "宝可梦地平线",
  "type_id": 4,
  "type_name": "动漫",
  "vod_en": "",
  "vod_time": "2023-04-14",
  "vod_remarks": "更新至133集/全200集",
  "vod_play_from": "gztv5"
}</pre>
<p>详情项（<code>$$$</code> 分隔源，<code>#</code> 分隔集）：</p>
<pre>{
  "vod_id": "3",
  "vod_name": "宝可梦地平线",
  "type_id": 4,
  "type_name": "动漫",
  "vod_year": "2023-04-14",
  "vod_area": "日本",
  "vod_class": "98",
  "vod_score": "7.9",
  "vod_actor": "铃木实里,寺崎裕香,...",
  "vod_director": "传沙织",
  "vod_content": "...",
  "vod_pic": "https://...",
  "vod_play_from": "gztv5",
  "vod_play_url": "01#https://...m3u8#02#https://...m3u8#..."
}</pre>
</div>

<h2>运维端点</h2>
<table>
<thead><tr><th>端点</th><th>说明</th></tr></thead>
<tbody>
<tr><td><code>/health</code></td><td>存活检查 + 缓存统计</td></tr>
<tr><td><code>/api/catalog</code></td><td>上游分类树（地区/年份/类型）</td></tr>
<tr><td><code>/play?vod_id=X&amp;episode=N</code></td><td>解析为直链 JSON（供 TVBox 等消费）</td></tr>
<tr><td><code>/api/m3u8?url=...</code></td><td>m3u8 代理转发（播放器 referrer 受限时用）</td></tr>
</tbody>
</table>

<h2>分类对照</h2>
<table>
<thead><tr><th>AppCMS type_id</th><th>上游 t_id</th><th>名称</th></tr></thead>
<tbody>
<tr><td><code>1</code></td><td>1</td><td>电影</td></tr>
<tr><td><code>2</code></td><td>2</td><td>连续剧 / 电视剧</td></tr>
<tr><td><code>3</code></td><td>3</td><td>综艺</td></tr>
<tr><td><code>4</code></td><td>4</td><td>动漫</td></tr>
<tr><td><code>64</code></td><td>64</td><td>短剧</td></tr>
<tr><td><code>30</code></td><td>30</td><td>少儿</td></tr>
<tr><td><code>40</code></td><td>40</td><td>体育</td></tr>
<tr><td><code>73</code></td><td>73</td><td>电影解说</td></tr>
<tr><td><code>39</code></td><td>39</td><td>短剧解说</td></tr>
<tr><td><code>74</code></td><td>74</td><td>AI 漫剧</td></tr>
<tr><td><code>70</code></td><td>70</td><td>电竞解说</td></tr>
<tr><td><code>71</code></td><td>71</td><td>体育解说</td></tr>
<tr><td><code>72</code></td><td>72</td><td>音乐</td></tr>
</tbody>
</table>

<h2>技术栈</h2>
<div class="card">
<span class="tag">EdgeOne Makers</span>
<span class="tag">Edge Functions</span>
<span class="tag">AppCMS V10</span>
<span class="tag">纯在线</span>
<span class="tag">零配置部署</span>
</div>
<p style="color:var(--muted);font-size:13px">
代码在 <code>edge-functions/</code> 单目录内（文件即路由 + lib/ 共享模块），符合 EdgeOne 打包边界。
上游 <code>haiwaiapi.1fc8ab0.com</code> 主备双写，故障自动切换。
</p>

</div>
<script>
// Replace $HOST placeholders with current host
const host = location.hostname + (location.port ? ':' + location.port : '');
document.querySelectorAll('pre, code').forEach(el => {
  if (el.textContent && el.textContent.includes('$HOST')) {
    el.innerHTML = el.innerHTML.replace(/\\\$HOST/g, host);
  }
});
</script>
</body>
</html>`;

export async function onRequest(context) {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders({}) });
  }

  return new Response(HTML, {
    status: 200,
    headers: corsHeaders({
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300'
    })
  });
}
