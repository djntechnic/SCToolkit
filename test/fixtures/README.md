# Test fixtures

These pages are **synthetic**. They reproduce the markup shapes the parser
depends on — `#setname-content` headings, a `.pagination` list, and
`#main-content-area` tables whose rows carry `ViewCard.cfm` / `Person.cfm` /
`Team.cfm` links — without being copies of any real page.

That makes them safe to commit and precise about what is being tested, but it
also means they only prove the parser handles the shapes we *believe* exist.
Replacing them with sanitized captures of real pages is tracked in
[../../docs/TESTPLAN.md](../../docs/TESTPLAN.md).

## Sanitizing a real capture

Before committing a saved page:

1. Strip every `<script>`, `<link>`, and inline event handler.
2. Remove cookies, session tokens, and any `?...` query string carrying one.
3. Replace usernames, collection counts, and prices with placeholder values —
   these are public issue-tracker artifacts.
4. Keep the structural markup the parser reads. Do not "tidy" the table.

| File | Covers |
|---|---|
| `checklist-single-page.html` | one page, no pagination; tags, print run, generational suffix |
| `checklist-multi-page.html` | pagination discovery up to `PageIndex=4` |
| `checklist-figcaption.html` | variation captions merged into the tag column |
| `checklist-no-person-link.html` | rows for unnamed subjects (team/checklist cards) |
| `challenge-page.html` | an anti-scraping challenge response |
