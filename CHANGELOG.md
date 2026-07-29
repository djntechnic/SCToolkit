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

### Phase 3 — performance

**Changed**
- **Checklist filter.** Data rows are indexed once at install; filtering toggles
  a single `.tk-hidden` class against the cached text. Previously every debounce
  tick re-queried the table, ran a per-row `querySelector`, and read
  `row.innerText` — a layout-forcing property — meaning a thousand forced
  reflows per keystroke on a thousand-row set. The filter also now reports
  `n of N` matches.
- **Enter-to-Tab.** The eligible-input list is cached and invalidated by a
  `MutationObserver` and `resize`, instead of being rebuilt on every Enter with
  a `getBoundingClientRect()` call per input on the page. Visibility is tested
  with `offsetParent`.
- **Set listings.** Badges are built into a `DocumentFragment` and attached in
  one operation per link, and links are processed in idle-time chunks of 25 so a
  few-hundred-link page stays responsive. The first chunk runs synchronously so
  badges appear immediately where the user is already looking.
- **Late-rendered set links** are detected by a `MutationObserver` that
  disconnects on first hit, replacing a flat `setTimeout(500)` that was too
  early on a slow page and needlessly late on a fast one.
- **Icons** are injected once as a `<symbol>` sprite and referenced by `<use>`.
  A 200-link listing previously parsed ~1,400 complete icon markups through
  `innerHTML`.
- **Settings CSS** is injected on first open rather than at page load.

**Fixed**
- Add Multiples no longer fights the user for the cursor. The old
  `setInterval(forceFocus, 250)` ran five times unconditionally, so typing in
  another field within 1.25s of load had focus stolen mid-word up to four more
  times. Focus is now re-asserted only while it has actually been lost, and any
  keypress, pointer press, or scroll cancels it outright.

**Notes**
- The export-memory item from the plan's Phase 3 already landed in Phase 1:
  pages are reduced to plain row objects as they arrive.
- `dist/` grew ~4 KB. The bundle is deliberately not minified — it is a
  userscript users can read before installing — so the added documentation
  outweighs the markup the sprite removes. The runtime win is in parse count,
  not bytes.

### Phase 4 — anti-scraping mitigation

**Added**
- **Cross-tab throttle** (`net/throttle.js`). Every request is gated on a
  timestamp shared across all tabs, so two tabs exporting at once interleave
  rather than doubling the request rate. This was the largest gap between what
  `docs/POLITE-USE.md` promised and what the code did.
- **Export cache** (`net/cache.js`). Parsed results are stored with a TTL
  (default 24 h, 0 to disable); re-exporting a set within the window makes zero
  requests. Capped at 20 sets and 20,000 rows per set, with occupancy and a
  purge button in Settings. Raw HTML is never persisted.
- **Adaptive pacing** (`net/pacing.js`). A session penalty on top of the base
  delay, raised on a rate-limit response or a sustained slow rolling median, and
  decayed only on continued success — it rises five times faster than it falls.
  Surfaced in the toolbar so a slowdown is visible rather than mysterious.
- **Per-request timeout** (default 30 s) and a **Cancel Export** button. A hung
  request previously stalled the queue indefinitely, and a 200-page run could
  only be stopped by closing the tab. Cancelling interrupts a backoff wait too —
  a cancel button that ignores a 15-second sleep is not a cancel button.
- Typed `AbortedError` and `BlockedError`, so a cancellation, a timeout, and a
  block are reported as three different things rather than one generic failure.

**Changed**
- **Block detection** now covers JavaScript-challenge interstitials
  (`__cf_chl`, `challenge-platform`, `Just a moment`), hCaptcha, and HTTP
  401/403 in addition to the original three markers. A challenge page that
  matched none of them used to parse as an empty checklist and get reported as a
  mysteriously missing set.
- **`Access Denied` no longer matches page copy.** The bare substring was
  searched across the whole body, so an ordinary page mentioning the phrase
  would abort the export and start a five-minute cooldown. Denial detection now
  only matches inside a `<title>` or `<h1>`.

