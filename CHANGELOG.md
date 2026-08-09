# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Set Dropdown Search Enhancer Module**: Added dedicated `setDropdownSearchEnhancer` module to intercept native TCDB set dropdown search inputs (`#setSearch`) in capturing phase, overriding strict `startsWith` matching with substring (`includes`) and OR condition matching across comma, semicolon, pipe, or space delimiters across collection routes (`CollectionSummary.cfm`, `ViewCollection.cfm`, `CollectionAddCardNumber.cfm`, `CollectionAddMultiples.cfm`, `ViewCollectionForSaleTrade.cfm`, `ViewCollectionWantlist.cfm`, `CollectionAddMultiplesText.cfm`, `CollectionDelMultiples.cfm`).
- **Filter Items OR Conditions**: Extended real-time listing filter matching (`applyFilter`) to support OR conditions using commas (`,`), semicolons (`;`), pipes (`|`), or spaces (` `) as delimiters.
- **Card Name Formatter Search Actions**: Added optional Baseball Reference and Google player search buttons to the floating popover with custom stroke SVG icons (`bref`, `google`). Only the extracted player name is passed to the search queries (`https://www.baseball-reference.com/search/search.fcgi?search=...` and `https://www.google.com/search?q=...`), and search actions always open in a new tab.
- **Card Name Formatter Settings & Scoping**: Added settings controls to toggle Copy, Baseball Reference Search, and Google Search. Output Mode selection is automatically set to `Floating Popover` and disabled when search actions are enabled, and configurable only when Copy alone is enabled.
- **Collection Defaulter Module**: Automatically sets the 'Collection' selection dropdown (`#CFForm_1 > select`) to a user-configured default value (default Collection ID `6`) on `ViewCollection.cfm` pages.
- **Pin Configuration Settings Tab**: New tab in the Settings modal allowing users to globally toggle individual pinned sets on/off and reorder them via drag-and-drop or keyboard controls.
- **Badge Configuration Settings Tab**: New tab in the Settings modal allowing users to independently toggle on/off and reorder action/shortcut badges for both the fixed top toolbar and injected set-link badge groups with real-time UI updates.

### Fixed
- **Filter Items Double-Counting Fix**: Fixed an issue where `buildRowIndex` double-counted data items on collection and listing tables by indexing nested `li` elements inside row action dropdown menus. Updated `buildRowIndex` and selector chrome definitions (`.dropdown-menu`, `.dropdown`, `.btn-group`, `.modal`) to ignore child menu items inside card rows.

## [0.1.0-beta] — 2026-08-06

### Added
- **Print Collection CSV Export**: Full CSV exporter for `PrintYourCollectionPDF.cfm` and `Collection.cfm?MODE=PRINT*` with page count assessment, rate-limited multi-part parsing, and thousands separator number formatting.
- **Initial Public Beta Release**: Reset project release version to `v0.1 Beta` (`0.1.0-beta`).

## [3.1.0] — 2026-08-03

### Added
- **Collection Quantity Counter Module**: Real-time distinct card count (`Qty >= 1`) and total item quantity counter overlay widget on `ViewCollectionForSaleTrade` and `ViewCollectionWantlist` pages (`Card Count: X / Z (Total Count: Y)`). Automatically updates on field quantity changes without requiring page refresh.
- **Unified Corner Toast & Widget Container**: Stacked flex container (`#tk-toast-container-bottom-right` / `#tk-toast-container-bottom-left`) for corner widgets and toast notifications with smooth slide animations and zero visual overlap.
- **Alphabetized & Accordion Settings Modal**: Sorted Modules & Routes alphabetically by display name. Rendered module rows as expandable accordions with header checkboxes, titles, full multi-line natural text wrapping descriptions, and smooth chevron expand buttons.
- **Parent Set ID Resolution**: Resolved parent set IDs for child insert set pages from Overview navigation links, ensuring INS and PAR toolbar links correctly return to parent set scope.


### Fixed
- **Set List Enhancer Contract & Observer Filtering**: Filtered self-generated DOM badge mutations in `MutationObserver` to prevent duplicate concurrent injection loops. Corrected total enhanced link calculation in contract reporting so Diagnostics accurately reflects page badge status.
- **Centralized Version Number**: Unified application version reporting across Settings UI, Diagnostics, and userscript metadata header via single source of truth in `src/core/version.js`.
- **Cross-Tab Throttle & Pagination Ceiling**: Added random jitter offset ($\Delta t \in [20\text{ms}, 80\text{ms}]$) and slot re-checks for multi-tab request serialization. Refactored pagination ceiling fallback when sets exceed max pages limit so data is safely downloaded without unhandled errors.

