# SCToolkit

A userscript toolkit for sports card database browsing: instant table filtering, keyboard-first data entry, set shortcut badges, and a polite, rate-limited CSV export.

> **Status:** v3.0 is in active development. The scaffolding is in place; feature modules land phase by phase.

---

## Install

1. Install a userscript manager — [Tampermonkey](https://www.tampermonkey.net/) is the reference target.
2. Open **[dist/sctoolkit.user.js](https://raw.githubusercontent.com/djntechnic/SCToolkit/main/dist/sctoolkit.user.js)** — Tampermonkey will offer to install it.
3. Updates arrive automatically; the script declares `@updateURL` against `main`.

## Features

Documented per module as each lands. See [CHANGELOG.md](CHANGELOG.md) for what is shipping now.

## Development

```bash
npm ci
npm run lint      # eslint, incl. userscript-metadata rules
npm test          # node --test, no external framework
npm run build     # esbuild -> dist/sctoolkit.user.js
npm run check     # all of the above + stale-dist guard
```

`dist/sctoolkit.user.js` is **committed on purpose** — it is the auto-update artifact users install from. CI fails if it does not match a fresh build of `src/`.

For local iteration, point Tampermonkey at the file on disk (`@require file:///C:/Dev/SCToolkit/dist/sctoolkit.user.js`) with *Allow access to file URLs* enabled, or simply reinstall after each build.

## Layout

| Path | Purpose |
|---|---|
| `src/core/` | logging, config store, storage, routing, module registry |
| `src/net/` | fetch pacing, throttling, block detection, result cache |
| `src/data/` | page parsing, CSV generation, filename building |
| `src/ui/` | design tokens, icons, toolbar, toasts, settings, command palette |
| `src/modules/` | user-facing features, registered and gated by config |
| `test/` | `node --test` suites; `test/fixtures/` holds sanitized page captures |
| `docs/` | architecture, test plan, removed-feature record, usage policy |

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Responsible use

Export features issue real HTTP requests to a third-party site. Pacing, caching, and hard-stop behaviour are described in [docs/POLITE-USE.md](docs/POLITE-USE.md) and are not user-disableable below their floors.

## License

[MIT](LICENSE)
