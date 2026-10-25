# VelaDeck visual identity

The selected identity is **Current**: an open, flowing ribbon with one clear inner channel. Its continuous movement suggests collecting progress and carrying work forward. The symbol is intentionally independent of initials and animal illustration.

- **Symbol:** a compact, asymmetrical flowing band. Keep the inner channel open at small sizes.
- **Mark palette:** white on graphite `#111318`. Electric blue belongs to the interface and small accents.
- **Surfaces:** cool white `#F6F7F9`, graphite `#0D1015`, fine borders and restrained depth.
- **Type:** platform sans-serif for content, platform monospace for status and identifiers.
- **Icons:** a consistent 24-unit vector grid, rounded strokes and visible keyboard focus.
- **Motion:** short state changes with reduced-motion support.

The editable [mark.svg](mark.svg), React mark and native Android vectors share the same geometry. PNG app icons are exported by `scripts/visual-qa.mjs`; README covers are composed from actual application screenshots by `scripts/brand-assets.mjs`.

The initial concept board was generated with the built-in imagegen tool; the user selected direction B, Current. Its shape was then redrawn as maintainable repository-native SVG and Android vector paths. The original [exploration board](identity-exploration.png) is retained for provenance. There is no image-generation API or hosted font in the application.

The exact generation prompt and output inventory are recorded in [GENERATION.md](GENERATION.md). PWA maskable icons use a separate, inset symbol on a full graphite surface so launcher cropping preserves its silhouette.

Screenshots use a temporary seeded database, not personal reports or real account balances. Local visual QA uses temporary Playwright tooling and Chrome; `CHROME_BIN` can override the browser path.
