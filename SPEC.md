# Agent Dock — 需求与设计规格 v1.0

> 单用户的「智能体手机工作台」。Android 优先，PWA 形态。
> 本文是实现的唯一事实来源；AGENTS.md 是给 Codex 的短指令，PROMPTS.md 是分阶段任务。
> 决策已定：PWA + Android 优先（D1）、手机可审批（D2）、保留期可配（D3）、域名/agent 后端可配（D4）、T1 功能全做 + 余额与预算面板。

---

## 1. 目标与非目标

### 1.1 目标

手机上一屏看全云端智能体的产出，一句话给它派活；关键事件能推到锁屏；手机上能点「同意」。

三条主线：

1. **收**：任何任务产出（报告、CSV、HTML、日志）自动入产物库，可预览、搜索、对比、下载、分享。
2. **说**：与 agent 对话（DSH headless 为主，PI/A2A 可插拔），流式输出，审批内联。
3. **管**：双节点健康、定时任务、成本与配额，一屏掌握。

### 1.2 非目标

- 多用户、权限分级、团队协作
- 实时行情、K 线自绘（做不过专业 App）
- 自建 LLM 网关（复用 DeepSeek / LiteLLM）
- 自训练语音或 OCR 模型（用系统能力）
- 桌面端完整功能（浏览器能用即可，不为桌面做专门布局）

---

## 2. 形态与技术栈（锁定，不要换）

| 层 | 选择 | 说明 |
|---|---|---|
| 前端 | React 18 + TypeScript + Vite | 严格模式，禁止 `any` 出现在公共 API |
| 样式 | Tailwind CSS + 少量 CSS 变量 | 深色优先，跟随系统主题 |
| PWA | `vite-plugin-pwa`（Workbox） | manifest + 离线缓存 + share_target + 快捷方式 |
| 路由 | react-router v6 | 5 个 Tab + 详情页 |
| 数据层 | TanStack Query + fetch | SSE 单独封装 |
| 后端 | Node 20 + TypeScript + Fastify | 只听 `127.0.0.1`，由 Caddy 反代 |
| DB | SQLite（better-sqlite3，WAL）+ FTS5 | 单文件，备份简单 |
| 校验 | zod | 所有入参出参 |
| 推送 | `web-push`（VAPID） | Android Chrome / iOS 16.4+ 主屏幕 |
| 认证 | 设备令牌 + 一次性配对码 + `@simplewebauthn/*` | cookie: httpOnly + Secure + SameSite=Strict |
| 测试 | vitest（单测）+ 一个 bash smoke 脚本 | 每个里程碑必须跑通 smoke |
| 部署 | systemd（`agent-dock.service`）+ Caddy 子路径 | 不新开公网端口 |
| 代码质量 | ESLint + Prettier + `tsc --noEmit` | CI 即 `npm run verify` |

**目录约定**（monorepo，单包多目录，不要拆成两个 npm 包）：

```
agent-dock/
├── AGENTS.md
├── SPEC.md
├── package.json            # 后端 + 前端脚本同仓，前后端各一份 tsconfig
├── server/
│   ├── src/
│   │   ├── index.ts        # Fastify 启动、路由注册
│   │   ├── config.ts       # 环境变量解析（zod）
│   │   ├── db/{schema.sql,migrate.ts,client.ts}
│   │   ├── routes/{auth,artifacts,threads,approvals,notify,ops,cost,push,inbox,digest,share}.ts
│   │   ├── services/{artifactStore,pushService,degradeChain,agentBridge,opsBridge,costService}.ts
│   │   └── lib/{ids,hash,sse,rateLimit,audit,logger}.ts
│   └── test/
├── web/
│   ├── src/{main.tsx,App.tsx,routes,pages,components,lib}
│   └── public/{icons,...}
├── scripts/                # 部署与运维脚本
└── sql/schema.sql
```

---

## 3. 信息架构（5 个 Tab + 1 个 Inbox）

底部 Tab：**产物 / 对话 / 审批 / 运维 / 设置**。Inbox 是产物页的顶部入口（徽标显示未处理数）。

### 3.1 产物页（Artifacts）

