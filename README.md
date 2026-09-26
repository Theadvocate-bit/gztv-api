# gztv-api · 苹果 CMS V10 · EdgeOne Makers

瓜子影视上游 `https://gztv5.com`（`haiwaiapi.1fc8ab0.com` 主 / `api.txxhuc.com` 备）
→ AppCMS V10 标准接口（`/?ac=detail`、`?ac=list`、`?ac=videolist`）
→ 播放链接代理解析为**直连 m3u8**。

部署：腾讯云 EdgeOne Makers（`pages.edgeone.ai`），零配置，纯在线。

---

## 1. 快速使用

```bash
# 健康检查
curl 'https://<YOUR-EDGEONE-HOST>/?'
# 列表（首页）
curl 'https://<YOUR-EDGEONE-HOST>/?ac=list&page=1&limit=20'
# 分类：电影
curl 'https://<YOUR-EDGEONE-HOST>/?ac=list&type_id=1&limit=10'
# 详情：AppCMS 标准参数 ids=
curl 'https://<YOUR-EDGEONE-HOST>/?ac=detail&ids=3'
# 详情：id= 别名同样支持
curl 'https://<YOUR-EDGEONE-HOST>/?ac=detail&id=3'
# 直链解析
curl 'https://<YOUR-EDGEONE-HOST>/play?vod_id=3&episode=1'
# m3u8 代理
curl 'https://<YOUR-EDGEONE-HOST>/api/m3u8?url=https%3A%2F%2Fexample.com%2Fa.m3u8'
```

## 2. 分类对照（`type_id` 直接透传 gztv5 的 `t_id`）

| AppCMS `type_id` | 上游 `t_id` | 名称 |
|---|---|---|
| 1 | 1 | 电影 |
| 2 | 2 | 连续剧 / 电视剧 |
| 3 | 3 | 综艺 |
| 4 | 4 | 动漫 |
| 64 | 64 | 短剧 |
| 30 | 30 | 少儿 |
| 39 | 39 | 短剧解说 |
| 40 | 40 | 体育 |
| 70 | 70 | 电竞解说 |
| 71 | 71 | 体育解说 |
| 72 | 72 | 音乐 |
| 73 | 73 | 电影解说 |
| 74 | 74 | AI 漫剧 |

> 与苹果 CMS 惯例（1/2/3/4/40）不同的地方：短剧是 `64`，少儿是 `30`，另多出「电影解说 73 / 短剧解说 39 / AI 漫剧 74」等。**下游播放器请直接用这里的 `type_id`，不要重编号。**

## 3. AppCMS V10 接口规范

### 3.1 端点

| 端点 | 用途 |
|---|---|
| `/` | AppCMS V10 主入口（GET/POST） |
| `/api/appcms` | 同上，作为独立路由别名 |
| `/play?vod_id=X&episode=N` | 播放解析（返回直连 m3u8 JSON） |
| `/api/m3u8?url=...` | m3u8 代理转发（播放器受 referrer 限时用） |
| `/api/catalog` | 上游分类/条件树 |
| `/health` | 存活检查 + 缓存统计 |
| `/docs` | 人类可读的 API 文档 |

> EdgeOne Makers 是「**文件即路由**」模型（`edge-functions/index.js` → `/`、`edge-functions/api/appcms.js` → `/api/appcms`），不是单文件分发路径。因此我们**不能**创建 `api.php` 路径；下游客户端如需 `/api.php/provide/vod`，请在客户端配置里改为 `/api/appcms` 或直接使用根路径 `/`。

### 3.2 查询参数

| 参数 | 说明 |
|---|---|
| `ac` | 动作：`list` / `detail` / `videolist`。省略时按 `ids` 或 `type_id` 推断。 |
| `ids` 或 `id` 或 `movie` | 详情 id（AppCMS `vod_id`），AppCMS 惯例是复数 `ids`；我们兼容单数 `id`。 |
| `type_id` 或 `t` | 分类 id（见上表）。 |
| `wd` 或 `word` 或 `keyword` | 搜索关键词。 |
| `page` | 页码，从 1 起。 |
| `limit` | 每页条数，默认 20，最大 100。 |
| `by` | 排序：`time`（默认）/ `score` / `hits`。 |
| `raw` | 传 `1` 强制透传原始字段（调试用）。 |

