# Architecture

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
| `core/` | No DOM writes. Logging, config, storage, SID and route helpers, module registry. |
| `net/` | All outbound HTTP funnels through here. Owns pacing, throttling, retry, block detection, the export queue. Nothing else calls `fetch`. |
| `data/` | Pure functions only: `Document` in, plain objects/strings out. No globals, no `GM_*`. This is where the test suite carries the most weight. |
| `ui/` | All DOM construction and styling. Reads from `core/`, never parses fetched pages. |
| `modules/` | User-facing features. Composed from the layers above; registered in `core/registry.js`. |

Dependencies point downward only: `modules → ui/net/data → core`. A `data/`
module importing from `ui/` is a bug.

### File map

| File | Responsibility |
|---|---|
| `core/log.js` | Levelled console logging; the CLIENT/SERVER origin tag |
| `core/config.js` | Schema, defaults, migration, persistence, `testUrlMatch` |
| `core/storage.js` | `GM_*` wrappers, pinned sets, `deriveSetYear` |
| `core/routes.js` | Page-shape predicates for the current URL |
| `core/sid.js` | Set-ID extraction from either URL form |
| `core/registry.js` | Module definitions and URL-gated resolution |
| `net/fetcher.js` | Timeout, retry loop, backoff, `Retry-After`; the only caller of `fetch` |
| `net/throttle.js` | Cross-tab request slot, shared through userscript storage |
| `net/pacing.js` | Adaptive delay penalty from observed latency and throttle signals |
| `net/cache.js` | TTL-keyed parsed-export cache |
| `net/blockDetect.js` | Challenge/denial page and status detection |
| `net/queue.js` | Serialized export queue |
| `net/setExport.js` | Multi-page checklist export orchestration |
| `data/checklistParser.js` | Checklist markup → plain row objects |
| `data/csv.js` | RFC 4180 escaping and download |
| `data/filename.js` | Export filename construction |
| `ui/styles.js` | Design tokens and component CSS |
| `ui/icons.js` | Icon geometry, the `<symbol>` sprite, and `<use>` references |
| `ui/badges.js`, `ui/dom.js` | Badge factory, DOM helpers |
| `ui/toolbar.js`, `ui/status.js`, `ui/toast.js`, `ui/settings.js` | The chrome |
| `modules/*.js` | One file per registry entry |

### Two known cycle hazards

Both are structural, and both are already avoided:

- **`status.js` is split from `toolbar.js`** so the export runner can report
  progress without importing the toolbar that started it.
- **`SettingsUI.init()` is called from `main.js`, not `Toolbar.init()`.** The
  settings pane renders the registry, the registry imports the modules, and the
  modules import the toolbar — so a toolbar that imported settings would close
  the loop.

## The registry contract

A module is an object in `ModuleRegistry`:

```js
{
  id: 'checklistEnhancer',      // key into Config.modules
  name: 'Checklist Enhancer',   // shown in settings and the status tooltip
  description: '...',           // shown in settings
  init: initChecklistEnhancer,  // () => void | Promise<void>
  isAsync: false,               // whether the bootstrap awaits init
  actionLabels: { ... }         // optional sub-feature toggles
}
```

`resolveModules()` filters by `Config.modules[id].enabled` and by
`testUrlMatch(cfg.urlMatch, location.href)`. That is the **only** gate.

> A module must not re-check the URL inside `init`. Doing so makes the route
> editor in Settings a lie: the user edits the patterns, the registry honours
> them, and the module then overrides the result. `test/registry.test.js` pins
> this — it moves `checklistEnhancer` onto an unrelated route by config alone
> and asserts the module follows.

Route rules are `{ pattern, exclude }`. With no rules, everything matches;
otherwise a URL must match at least one include (or there must be none) and no
exclude. An unparseable pattern never matches, so a typo cannot widen scope.

`init` may still branch on page *content* — that is a different question from
which pages the module is for.

## Data flow: an export