**列表**
- 默认按时间倒序，无限滚动，每页 20
- 分组视图切换：按时间 / 按项目
- 筛选：项目、类型（markdown/html/pdf/csv/image/log/json/diff）、星标、时间范围
- 全文搜索（FTS5），输入防抖 300ms，命中高亮
- 卡片信息：标题、项目徽标、类型图标、时间、大小、一句话摘要、星标按钮
- 下拉刷新

**详情**
- 预览区按类型分派：
  - `markdown` → 渲染（GFM 表格 + 代码高亮 + 图片）
  - `html` → `<iframe sandbox="allow-same-origin allow-popups">`，**禁止 allow-scripts**
  - `csv` → 表格视图（首行表头，虚拟滚动，列可排序，>5000 行分页）
  - `pdf` → 原生 `<embed>` 查看器
  - `image` → 手势缩放
  - `log/json/diff` → 等宽字体 + 行号 + 关键字高亮
- 操作条：星标、下载、分享链接、`@提到对话`、删除、（有版本时）版本对比
- 阅读进度记忆：记录滚动位置（按 artifact_id 存 localStorage + 服务端），下次进入恢复
- 版本时间线：同一 `lineage_key` 的多个版本可**并排 diff**（统一 diff 视图，仅 markdown/log/json 支持）

**稍后读**：星标的另一种标记 `read_later=true`，独立入口。

**保留期**：全局默认来自配置；单产物可覆盖（`retain_until`）；`starred=true` 永不清理。清理任务每日 04:00 执行，先删文件后删记录，写审计。

### 3.2 对话页（Threads）

**会话列表**：按项目分组；置顶、重命名、搜索、未读徽标；显示最近一条摘要与时间。

**会话详情**
- 消息流：用户 / agent / 工具调用（折叠，显示工具名 + 参数摘要 + 耗时）/ 系统事件
- 流式：SSE，逐 token 追加；Markdown 增量渲染（代码块闭合前不高亮）
- 输入区：多行、发送、生成中→变「停止」；附件（图片/文件，≤20MB，类型白名单）；`@` 引用产物（插入 artifact 引用，服务端注入摘要与路径）
- 语音输入：调用系统听写（`webkitSpeechRecognition` / Android 键盘语音），不自己录音转写
- 后台续跑：客户端断开不取消；重连拉 `after_seq` 增量
- 跨设备续接：会话存服务端，任何设备打开同一 thread 继续
- 动作模板：输入框上方横向卡片（来自配置），点击填入并发送

**审批内联**
- 消息流中审批卡片：标题、风险等级、参数摘要、有效期倒计时、[同意] [拒绝]
- 危险操作（删除数据、暴露端口、花钱、密钥操作）：需 WebAuthn 二次确认
- 与现有 `/approve` `/reject` 语义对齐：服务端记录决策人（设备名）、时间、IP、结果

### 3.3 审批页（Approvals）

- 待批列表：风险等级排序（危险红 / 常规灰），显示来源会话、发起时间、将执行的命令摘要
- 批量同意：仅对「常规」允许；危险项必须逐条
- 历史：已批准/已拒绝，可审计，可按时间筛选
- 空态：显示「没有待处理审批」+ 最近 5 条已处理

### 3.4 运维页（Ops）

- 节点卡：广州 / 硅谷（CPU、内存、磁盘、SWAP、uptime、关键服务 active 状态、上次探活时间）
- 定时任务清单：名称、计划、上次运行（成功/失败/耗时）、下次运行；失败标红；点击展开最近 20 行日志（脱敏）
- 一键动作（白名单）：重跑某任务、启用/停用某任务、节点体检、立即备份
- 告警时间线：最近 50 条，可确认（ack）/静音（mute 1h/1d）
- **成本与配额面板**（必须做）：
  - DeepSeek：当日 token（输入/输出/缓存命中）、当日估算花费、余额、预算进度条
  - Agent 邮箱：今日已用/上限 50、最近一次发送结果
  - 磁盘：产物库占用、各项目占用 Top 5、按保留策略预计释放
  - 预算告警线可配（默认单日 ¥3，超线推 P1）

