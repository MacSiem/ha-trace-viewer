# HA Trace Viewer

![Preview](banner.png)

Browse, inspect and export Home Assistant automation traces from a Lovelace
card — with success/error stats, a step-by-step timeline and JSON/CSV export.
Zero configuration: add the card and it discovers every `automation.*` entity.
Trace access requires a Home Assistant administrator account; household users
see a permission message without trace data or export controls.

[![Version](https://img.shields.io/github/v/release/MacSiem/ha-trace-viewer)](https://github.com/MacSiem/ha-trace-viewer/releases) [![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## How it works

**Short version: it works automatically.** The card needs no configuration and
no extra integration:

1. **Automations from HA state.** On load, the card lists every `automation.*`
   entity with its status and last-triggered time — searchable, sortable and
   filterable.
2. **Traces via the native trace API.** Selecting an automation fetches its
   execution traces (`trace/list`), shows total / success rate / average
   duration / error stats, and each run can be opened for a step-by-step
   detail view (`trace/get`) with Timeline, JSON, Changes, Config and Related
   tabs.
3. **Browser history.** Home Assistant keeps the last 5 traces per automation
   by default. The card automatically retains fetched summaries in this browser
   (up to 2000 traces) and details you open (up to 200 details). Older opened
   details remain available when Home Assistant expires the run. Runs whose
   details were never opened may have only a saved summary. The card collects
   history while in use; it does not add a background server job.

The **Settings** button explains retention and sets traces per page. You can
also raise `trace.stored_traces` in your automation configuration; YAML
automations need an `id` for traces. See the
[Home Assistant trace configuration](https://www.home-assistant.io/docs/automation/troubleshooting/#trace-configuration).

### What is automatic vs. manual

| Automatic | Manual (optional) |
|---|---|
| Discovering all automations | Nothing required to start |
| Trace stats and fetched summaries saved locally | Opening details to retain them locally |
| Trace detail timeline + flow view | Exporting traces to JSON / CSV |
| View preferences remembered | Raising `stored_traces` for more history |

## Comparing retained runs

Open a run and choose **Compare with previous retained run** to compare it with
this automation's nearest earlier retained run. This searches the available
history independently of the active filters. It does not imply that Home
Assistant retained every execution. You can also select two runs manually.

The two timelines show recorded execution points on a shared elapsed-time axis.
Matching paths and repeated-point ordinals line up across both runs. The first
confirmed difference is outlined, with the conclusion above the point list.
**Not recorded** is a gap, not a zero. The spacing between points does not prove
how long an action took, and variable values and configuration are not compared.
Expand **Comparison scope and limits** for the source, coverage and timing rules.
Unavailable or incomplete traces stay explicit and cannot produce a complete
comparison export. Long comparisons are paged; **Jump to first difference** also
opens the relevant page.

Dates and times in lists, details and timelines follow your browser/system time
zone by default. An explicit Home Assistant profile choice for server time or
12/24-hour display takes precedence. Date display can follow the system locale;
Polish and English labels remain in the selected Home Assistant language. Time
zone offsets distinguish repeated times at daylight-saving changes. Elapsed
milliseconds and exported source timestamps keep their original meaning.

Active filter buttons show the current scope. Clear one to reset only that
criterion and return focus to its control.

## Screenshots

| Light | Dark |
|---|---|
| ![Traces, light theme](docs/screenshots/card-traces-light-4.3.0.jpg) | ![Traces, dark theme](docs/screenshots/card-traces-dark-4.3.0.jpg) |

*Version 4.3.0 with harmless test automations in a real Home Assistant instance:
automation selection, run statistics and preserved detail tabs. Dark mode follows
your Home Assistant theme. No household trace is shown.*

![Comparison of two selected runs](docs/screenshots/card-comparison-4.3.0.jpg)

*Two elapsed timelines keep recorded points aligned. The outlined first difference
and the point list use the same Analyzer comparison. Missing points remain gaps;
the expandable source and limits explain what can be concluded.*

## Installation

1. Open HACS → Custom repositories.
2. Add `https://github.com/MacSiem/ha-trace-viewer` as category **Dashboard**
   (Lovelace plugin).
3. Install **HA Trace Viewer** and reload your browser.

## Quick start

```yaml
type: custom:ha-trace-viewer
```

That's it — no options are required.

## Features

- **By Automation / All Traces views** with time-range, status and text filters.
- **Trace detail** — timeline of triggers / conditions / actions, raw JSON,
  config and related entities.
- **Multi-select + export** — review selected traces or automations as JSON or CSV,
  with explicit source limits and a preview of the exact file.
- **Local saving** — keep important traces in browser storage beyond HA's
  5-trace limit and across restarts.

## Exporting and sharing

Select traces or automations, open **Export**, then choose JSON or CSV.
Private fields are off by default. Files contain anonymous run/automation aliases,
confirmed outcomes, durations and a bounded summary of details already loaded in
this card. Export does not fetch `trace/get`; missing details remain explicit.
The report distinguishes partial results and describes its source limits.

**Include reviewed private fields** adds reviewed automation names, run IDs and
confirmed timestamps for this export only. Tokens, users, addresses, variables,
service arguments, raw configuration, error messages, entity identifiers and
source paths remain excluded in both modes. Review the exact preview before
saving. CSV quotes separators, quotes and line breaks and neutralizes formula-like
text. Browser-retained raw details remain available in the administrator detail
view; they are not copied into the reviewed export.

## FAQ

**Do I have to configure anything?**
No. Add the card and it discovers your automations by itself.

**Why do I only see a few traces per automation?**
Home Assistant stores the last 5 traces per automation by default. Raise
`trace.stored_traces` to keep more on the server. This card's browser history
is separate and includes only runs fetched while the card is in use.

**Where are saved traces kept?**
In your browser's localStorage — per browser, per device. Clearing browser
data removes them; use Export (JSON/CSV) for permanent copies.

**Does this send data anywhere?**
No. Everything runs locally in your browser against your Home Assistant
instance — no telemetry, no CDN assets.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## Support

- [Buy Me a Coffee](https://buymeacoffee.com/macsiem)
- [PayPal](https://www.paypal.com/donate/?hosted_button_id=Y967H4PLRBN8W)

The optional in-card support link is shown only to administrators. Dismiss it in the card or set `show_support: false` in the card configuration.

## License

MIT, see [LICENSE](LICENSE).

## Privacy and data

Automation traces can include entity identifiers, service arguments and household activity. Saved browser data belongs to the current Home Assistant origin and is not a shared backup. Review exported files before sharing; keep raw traces private.

See [SECURITY.md](SECURITY.md) for safe vulnerability reporting and [NOTICE](NOTICE) for licensing notices.

Polish regional locales such as `pl-PL` use the Polish dictionary consistently. Ordinary language updates translate optional support labels while preserving the search draft, focus and text selection, without reloading trace history. Dismissed support stays hidden.
