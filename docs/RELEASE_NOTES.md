VelaDeck 0.1.2 — signed in-app updates.

- Automatically checks published GitHub Releases once a day at launch, including previews. Check manually from the connection screen or the workspace menu's “应用更新” entry.
- Shows the new version and notes, downloads after confirmation with progress/retry, verifies SHA-256, file size, package/version and signing identity, then opens Android's system installer.
- Handles the Android 8+ installation-source permission step; returning from Settings continues when permission is granted. The system still asks for installation confirmation.
- Release APKs now use a fixed signing identity stored in GitHub Actions Secrets. The workflow checks its public certificate fingerprint before publication and never falls back to an ephemeral key. Development builds use a separate `.dev` package.

ONE-TIME MIGRATION: if you installed the temporary-signed 0.1.1 preview, uninstall that old companion and manually install `VelaDeck-0.1.2-preview.apk`, then enter your workspace URL again. This does not delete server-side data. Later fixed-key versions can update in place through the app.

Android 8.0+. The companion still connects to your own HTTPS workspace; no hosted backend is included. This remains preview software. Live DSH, remote adapters, physical-device push/passkeys and production deployment remain separate integration checks. Signature/package metadata and SHA-256 checksums are attached.