### 3.5 设置页（Settings）

- 设备管理：名称、最后活跃、撤销（撤销后该设备 cookie 失效）
- 安全：WebAuthn 注册/删除、锁屏遮蔽开关、二次确认开关
- 通知：总开关、按项目开关、免打扰时段、优先级阈值（哪些等级能穿透免打扰）
- 保留策略：全局默认天数（按类型分别可配）、磁盘水位保护（超 85% 时自动清理最旧非星标）
- 外观：深/浅/跟随系统
- 数据：导出全部产物元数据（JSON）、退出登录

### 3.6 Inbox（分享即投稿）

- Android 分享面板进来（PWA `share_target`）：文本/链接 → 建 `inbox_item`，状态 `new`
- 列表：待处理 / 已处理；每条可「转成任务」（选 agent，发起 thread）或「归档」
- 通知：分享成功后 3 秒内本地 Toast；服务端在 digest 里提及积压条数

---

## 4. 功能清单与验收标准

> 每条都要有对应自动化测试或 smoke 检查。验收不通过视为该里程碑未完成。

### F1 配对与登录
- 首次启动显示「配对」页，输入 6 位一次性码（服务端 `agent-dock pair` 命令生成，5 分钟有效，一次性）
- 配对成功后写 httpOnly cookie（`ad_device`，30 天），设备表落库（名称取 UA 简称，可改）
- 支持 WebAuthn 注册（可选但推荐）：注册后敏感操作要求断言
- **验收**：错误码 10 次锁 10 分钟；撤销设备后该 cookie 立即 401；同一码第二次使用 401

### F2 产物库
- ingest：`POST /api/artifacts`（内部令牌）+ 目录扫描兜底（`ARTIFACT_SCAN_DIRS`，读 `manifest.json`）
- 幂等：`idempotency_key` 唯一，重复上报更新而非新建（`version` +1）
- 预览四类：markdown / html / csv / image；pdf/log/json 至少能看原文
- 搜索：FTS5 索引 title + summary + 正文前 64KB
- **验收**：1 万条产物下列表首屏 < 800ms（本地）；搜索 p95 < 200ms；重复上报不产生重复条目

### F3 推送
- `POST /api/push/subscribe` 存订阅（endpoint/auth/keys）；失效自动删除（410/404）
- 通知 ingest：`POST /api/notify`（标题、正文、优先级 P0–P3、项目、深链、动作、幂等键）
- 分发规则：按项目开关 → 免打扰（只有 P0 穿透）→ 同幂等键 6 小时内去重
- 降级链：Web Push 失败/无订阅 → 微信（若配置）→ 邮件（复用现有脚本）
- **验收**：锁屏收到通知，点击深链进入对应产物；关闭某项目后不再收到该项目通知；重复调用同一幂等键只推一次

### F4 对话
- 后端适配层 `agentBridge`，接口：`send(threadId, text, attachments) → AsyncIterable<Event>`，`cancel(threadId)`
- 首个实现：`dsh-headless`（spawn 命令，stdout 流式，stderr 记日志）
- 事件类型：`token` / `tool_call` / `tool_result` / `approval_required` / `done` / `error`
- 断线重连：`GET /api/threads/:id/events?after_seq=` 补发
- **验收**：发送后 2 秒内首 token；点停止 1 秒内进程终止；断网 30 秒后重连不丢消息

### F5 审批
- 审批项落库（thread、命令摘要、风险等级、过期时间）
- 同意 → 回传给 agentBridge（写回 agent 的 stdin 或调对应回调），记录审计
- 危险动作需 WebAuthn 断言（若设备未注册 WebAuthn，退回设备令牌 + 二次确认弹窗）
- **验收**：拒绝后 agent 收到 rejected 并继续/终止正确；危险项无断言不能提交

### F6 运维 + 成本
- 数据来源全部只读命令，白名单：`systemctl is-active`、`~/ops/sv status`、`df`、`free`、`logger` 查询等
- 成本：DeepSeek `GET /user/balance`（余额）+ 本地累计 token 计费表；agently `+me` 取额度；磁盘 `du`
- **验收**：面板数字与实际命令输出一致；重跑任务需二次确认并落审计

