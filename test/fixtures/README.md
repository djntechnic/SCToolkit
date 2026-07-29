# Test fixtures

Two sets, with different jobs.

## `real/` — sanitized captures of live pages

These are the authority. They prove the parser and the module selectors handle
the markup the site actually returns, and they have already overturned two
assumptions the synthetic fixtures could not.

| File | Route | What it pins |
|---|---|---|
| `checklist.html` | `Checklist.cfm` | full parse of 100 rows → CSV; three card links per row; generational suffixes; `RC` tag extraction |
| `collection-mode.html` | `ViewCollectionMode.cfm` | **an 18-page pagination control that lists only 10 numbered links** |
| `add-multiples-text.html` | `CollectionAddMultiplesText.cfm` | a short pagination control; filterable rows outside `#main-content-area` |
| `for-sale-trade.html` | `ViewCollectionForSaleTrade.cfm` | filter container is `#content`, not `#main-content-area` |
| `wantlist.html` | `ViewCollectionWantlist.cfm` | as above |
| `collection-browse.html` | `CollectionBrowse.cfm` | another paginated listing shape |
| `view-all.html` | `ViewAll.cfm` | set links for badge injection; image-only links excluded |
| `print-collection.html` | `PrintYourCollectionPDF.cfm` | **a card grid with no table at all** |
| `homepage.html` | `/` | negative control: card links present, but no checklist to parse |

### Adding one

Save the page, then run it through the sanitizer — do not edit by hand:

```bash
node scripts/sanitize-fixture.js capture.html test/fixtures/real/name.html --owner YOUR_HANDLE --max-rows 28 --max-options 8
```

It strips scripts, styles, and inline handlers; pseudonymises every account
handle including third parties who merely appear in a listing; blanks prices;
neutralises asset paths; and trims repeated blocks through a real DOM so the
result still parses the way the original did.

Then check the result:

```bash
npm test
```

`test/realPages.test.js` asserts that no fixture contains the owner handle, a
`<script>` tag, or an inline handler — so a capture that slipped through
sanitization fails the build rather than reaching the repository.

Raw captures go in `test/fixtures/submitted/`, which is **gitignored**. They
contain unredacted handles and the browser's saved asset directories, and must
never be committed.

## Synthetic fixtures

Hand-written pages reproducing one shape each, for cases a real capture happens
not to contain — a figcaption variation row, a row with no person link, and the
challenge and denial pages.

The challenge fixtures are synthetic on purpose and are not a weakness:
challenge interstitials are generic vendor output, identical everywhere, and
capturing a real one means getting blocked on purpose.

| File | Covers |
|---|---|
| `checklist-single-page.html` | tags, print run, generational suffix, header and footer rejection |
| `checklist-multi-page.html` | pagination discovery up to `PageIndex=4` |
| `checklist-figcaption.html` | variation captions merged into the tag column |
| `checklist-no-person-link.html` | rows for unnamed subjects (team/checklist cards) |
| `challenge-page.html` | a legacy reCAPTCHA challenge |
| `challenge-cloudflare.html` | a JavaScript-challenge interstitial |
| `challenge-hcaptcha.html` | an hCaptcha gate |
| `denial-page.html` | an access-denied response |
| `checklist-mentions-denial.html` | **a legitimate page whose copy says "Access Denied"** — the false positive that must not be flagged |
