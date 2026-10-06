## 4.1.15 (2026-10-06)

- Use Polish translations for regional Polish locales, and translate optional support labels while preserving search focus and existing trace history.
- Offer redacted JSON/CSV exports by default while retaining an explicit raw option. Omit identifying data, variables, service arguments and configuration from sharing exports.
- Quote CSV fields correctly and neutralize formula-like values; retain stored details when the server has expired a run.
- Cancel pending trace and export requests when the user or administrator role changes, and prevent older detail responses replacing the latest selection.
- Clear canceled list/detail loading when changing views or reconnecting, while retaining completed details.
- Render loading and retry states, and provide standalone browser-history settings with persistent page size.
- Keep export options open while changing redaction, restore focus with Escape, and preserve aborted outcomes in redacted exports.

- Refresh administrator controls and the household permission message after ordinary Home Assistant language changes without rereading trace history. Preserve active search text, focus and selection; same-language state updates retain the form DOM.

- Wrap long timeline action paths within narrow Sections cards.
- Refresh selected automation traces while retaining saved history, updating All Traces and the automation last-run time.
- Reset automation filters when changing views and explain unavailable trace details.
- Keep search focus, caret and text selection while typing and refreshing trace data.
- Render selected trace detail tabs and keep their selected state and keyboard focus consistent.
- Preserve the execution clock when refreshing relative trace ages; keep missing timestamps as Never.
- Count only persisted traces in the saved badge, including retention limits and failed browser-storage writes.
- Keep toolbar actions within narrow Home Assistant Sections cards.
- Explain administrator-only trace access to household users instead of showing an empty trace list.
- Replace the prominent support panel with one optional, dismissible link visible only to administrators.

## 4.1.14 (2026-09-01)

- Fixed Trace Viewer content crossing its Home Assistant Sections row boundary and overlapping the following card.
- Sections now use the viewer's natural content height instead of a fixed ten-row allocation.
- Added a regression check that rejects fixed row constraints for this dynamic card.

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
