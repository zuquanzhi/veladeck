# Native Android workspace

From 0.2.0, VelaDeck's Android app uses native Android Views for pairing, artifacts, conversations, approvals, operations, Inbox and settings. It talks directly to the existing HTTPS JSON/SSE API. It does not use a WebView, Custom Tabs or the React site as its workspace. The browser/PWA remains a separate client.

## Install and connect

1. Deploy the current server build at your HTTPS workspace URL. Its API must support device-cookie authentication directly; a browser-only outer login gateway needs an API-compatible entry.
2. Install the latest Release APK on Android 8.0+ and enter that URL, including its configured base path.
3. Run `npm run pair` on the server and enter the one-time code in the native pairing screen.

The native app creates its own device session. An earlier browser session is not imported. Server files, conversations and existing paired browser devices remain intact. Fixed-key 0.1.2 APKs can be covered by the new signed APK; temporary-signed 0.1.1 requires one uninstall/manual replacement.

## Native functionality

| Screen | Behavior |
| :--- | :--- |
| Artifacts | Search, filters, pagination, native text/image/CSV preview, star/read-later, server-side reading progress, version diff, retention and read-only sharing |
| Conversations | Native chat UI, persistent SSE events, reconnect/replay, cancellation, document attachments and artifact references |
| Approvals | Context, expiry/history, normal batch approval and action-bound passkey verification for dangerous approvals |
| Inbox | Text/link capture, Android text sharing, archive and conversion to an agent task |
| Operations | Actual host/adapter state, reported usage/budgets, task status and passkey-protected task execution |
| Settings | Themes, retention, devices, passkeys, privacy, scheduled reminders and in-app APK updates |

Text previews are bounded for phone responsiveness; CSV previews show up to 2,000 rows with native pagination. Complete files can be saved or opened in a separate document viewer. HTML is rendered as static native text, without JavaScript execution or loading a remote page.

## Session and file security

The device cookie is encrypted with AES-GCM using a non-exportable Android Keystore key, with the normalized workspace URL as associated data. Cookies are scoped to that exact configured workspace and sent only to its API. Requests reject redirects. Credentials are not written to logs, URLs, browser storage or exported files; application backup is disabled.

Artifacts and APK updates use separate, non-exported FileProviders and dedicated private cache directories. Only explicit file-open/share/install intents receive temporary read grants. Dangerous operations retain server-side scope-bound, one-time WebAuthn assertions; a dialog alone does not authorize them.

## Native passkeys

The client uses Android Credential Manager. A compatible credential provider and screen lock are required; provider availability varies by Android version/device. The backend recognizes the fixed Release app's Android WebAuthn origin, alongside the configured website origin. It serves the matching public association at `/.well-known/assetlinks.json`.

For an actual deployment, expose that JSON at the **domain root** over HTTPS, returning 200/application-json without an outer login or redirect. A server mounted under `/private/dock` still needs the root association route. See [the Caddy example](Caddyfile.example). No host/proxy/account setting is changed automatically. Debug builds have a separate package/signature and are not authorized by the official Release association.

The public package/certificate mapping is in [androidIdentity.ts](../server/src/lib/androidIdentity.ts); CI verifies that it matches [the release certificate pin](../android/release-certificate.sha256). A fork must configure its own app association. [Android association prerequisites](https://developer.android.com/identity/credential-manager/prerequisites).

## Background reminders

Enable **本机后台提醒** in native settings. Android schedules network checks periodically (nominal minimum period 15 minutes, subject to system power/network policy). Workspace notification preferences, project filters, quiet hours and lock-screen privacy apply; urgent P0 events can bypass quiet hours. These are periodic native reminders, not a claim of an always-connected instant-push service. The HTTPS backend must remain reachable.

## Validation

Native UI acceptance uses an Android emulator and the real backend with synthetic records. An ephemeral certificate is trusted only by that disposable debug fixture; production Release builds use normal platform HTTPS validation. The test drives pairing, artifact changes, SSE, approval forwarding, Inbox, operations, theme changes, encrypted-session restart, scheduled notifications and revocation. Its request audit records methods/API paths only, never cookies, pairing codes or response bodies.

Exact completed runs and limitations are recorded in [VALIDATION.md](VALIDATION.md). Physical passkey/provider behavior and real-world background delivery remain device checks. [APK updates and signing](ANDROID_UPDATES.md).
