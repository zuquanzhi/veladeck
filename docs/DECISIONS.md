# Implementation decisions

The original design remains unchanged in SPEC.md. These decisions resolve contradictions and describe the first-preview scope.

- Brand: VelaDeck. Original Agent Dock names describe the source design. The current distributable service uses `veladeck.service`; new databases use `veladeck.db`, with legacy database compatibility described below.
- Dangerous operations require a verified, action-bound, one-time passkey assertion. An unregistered device cannot substitute a dialog for cryptographic verification.
- Reading progress is saved server-side; browser storage contains no device tokens.
- Old files and their metadata are recorded separately before an idempotent artifact update, preserving meaningful diffs.
- Usage records retain a project dimension and an idempotency key. An empty ledger is reported as missing usage, never as a known zero bill. Prices and balances are not fabricated.
- Six-hour notification deduplication is represented by a separate key/time record; persisted event IDs remain unique across windows.
- Read-only share tokens are stored as SHA-256 hashes, not reusable plaintext bearer credentials.
- PDF content is downloaded to the device viewer. This preserves `object-src 'none'`.
- The first Android previews through 0.1.2 used Custom Tabs. The user explicitly requested a native app on 2026-10-25. Version 0.2.0 replaces that workspace with Android Views and authenticated HTTPS JSON/SSE requests. Browser/PWA remains available separately. Native cookies are Keystore-encrypted, passkeys use Credential Manager, and public app/domain association is pinned to the fixed release certificate. See NATIVE_ANDROID.md.
- APKs through 0.1.1 were development-signed. From 0.1.2, `.preview` Release APKs use a fixed signing identity in Actions Secrets, a pinned public certificate fingerprint and verified in-app updates. The old temporary-signed client requires one manual replacement. Debug builds now use `.dev`. No signing private key is committed or included in release assets. See ANDROID_UPDATES.md.
- Backend adapters fail explicitly when not configured. Live DSH protocol, Linux remote probes, quota commands and device push have not been substituted by demo successes.

Remaining original-spec work includes cross-item lineage timelines, full CSV sorting/virtualization, project-grouped artifact views, image gestures beyond browser zoom, code syntax highlighting, per-device conversation unread markers, live mail quota parsing, timer log details/enable-disable controls, alert ack/mute and production device regression. This preview is not an assertion that all T1 production acceptance criteria have passed.

Security maintenance: the first-preview dependency audit required React Router 7 (React 18 compatible), Zod 4 and the patched Fastify static plugin. These replace vulnerable original version ranges while keeping the same libraries and architecture. SPEC.md is retained as the original design record.

The patched runtime dependencies require Node 22. The supported runtime and CI baseline are therefore Node 22 LTS, replacing the original Node 20 target. No system Node installation is modified.

2026-10-25 rebrand: the user selected VelaDeck and the abstract Current symbol. GitHub repository identity and release history are preserved through a repository rename. Existing `runotter.db` files and the `ad_device` authentication cookie remain compatible; a fresh data directory uses `veladeck.db`. The internal `runotter-base` HTML marker is retained to avoid breaking configured base paths. Existing deployments should retain their DATA_DIR and HTTPS origin; no live service or credential configuration is automatically changed.

2026-10-25 Android updates: published preview releases are intentionally included, since this project currently distributes previews. Use the release collection rather than GitHub’s stable-only latest endpoint. Android system confirmation is retained; the app does not install silently or update the self-hosted server.

2026-10-25 native scope: reuse the existing API and security rules while replacing the Android UI. The client has no WebView or Custom Tabs workspace and does not load the React bundle. HTML artifacts are read through native static text rendering; document files can be opened/saved through scoped Android intents. Native reminders use opt-in JobScheduler checks instead of introducing a hosted push account. Background delivery timing, physical passkeys and the deployed domain association require device/host verification.
