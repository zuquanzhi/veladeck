VelaDeck 0.1.1 — a new identity and a calmer workspace.

- Renamed RunOtter to VelaDeck, preserving the GitHub repository and release history. The selected Current logo is an abstract flowing ribbon, shared across web, PWA and Android as editable vector artwork.
- Redesigned light/dark interfaces with a desktop sidebar, floating mobile navigation, clearer file cards, working list/grid views and keyboard search with Ctrl/Cmd K.
- Refreshed the native Android connection screen and app icons. Rebuilt the English and Chinese READMEs with real application screenshots, architecture and installation guidance.
- Existing `runotter.db` databases, device cookies and passkeys remain compatible when keeping the same data directory and HTTPS origin. See the upgrade notes in docs/GETTING_STARTED.md.

Install `VelaDeck-0.1.1-preview.apk` on Android 8.0+. Enter the HTTPS URL of your own VelaDeck server. The APK is a browser-backed companion; it does not include a hosted server or AI backend. Its renamed package can coexist with the old RunOtter preview; enter your workspace address again.

This APK uses a development signing certificate and a separate `.preview` package ID. Future builds from a different CI runner may require uninstalling the previous VelaDeck preview. Production signing and store distribution are not configured. SHA-256 checksums and APK verification metadata are attached.

Live DSH compatibility, remote-node/mail adapters, HTTPS deployment, background push, physical passkeys and Android share-panel behavior remain unverified on the user's devices. For background push, install the PWA in a compatible browser. See docs/VALIDATION.md for actual checks and remaining integration work.
