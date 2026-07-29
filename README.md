# SCToolkit

A userscript toolkit for sports card database browsing: instant table filtering, keyboard-first data entry, set shortcut badges, and a polite, rate-limited CSV export.

> **Status:** v3.0 is in active development. The full v2.42 feature set is ported and under test; UI redesign and anti-scraping hardening land in later phases.

---

## Install

1. Install a userscript manager — [Tampermonkey](https://www.tampermonkey.net/) is the reference target.
2. Open **[dist/sctoolkit.user.js](https://raw.githubusercontent.com/djntechnic/SCToolkit/main/dist/sctoolkit.user.js)** — Tampermonkey will offer to install it.
3. Updates arrive automatically; the script declares `@updateURL` against `main`.

## Features

| Feature | Where |
|---|---|
| Fixed toolbar with page context, pinned sets grouped by year, and a status readout | every page |
| Shortcut badges — inserts, parallels, for-sale, add-multiples, wantlist | set-scoped pages |
| Pin / CSV / shortcut badges beside every set link | set listings |
| Real-time table filter | checklist, for-sale, wantlist, add-multiples |
| Enter-to-Tab across text and number inputs | any page with inputs |
| Sale-type defaults and first-empty-field focus | add-multiples |
| Multi-page checklist export to CSV — paced, retrying, and queued one at a time | set-scoped pages |
| Raw-table CSV export | collection, player collection, print views |
| Settings: per-module enablement, editable route patterns, thresholds, log level | toolbar gear icon |

See [CHANGELOG.md](CHANGELOG.md) for what changed and what is still outstanding.

## Settings

Open with the gear icon in the toolbar, or `Ctrl+K` → "Open Settings".

### Global

| Setting | Default | What it does |
|---|---|---|
| Theme | auto | `auto` follows your OS. The site itself has no theme to follow. |
| Export base delay | 500 ms | Minimum wait between requests. Shared across every open tab. |
| Export jitter | 0–700 ms | Random amount added, so timing is not a fixed interval. |
| Max retries per page | 3 | Attempts on HTTP 429/503 before the export fails. |
| Retry backoff base / cap | 1 s / 15 s | Doubling backoff between retries. |
| Pagination safety ceiling | 200 | Hard stop on discovered page count. |
| Request timeout | 30 s | Abandons a request that never answers. |
| Anti-scraping cooldown | 5 min | After a detected block, refuse new exports for this long. |
| Export cache lifetime | 24 h | Re-exporting within this window makes **no requests**. 0 disables. |
| Toast duration | 4 s | How long notifications stay visible. |
| Filter debounce | 150 ms | Delay after typing before the table filter re-runs. |
| Settings save debounce | 400 ms | Delay before writing changes to storage. |
| Console log level | info | `debug` includes per-module lifecycle lines. |

Threshold and module changes apply on the next page load. Theme and log level
apply immediately.

### Modules & Routes

Each module can be switched off, and its route patterns edited. The patterns are
regular expressions matched against the full URL, and they are the **only** gate
on where a module runs — so adding a pattern genuinely moves a feature to a new
page.

### Diagnostics

What the script thinks about the current page: active modules, matched routes,
the resolved theme, the last detected block, cached-export occupancy with a
purge button, and every DOM contract check with its result.

## Troubleshooting

**A feature didn't appear.** Open Settings → Diagnostics. If a contract check
shows `MISSING`, the site's markup no longer matches what the script expects —
that is a selector-drift issue, and pasting those lines into a report is enough
to act on. If the module is not listed under "Active modules", its route
patterns did not match this URL.

**An export stopped partway.** The toolbar and the progress toast both report
why. `Export blocked` means the site returned a challenge or refused the
request; the script stops and will refuse new exports for the cooldown period,
which is deliberate — see [docs/POLITE-USE.md](docs/POLITE-USE.md). `Export
timed out` means a single request never answered.

**An export was suspiciously fast and made no requests.** It was served from the
cache. Diagnostics shows what is cached; purge there to force a refetch.

**Exports feel slower than they used to.** Adaptive pacing raises the delay when
the site is slow or rate-limits, and decays it only after sustained success. The
current penalty is shown in the toolbar status.

**`Ctrl+K` does nothing.** It stands down while you are typing in a page field,
so it cannot swallow input during bulk data entry. Click outside the field first.

**Nothing works at all.** Check the browser console for lines prefixed
`[SCToolkit`. Set the log level to `debug` in Settings for per-module detail.

## Development

```bash
npm ci
npm run lint      # eslint, incl. userscript-metadata rules
npm run build     # esbuild -> dist/sctoolkit.user.js
npm test          # node --test, no external framework
npm run check     # lint -> build -> test -> stale-dist guard
```

Build **before** test: `test/bootstrap.test.js` loads the built bundle to check that it boots, so a stale `dist/` means testing the wrong code. `npm run check` and CI both order the steps that way.

`dist/sctoolkit.user.js` is **committed on purpose** — it is the auto-update artifact users install from. CI fails if it does not match a fresh build of `src/`.

For local iteration, point Tampermonkey at the file on disk (`@require file:///C:/Dev/SCToolkit/dist/sctoolkit.user.js`) with *Allow access to file URLs* enabled, or simply reinstall after each build.

## Layout

| Path | Purpose |
|---|---|
| `src/core/` | logging, config store, storage, SID and route helpers, module registry |
| `src/net/` | fetch pacing, retry, block detection, export queue and orchestration |
| `src/data/` | page parsing, CSV generation, filename building |
| `src/ui/` | design tokens, icons, badges, toolbar, toasts, settings |
| `src/modules/` | user-facing features, registered and gated by config |
| `test/` | `node --test` suites; `test/fixtures/` holds page captures |
| `docs/` | architecture, test plan, removed-feature record, usage policy |

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Responsible use

Export features issue real HTTP requests to a third-party site. Pacing, caching, and hard-stop behaviour are described in [docs/POLITE-USE.md](docs/POLITE-USE.md) and are not user-disableable below their floors.

## Contributing

Issues and pull requests are welcome. Two things worth knowing:

- **`main` is protected.** CI — lint, build, tests, and a check that the
  committed `dist/` matches a fresh build — must pass before a merge.
- **`dist/sctoolkit.user.js` is committed on purpose**, because it is what users
  install from. Run `npm run build` and include the result in your PR, or CI
  will reject it as stale.

If a feature stopped working, open a **selector-drift** issue and paste the
contract-check lines from Settings → Diagnostics. That turns "it didn't appear"
into a named selector.

Open work is tracked on the
[project board](https://github.com/users/djntechnic/projects/3).

## License

[MIT](LICENSE)
