# Implementation decisions for 0.1.0

The original design remains unchanged in SPEC.md. These decisions resolve contradictions and describe the first-preview scope.

- Brand: RunOtter. Original Agent Dock names describe the source design. The distributable service uses `runotter.service`; database filename is `runotter.db`.
- Dangerous operations require a verified, action-bound, one-time passkey assertion. An unregistered device cannot substitute a dialog for cryptographic verification.
- Reading progress is saved server-side; browser storage contains no device tokens.
- Old files and their metadata are recorded separately before an idempotent artifact update, preserving meaningful diffs.
- Usage records retain a project dimension and an idempotency key. An empty ledger is reported as missing usage, never as a known zero bill. Prices and balances are not fabricated.
- Six-hour notification deduplication is represented by a separate key/time record; persisted event IDs remain unique across windows.
- Read-only share tokens are stored as SHA-256 hashes, not reusable plaintext bearer credentials.
- PDF content is downloaded to the device viewer. This preserves `object-src 'none'`.
- The Android companion uses [Android Custom Tabs](https://developer.chrome.com/docs/android/custom-tabs/guide-get-started) to retain browser cookie, TLS and passkey boundaries. It accepts Android text shares and configurable HTTPS workspace addresses. It does not embed a remote-code-enabled WebView or run a backend on the phone.
- The first APK is development-signed and separated by the `.preview` application ID. Production signing needs a private keystore configured as repository secrets in a future release. No signing private key is committed or included in release assets.
- Backend adapters fail explicitly when not configured. Live DSH protocol, Linux remote probes, quota commands and device push have not been substituted by demo successes.

Remaining original-spec work includes cross-item lineage timelines, full CSV sorting/virtualization, project-grouped artifact views, image gestures beyond browser zoom, code syntax highlighting, per-device conversation unread markers, live mail quota parsing, timer log details/enable-disable controls, alert ack/mute and production device regression. This preview is not an assertion that all T1 production acceptance criteria have passed.

Security maintenance: the first-preview dependency audit required React Router 7 (React 18 compatible), Zod 4 and the patched Fastify static plugin. These replace vulnerable original version ranges while keeping the same libraries and architecture. SPEC.md is retained as the original design record.

The patched runtime dependencies require Node 22. The supported runtime and CI baseline are therefore Node 22 LTS, replacing the original Node 20 target. No system Node installation is modified.
