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