**Notes**
- No schema bump: the new settings are additive, and `mergeWithDefaults` fills
  new keys from defaults.
- `docs/POLITE-USE.md` has no outstanding items left. Every commitment in it is
  now implemented and tested.

### Real-page fixtures

**Added**
- Sanitized captures of nine live pages under `test/fixtures/real/`, and
  `scripts/sanitize-fixture.js` to produce them. The sanitizer strips scripts,
  styles, and inline handlers; pseudonymises every account handle including
  third parties who appear in a listing; blanks prices; and trims repeated
  blocks through a real DOM rather than a regex, so a fixture cannot end up
  parsing differently from the page it came from.
- `test/realPages.test.js`, including an assertion that no fixture contains an
  account handle, a `<script>` tag, or an inline event handler — a capture that
  slipped through sanitization fails the build instead of reaching the repo.

**Fixed** — both found by the captures, both invisible to synthetic fixtures:
- **The checklist filter never appeared on for-sale, wantlist, or add-multiples
  pages.** It required `#main-content-area`, which only exists on checklist and
  set-index pages; the other three routes in the module's own `urlMatch` use
  `#content`. Three of its four configured routes had silently done nothing
  since v2.42.0.
- **The print-view export wrote an empty CSV.** That page is a card grid with no
  table at all, and the exporter only read `table tr`. It now falls back to the
  grid, and refuses with a message rather than downloading an empty file.

**Confirmed by capture, not assumed**
- Pagination discovery is correct on a control that lists 10 numbered links for
  an 18-page listing: the true total comes from the last-page link, which the
  max-across-all-links approach picks up. Reading only the numbered links would
  have exported 10 of 18 pages and reported success.
- Scoping page discovery to `.pagination` is what keeps the `?PageIndex=1` on
  every card link out of the page count.

### Phase 5 — UI/UX redesign

**Added**
- **Dark mode**, with a `Theme` setting of auto / light / dark. `auto` follows
  the OS and updates live. The plan called for detecting the site's own theme as
  a middle source — the real captures carry no theme signal of any kind, so that
  branch is not implemented rather than guessed at.
- **Ctrl+K command palette** with fuzzy search over pinned sets, the shortcut
  actions for the current set, export, and settings. Ignored while typing in a
  page field, so it cannot swallow a keystroke on a data-entry page.
- **Diagnostics tab** in Settings: version, matched routes, active-module
  resolution for the current URL, last block timestamp, resolved theme, and
  cache occupancy. All of this previously reached only the console, so a report
  of "the filter didn't appear" could not be answered.
- **Progress toasts** that update in place with page *n* of *N* and carry their
  own Cancel button, next to the thing they cancel.

**Changed**
- **The page offset is measured.** `body { padding-top: 38px }` was a fixed
  compensation for a `flex-wrap: wrap` toolbar — the moment it wrapped to two
  rows it covered the top of the page. The toolbar no longer wraps, and a
  `ResizeObserver` publishes its real height.
- **Dropdowns are click-only**, with `aria-expanded`, Escape-to-close that
  returns focus to the trigger, and arrow-key/Home/End navigation. Hover-open
  cannot be dismissed on a touch device and fires by accident on desktop.
- **Toast variants are named** (`success`/`warn`/`error`/`progress`/`muted`)
  rather than each call site passing a raw colour, and every variant resolves
  through a theme token — a hardcoded colour would have stayed light in dark
  mode. Stacking is capped so a long export cannot bury the page.
- **The settings modal is a real dialog**: `role="dialog"`, `aria-modal`, a
  focus trap, Escape to close, and focus returned to wherever it came from.
- Toasts are announced via `aria-live="polite"`.

**Notes**
- No schema bump: `theme` is additive.

### Known issues
- No capture of a **multi-page `Checklist.cfm`** yet; pagination on that exact
  route is proven by the shared control markup, not directly.

## [2.42.0] — prior single-file releases

Versions up to and including 2.42.0 were maintained as a single monolithic
userscript with no changelog and are not published here. The v3.0 line starts
this history.
