# Architecture

> **Phase 0 status.** This document describes the target structure. Sections
> marked _(pending)_ are filled in as each phase lands.

## Shape

SCToolkit ships as a **single userscript file** — that is a hard constraint of
the distribution channel — but is *authored* as ES modules under `src/` and
bundled by esbuild into one IIFE. Authoring and distribution are deliberately
decoupled:

- **Authoring** gets real module boundaries, importable pure functions, and a
  test surface that never needs a browser.
- **Distribution** stays a single file with no runtime imports, no CSP concerns,
  and one artifact to auto-update.

```
src/main.js  --esbuild-->  dist/sctoolkit.user.js  --raw.githubusercontent-->  Tampermonkey
```

## Layers

| Layer | Rule |
|---|---|
| `core/` | No DOM writes. Logging, config, storage, route predicates, module registry. |
| `net/` | All outbound HTTP funnels through here. Owns pacing, throttling, retry, block detection, caching. Nothing else calls `fetch`. |
| `data/` | Pure functions only: `Document` in, plain objects/strings out. No globals, no `GM_*`. This is where the test suite carries the most weight. |
| `ui/` | All DOM construction and styling. Reads from `core/`, never parses pages. |
| `modules/` | User-facing features. Composed from the layers above; registered in `core/registry.js`. |

Dependencies point downward only: `modules → ui/net/data → core`. A `data/`
module importing from `ui/` is a bug.

## The registry contract _(pending — Phase 1)_

Each module declares `{ id, name, init, urlMatch, actions }` and is gated
**solely** by the registry's URL matching. Modules must not re-check routes
themselves; doing so makes the Settings route editor inert.

## Data flow: an export _(pending — Phase 1/4)_

## Adding a module _(pending — Phase 1)_

## Build and release

`scripts/build.js` composes the metadata banner from `package.json` via
`src/meta.js`, so version and URLs cannot drift. `dist/` is committed; CI runs
`scripts/verify-dist.js` to guarantee the published auto-update artifact is
never stale relative to `src/`.
