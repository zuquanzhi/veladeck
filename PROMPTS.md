# Codex 提示词手册（Agent Dock）

## 使用方式

1. 新建仓库，把本目录的四个文件放到仓库根：
   - `SPEC.md`（需求与设计，唯一事实来源）
   - `AGENTS.md`（Codex 自动读取的项目指令）
   - `sql/schema.sql`（数据库结构，直接复制使用）
   - `PROMPTS.md`（本文件）
2. 用 Codex 打开仓库，**按顺序**逐条粘贴下面的提示词，一次只做一个里程碑。
3. 每个里程碑结束后：确认 `npm run verify` 与 `bash scripts/smoke.sh` 都通过，再开始下一个。
4. 卡的流程：让 Codex「只输出计划，不改代码」→ 你审 → 再说「按计划执行」。

> 通用开场（每次新会话先贴一次）：
> 「先读仓库根的 `SPEC.md` 与 `AGENTS.md`，严格按其中的技术栈与安全红线执行。本次只做我指定的里程碑，完成后给出验收输出与假设清单。」

---

## M0 — 脚手架与健康检查

```
里程碑 M0。任务：搭出可运行的骨架，不做任何业务功能。

要求：
1. 按 SPEC.md §2 的目录约定创建 monorepo 结构（server/ 与 web/，单个 package.json）。
2. 依赖只装 AGENTS.md「技术栈」里列出的项，version 用稳定版。
3. 后端：Fastify 监听 127.0.0.1:${PORT:-8090}，实现 GET /api/health 返回
   { ok: true, version, time }；用 pino 记录启动与请求日志；
   所有配置从环境变量读，用 zod 在 server/src/config.ts 校验，缺失时给出清晰报错。
4. 前端：Vite + React + TS + Tailwind + react-router，5 个底部 Tab
   （产物/对话/审批/运维/设置）各自一个占位页，能切换；深色主题跟随系统。
5. 实现 package.json 的全部脚本（dev/build/start/verify/smoke/db:migrate/pair），
   scripts/smoke.sh 至少做到：启动服务→curl /api/health→断言 200 与 ok:true→关闭。
6. 写好 .env.example（字段与 SPEC §11 对齐）与 README（如何本地跑起来）。

验收：npm run verify 全绿；npm run smoke 通过；npm run dev 后浏览器打开能看到 5 个 Tab。
禁止：写业务逻辑、建数据库表以外的表结构改动、引入额外状态管理库。
```

---

## M1 — 配对、设备令牌、WebAuthn

```
里程碑 M1。任务：把认证做扎实。参考 SPEC §4 F1、§10、§5 devices/pair_codes。

要求：
1. 迁移：应用 sql/schema.sql 里的 devices、pair_codes、audit（db:migrate 可重复执行，用 schema_migrations 记录）。
2. CLI：`npm run pair` 调本机 POST /api/pair/code（需 INGEST_TOKEN），生成 6 位数字码，
   TTL 300 秒，只存 hash，打印给用户；该接口只允许回环来源调用。
3. POST /api/pair/claim {code, device_name}：校验码、一次性使用、发 32 字节随机设备令牌，
   存 scrypt hash，返回 Set-Cookie ad_device（httpOnly, Secure, SameSite=Strict, 30 天）。
4. 中间件 requireDevice：无 cookie → 401 UNAUTHENTICATED；revoked_at 非空 → 401 DEVICE_REVOKED。
5. 设备管理：GET /api/devices（列表，含 last_seen_at）、PATCH（改名字）、DELETE（撤销）。
   撤销后该 cookie 立即失效（下一个请求就 401）。
6. WebAuthn：POST /api/auth/webauthn/register/options + /verify（登录态下注册），
   以及 /login/options + /verify（用于二次确认）；凭据存 devices.webauthn_cred_id/pubkey/counter。
7. 限流：同一 IP 对 /api/pair/claim 与 webauthn/login 合计 10 次/10 分钟，超限 429 + Retry-After。
8. 所有设备写操作落 audit 表（action=revoke_device 等）。

验收：smoke 覆盖 —— 生成码→配对→带 cookie 调 /api/devices 200→撤销→再调 401；
同一个码用第二次返回 401；连续 11 次错误码后返回 429。
禁止：把令牌明文存库；用 localStorage 存任何东西。
```

