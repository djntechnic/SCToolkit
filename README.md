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

## License

[MIT](LICENSE)