### F7 T1 全量
- 快捷指令卡（首页四宫格，白名单动作）
- 分享即投稿（`share_target`）
- 每日摘要卡（早 08:30 生成，含昨晚产出、今日计划、待批数、积压 Inbox）
- 锁屏遮蔽（通知正文仅在解锁后由 App 内拉取）
- 只读分享链接（`/s/:token`，默认 7 天，可撤销，限流 60 次/小时）
- 稍后读 + 星标
- 成本与预算面板（见 F6）
- **验收**：每条有对应 e2e 或 smoke 断言

---

## 5. 数据模型

见 `sql/schema.sql`。核心表：

| 表 | 用途 | 关键字段 |
|---|---|---|
| `devices` | 设备 | id, name, token_hash, webauthn_cred_id, created_at, last_seen_at, revoked_at |
| `pair_codes` | 配对码 | code_hash, expires_at, used_at |
| `artifacts` | 产物 | id, project, kind, title, summary, path, bytes, sha256, version, lineage_key, idempotency_key(uniq), starred, read_later, retain_until, created_at |
| `artifact_search` | FTS5 虚表 | title, summary, body |
| `threads` | 会话 | id, title, project, backend, pinned, created_at, updated_at, last_seq |
| `messages` | 消息 | id, thread_id, seq, role, content, meta(json), created_at |
| `approvals` | 审批 | id, thread_id, title, command_digest, risk, status, decided_by_device, decided_at |
| `push_subs` | 推送订阅 | id, device_id, endpoint, p256dh, auth, ua, created_at, failed_at |
| `events` | 通知事件 | id, type, priority, project, title, body, deep_link, idempotency_key(uniq), delivered_via, created_at |
| `inbox_items` | 分享投递 | id, kind, content, url, status, created_at |
| `audit` | 审计 | id, at, device_id, action, target, result, ip |
| `cost_daily` | 成本 | day(PK), llm_in_tokens, llm_out_tokens, llm_cost_cny, email_sent, artifacts_bytes |

---

## 6. API 契约

统一前缀 `/api`。除 `/api/pair/*`、`/api/health`、`/s/:token` 外，全部要求设备 cookie。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 服务存活 + 版本 + 时间 |
| POST | `/api/pair/code` | 内部令牌；生成一次性配对码（仅本机 CLI 调用） |
| POST | `/api/pair/claim` | `{code, device_name}` → set-cookie |
| POST | `/api/auth/webauthn/register` `/login` | 注册与断言 |
| GET/PATCH/DELETE | `/api/devices` `/api/devices/:id` | 设备管理 |
| GET | `/api/artifacts` | 查询：`project,kind,q,starred,read_later,from,to,page,size,sort` |
| POST | `/api/artifacts` | 内部令牌 ingest（见 §7） |
| GET | `/api/artifacts/:id` | 元数据 |
| GET | `/api/artifacts/:id/content` | 预览内容（html 以 `text/plain` + 前端沙箱渲染；md/csv 原文） |
| GET | `/api/artifacts/:id/download` | 附件下载（支持 Range） |
| POST | `/api/artifacts/:id/star` `/read-later` `/retain` `/share` | 状态与分享 |
| GET | `/api/artifacts/:id/versions` `/diff?vs=` | 版本与 diff |
| GET | `/api/threads` `POST /api/threads` | 会话 |
| GET | `/api/threads/:id/messages` | 历史（分页） |
| POST | `/api/threads/:id/messages` | 发送，返回 SSE 流 |
| GET | `/api/threads/:id/events?after_seq=` | 断线补发 |
| POST | `/api/threads/:id/cancel` | 中断 |
| GET | `/api/approvals` `POST /api/approvals/:id/approve` `/reject` | 审批 |
| POST | `/api/notify` | 内部令牌；事件 ingest |
| GET | `/api/notify/events` | 历史 |
| POST | `/api/push/subscribe` `DELETE /api/push/subscribe` | 订阅 |
| GET | `/api/ops/status` `/api/ops/tasks` `POST /api/ops/tasks/:name/run` | 运维 |
| GET | `/api/cost/summary` | 成本与配额 |
| POST | `/api/inbox` `GET /api/inbox` `POST /api/inbox/:id/to-thread` | 分享投递 |
| GET | `/api/digest/today` | 摘要卡数据 |
| GET | `/s/:token` | 只读分享页（无 cookie） |