```
badge click
  └─ exportSetCSV(sid, label)
       └─ ExportQueue.enqueue          serialized; one export at a time
            └─ runExportSetCSV
                 ├─ cooldownRemainingMinutes()      refuse if recently blocked
                 ├─ cache.read(sid, ttl)            hit → download, zero requests
                 ├─ new AbortController             wired to the Cancel button
                 └─ for each page:
                      ├─ jitteredDelay()            base + pacing penalty + jitter
                      ├─ fetchPageWithRetry()
                      │    ├─ waitForSlot()         cross-tab gate
                      │    ├─ timedFetch()          per-request timeout + cancel
                      │    ├─ isBlockedStatus()     401/403 → BlockedError
                      │    ├─ 429/503               → Retry-After or backoff
                      │    └─ Pacing.record()       latency → future delay
                      ├─ detectBlock(html)          → BlockedError
                      ├─ DOMParser → parseChecklistDocument()
                      │    page 1 also yields identity + totalPages
                      └─ push plain row objects; drop the Document
                 ├─ cache.write(sid, result, ttl)
                 ├─ buildExportFilename()
                 └─ CSV.toCSV() → CSV.download()
```

Every page is reduced to plain objects as it arrives, so a 200-page run holds
one parsed document at a time rather than 200 live DOM trees.

Three outcomes are distinguished, because they need different responses:
`BlockedError` starts the cooldown, `AbortedError` reports a cancellation or a
timeout, and anything else is a plain failure. Collapsing them into one generic
"export failed" was how a challenge page previously became a mysteriously empty
set.

### The request invariant

Every request passes through the slot gate, the timeout, block-status
detection, throttle handling, and the pacing recorder — in that order, in
`fetchPageWithRetry`. There is no other caller of `fetch` in the codebase, and
adding one would bypass all five. If a second kind of fetch is ever needed, it
goes through this function or extends it.

## Adding a module

1. Create `src/modules/<name>.js` exporting a single `init<Name>()`.
2. Import it in `core/registry.js` and add a registry entry.
3. Add a `Config.modules.<id>` block to `DEFAULT_CONFIG` with `enabled`,
   `urlMatch`, and `actions`. Without it the module never resolves —
   `test/registry.test.js` fails on a registry entry with no config block, and
   on a config block with no registry entry.
4. Do not bump `schemaVersion` for an additive module; `mergeWithDefaults`
   already fills new keys from defaults. **Do** bump it when removing a module
   or an action toggle, so stale keys are cleared from storage.
5. Add tests for any pure logic the module needs, in `data/` or `core/`, not in
   the module file.

### Config schema changes

`migrate()` treats any stored version older than the current one as an upgrade
and merges it onto fresh defaults: the user's choices survive, new keys arrive
at their defaults, and removed modules and action toggles are dropped. Only a
version *newer* than the build, or one that is missing or not a positive
integer, resets to defaults.

That means a schema bump is safe by construction and does not need its own
branch. It also means removals must go through a bump — otherwise a deleted
toggle sits in storage forever, invisible to Settings and read by nothing.

## Testing

`node --test` with jsdom, no framework dependency. Three tiers:

- **Pure logic** — parser, filename, CSV, config migration, route matching,
  backoff maths. Fast, exhaustive, no DOM.
- **Fixture parsing** — `test/fixtures/*.html` through the real parser,
  including a golden-file assertion on exact CSV bytes. This is the tripwire
  for any future parser change.
- **Bundle smoke test** — `test/bootstrap.test.js` evaluates the built
  `dist/sctoolkit.user.js` in jsdom with stubbed `GM_*` globals. It is the only
  check that can catch an import cycle or a load-order fault, so **build before
  test**: `npm run check` and CI both do.

## Performance rules

The expensive things on these pages are layout reads and repeated markup
parsing, not computation. Three rules follow, and the Phase 3 tests pin them:

- **Never read layout in an event handler.** `innerText`,
  `getBoundingClientRect()`, `offsetTop` and friends force a synchronous
  reflow. Index what you need up front and read the cache. The checklist filter
  and Enter-to-Tab are both structured this way.
- **Toggle a class; do not write `style.display`.** A class write is a no-op
  when the state is unchanged, and it leaves the element's own stylesheet value
  intact.
- **Batch DOM insertion.** Build into a `DocumentFragment` and attach once. For
  work proportional to page size, slice it across `requestIdleCallback` and run
  the first slice synchronously so the visible region updates immediately.

Icons follow from the same reasoning: one sprite parsed once, referenced by
`<use>`, rather than a full SVG string parsed per badge.

## Build and release

`scripts/build.js` composes the metadata banner from `package.json` via
`src/meta.js`, so version and URLs cannot drift. `dist/` is committed; CI runs
`scripts/verify-dist.js` to guarantee the published auto-update artifact is
never stale relative to `src/`.
