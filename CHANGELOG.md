# Changelog

## M0 — Foundation

Single-package TypeScript project, loopback Fastify health endpoint, React five-tab shell, strict compiler/linter, health integration test, executable smoke harness. Native Android distribution is requested in addition to the original PWA target; packaging follows application implementation.

Verification: Node 20.20.2; npm run verify passed (1 integration test); npm run build passed; bash scripts/smoke.sh passed (HTTP health 200). Remote Caddy access and browser visual QA not yet performed. Assumption: keep original SPEC unchanged and resolve ambiguities in implementation notes.
