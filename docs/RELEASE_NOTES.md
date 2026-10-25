VelaDeck 0.2.0 — the native Android workspace.

- Replaced the browser-backed companion with native Android screens for pairing, artifacts, conversations, approvals, operations, Inbox and settings. The app connects directly to authenticated HTTPS JSON/SSE APIs.
- Added Keystore-encrypted device sessions, native previews and scoped file save/share, streaming conversations, approval forwarding, themes, device management and opt-in system-scheduled reminders.
- Native passkeys use Android Credential Manager. The server serves the fixed app's public domain association; real deployments must expose it at the HTTPS domain root. Physical provider/passkey validation remains a device check.
- Retained fixed-signature in-app updates. Fixed Android 10 falsely rejecting downloaded APKs when its archive parser returned empty signing metadata. Checksums, package/version and matching certificates remain required before opening the system installer.

Install `VelaDeck-0.2.0-preview.apk` on Android 8.0+. Fixed-key 0.1.2 installs can be covered by this APK. For temporary-signed 0.1.1, uninstall that old companion first. Enter your HTTPS workspace URL and pair the native app once; existing server data and browser devices are preserved.

The native UI is delivered through APK updates. Server/PWA changes require a server deployment. Background reminders use Android-scheduled checks and require a reachable backend; they are not instant push. No hosted AI backend or local LLM is included. This remains preview software; physical-device passkeys/background behavior, live DSH and deployment checks are recorded separately in docs/VALIDATION.md.
