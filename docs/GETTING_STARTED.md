# Installation and operations

**Your AI agents, in your pocket.**

A self-hosted, mobile-first workspace for agent artifacts, conversations, approvals, notifications, and operations. 单用户智能体手机工作台。

**0.1.1 is a redesigned preview.** The core workflows are implemented; live infrastructure and physical-device integration checks remain open. [Validation](VALIDATION.md) · [Design decisions and remaining scope](DECISIONS.md).

## Android APK

Download `VelaDeck-0.1.1-preview.apk` from [Releases](https://github.com/zuquanzhi/veladeck/releases). Android 8.0+ and a compatible browser are required. Enter your self-hosted HTTPS workspace URL, then enter a pairing code generated on the server. The APK is a browser-backed companion with an Android share target; it does not provide a hosted server or run an LLM on your phone.

The preview uses a development certificate and separate package ID. A build from another runner may need the previous preview uninstalled. Production signing is not configured. For background push, install the PWA from Chrome as well.

### Upgrading from RunOtter

VelaDeck is the same project under its new name. Keep your existing `DATA_DIR`, HTTPS origin and private environment configuration. The service opens an existing `runotter.db` in place; new installations use `veladeck.db`. Browser device sessions and passkeys remain tied to your existing origin. The renamed Android companion has a new package ID, so enter your workspace address again after installing it. An installed PWA may need reinstalling to refresh its launcher name.

## Development

Requires Node.js 22+ (Node 22 LTS is used in CI).

```sh
npm ci
cp .env.example .env
# Set INGEST_TOKEN to a locally generated random secret; never commit it.
npm run dev
npm run verify
bash scripts/smoke.sh
npm run build
npm start
```

Backend: `127.0.0.1:8090`. Frontend dev: `127.0.0.1:5173`. Production must use HTTPS through your existing authenticated reverse proxy; no public application port is opened.

For pairing in development, serve the built app at `http://localhost:8090` (`npm run build && npm start`). Secure cookies must not be disabled; the separate HTTP Vite port is for UI development.

Generate an ingestion secret locally with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`, write it only to your private `.env`, then run `npm run pair` while the backend is running. Pairing codes expire after five minutes. Register a passkey in Settings before approving dangerous actions.

`DSH_CMD` is an executable path; `DSH_ARGS` is a JSON array of separate arguments. User prompts are written to stdin without a shell. The adapter accepts newline-delimited JSON events (`token`, `tool_call`, `tool_result`, `approval_required`, `done`, `error`) and plain stdout lines as text. Approval responses are written as `{type:"approval_decision",approval_id,decision}`. Configure this protocol against your real CLI before relying on agent execution.

## Self-host and release

Unpack the server archive, run `npm ci`, configure the private environment and `npm start`. Source installation may use `scripts/deploy.sh` on Ubuntu after reviewing it and creating `/etc/veladeck/env`. It configures systemd only; it does not change Caddy, SSH, Docker, accounts or networking. See [Caddy example](Caddyfile.example). Backups: `DATA_DIR=/var/lib/veladeck bash scripts/backup-hook.sh /private/encrypted-backup-destination`.

GitHub Actions runs verification on pushes/PRs. Tags matching `v*` build, lint and verify the Android APK, package the server, compute SHA-256 checksums and create a preview Release. Download assets only after the workflow succeeds.

## Artifact and usage ingestion

Internal endpoints accept the ingestion bearer secret from loopback only. Use `POST /api/artifacts` with `project`, `kind`, `title`, `file` (UTF-8 text, or base64 with `encoding:"base64"`) and `idempotency_key`. Reusing the key preserves the old version and updates the existing item. File limit: 20 MB.

`POST /api/cost/usage` accepts `idempotency_key`, `project`, `input_tokens`, `output_tokens`, optional `cache_hit` and an explicitly supplied `cost_cny`. Only supplied accounting is displayed; no service infers your actual bill from missing data. Remote balance lookup is attempted only when `DEEPSEEK_API_KEY` is configured privately on the server.

## Device regression checklist

- [ ] Pair once over HTTPS; verify reuse and device revocation fail.
- [ ] Receive a real background push and follow its deep link.
- [ ] Preview/download a report and compare historical versions.
- [ ] Stream a live DSH task, interrupt it and reconnect after 30 seconds offline.
- [ ] Approve/reject a real request and verify dangerous operations require a passkey.
- [ ] Share a URL from Android into Inbox; open and revoke a read-only share.
- [ ] Restart the deployed server and confirm recovery.

## Roadmap

M0 foundation → M1 pairing → M2 artifacts → M3 push → M4 conversations → M5 approvals → M6 operations → M7 sharing → M8 distribution.

Original design: [SPEC.md](../SPEC.md). Engineering instructions: [AGENTS.md](../AGENTS.md). Progress: [CHANGELOG.md](../CHANGELOG.md).

MIT licensed.
