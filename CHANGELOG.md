# Changelog

## 0.1.1 — VelaDeck visual refresh

Renamed RunOtter to VelaDeck with the user-selected Current flowing-ribbon identity. Rebuilt the responsive workspace, light/dark themes, pairing and native Android connection screen. Added actual grid/list switching, keyboard search, shared vector icons, bilingual project READMEs and screenshots generated from synthetic fixtures. GitHub history is retained. Existing databases and browser sessions remain compatible on the same configured server origin.

Local validation passed: strict TypeScript, ESLint, 16 workflow/security tests (including legacy database/session compatibility), production build, real HTTP smoke, and Chromium checks at 375/390 px mobile and 1440 px desktop in both themes. GitHub Actions application/Android checks and v0.1.1 publication passed; downloaded APK/server checksums match the release manifest (see docs/VALIDATION.md). Physical-device and live-service integration checks remain open.

## M0 — Foundation

Single-package TypeScript project, loopback Fastify health endpoint, React five-tab shell, strict compiler/linter, health integration test, executable smoke harness. Native Android distribution is requested in addition to the original PWA target; packaging follows application implementation.

Verification: Node 20.20.2; verify passed (1 integration test); production build and bash smoke passed. Remote Caddy access and browser visual QA not yet performed. Assumption: keep original SPEC unchanged and resolve ambiguities in implementation notes.

## M1 — Pairing and device authentication

Single-use scrypt-hashed pairing codes; secure HttpOnly cookies; revocation, expiry and IP rate limiting; WebAuthn registration and scoped, single-use step-up grants. Cross-origin write protection and masked request logs. Production SPA serving supports a configurable base path.

Verification: verify passed (3 integration tests), production build passed, bash smoke passed. WebAuthn hardware and HTTPS device checks require a deployed server and a physical device. No credentials are stored in browser localStorage.

## M2 — Artifacts

Authenticated loopback ingestion, 20 MB limits, typed artifact previews, FTS queries, filters, pagination, immutable file versions and diffs, Range downloads, starring, read-later and progress persistence, manifest scanning and scheduled retention. Destructive deletion requires an action-bound passkey assertion. PDF uses download/open-in-reader to preserve object-src 'none'.

Verification pending. Reading progress is stored on the server only. Settings and actual device push validation follow later milestones.

M2 validation: verify passed (5 tests); 10,000 rows: list 37.4 ms, search p95 60.7 ms; production build and extended HTTP smoke passed.

## M3 — Notifications and PWA

VAPID generation, authenticated push subscriptions, six-hour deduplication, quiet hours, project preferences, priority filtering and configurable delivery fallback. Service worker caches static assets only; personal API data is never cached. Lock-screen content is hidden by default.

Verification pending. Real Android background delivery cannot be marked passed without a configured HTTPS deployment and a physical device. Failed/absent notification channels remain explicitly undelivered.

M3 validation: compiler/linter, notification policy and subscription isolation tests, production PWA build and extended HTTP smoke passed. Real-device checks remain pending.

## M4 — Conversations

Persistent monotonic event sequences, SSE send/replay streams, cancellable DSH subprocess adapter without shell interpolation, attachment limits, thread search/pinning/renaming and incremental Markdown display. Client disconnects do not cancel server tasks. Adapter errors are explicit; no simulated successful agent responses are shown.

Verification pending. Actual DSH CLI protocol, first-token latency and production reconnection still need integration against the user's configured backend.

M4 validation: all current tests including subprocess sequence/replay passed; production build and extended HTTP smoke passed. Live DSH integration remains unverified.

## M5 — Approvals

Persisted approval requests, live-process binding, expiration and history, rejection and passkey-protected dangerous approvals, normal-only batch approval UI and audited decision forwarding. An approval cannot be forwarded to a replacement process after the original process ends. Dangerous actions require an action-bound, one-time passkey proof; the weaker fallback in the original contradictory prose is intentionally not used.

Verification pending. Real agent approval protocol and physical passkeys remain integration checks.

M5 validation: all tests including assertion bypass and expired decision rejection passed; production build and extended HTTP smoke passed.

## M6 — Operations and cost accounting

Actual host memory/disk/uptime and Linux service probes; explicit unavailable remote states; fixed systemd task allowlist with passkey confirmation; idempotent usage ledger with project totals and daily budget alerts; cached DeepSeek balance lookup when configured; cost history and notification timeline UI. No fabricated usage, balances or remote telemetry.

Verification pending. Mail quota collection and a live Silicon Valley status adapter are not configured. Windows development reports local telemetry and explicitly disables systemd actions.

M6 validation: all current tests including idempotent project accounting and daily budget alerts passed; production build and extended HTTP smoke passed. Remote quota sources remain unconnected.

## M7 — Inbox and read-only sharing

Share-target capture, idempotent Inbox submission, task conversion and archive, seven-day revocable public links with hashed bearer tokens, public-link rate limiting and sandboxed HTML, metadata export and a live summary card. Shared Markdown is rendered without raw HTML execution. No share route exposes write controls.

Verification pending. PWA share-panel registration needs installation and a physical Android check; no hosted endpoint has been provisioned by this development task.

M7 validation: all tests including public share hashing/revocation/XSS and Inbox idempotency passed; production PWA build and extended HTTP smoke passed.

## M8 — Distribution preview

Android companion with configurable HTTPS address and text share handling; GitHub CI/release workflows, installable development-signed APK, signature metadata and checksums; systemd installer and private backup hook; deployment and device-regression documentation. No production host configuration is changed by local development or CI.

Validation and publication pending. Physical-device and live-infrastructure checks remain open; release notes explicitly describe the preview scope and development signing.

M8 local validation: Node 22 baseline; 15 tests, production PWA build, extended HTTP smoke and mobile Chrome QA passed. Runtime dependency audit is clean. Android CI and publication remain pending at this commit.

M8 cloud validation: GitHub Actions Verify run 40170211621 passed both verify and Android build/lint jobs. First preview release tag: v0.1.0. Publication is verified separately after the tag workflow completes.
