## 4.1.13 (2026-08-28)

- Isolation: persistence is now card-local, removing `window._haToolsPersistence` load-order coupling while retaining existing localStorage keys.
- Isolation: removed the document-wide sibling-card injector, shared global escape helper, and the remaining dynamic HA Tools Panel loader.
- Isolation: Bento styling is component-local and no longer depends on or mutates `window.HAToolsBentoCSS` loaded by another card.
- UI: the support footer now renders directly inside Trace Viewer's own shadow root and survives normal re-renders without a global loader.
- Security: all runtime values use a local String-before-escape helper.
- Tests: retained trace regressions and added portfolio residual verification.

## 4.1.12 (2026-08-20)

- Security: escape automation friendly names, trace group names (including the
  `data-group` attribute), trace fetch errors, and the configured card title
  before inserting them into the card's HTML.
- Tests: add regression coverage for all three user-controlled HTML paths.

## 4.1.11 (2026-07-18)

- Fix (UI): the small accent dot before section titles no longer detaches from the title text (it was pushed to the opposite edge by the header's flex space-between); it is now pinned next to the title.

# Changelog — Trace Viewer

## [4.1.8] - 2026-06-15

- Theme: dark/light now follows the active Home Assistant theme (luminance of --card-background-color) instead of OS prefers-color-scheme.


## [4.1.7] - 2026-06-15

- Theme: dark/light now follows the active Home Assistant theme (luminance of --card-background-color) instead of OS prefers-color-scheme.


## [4.1.6] - 2026-06-15

- Theme: dark/light now follows the active Home Assistant theme (luminance of --card-background-color) instead of OS prefers-color-scheme.


## [4.1.3] - 2026-05-12

### Fixed
- Removed Google Fonts CDN @import (1 occurrence(s)); now uses system font stack with Inter as the preferred locally-installed face.
- Normalized bare `font-family: "Inter", sans-serif` declarations to a complete cross-platform system stack.
- Privacy section in README: claim now matches behaviour (no CDN dependencies).

All notable changes to **Trace Viewer** are documented here.

## [4.0.0] - 2026-05-10

### Major
- **Split from `MacSiem/ha-tools` monorepo** into a dedicated standalone HACS plugin.
- Bundled Bento Design System CSS inline — no shared dependency required.
- Inlined `_haToolsEsc` XSS sanitizer.
- Persistence keys migrated to per-tool namespace `ha-trace-viewer-…` (clean break — old data under `ha-tools-…` is **not** migrated automatically).
- Donation/support footer added to the panel.
- Cross-tool discovery banner removed; each tool stands on its own.

### Compatibility

- Home Assistant ≥ 2024.1.0
