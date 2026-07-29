# Test plan

Two layers: an automated suite that runs in CI with **zero live network
traffic**, and a manual route walk performed against a real browser before each
release.

## Automated (`npm test`)

`node --test` + jsdom, driven entirely by sanitized captures in
`test/fixtures/`. No test may make a network request.

| Suite | Status |
|---|---|
| Userscript metadata banner | ✅ Phase 0 |
| Checklist parser vs. fixtures (single page, multi-page, figcaption/variation row, no-person-link row) | Phase 1 |
| Golden-file: fixture → exact expected CSV bytes | Phase 1 |
| Export filename builder, incl. missing-year fallback | Phase 1 |
| CSV field escaping (comma, quote, newline, null) | Phase 1 |
| URL rule matching (include-only, exclude-only, both, invalid regex) | Phase 1 |
| Config migration (fresh, same-version merge, upgrade, unknown version, unknown module) | Phase 1 |
| Block detection vs. captured challenge/denial pages | Phase 4 |
| Backoff math, incl. `Retry-After` in seconds and HTTP-date form | Phase 4 |
| Cross-tab throttle timing, faked clock | Phase 4 |

### Capturing a fixture

Save the page source, then strip: session cookies, user handles, real
usernames, any personal collection data, and absolute URLs containing IDs tied
to an account. Fixtures are committed and public — treat them as such.

## Manual route walk

Install `dist/sctoolkit.user.js` and confirm each row.

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
