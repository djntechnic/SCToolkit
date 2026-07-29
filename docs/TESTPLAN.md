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
| Block detection vs. captured *real* challenge pages | — | Phase 4 |
| Cross-tab throttle timing, faked clock | — | Phase 4 |

### Fixture status

The committed fixtures are **synthetic** — they reproduce the markup shapes the
parser depends on without being copies of any real page. They prove the parser
handles the shapes we believe exist, which is not the same as proving those are
the shapes that do exist. Replacing them with sanitized real captures is
outstanding work; see [`test/fixtures/README.md`](../test/fixtures/README.md)
for the sanitization procedure.

The golden-file test is the regression tripwire for the parser. If a change to
`checklistParser.js` breaks it, the change is wrong until proven otherwise.

## Manual route walk

Install `dist/sctoolkit.user.js` and confirm each row. Rows referencing a
command palette, Diagnostics tab, cancel affordance, cross-tab throttling, or
the result cache describe features that land in Phases 3–5 and are not
testable yet.

| Route | Confirm |
|---|---|
| Checklist (multi-page) | Filter is instant on a 1,000-row set; export matches the golden CSV; progress toast counts pages; **Cancel** aborts mid-run. |
| Set index / inserts listing | Badges on every set link; **no badge group on links lacking a set id**; no jank on a long list. |
| Add-multiples entry | Sale-type defaults applied; first zero-quantity input focused; Enter tabs through hundreds of inputs without lag; typing immediately is not stolen by the focus retry. |
| For-sale / wantlist views | Filter present; export filename reflects the *fetched* content, not the current page. |
| Single card / person pages | Context label and shortcut badges correct. |
| Any page | Ctrl+K palette; Settings tabs incl. Diagnostics; theme follows system and manual override; toolbar wrapping never covers page content; full keyboard traversal with visible focus; screen-reader labels on icon-only controls. |
| Two tabs at once | Simultaneous exports interleave at the configured global rate, not double rate. |
| Cache | Second export of the same set completes with zero network requests; purge forces a refetch. |
| Auto-update | Bump version, tag, release; the userscript manager detects the update from the raw URL. |

## Migration check

Install v3.0 over an existing v2.42 profile: pins survive, stored config
migrates without reset, Settings reflects prior values.