**错误格式**：`{ "error": { "code": "string", "message": "string" } }`，HTTP 码语义化；限流返回 429 + `Retry-After`。

---

## 7. 产物上报（关键约定）

两种入口，都进同一个 ingest 逻辑：

1. **HTTP**：任务脚本 POST `/api/artifacts`，头 `Authorization: Bearer $AGENT_DOCK_INGEST_TOKEN`
2. **目录扫描**：每 60 秒扫 `ARTIFACT_SCAN_DIRS`（默认 `/var/lib/agent-dock/inbox-artifacts`），发现 `*.manifest.json` 则入库并（配置允许时）移动文件进库

`manifest.json`：

```json
{
  "project": "trendradar",
  "kind": "html",
  "title": "TrendRadar 热点报告 10月25日",
  "summary": "11 平台 255 条在榜，命中 26 条",
  "file": "report.html",
  "idempotency_key": "trendradar:2026-10-25:current",
  "lineage_key": "trendradar:current",
  "tags": ["daily"],
  "retain_days": 90
}
```

规则：

- `idempotency_key` 相同 → 更新（`version +1`），旧文件保留为历史版本
- `kind` 从扩展名推断，manifest 可覆盖
- 入库后计算 `sha256`、`bytes`，写 FTS 索引（正文取前 64KB，HTML 去标签后取文本）
- 文件落库路径：`$DATA_DIR/files/<project>/<yyyy-mm-dd>/<uuid>.<ext>`

---

## 8. 推送与降级

- VAPID 密钥首次启动生成并存 `$DATA_DIR/vapid.json`（权限 600），公钥通过 `/api/health` 暴露给前端
- 通知 payload（加密后 ≤4KB）：`{title, body, priority, deep_link, artifact_id?, thread_id?, tag}`
- 去重：`events.idempotency_key` 唯一 + 6 小时窗口
- 免打扰：`DND_START`/`DND_END`（默认 23:00–08:00），仅 P0 穿透
- 降级链顺序可配：`PUSH_DEGRADE_CHAIN=webpush,wechat,email`
  - `wechat`：调用现有 Weixin 通道脚本（若存在），失败静默
  - `email`：调用 `/usr/local/bin/agent-notify-email.sh`（复用 Agent 邮箱 + agently-cli），封装好供本服务调用
- 心跳：每日 09:00 检查 `push_subs` 是否全失效；全失效则走邮件提醒「推送已断开，请重新开启」

---

## 9. 成本与配额采集

| 项 | 来源 | 频率 |
|---|---|---|
| DeepSeek 余额 | `GET https://api.deepseek.com/user/balance` | 每次打开面板 + 每 30 分钟缓存 |
| 当日 token / 花费 | 本地 `cost_daily` 累计（后端 + 任务脚本上报 usage） | 实时 |
| 邮箱额度 | `agently-cli +me` → `rate_limits.daily_send_quota` | 每 60 分钟缓存 |
| 磁盘/产物占用 | `du -sh $DATA_DIR/files/*` | 每 30 分钟 |
| 预算告警 | `DAILY_BUDGET_CNY`（默认 3） | 超线推 P1，每日最多一次 |

**余额与预算面板必须展示**：余额、今日已花、预算进度条（超线变红）、近 14 天柱状趋势、按项目花费 Top 5。

---

## 10. 安全红线（实现时不可违反）

