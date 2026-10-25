# AGENTS.md — 给 Codex 的项目指令

本仓库实现 **VelaDeck**（原型名 Agent Dock，首版发布名 RunOtter）：单用户、Android 优先的 PWA，用来接收云端智能体的推送与产物、与智能体对话并审批。
完整需求见 `SPEC.md`（唯一事实来源）。本文件是每次会话都必须遵守的工程约定。

## 你的工作方式

1. **先读 `SPEC.md`**。任何与 SPEC 冲突的「合理想法」都不要自行采纳，先按 SPEC 实现；有疑问就在回复里提出。
2. **一次只做一个里程碑**（M0…M8，见 SPEC §12）。不要顺手把后面里程碑的功能先写出来。
3. 每个里程碑结束前必须：`npm run verify` 全绿 + 跑 `bash scripts/smoke.sh` + 在 `CHANGELOG.md` 追加一段（做了什么、如何验证、遗留问题）。
4. 不确定的细节：采用 SPEC 里最保守的解读，并在回复末尾列出「我做的假设」清单。
5. 不要引入新的大型依赖（UI 框架、ORM、状态管理库）。需要时先说明理由并等确认。允许的依赖上限见下方「技术栈」。

## 技术栈（锁定）

- 后端：Node 20 + TypeScript + Fastify + better-sqlite3（WAL）+ zod
- 前端：React 18 + TypeScript + Vite + Tailwind + react-router + TanStack Query
- PWA：`vite-plugin-pwa`
- 推送：`web-push`
- 认证：设备令牌（scrypt）+ `@simplewebauthn/server` / `@simplewebauthn/browser`
- 测试：vitest + 一个 bash smoke
- 其他：`pino` 日志、`dayjs`（时区）

不要引入：Prisma、Drizzle、Next.js、Nest、Redux、MUI/Ant、ORM 层、GraphQL。

## 代码规范

- TypeScript `strict: true`；公共 API 与跨模块边界禁止 `any`（用 `unknown` + zod 收窄）
- 所有 HTTP 入参用 zod 校验；所有 SQL 用参数化查询；禁止字符串拼接 SQL
- 时间一律 UTC 存储、按 `TIMEZONE` 展示；日期格式化只走一个工具函数
- 每个 route 处理器不超过 40 行，业务逻辑下沉到 `services/`
- 错误统一 `{ error: { code, message } }`；内部错误不向客户端泄漏堆栈
- 提交前 `npm run verify` = `tsc --noEmit && eslint . && vitest run`
- 提交信息：`feat(M2): artifact ingest + scan fallback`

## 安全红线（违反即视为 bug）

1. 服务只听 `127.0.0.1`；不要写任何 `0.0.0.0` 绑定
2. 令牌只存 hash；cookie `httpOnly + Secure + SameSite=Strict`；禁止写 `localStorage`
3. HTML 产物只在 `<iframe sandbox>` 渲染，**绝不**加 `allow-scripts`
4. ingest 令牌与设备令牌分离；ingest 校验来源为回环
5. 所有写操作落 `audit` 表
6. 日志禁止输出令牌、API key、正文全文（截断 200 字并脱敏 `sk-`/`Bearer`）
7. 不新增公网端口、不改 SSH、不碰 Docker socket

## 目录与脚本

```
server/src/{routes,services,lib,db}   # 见 SPEC §2
web/src/{pages,components,lib,routes}
sql/schema.sql                        # 单一 schema 来源；迁移用编号 sql 文件
scripts/{dev.sh,smoke.sh,deploy.sh,seed.ts}
```

`package.json` 脚本必须包含：

```
dev        并行启后端(+nodemon)与前端(vite)
build      server(tsc) + web(vite build)
start      跑构建后的 server
verify     tsc --noEmit && eslint . && vitest run
smoke      跑 scripts/smoke.sh
db:migrate 应用 sql/ 下未执行的迁移
pair       生成一次性配对码（调本机 /api/pair/code）
```

## 交付节奏

- 每个里程碑一个 PR/分支：`feat/m1-pairing`、`feat/m2-artifacts` …
- 里程碑结束时给我三样东西：① 通过的验证命令与输出摘要 ② 该里程碑的截图或 curl 示例 ③ 遗留与假设清单
- 不要「顺手重构」未涉及的模块；不要在未要求时修改 SPEC

## 已知环境约束

- 目标部署机：Ubuntu 24.04，Node 20，服务挂 `127.0.0.1:8090`，Caddy 反代到 `/<secret>/dock`（或独立子域名）
- 数据目录 `/var/lib/agent-dock`，权限 750，属主为服务运行用户
- 本机已有：`dsh --profile headless`（agent CLI）、`agently-cli`（邮件）、`~/ops/sv`（远端执行）
- 出口受限：广州节点访问 GitHub 慢、Docker Hub 不可达。**不要在构建流程里依赖境外资源**
- 时间基准：`Asia/Shanghai`；定时相关逻辑一律走配置，不硬编码
