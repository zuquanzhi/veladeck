RunOtter 0.1.0 — first installable preview.

- Mobile workspace: artifact ingestion/previews/search/version diffs, durable agent conversation streams, passkey-protected approvals, Inbox, read-only shares, settings, host telemetry and usage accounting.
- PWA and browser-backed Android companion; enter the HTTPS URL of your own RunOtter server. The APK does not contain an AI backend or a hosted account.
- GitHub Actions verifies the application, builds/lints the APK, checks its signature and packages a self-hosted server archive. Checksums are attached.

Install `RunOtter-0.1.0-preview.apk` on Android 8.0+. This initial APK uses a development signing certificate and a separate `.preview` package ID. A future build from a different CI runner may require uninstalling this preview before installation. Production signing and store distribution are not configured.

Live DSH compatibility, remote-node/mail quota adapters, HTTPS deployment, background push, physical passkeys and Android share-panel behavior have not been verified on the user's devices. Unconfigured sources are shown as unavailable. For background push, install the PWA in a compatible browser.

This is a preview release, not confirmation that all original SPEC acceptance criteria or production deployment checks are complete. See README and docs/VALIDATION.md for supported behavior and remaining integration checks.
