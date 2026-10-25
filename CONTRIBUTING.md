# Contributing to VelaDeck

Thanks for helping make a quieter, clearer workspace for agent work.

## Before you start

- Read [the design decisions](docs/DECISIONS.md) and [engineering conventions](AGENTS.md).
- For a feature or a large change, open an issue describing the problem and intended behavior.
- For a visual issue, include viewport size, theme and a screenshot with personal data removed.
- Report security problems using [SECURITY.md](SECURITY.md), not a public issue containing credentials.

## Development

Node.js 22+ is required. Use a local development environment with a private `.env`.

```sh
npm ci
cp .env.example .env
npm run dev
```

Before submitting:

```sh
npm run verify
npm run build
bash scripts/smoke.sh
```

Keep changes focused, explain the visible behavior, and include relevant verification. UI changes should include light/dark screenshots at a phone width. Fixtures and screenshots must use clearly labelled synthetic content.

Android uses Java/native Views with Credential Manager and the same HTTPS JSON/SSE API. Run `gradle --no-daemon -p android testDebugUnitTest assembleDebug lintDebug` with JDK 17 and Android SDK 35. Development APKs use `.dev` and never substitute for fixed-key Release APKs. The Native Android smoke workflow exercises a disposable debug client against a real synthetic HTTPS backend; the temporary test certificate never enters Release builds. See [native client architecture](docs/NATIVE_ANDROID.md).

## Boundaries worth keeping

The backend listens on loopback. Browser tokens never go in localStorage. Dangerous approvals require a passkey assertion. HTML previews remain script-disabled. Do not commit runtime data, keys, signing certificates or credentials. Avoid introducing a UI framework, ORM or state library for a small change.

## Visual system

Use the shared [icon component](web/src/components/Icon.tsx), [brand mark](web/public/brand/mark.svg) and CSS tokens. Preserve keyboard focus, reduced-motion support, semantic controls and theme contrast. See [brand notes](docs/brand/README.md).
