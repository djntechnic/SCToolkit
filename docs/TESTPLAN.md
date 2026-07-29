# Test plan

Two layers: an automated suite that runs in CI with **zero live network
traffic**, and a manual route walk performed against a real browser before each
release.

## Automated (`npm test`)

`node --test` + jsdom, driven entirely by fixtures in `test/fixtures/`. No test
may make a network request.

**Build before test.** `test/bootstrap.test.js` loads the built bundle, so a
stale `dist/` makes it assert against the wrong code. `npm run check` and CI
both order the steps `lint → build → test → verify-dist`.

| Suite | File | Status |
|---|---|---|
| Userscript metadata banner | `meta.test.js` | ✅ Phase 0 |
| Subject-cell token classification (tags, print run, generational suffix, captions) | `checklistParser.test.js` | ✅ Phase 1 |
| Checklist parser vs. fixtures (single page, multi-page, figcaption row, no-person-link row) | `checklistParser.test.js` | ✅ Phase 1 |
| Golden-file: fixture → exact expected CSV bytes | `checklistParser.test.js` | ✅ Phase 1 |
| Export filename builder, incl. missing-year fallback | `filename.test.js` | ✅ Phase 1 |
| CSV field escaping (comma, quote, newline, null) | `csv.test.js` | ✅ Phase 1 |
| URL rule matching (include-only, exclude-only, both, invalid regex) | `config.test.js` | ✅ Phase 1 |
| Config migration (fresh, same-version merge, v1 upgrade, unknown version, unknown module) | `config.test.js` | ✅ Phase 1 |
| SID extraction and pinned-set year derivation | `storage.test.js` | ✅ Phase 1 |
| Block detection vs. a challenge-page fixture | `net.test.js` | ✅ Phase 1 |
| Backoff math, incl. `Retry-After` in seconds and HTTP-date form | `net.test.js` | ✅ Phase 1 |
| Bundle boots in jsdom; toolbar, filter, and settings mount | `bootstrap.test.js` | ✅ Phase 1 |
| Registry/config symmetry; route rules are the only gate on a module | `registry.test.js` | ✅ Phase 2 |
| Badge set rendering: order, handler wiring, no dead action badges | `badges.test.js` | ✅ Phase 2 |
| Schema upgrade from every older version preserves user settings | `config.test.js` | ✅ Phase 2 |
| Filter row index, class-based hiding, input eligibility, badge injection | `perf.test.js` | ✅ Phase 3 |
| Icon sprite completeness; no dangling `<use>` references | `icons.test.js` | ✅ Phase 3 |
| Settings CSS injected on first open only | `bootstrap.test.js` | ✅ Phase 3 |
| Block detection: challenge, hCaptcha, denial page, and the page-copy false positive | `antiScraping.test.js` | ✅ Phase 4 |
| Cross-tab throttle timing, incl. another tab claiming mid-wait | `antiScraping.test.js` | ✅ Phase 4 |
| Adaptive pacing: rise, decay, clamps, bounded sample window | `antiScraping.test.js` | ✅ Phase 4 |
| Cache read/write/TTL/eviction, and corrupt-data tolerance | `antiScraping.test.js` | ✅ Phase 4 |
| Real checklist → CSV, incl. suffixes, tags, and thumbnail-link rejection | `realPages.test.js` | ✅ |
| Real 18-page pagination control read from the last-page link | `realPages.test.js` | ✅ |
| Filter container resolution across all four listing routes | `realPages.test.js` | ✅ |
| Print-view export is non-empty | `realPages.test.js` | ✅ |
| Fixtures carry no account handle, script tag, or inline handler | `realPages.test.js` | ✅ |
| Block detection vs. captured *real* challenge pages | — | needs a real capture |

### Fixture status

`test/fixtures/real/` holds **sanitized captures of live pages** — these are the
authority, and they overturned two assumptions the synthetic fixtures could not
see. `test/fixtures/` also keeps hand-written pages for shapes a capture happens
not to contain (a figcaption variation row, challenge and denial pages).

Sanitization is a script, not a checklist, and the suite asserts that no fixture
contains an account handle, a `<script>` tag, or an inline handler — a capture
that slipped through fails the build. See
[`test/fixtures/README.md`](../test/fixtures/README.md).

The golden-file test is the regression tripwire for the parser. If a change to
`checklistParser.js` breaks it, the change is wrong until proven otherwise.

## Manual route walk

Install `dist/sctoolkit.user.js` and confirm each row. Rows referencing a
command palette, Diagnostics tab, cancel affordance, cross-tab throttling, or
the result cache describe features that land in Phases 3–5 and are not
testable yet.

| Route | Confirm |
|---|---|
| Checklist (multi-page) | Filter is instant on a 1,000-row set and shows `n of N`; hidden rows carry `.tk-hidden` and no inline style; export matches the golden CSV; progress toast counts pages; **Cancel** aborts mid-run. |
| Set index / inserts listing | Badges on every set link; **no badge group on links lacking a set id**; a several-hundred-link page stays scrollable while badges fill in. Icons render — a broken sprite reference shows as blank space. |
| Add-multiples entry | Sale-type defaults applied; first zero-quantity input focused; Enter tabs through hundreds of inputs without lag. **Type into a different field immediately on load — the cursor must not be taken back.** |
| For-sale / wantlist views | Filter present; a set export started here is named `..._Checklist.csv`, because a checklist is what was fetched. |
| Settings → Modules & Routes | Add a route pattern to Checklist Enhancer, reload, and confirm the filter appears on the newly matched page. |
| Upgrade from an earlier install | Existing module toggles, route patterns, and thresholds survive the schema bump; a stored `inlineActionCells` key is gone from storage. |
| Single card / person pages | Context label and shortcut badges correct. |
| Any page | Ctrl+K palette; Settings tabs incl. Diagnostics; theme follows system and manual override; toolbar wrapping never covers page content; full keyboard traversal with visible focus; screen-reader labels on icon-only controls. |
| Two tabs at once | Simultaneous exports interleave at the configured global rate, not double rate. |
| Cache | Second export of the same set completes with zero network requests; purge forces a refetch. |
| Auto-update | Bump version, tag, release; the userscript manager detects the update from the raw URL. |

## Migration check

Install v3.0 over an existing v2.42 profile: pins survive, stored config
migrates without reset, Settings reflects prior values.