### 3.3 响应格式（AppCMS V10 标准）

**顶层：**

```json
{
  "code": 1,
  "msg": "数据列表",
  "page": "1",
  "pagecount": "25",
  "limit": "20",
  "total": "500",
  "list": [ /* 8 字段项 */ ],
  "class": [ /* 全量分类树 */ ]
}
```

- `code = 1` 成功 / `code = 0` 资源不存在（对齐 hongniu / bfzy / dyttzy）
- `msg` 默认 `数据列表`（list）或 `详细信息`（detail）
- `page / pagecount / limit / total` **一律字符串**
- `class` **每次响应都返回**（客户端渲染分类导航用）

**list 项（8 字段）：**

```json
{
  "vod_id": "3",
  "vod_name": "宝可梦地平线",
  "type_id": 4,
  "type_name": "动漫",
  "vod_en": "",
  "vod_time": "2023-04-14",
  "vod_remarks": "更新至133集/全200集",
  "vod_play_from": "gztv5"
}
```

**detail 项（含 `vod_play_from` / `vod_play_url`，`$$$` 分隔源、`#` 分隔集）：**

```json
{
  "vod_id": "3",
  "vod_name": "宝可梦地平线",
  "type_id": 4,
  "type_id_1": 4,
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
  "vod_play_url": "1#https://...m3u8#2#https://...m3u8#...",
  "vod_total": "...",
  "vod_continu": "..."
}
```

## 4. 部署

EdgeOne Makers 是**文件即路由**：

```
edge-functions/
├── index.js              # → /
├── health.js             # → /health
├── docs.js               # → /docs
├── api/
│   ├── appcms.js         # → /api/appcms
│   ├── play.js           # → /play
│   ├── m3u8.js           # → /api/m3u8
│   └── catalog.js        # → /api/catalog
└── lib/                  # 共享模块（不打路由，被上面文件 import）
    ├── upstream.js       # gztv5 上游客户端（主备双写）
    ├── appcms.js         # AppCMS V10 格式化 + 分类字典
    ├── appcms_handlers.js  # 各 handler 的实际实现
    └── cache.js          # 内存 LRU + 可选上游持久化
```

**关键约束：** 所有 `import` 必须落在 `edge-functions/` 内部，EdgeOne 不会把树外的文件打包进去。`tools/smoke_test.mjs` 里有一条断言专门验证这一点。

**部署步骤：**

1. 把仓库推到 GitHub（`Theadvocate-bit/gztv-api`，`main` 分支）。
2. 打开 <https://pages.edgeone.ai/> → 新建项目 → 选 GitHub 仓库 → 关联。
3. EdgeOne 自动识别 `edge-functions/` 目录（见 `edgeone.json`）。
4. 部署完成后拿到 `https://<your-sub>.<your-domain>`。

## 5. 缓存

内存 LRU 512 条，各端点 TTL：

- list 10 min
- detail 30 min
- play 30 min
- catalog 24 h

**跨实例持久化（可选）：** 在 EdgeOne Makers 控制台配置两个环境变量后，缓存会写入共享上游：

- `CACHE_UPSTREAM_URL` — 共享缓存服务 URL
- `CACHE_UPSTREAM_KEY` — 访问密钥

未配置时缓存仅在单实例内存里，边缘函数冷启动后会重建。

## 6. 测试

```bash
cd gztv-api
node tools/smoke_test.mjs       # 25/25 单元测试，不需要网络
node tools/integration_test.mjs # 10/10 集成测试，需要访问 gztv5 上游
```

测试覆盖：上游双主备、主备故障切换、缓存读写、AppCMS 详情/列表/搜索/分类、播放解析、m3u8 代理、错误路径、id/ids 别名、EdgeOne 打包边界（无越界 import）。

## 7. 安全

- 无鉴权（当前是公开 API）。
- **建议**：GitHub PAT 完成后 revoke，换成 SSH key 或 fine-grained PAT（仅 `repo` 权限）。
- 播放链接代理解析后是**直连 m3u8**，不经过我们的 CDN —— 上游限流或防盗链失效时直接失败，符合"纯在线"约定。

---

EdgeOne Makers · AppCMS V10 · 瓜子影视上游 · 纯在线 · 零配置