---

## M2 — 产物库（核心）

```
里程碑 M2。任务：产物入库、列表、预览、搜索、星标、保留期。参考 SPEC §4 F2、§5、§7。

要求：
1. 表：artifacts、artifact_search(FTS5)、audit。（不建对话相关表）
2. ingest：POST /api/artifacts，鉴权用 Authorization: Bearer ${INGEST_TOKEN} 且校验来源为回环。
   - 校验 body（zod）：project, kind, title, summary, file（base64 或 multipart）, idempotency_key, lineage_key, tags, retain_days
   - idempotency_key 已存在 → 更新同一条记录、version+1、旧文件保留
   - 落盘 $DATA_DIR/files/<project>/<yyyy-mm-dd>/<uuid>.<ext>，算 sha256 与 bytes
   - 写 FTS 索引：title/summary/正文前 64KB（html 去标签后取文本）
3. 目录扫描兜底：每 60 秒扫 $ARTIFACT_SCAN_DIRS 下的 *.manifest.json（格式见 SPEC §7），入库后把文件移进库。
4. 查询：GET /api/artifacts 支持 project/kind/q/starred/read_later/from/to/page/size/sort，返回分页元数据。
5. 内容：GET /api/artifacts/:id/content（html 以 text/plain 返回，供前端沙箱渲染），
   /download 支持 Range 请求（大文件断点）。
6. 状态：POST /:id/star、/read-later、/retain（写 retain_until）、/progress（写 read_progress）。
7. 版本：GET /:id/versions（按 lineage_key 列表）、GET /:id/diff?vs=<id>（仅 markdown/log/json，返回 unified diff 文本）。
8. 清理任务：每日 04:00 删除过期且未星标产物（先删文件后删记录），磁盘水位 > DISK_WARN_PCT 时额外清理最旧非星标。
9. 前端产物页：列表（无限滚动、分组切换、筛选、搜索防抖 300ms、下拉刷新）+ 详情（md 渲染、html 沙箱 iframe、csv 表格、图片缩放、原文视图）+ 操作条（星标/下载/删除/进度记忆）。
10. 种子脚本 scripts/seed.ts 生成 200 条假产物，覆盖全部 kind。

验收：smoke 覆盖 ingest→列表→搜索命中→下载→星标→版本 diff；
1 万条假数据下列表首屏 < 800ms（本地，记录实测值）。
禁止：把 HTML 用 dangerouslySetInnerHTML 渲染；把文件内容存进 SQLite。
```

---

## M3 — 推送与降级链

```
里程碑 M3。任务：Web Push 全链路 + 去重 + 免打扰 + 降级。参考 SPEC §4 F3、§8。

要求：
1. 启动时若无 $DATA_DIR/vapid.json 则生成 VAPID 密钥（权限 600），公钥经 GET /api/health 暴露。
2. POST /api/push/subscribe 存订阅（endpoint/p256dh/auth/UA，绑定 device_id）；
   DELETE 取消；发送遇 410/404 自动删订阅并写 failed_at。
3. POST /api/notify（需 INGEST_TOKEN）：zod 校验 type/priority/project/title/body/deep_link/artifact_id/thread_id/actions/idempotency_key。
   - 幂等键重复且 6 小时内 → 直接返回 200 并标记 deduped
   - 按项目开关过滤；免打扰时段仅 P0 穿透；P3 只更新角标不发通知
   - 分发后写 events.delivered_via
4. 降级链：PUSH_DEGRADE_CHAIN=webpush,email。webpush 无订阅或全部失败 → 调
   /usr/local/bin/agent-notify-email.sh（封装好接口：标题+正文+优先级），失败静默并记日志。
5. 前端：注册 Service Worker（vite-plugin-pwa），在设置页提供「开启推送」按钮与 iOS/Android 安装引导；
   通知点击带 deep_link 跳转。
6. 心跳：每日 09:00 检查订阅有效性，若全部失效则发一封邮件提醒「推送已断开」。

验收：smoke 用 --dry-run 模式断言去重与免打扰判定逻辑（不真发）；
真机 Android Chrome：后台收到通知，点击进入对应详情页。
禁止：通知正文里放敏感全文（锁屏遮蔽：body 仅摘要，正文由 App 内拉取）。
```

---

## M4 — 对话（流式 + 断线补发）

