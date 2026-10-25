# Changelog

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
