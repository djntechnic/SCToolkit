# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Phase 0 scaffolding: repository, MIT license, `src/` module layout, esbuild
  bundle pipeline, generated userscript banner, `node --test` suite, CI and
  release workflows, issue templates.
- Auto-update support via `@updateURL` / `@downloadURL` against `dist/` on `main`.
- Phase 1: the full v2.42.0 feature set ported into ES modules under
  `src/{core,net,data,ui,modules}`, with JSDoc on every exported function.
- Phase 1: 79 automated tests, including a golden-file assertion on exact CSV
  bytes and a smoke test that boots the built bundle in jsdom — the check that
  catches import cycles and load-order faults.
- Test fixtures under `test/fixtures/`, with a documented sanitization
  procedure. They are synthetic for now; see `docs/TESTPLAN.md`.
- `docs/ARCHITECTURE.md` now documents the registry contract, the export data
  flow, how to add a module, and the two structural import-cycle hazards.

### Changed
- Project renamed to **SCToolkit** and relocated to its own repository. DOM ids
  and classes follow: `#sctk-toolbar`, `.sctk-btn`, `.sctk-badge`.
- `@description` reduced to a single sentence; release history now lives in this
  file rather than in the userscript metadata block.
- The checklist parser reads `textContent` rather than `innerText`. For the
  unrendered `DOMParser` documents it operates on these are the same value by
  specification, and the change makes the parser testable outside a browser.
- Export pages are reduced to plain row objects as they arrive, so a long run
  holds one parsed document at a time instead of one per page.
- `Routes.isSetPage()` is composed from the individual route predicates instead
  of re-listing the same seven path fragments.
- The two verbatim-duplicated export-threshold `Object.assign` blocks are one
  `syncExportConfig()` call.
- `Retry-After` parsing, exponential backoff, and block detection are separate
  pure functions, each with tests.
- Queue bookkeeping is logged as CLIENT, not SERVER. The SERVER tag now means
  exactly one thing: a network request happened.
- Module lifecycle logging belongs to the bootstrap; modules no longer announce
  themselves as well.
- Settings-save debounce is rebuilt when its own slider changes, so the setting
  takes effect immediately rather than on next page load.
- Pinned-set year derivation is one function shared by the create and render
  paths, which previously used different rules.
- `URL.revokeObjectURL` is called after a CSV download.
- Icon-only controls carry `aria-label`.

### Fixed
- Set links with no set id no longer receive badges. v2.42.0 substituted a
  random string, producing badge links to pages that cannot exist.

### Removed
- `@grant GM_addStyle` — declared but never used by the script.
- `Routes.isSetList()`, three write-only `State` fields, and
  `EXPORT_CONFIG.blockCooldownMs`. Each is recorded verbatim in
  [docs/REMOVED.md](docs/REMOVED.md) with revival notes.

### Phase 2 — dead code, deduplication, correctness

**Added**
- `renderBadgeSet()` replaces three hand-rolled badge blocks that appended the
  same badges in different orders with different handler wiring. An action badge
  with no handler is now skipped rather than rendered dead.
- `test/registry.test.js` and `test/badges.test.js`: every registry entry has a
  config block and vice versa, `actionLabels` name only real toggles, and route
  rules are proven to be the only gate on where a module runs.
- Contract checks moved onto selectors that are actually load-bearing — the
  filter mount point, and set links after the late-render grace period.

**Changed**
- Config `schemaVersion` 2 → 3. `migrate()` now upgrades from *any* older
  version by merging onto fresh defaults, instead of a hardcoded v1 → v2 branch
  that would have silently reset every user's settings on this bump.
- `mergeWithDefaults()` drops action toggles the build no longer defines, the
  same way it already dropped unknown modules.
- `'server'` log tags now mark only lines about an HTTP request. Counting SERVER
  lines during an export gives the number of requests made.

**Fixed**
- Export filenames describe what was fetched. Exporting a set from a wantlist
  page wrote a full checklist to `..._Wantlist.csv`.
- Editing `checklistEnhancer`'s route patterns in Settings now takes effect. The
  module re-checked routes itself and overrode the registry, making the editor
  inert for the one module most worth moving.

**Removed** — each recorded verbatim with revival notes in
[docs/REMOVED.md](docs/REMOVED.md):
- `cardNameFormatter`, a registered and enabled module whose only selector never
  matched anything in any shipped release.
- The `inlineActionCells` sub-feature: four selectors that do not exist, a CSS
  class with no rule, and handlers that only logged.
- The unreachable `icon` parameter of `createBtn`.

### Known issues
- Test fixtures are synthetic rather than sanitized real captures.

## [2.42.0] — prior single-file releases

Versions up to and including 2.42.0 were maintained as a single monolithic
userscript with no changelog and are not published here. The v3.0 line starts
this history.