```
里程碑 M4。任务：会话、SSE 流式、取消、重连补发、DSH 桥。参考 SPEC §4 F4、§6。

要求：
1. 表：threads、messages、attachments。
2. agentBridge 接口（server/src/services/agentBridge.ts）：
   send(thread: Thread, text: string, attachments: Attachment[]): AsyncIterable<AgentEvent>
   cancel(threadId: string): Promise<void>
   AgentEvent = token|tool_call|tool_result|approval_required|done|error（含 seq）
   先实现 dsh 适配器：spawn 配置的命令（DSH_CMD），正文走 stdin，stdout 逐行/逐块解析为事件，
   stderr 写日志（脱敏）。超时 DSH_TIMEOUT_SEC 到则终止并 error 事件。
3. 接口：GET/POST /api/threads、GET /api/threads/:id/messages（分页）、
   POST /api/threads/:id/messages 返回 text/event-stream（每个事件 data: {...}\n\n），
   POST /api/threads/:id/cancel、GET /api/threads/:id/events?after_seq=（补发）。
   每条消息落 messages（seq 单调递增，threads.last_seq 同步）。
4. 客户端断开不取消任务：后台继续消费事件并入库；重连按 after_seq 补发。
5. 前端对话页：会话列表（置顶/重命名/搜索/未读）+ 消息流（增量 Markdown 渲染、工具调用折叠、
   生成中显示停止按钮）+ 输入区（多行、附件、@产物引用、系统听写按钮）。
6. 单测：用假 adapter 覆盖 seq 连续、断线补发、取消后不再产生事件。

验收：真实跑 dsh 一句话，2 秒内出现首 token；点停止 1 秒内进程结束且状态落库；
手工断开浏览器 30 秒再连，消息完整。
禁止：把 SSE 换成轮询；在客户端生成 seq。
```

---

## M5 — 审批（含危险操作二次确认）

```
里程碑 M5。任务：审批闭环 + 审计。参考 SPEC §4 F5、§3.3、§10。

要求：
1. 表：approvals。approval_required 事件落库（thread_id、title、command_digest、risk、expires_at 默认 10 分钟）。
2. 接口：GET /api/approvals?status=pending、POST /api/approvals/:id/approve、/reject。
   - 决策回传 agentBridge（写回子进程 stdin 或调用回调），并把结果写进该会话消息流
   - risk=danger 必须带 WebAuthn 断言；设备未注册 WebAuthn 时要求二次确认弹窗 + 设备令牌
   - 落 audit（action=approve|reject，含 device_id、ip、decided_via）
   - 过期自动置 expired（后台每分钟检查一次）
3. 前端：审批卡片（消息流内联 + 审批页聚合）；危险项红色标识、按钮文案「确认执行（危险）」；
   批量同意仅对 normal 生效；历史列表可查。
4. 单测：过期、重复决策（幂等）、无断言的危险项被拒。
5. 端到端：发一个需要审批的指令，通知 → 点通知进入 → 同意 → agent 继续。

验收：拒绝后 agent 收到 rejected 且行为正确；危险项无断言提交返回 403；
重复 approve 返回 409。所有决策在 audit 里能查到。
禁止：审批结果只存在内存；把命令原文完整写进日志（只存脱敏摘要）。
```

---

## M6 — 运维面板 + 成本与配额 + 快捷指令 + 摘要卡