## [3.0.0] — 2026-07-29

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

### Second fixture round

**Fixed**
- **Figcaptions are no longer assumed to be variations.** Real checklist cards
  caption themselves with the card range they cover — `Checklist: 211-245` — and
  every one became a fabricated `VAR (Checklist: 211-245)` tag. Twenty wrong
  rows in a single real set, in a column people filter and sort on. A caption
  now becomes a variation only on evidence: a `VAR:`/`ERR:`/`UER:` prefix, an
  existing variation tag on the row, or a letter-suffixed card number such as
  `126b`. All 27 genuine variations in that set are still captured.

**Added**
- Seven more captures: a 727-row set with real variations and print runs, a
  non-sport set with no team links, two `Inserts.cfm` indexes across two sports,
  a single card page, and two paginated player-collection routes (one with 163
  pages).

**Confirmed**
- **`Checklist.cfm` does not paginate** — every set renders on one page,
  verified up to 727 rows. The export's page loop makes exactly one request per
  set today. It stays because the loop and its safety ceiling cost nothing and
  the site may change, but it is no longer described as load-bearing.
- Pagination is real on the collection routes, where the truncated numbered list
  and last-page link behaviour matters.

### Phase 6 — documentation & supportability

**Added**
- `core/contracts.js`: DOM contract checks are recorded, not just logged, and
  every result is listed in Settings → Diagnostics with the selector that failed.
  A report of "the feature didn't appear" is now answerable without asking the
  user to open a console.
- Contract coverage extended from two modules to all six, including runtime
  assumptions that are not a single selector — "the filter indexed zero rows",
  "badges went on zero of 40 links" — which are exactly the silent-no-op cases
  the checks exist for.
- README gains a full settings reference and a troubleshooting section keyed to
  what the UI actually reports.

**Changed**
- `assertContract` moved from `ui/dom.js` to `core/`, where the layering puts
  it; `ui/dom.js` re-exports it so UI code keeps one import surface.
- A contract failure now points the user at Diagnostics rather than only
  printing to the console.

### Phase 7 — GitHub integration

**Added**
- Project board [SCToolkit v3.0](https://github.com/users/djntechnic/projects/3)
  with one issue per outstanding item, so the findings from this review stay
  traceable now that the phases have landed.
- `type:chore` label.

**Already in place from earlier phases**
- `ci.yml` (lint → build → test → stale-dist guard) on every push and PR.
- `release.yml` on `v*` tags: verifies the tag matches `package.json`, extracts
  the matching changelog section as the release body, attaches the built
  userscript.
- Bug, feature, and selector-drift issue templates; blank issues disabled.
- Branch protection on `main`: CI must pass, no force-push, no deletion, no
  bypass — added once the repository went public in Phase 1.

### Variation, error, and correction notes

**Added**
- A **`Variations` column** in the exported CSV. The site lists a card's
  variations, errors, and corrections in a panel that is collapsed by default;
  those rows carry no card number, so the row parser skipped them and **none of
  that data reached the export**. The 1990 Donruss capture has 725 such panels
  and produced none of it. Panels are located by `aria-controls` rather than DOM
  position, so a layout change cannot pair a row with the wrong panel.
- Keywords found in a panel are merged into the `Tags` column, which is what a
  reader filters on. Card 10 of that set now reads `DK, ERR, VAR, COR` instead
  of `DK`.
- `COR` (corrected print) is now a recognised caption keyword. It was missing
  entirely: a `COR: ...` caption was either dropped or, on a suffixed card
  number, relabelled `VAR (COR: ...)` — a correction reported as a variation.

**Changed**
- **A caption keeps its own keyword.** `ERR: Reversed image` becomes
  `ERR (Reversed image)`, not `VAR (...)`. Flattening everything to `VAR`
  discarded a distinction the page makes explicitly.
- **Multi-keyword captions are split.** A real caption carries more than one
  semantic at once — `VAR: Pack border; "© 1989 LEAF, INC." on back; ERR:
  Reverse image` — and now yields two separate tags rather than one opaque blob.

### Known issues
- `Inserts.cfm` expandable-parent detection (the Inserts/Parallels badge logic)
  is exercised against real markup but its two branches are not individually
  pinned (#10).

## [2.42.0] — prior single-file releases

Versions up to and including 2.42.0 were maintained as a single monolithic
userscript with no changelog and are not published here. The v3.0 line starts
this history.
