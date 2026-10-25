# Android updates and release signing

## User flow

The fixed-key Release app checks the public `zuquanzhi/veladeck` GitHub Releases API at launch, at most once per day after a successful check. Published previews are included; drafts, old versions, invalid version tags, other assets and incomplete assets are ignored. An unsuccessful network check is shown as unavailable, never as proof that the app is current. It does not prevent connecting to the workspace.

Check at any time using **检查应用更新** on the native connection screen, or **设置 → 应用更新** in the native workspace. The app shows the available version and release notes. Download begins only after confirmation, with progress and retry status. If the native screen is temporarily covered, the prompt waits until it is visible again.

Before installation the app checks:

- The official repository, exact versioned APK name, HTTPS URL and bounded file size.
- SHA-256 from the GitHub asset metadata, byte count, package ID, expected version name/code and the currently installed signing certificate.
- HTTPS-only redirects to GitHub's release download hosts. No workspace cookies, ingestion secrets or account tokens are sent to GitHub.

The download stays in the app's private update cache. A non-exported FileProvider grants the system installer temporary read access to that directory only. Android 8+ can ask the user to allow VelaDeck as an installation source; returning from Settings continues the installation if permission was granted. Each installation still requires system confirmation. No silent installation is attempted. Failed downloads/verification preserve the installed app and can be retried.

This updates the native Android interface and client functionality. Backend and browser/PWA changes still require deploying the new server build. The Android app directly calls the API; it does not open the browser workspace.

## One-time migration from 0.1.1

Versions through 0.1.1 used a CI-generated development key. Android cannot cover-install the new signing identity over that version. Uninstall the old VelaDeck companion, manually install the latest native Release APK, and enter the workspace URL again. Browser-side device pairing and backend files remain on their existing origin/server; no server data is deleted by uninstalling the companion. Future fixed-key Release APKs can update in place.

Release package: `io.github.zuquanzhi.veladeck.preview`. Development artifacts use `.dev`, disable in-app installation updates and never substitute for published releases.

## Maintainer configuration

The fixed PKCS12 private key is outside the source repository. The local keystore password is protected with Windows DPAPI and a restricted directory ACL. GitHub stores the keystore/password in Actions Secrets, encrypted using the repository public key. No private signing material is included in source, ordinary notes or release archives.

Required repository secrets:

- `ANDROID_KEYSTORE_BASE64`: Base64 PKCS12 keystore.
- `ANDROID_KEYSTORE_PASSWORD`: keystore/key password.
- `ANDROID_KEY_ALIAS`: signing alias.

The workflow restores the keystore only into the runner's temporary directory, builds `assembleRelease`, runs lint and update policy tests, verifies the APK signature and checks its certificate against [the pinned public SHA-256](../android/release-certificate.sha256). A cleanup step removes the temporary keystore even if the job fails. Missing/invalid secrets cause a failed build; there is no fallback to a temporary debug key. Keep the same key for subsequent releases. A fork must provision its own signing identity and pin, not reuse this project's key.

`package.json` is the version source. Android version codes are `major × 1,000,000 + minor × 1,000 + patch` (for example, 0.1.2 → 1002); minor/patch must be below 1000 and the final code must fit Android's limit. Tags, APK names and package versions must agree. Current preview tags use `vMAJOR.MINOR.PATCH`.

## Validation boundaries

Pure-Java tests cover version ordering/no downgrade, release URL/digest/size restrictions, redirect trust, byte count/checksum failures and package/certificate identity. GitHub Actions compiles/lints Android and exercises the fixed signing configuration before publishing. Physical-device installer permissions and behavior are reported separately, not inferred from a successful build.

References: [Android app updates](https://developer.android.com/google/play/app-updates), [installation-source permission](https://developer.android.com/reference/android/content/pm/PackageManager#canRequestPackageInstalls()), [FileProvider](https://developer.android.com/reference/androidx/core/content/FileProvider), [GitHub Releases API](https://docs.github.com/en/rest/releases/releases).

## Android 10 certificate compatibility

Android 10's APK archive parser collects certificates only when the legacy `GET_SIGNATURES` flag is requested. The native client requests that flag together with modern `SigningInfo`, and falls back to legacy signature metadata when necessary. Empty or mismatched certificates are still rejected. This fixes the false `APK_SIGNER` rejection observed during the 0.1.2 emulator upgrade test; fixed signing keys were not changed. [Android 10 framework source](https://android.googlesource.com/platform/frameworks/base/+/android-10.0.0_r1/core/java/android/content/pm/PackageManager.java).
