# gztv-api

苹果 CMS V10 (AppCMS V10) API · 上游对接 <https://gztv5.com/> · 边缘函数部署于 EdgeOne Makers

![status](https://img.shields.io/badge/upstream-gztv5-green)
![deploy](https://img.shields.io/badge/platform-EdgeOne%20Makers-orange)
![format](https://img.shields.io/badge/API-AppCMS%20V10-blue)
![mode](https://img.shields.io/badge/mode-pure-online-purple)

## 特性

- 🎯 **AppCMS V10 完全对齐** — 顶层 `{code, msg, page, pagecount, limit, total, list, class}`，`$$$` 分隔源、`#` 分隔集、列表 8 字段
- 🎬 **上游 gztv5.com** — 自动对接 `haiwaiapi.1fc8ab0.com` / `api.txxhuc.com` 双主备
- 🔗 **播放解析直链** — 直接返回 m3u8 可播地址，无需二次解
- ☁️ **纯在线部署** — EdgeOne Makers 边缘函数，零外部依赖，无数据库
- 🛡️ **零配置** — 无 token / secret 需求，直接部署即用

## 快速开始

```bash
# 直接部署（EdgeOne Makers 拉 GitHub 仓库自动部署）
gh repo create Theadvocate-bit/gztv-api --public --source ./gztv-api

# 本地开发/测试
node tools/smoke_test.mjs
```

## 苹果 CMS 集成

在苹果 CMS V10 后台的**资源管理**里添加采集地址：

```
https://<your-edgeone-host>/api.php/provide/vod
```

### 端点

| 路径 | 说明 |
|------|------|
| `/` | AppCMS V10 主入口（支持 `?ac=list` / `?ac=detail` / `?ids=` / `?type_id=` / `?wd=` / `?page=` / `?limit=`） |
| `/api.php/provide/vod` | 苹果 CMS 采集标准路径 |
| `/api/appcms` | AppCMS 别名 |
| `/api.php` | AppCMS 别名 |
| `/health` | 健康检查 |
| `/api/catalog` | 上游分类树（地区/年份/类型） |
| `/play?vod_id=X&episode=N` | 解析为直链 JSON |
| `/api/m3u8?url=...` | m3u8 代理转发（播放器 referrer 受限时用） |
| `/docs` | 完整 API 文档 |

### 示例请求

```bash
# 列表
curl 'https://<host>/?ac=list&page=1&limit=20'

# 电影分类
curl 'https://<host>/?ac=list&type_id=1'

# 连续剧
curl 'https://<host>/?ac=list&type_id=2'

# 动漫
curl 'https://<host>/?ac=list&type_id=4'

# 搜索
curl 'https://<host>/?ac=list&wd=肖'

# 详情（含所有分集直链）
curl 'https://<host>/?ac=detail&ids=3'

# 解析单集直链
curl 'https://<host>/play?vod_id=3&episode=1'
```

### 响应示例（AppCMS V10）

**列表**：

```json
{
  "code": 200,
  "msg": "请求成功",
  "page": "1",
  "pagecount": "500",
  "limit": "20",
  "total": "10000",
  "list": [
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
  ],
  "class": [{"type_id":1,"type_name":"电影",...}]
}
```

**详情**：

```json
{
  "code": 200,
  "msg": "请求成功",
  "page": "1",
  "pagecount": "1",
  "limit": "1",
  "total": "1",
  "list": [
    {
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
      "vod_content": "剧情简介...",
      "vod_pic": "https://...",
      "vod_play_from": "gztv5",
      "vod_play_url": "01#https://...m3u8#02#https://...m3u8"
    }
  ],
  "class": [...]
}
```

## 分类对照

| AppCMS `type_id` | 上游 `t_id` | 名称 |
|:-:|:-:|:-|
| `1` | `1` | 电影 |
| `2` | `2` | 电视剧 / 连续剧 |
| `3` | `3` | 综艺 |
| `4` | `4` | 动漫 |
| `64` | `64` | 短剧 |
| `30` | `30` | 少儿 |
| `40` | `40` | 体育 |
| `73` | `73` | 电影解说 |
| `39` | `39` | 短剧解说 |
| `74` | `74` | AI 漫剧 |

## 部署到 EdgeOne Makers

1. **建仓库**：`gh repo create Theadvocate-bit/gztv-api --public --source ./gztv-api`
2. **建 EdgeOne Makers 项目**：控制台 → 关联 GitHub 仓库 → 分支选 `main`
3. **构建配置**：`edgeone.json` 已经声明 `"functions": "./edge-functions"`，无需额外配置
4. **推送代码**：`git push` 后 EdgeOne 自动部署
5. **验证**：`curl https://<domain>/health`

### 环境变量（可选）

无必需环境变量。以下可选：

| 变量 | 用途 |
|------|------|
| `CACHE_UPSTREAM_URL` | 外部缓存 URL，开启跨实例持久化 |
| `CACHE_UPSTREAM_KEY` | 缓存服务 Bearer token |

## 项目结构

```
edge-functions/           # EdgeOne Makers 打包边界（唯一被打包的目录）
├── index.js              # 请求路由（路径 → handler）
├── api.js                # AppCMS V10 handlers
└── lib/
    ├── upstream.js       # 上游 HTTP 客户端（双主备 failover）
    ├── appcms.js         # AppCMS V10 格式化 + 分类字典
    └── cache.js          # LRU 缓存（可选上游持久化）
tools/
└── smoke_test.mjs        # 纯函数单测（无网络）
edgeone.json              # {"functions": "./edge-functions"}
.gitignore
README.md
```

## 架构说明

```
┌──────────────┐   ┌─────────────────────┐   ┌────────────────────────────┐
│ 苹果 CMS/TVBox│──▶│ gztv-api (EdgeOne)  │──▶│ 上游 gztv5 后端             │
│              │◀──│ /api.php/provide/vod │◀──│ haiwaiapi.1fc8ab0.com      │
│              │   │ /play                │   │ api.txxhuc.com (fallback)  │
└──────────────┘   └─────────────────────┘   └────────────────────────────┘
                            │
                            ▼
                     m3u8 直链 (wjm.eny7kg.com)
```

**核心链路**：

- `Search/GetConditionList` → 列表页 + 分页 + 分类过滤
- `Resource/GetVodInfo` → 详情元数据
- `Resource/GetOnePlayList` → 分集 m3u8 直链（分页 24/页）

**缓存策略**：

- 列表 10 分钟
- 详情 / 分集 30 分钟
- 分类树 24 小时

**边界**：所有代码在 `edge-functions/` 单目录内，符合 EdgeOne 打包规则（不能引用目录外文件）。

## 已知问题

- 上游 `Search/GetConditionList` 的 `column` 参数被忽略，本项目通过**客户端过滤 + 翻页补量**方式兜底（对 `type_id` 生效）
- 上游密钥轮转时（历史上 `appsecretkey168` → `192`）本项目**不依赖任何密钥**，无兼容负担
- 上游接口若做破坏性变更，`lib/upstream.js` 一处修改即可适配

## 合规声明

本项目仅为技术演示：上游数据来自 gztv5.com 公开网页与其公开 API，播放地址由上游返回，本项目仅做**格式转换与直链透传**，不存储任何视频内容。请合理使用，遵守当地法规。

## License

MIT
