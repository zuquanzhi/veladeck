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
