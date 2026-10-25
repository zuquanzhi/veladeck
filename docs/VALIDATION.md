# Validation

Local environment: Windows, isolated Node 22 LTS (Node 20.20.2 used in earlier development stages), Java 21. Tests use temporary SQLite directories and explicit synthetic fixtures; they do not use personal credentials, send real email or run production systemd tasks.

Checks performed through M7:

- `npm run verify`: strict TypeScript, ESLint and 15 automated tests.
- `npm run build`: backend TypeScript and production PWA build.
- `bash scripts/smoke.sh`: real loopback HTTP startup, pairing/reuse rejection, artifact ingestion/search/download/star and version diff.
- 10,000-row synthetic performance test: observed list 33–53 ms and search p95 60–94 ms across development runs; assertions are <800 ms / <200 ms respectively on the test host.
- Security checks: revoked devices, forbidden forwarded ingress, origin isolation, pairing limits, dangerous approval bypass rejection, expired approvals, public-share hashing/revocation/XSS and Inbox deduplication.

Release jobs additionally build/lint Android and check APK signing and package metadata before publishing assets. Exact final run results are linked from the GitHub Actions page; a configured workflow is not a completed build.

Not executed on production hardware:

- HTTPS/Caddy routing on an actual host, existing dsh-auth integration and server reboot recovery.
- A real DSH CLI conversation/approval, first-token timing and process cancellation against that CLI.
- Android background push, share panel, physical passkey and installed APK regression.
- Live remote-node, mail quota and API balance comparison.

These require an actual configured endpoint and devices. They must not be reported as passed on the basis of local tests or an APK build.

Final local checks: 15 tests passed; production build and HTTP smoke passed; mobile Chrome browser QA passed for pairing, artifact detail and navigation with no page errors. Screenshots are synthetic fixtures in docs/screenshots. Runtime dependency audit after security upgrades reported zero vulnerabilities.

GitHub validation succeeded for c72e992: both application verification and Android assembleDebug/lintDebug passed in https://github.com/zuquanzhi/runotter/actions/runs/40170211621 . The APK was produced as a workflow artifact. Release asset signing metadata and publication are handled by the subsequent tag-triggered Release run.

## 0.1.1 visual refresh — local validation

- `npm run verify`: strict TypeScript, ESLint and **16 tests passed**, including reopening a legacy `runotter.db` with its paired session and artifact metadata intact.
- `npm run build` and `bash scripts/smoke.sh`: passed. The production manifest and UI use VelaDeck; app icons are exported from the selected Current vector, with a separate maskable export.
- Chrome / temporary Playwright fixture: **375 and 390 px mobile, 1440 px desktop**, light/dark themes, one-time pairing, artifact detail, star filtering, list/grid switching, keyboard search, theme persistence, navigation and horizontal overflow checks passed; no browser page errors. Screenshots and README covers were regenerated from synthetic content.
- Documentation image/file links: passed.
- 10,000-row local performance observation: list **55.7 ms**, search p95 **105.1 ms**, within the existing assertions.

Cloud validation completed:

- [Source verification run 40174544966](https://github.com/zuquanzhi/veladeck/actions/runs/40174544966) and [main verification run 40174645306](https://github.com/zuquanzhi/veladeck/actions/runs/40174645306): application checks and Android assemble/lint succeeded for `b0aa236`.
- [Release run 40174647642](https://github.com/zuquanzhi/veladeck/actions/runs/40174647642): web, Android and publish jobs succeeded. [v0.1.1](https://github.com/zuquanzhi/veladeck/releases/tag/v0.1.1) was published on 2026-10-25 at 07:56:50 UTC.
- Downloaded all four release assets and checked their SHA-256 values against GitHub asset digests; APK/server values also match the attached checksum manifest. APK SHA-256: `40dd667c7abbeac22bbeb3f0b10196905166720d878b52fb0e68b761d603d212`.
- APK ZIP integrity and self-hosted archive inventory checks passed. Signature/package metadata is attached as `APK-VERIFICATION.txt`.

Native-device visual regression and the live-service checks above remain pending.

## 0.1.2 signed in-app updates

- Local strict TypeScript, ESLint, 16 application tests, production build and real HTTP smoke passed.
- [Verification 40176599778](https://github.com/zuquanzhi/veladeck/actions/runs/40176599778): application verification and Android build/lint/unit tests succeeded for `edf0071`. The 7 Android policy tests cover numeric version selection, downgrade rejection, exact release assets, digest/size restrictions, redirect trust, byte integrity and package/signature identity.
- [Signed release rehearsal 40176605831](https://github.com/zuquanzhi/veladeck/actions/runs/40176605831): application and signed Android builds succeeded, including the pinned certificate comparison. This branch dispatch intentionally skipped publication. Signing secrets were verified through actual use, not merely local configuration.
- Updated documentation links passed.

A dedicated emulator smoke workflow uses current source stamped with an older version and the same fixed key, then upgrades through the actual public release API/download, installation-source permission UI and Android installer. This fixture is not the historical temporary-signed 0.1.1 APK. Results are recorded only after that workflow completes. Physical-device checks remain pending.

Release publication verification:

- [Release 40177047399](https://github.com/zuquanzhi/veladeck/actions/runs/40177047399) succeeded for [v0.1.2](https://github.com/zuquanzhi/veladeck/releases/tag/v0.1.2), source `c4f4f64`, published 2026-10-25 08:34:09 UTC. Main verification 40177044594 also passed.
- Downloaded all four published assets. GitHub asset digests and the APK/server checksum manifest match the local files. APK ZIP integrity passed. APK SHA-256: `58181641fba674fc18e0e08a3041f0f774dc8dff6c7296c1c470d2107e8bdd32`.
- Verified package `io.github.zuquanzhi.veladeck.preview`, code `1002`, version `0.1.2-preview`, and fixed signer SHA-256 `7a149537b057d66450254fc84b85a099707fb574892b8427452c8a4dd06a715d` against the repository pin and published APK verification metadata.

## 0.2.0 native Android workspace

- Local strict TypeScript, ESLint and **17 backend/application tests** passed, including the native passkey association/certificate contract.
- [Verification 40197421011](https://github.com/zuquanzhi/veladeck/actions/runs/40197421011) passed backend build/smoke plus Android compile, lint and **10 native unit tests** for `959ff2d`.
- [Native Android smoke 40197421158](https://github.com/zuquanzhi/veladeck/actions/runs/40197421158) **passed on Android API 29**. It used native Views and the real backend over HTTPS, with clearly synthetic data and a debug-only ephemeral certificate.
- The emulator drove native pairing, artifact search/detail/star, real SSE conversation, approval forwarding to the waiting fixture subprocess, Inbox submission/archive, operations, dark-theme persistence, Keystore-encrypted session/restart, a forced system-scheduled notification and device revocation. The request audit contains API methods/paths only and confirms no browser page/assets were loaded.
- Native screenshots in docs/screenshots are actual emulator captures. The native smoke driver was corrected to account for Switch accessibility ON/OFF suffixes. Separately, the APK upgrade smoke exposed Android 10's need for the legacy certificate-collection flag; the signature checks were retained.

Physical passkeys/provider and domain-association behavior, real-device background timing, production deployment and live DSH remain unverified. The emulator upgrade workflow uses a version-stamped test baseline with the same fixed key; it does not claim that the historical temporary-signed 0.1.1 APK can cover-install a new key.

Final source and publication:

- [Final source verification 40198774234](https://github.com/zuquanzhi/veladeck/actions/runs/40198774234) and [native HTTPS emulator 40198774241](https://github.com/zuquanzhi/veladeck/actions/runs/40198774241) both passed for `cc2761e68648d82d668c15c072bacb363187261f`. [Main verification 40199348481](https://github.com/zuquanzhi/veladeck/actions/runs/40199348481) also passed after the fast-forward merge.
- [Release 40199351214](https://github.com/zuquanzhi/veladeck/actions/runs/40199351214) passed all web, signed Android and publish jobs. [v0.2.0](https://github.com/zuquanzhi/veladeck/releases/tag/v0.2.0) was published at **2026-10-25 13:50:47 UTC**, from that same source.
- All four public assets were downloaded into `dist/releases/v0.2.0/` and checked against GitHub SHA-256 digests. APK/server values also match `SHA256SUMS.txt`. APK integrity, native package/version and server archive inventory checks passed; no private signing files are included.
- APK: `io.github.zuquanzhi.veladeck.preview`, code `2000`, version `0.2.0-preview`, SHA-256 `1411f1db8bb1d1bed038a7f8225d4cfb93891081a779349d3783a1d4bce5ed35`. The release's `apksigner` output matches the unchanged public certificate pin `7a149537b057d66450254fc84b85a099707fb574892b8427452c8a4dd06a715d`.
- Server archive SHA-256: `5f3bbca52b5e71dddb1e6bc440829d9bf779f20c88238b667d7c0a97df38663f`. Download verification does not represent a server deployment.
