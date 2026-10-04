# 同类开源项目调研与借鉴

## 调研时间
2026-10-03

## 1. 成熟产品参考

### daily.dev (dailydotdev/daily)
- **定位**：开发者个性化新闻流，浏览器新标签页 + WebApp + 移动端
- **技术栈**：前端 Preact/Vue/React，后端 Node.js + Go，PostgreSQL，Algolia 搜索，GCP Pub/Sub
- **架构亮点**：
  - 前后端分离多仓库：`apps`(前端), `api`(单体 API), `gateway`(网关), `scraper`(网页抓取), `functions`(Cloud Functions 摄取内容)
  - **标签/来源过滤 + 个性化推荐**
  - 书签同步、已读/未读、PWA、原生广告
- **可借鉴点**：
  - 引入「标签(tag)」与「来源(source)」双维度过滤
  - 文章卡片增加「书签/已读」状态
  - 增加 "Read Later" 列表
  - 增加 OPML 导入/导出，让用户可自定义 RSS 源

### FreshRSS (FreshRSS/FreshRSS)
- **定位**：自托管 RSS 聚合器，PHP + SQLite/PostgreSQL/MySQL
- **亮点**：
  - WebSub 推送、XPath 网页抓取
  - 分类(folder)、收藏(star)、全文搜索
  - REST API / Fever API 兼容第三方客户端
  - 多用户、插件系统
- **可借鉴点**：
  - 用 folder/category 组织源
  - 给文章增加「收藏/加星」和「已读标记」
  - 提供 RSS/JSON Feed 输出，让别人也能订阅我们的日报
  - 添加正则过滤/关键词过滤

### Hacker News Weekly (headllines/hackernews-weekly)
- **定位**：用 GitHub Actions 每周自动发布 HN Top 10
- **技术**：Node.js + GitHub Issues 存储 + RSSHub 分发
- **亮点**：
  - 完全无服务器，用 GitHub Issues 当数据库/展示层
  - 用 GitHub Actions Cron 自动执行
  - 用 RSSHub 把 Issues 转成 RSS
- **可借鉴点**：
  - 可以增加 GitHub Actions 工作流作为免费托管方案
  - 生成静态 RSS/XML 输出，方便播客/阅读器订阅
  - 日报可以导出为 Markdown 存档

## 2. 小型/单体项目参考

### Latest Tech News Digest (mariaoliv/latest_tech_news)
- **定位**：Python + React 的科技日报
- **亮点**：
  - LangGraph 工作流：搜索 → 去重 → 摘要 → 合并
  - 多 API 源(GNews/NewsAPI/TheNewsAPI)
  - React + Vite + Tailwind 卡片式 UI
- **可借鉴点**：
  - 把生成日报做成可观察的工作流
  - 使用 LLM 给文章生成中文摘要（可选升级）
  - 前端文章卡片支持 Markdown 渲染

### Cosmic Digest (NaxeCode/Cosmic-Digest)
- **定位**：.NET + GPT 邮件日报
- **亮点**：
  - 根据用户偏好关键词/主题/地区打分
  - GPT 写 AI Summary
  - 每日一道算法/系统设计题
  - GitHub Actions 免费运行
- **可借鉴点**：
  - 用户偏好设置（关键词、主题、屏蔽词）
  - AI 摘要 + 每日一题/每日一工具
  - 邮件推送（Resend）

### hacker-news-podcast (yourtion/hacker-news)
- **定位**：AI 抓取 HN 热门 → 中文摘要 → 播客音频
- **亮点**：
  - Next.js + Cloudflare Workers
  - Edge TTS 生成中文播报
  - RSS feed 输出
- **可借鉴点**：
  - 生成音频/播客版日报（未来可扩展）
  - RSS feed 输出是标准做法

### AI RSS 增强类项目
- **RSSbrew / Precis / RSS-Master**：多源聚合 + 自定义过滤 + AI 摘要
- **TrendRadar**：多渠道推送（微信/飞书/钉钉/Telegram/邮件）
- **BestBlogs**：LLM 摘要 + 评分辅助阅读
- **Folo (RSSNext)**：现代 AI RSS 阅读器，39k star

## 3. 值得加入我们项目的关键功能

### 3.1 数据模型增强
- `tags`：给文章自动打标签（AI/前端/后端/开源/创业）
- `stars` / `read`：收藏与已读状态
- `categories` / `folders`：信息源分组
- `blacklist_keywords`：用户屏蔽关键词

### 3.2 后端 API 增强
- `GET /api/articles/bookmarks`：收藏列表
- `POST /api/articles/:id/star`：收藏/取消收藏
- `POST /api/articles/:id/read`：标记已读
- `GET /api/digests/:id/rss`：导出日报为 RSS
- `GET /api/digests/:id/markdown`：导出 Markdown
- `POST /api/import/opml`：导入 RSS 源
- `GET /api/export/opml`：导出 RSS 源
- `GET /api/trends`：关键词趋势统计

### 3.3 前端 UI 增强
- 文章卡片：书签按钮、已读标记、标签云
- 阅读模式：内嵌原文或摘要
- 过滤面板：关键词/来源/标签/时间
- 主题切换：已完成，可加入跟随系统
- 移动端 PWA：manifest + service worker
- 空状态骨架屏

### 3.4 自动化与部署
- GitHub Actions 工作流：每日自动生成 + 静态 RSS
- Dockerfile
- 环境变量配置（不要硬编码端口、密钥）

## 4. 与竞品的差异化定位

我们的 News Digest 走 **"轻量自托管 + 开发者向 + 多源聚合 + 本地优先"** 路线：

| 特性 | daily.dev | FreshRSS | 我们的 News Digest |
|------|-----------|----------|------------------|
| 自托管 | 否（云服务） | 是 | 是 |
| 部署复杂度 | 高（多服务） | 中（PHP+DB） | 低（Node + SQLite 单文件） |
| 社区源 | 2000+ 预制 | 需自己添加 | HN/GitHub/V2EX/掘金/PH 内置 |
| AI 摘要 | 部分有 | 插件实现 | 可选集成（预留接口） |
| 生成日报 | 实时流 | 实时流 | 主动生成 + 历史归档 |
| 目标用户 | 泛开发者 | RSS 重度用户 | 想每天快速扫一遍热点的开发者 |

## 5. 下一步优化重点

1. **先让项目跑起来**：修复依赖/环境，验证 API 和前端
2. **加书签 + 已读**：最轻量但有价值的交互
3. **加 RSS/Markdown 导出**：让日报可被外部订阅
4. **加标签自动分类**：基于关键词规则简单分类
5. **加 GitHub Actions**：作为免费托管/备份方案
