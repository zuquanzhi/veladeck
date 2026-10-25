# 🦦 RunOtter

**Your AI agents, in your pocket.**

A self-hosted, mobile-first workspace for agent artifacts, conversations, approvals, notifications, and operations. 单用户智能体手机工作台。

## Development

Requires Node.js 20.19+ (22/24 also supported).

```sh
npm ci
cp .env.example .env
npm run dev
npm run verify
bash scripts/smoke.sh
npm run build
npm start
```

Backend: `127.0.0.1:8090`. Frontend dev: `127.0.0.1:5173`. Production must use HTTPS through your existing authenticated reverse proxy; no public application port is opened.

## Roadmap

M0 foundation → M1 pairing → M2 artifacts → M3 push → M4 conversations → M5 approvals → M6 operations → M7 sharing → M8 distribution.

Original design: [SPEC.md](SPEC.md). Engineering instructions: [AGENTS.md](AGENTS.md). Progress: [CHANGELOG.md](CHANGELOG.md).

MIT licensed.