```
里程碑 M6。任务：把「问机器怎么样」变成一屏。参考 SPEC §4 F6/F7、§9。

要求：
1. 采集器（server/src/services/opsBridge.ts）：
   - 广州本机：systemctl is-active（白名单服务）、df、free、uptime
   - 硅谷：~/ops/sv status，解析其输出
   结果写 ops_snapshots，每 5 分钟一次（node-cron 或 setInterval）。
2. GET /api/ops/status 返回两节点卡片数据；GET /api/ops/tasks 返回定时任务清单
   （名称、OnCalendar、上次结果、下次运行、耗时），来源为 systemctl list-timers + 日志目录。
3. POST /api/ops/tasks/:name/run 只允许白名单动作（trendradar-push/stock-report-push/dsh-backup），
   二次确认 + audit；执行结果轮询返回。
4. 成本：
   - GET /api/cost/summary 返回：DeepSeek 余额（调 /user/balance，30 分钟缓存）、
     今日 token 与估算花费（cost_daily 汇总）、预算进度（DAILY_BUDGET_CNY）、
     邮箱今日用量/上限（agently-cli +me，60 分钟缓存）、磁盘占用与预计可释放
   - 超预算推 P1 事件，每日最多一次
5. 前端：运维页（节点卡、任务清单、一键重跑、告警时间线、成本面板含 14 天柱状图）；
   首页四宫格快捷指令（跑热榜 / 跑股票日报 / 节点体检 / 重跑失败任务），全部走白名单接口；
   每日 08:30 生成摘要卡（GET /api/digest/today：昨晚产出数、今日计划、待批数、Inbox 积压）。
6. 单测：白名单外动作返回 403；预算超线只推一次。

验收：面板数字与手工执行 df/free/systemctl 一致（截图或 curl 对比）；
一键重跑一个定时任务成功并留痕。
禁止：让接口执行任意 shell；把 systemctl 全量输出原样透出到前端。
```

---

## M7 — Inbox 分享、只读分享链接、稍后读、锁屏遮蔽

```
里程碑 M7。任务：补齐 T1 剩余项。参考 SPEC §3.6、§4 F7。

要求：
1. PWA manifest 加 share_target（action=/share，method=GET 或 POST，接受 title/text/url），
   前端 /share 页把内容 POST /api/inbox 后跳转列表；GET /api/inbox 列表；
   POST /api/inbox/:id/to-thread 选后端建会话并把内容作为首条用户消息。
2. 只读分享：POST /api/artifacts/:id/share → 生成 32B base64url token，默认 7 天，
   存 share_links；GET /s/:token 无 cookie 渲染只读页（markdown/html 沙箱/csv 表格/图片），
   限流 60 次/小时，支持撤销（DELETE /api/artifacts/:id/share）。
3. 稍后读：列表与详情的 read_later 标记；产物页顶部「稍后读」入口。
4. 锁屏遮蔽：推送 payload 的 body 只放摘要；设置页开关「锁屏显示摘要/不显示内容」；
   通知点击后再拉全文。
5. 单测：分享链接过期与撤销后 404；inbox 幂等；锁屏开关影响 payload 生成。

验收：手机从任意 App 分享一个链接，30 秒内出现在 Inbox；
分享链接在无痕窗口可打开，撤销后立刻 404。
禁止：分享页出现任何写操作入口。
```

---

## M8 — 部署、备份、真机回归

```
里程碑 M8。任务：上生产。参考 SPEC §11、§12。

要求：
1. scripts/deploy.sh：构建 → 创建 /var/lib/agent-dock（750）→ 安装 systemd 单元
   （User=ubuntu、Environment 从 /etc/agent-dock/env 读取、Restart=always、TimeoutStopSec=30）
   → daemon-reload → enable --now → 打印 systemctl status。
2. Caddy 片段：反代到 127.0.0.1:8090，路径前缀 /<secret>/dock，沿用现有 dsh-auth；
   手工步骤写进 README（含 PWA 安装与推送开启指引）。
3. 备份：scripts/backup-hook.sh 供现有 ~/ops/backup.sh 调用，导出 SQLite 快照（VACUUM INTO）+ 文件目录 tar。
4. 真机回归清单（写进 README）：配对、收推送、点通知深链、产物预览、对话流式、停止、
   审批通过/拒绝、分享投稿、分享链接、断网重连、重启后自愈。
5. 输出一份「上线报告」：服务状态、首次配对步骤、已知限制。

验收：重启机器后服务自动起来；smoke 全绿；真机回归清单打勾。
禁止：改 Caddy 全局配置以外的东西；动 SSH/Docker socket。
```

---

## 附：常用追问提示词

- 修复：「`npm run verify` 报错如下：<粘贴>。只修这个问题，不要顺带重构。」
- 评审：「以 `SPEC.md` 与 `AGENTS.md` 的安全红线为基准，只输出问题清单（文件:行号 + 风险 + 修法），不要改代码。」
- 局部重做：「M4 的 SSE 实现与 SPEC §4 F4『断线补发』不一致：<说明>。只重写这一处并补一个单测。」
- 收尾：「把本里程碑的验收输出、假设清单、遗留清单整理成三条，写进 CHANGELOG.md。」