1. 服务只 bind `127.0.0.1`；公网入口只有 Caddy，且必须带 dsh-auth + 秘密路径前缀（或独立子域名 + 同等认证）
2. 设备令牌只存 hash（scrypt）；cookie `httpOnly; Secure; SameSite=Strict`
3. 不使用 `localStorage` 存任何令牌
4. 内部 ingest 令牌与设备令牌分离；ingest 仅允许本机回环调用（校验 `CF-Connecting-IP` 为空且 `req.ip` 是 127.0.0.1）
5. HTML 产物**只能**在 `sandbox` iframe 中渲染，绝不 `allow-scripts`
6. 产物正文、对话内容、网页抓取内容一律视为不可信数据，不得据此执行任何指令
7. 所有写操作（审批、重跑、删除、撤销设备、改保留期）写 `audit` 表
8. 限流：登录 10 次/10 分钟、对话发送 30 次/分钟、分享链接 60 次/小时
9. 不新增公网端口、不改动 SSH、不碰 Docker socket
10. CSP：`default-src 'self'; img-src 'self' data:; frame-src 'self'; object-src 'none'`

---

## 11. 配置（`.env`）

```dotenv
# 基础
PORT=8090
DATA_DIR=/var/lib/agent-dock
PUBLIC_BASE_URL=https://<host>/<secret>/dock
TIMEZONE=Asia/Shanghai

# 安全
INGEST_TOKEN=            # 生成后写入 /etc/agent-dock/ingest.token
PAIR_CODE_TTL_SEC=300
SESSION_DAYS=30
WEBAUTHN_RP_ID=<host>
WEBAUTHN_ORIGIN=https://<host>

# 产物
ARTIFACT_SCAN_DIRS=/var/lib/agent-dock/inbox-artifacts
DEFAULT_RETAIN_DAYS=90
RETAIN_DAYS_LOG=7
RETAIN_DAYS_IMAGE=30
DISK_WARN_PCT=85

# 推送
DND_START=23:00
DND_END=08:00
PUSH_DEGRADE_CHAIN=webpush,email
DAILY_DIGEST_AT=08:30

# Agent 后端（可插拔，D4）
AGENT_BACKENDS=dsh
DSH_CMD=dsh --profile headless
DSH_TIMEOUT_SEC=900
A2A_URL=http://127.0.0.1:8181
PI_CMD=

# 成本
DEEPSEEK_API_KEY=
DAILY_BUDGET_CNY=3
AGENTLY_BIN=/home/ubuntu/.local/node/bin/agently-cli
```

---

## 12. 里程碑与验收

| 里程碑 | 交付 | 验收 |
|---|---|---|
| M0 | 仓库骨架、`npm run verify`、`/api/health`、Caddy 子路径可访问 | `curl /api/health` 200；`tsc --noEmit` 与 ESLint 零错误 |
| M1 | 配对 + 设备令牌 + WebAuthn + 撤销 | F1 全部断言；smoke 脚本覆盖 |
| M2 | 产物库：ingest、扫描、列表、四类预览、搜索、星标、保留期清理 | F2 断言 + 1 万条性能 |
| M3 | 推送：订阅、notify、去重、免打扰、降级链、深链 | F3 断言（真机 Android 收到通知） |
| M4 | 对话：threads、SSE 流式、取消、重连补发、DSH 桥 | F4 断言 |
| M5 | 审批：卡片、同意/拒绝、危险项二次确认、审计 | F5 断言 |
| M6 | 运维 + 成本面板 + 快捷指令 + 摘要卡 | F6/F7（运维、成本、摘要卡部分） |
| M7 | Inbox 分享、只读分享链接、稍后读、锁屏遮蔽 | F7 其余断言 |
| M8 | 部署脚本、systemd、备份接入、真机回归 | 全部 smoke 通过；断网/重启后自愈 |

---

## 13. 风险与对策

| 风险 | 对策 |
|---|---|
| iOS Web Push 脆弱 | 降级链 + 每日心跳自检 + 邮件兜底（用户现以 Android 为主） |
| 后台挂起导致进度丢失 | 服务端执行、事件落库、客户端按 seq 补发 |
| 手机丢失 | 设备撤销 + WebAuthn + 锁屏遮蔽；一键「撤销全部设备」 |
| 产物塞爆磁盘 | 保留策略 + 水位保护 + 面板可见 |
| 上游 agent CLI 变动 | `agentBridge` 接口隔离；适配层单测用假实现 |
| 自己维护成本 | 单服务 + SQLite + 无外部依赖；纳入现有备份与监控 |
