# Removed functionality

A record of behaviour deleted during the v3.0 port, kept so nothing is lost
silently. Every entry states the original code, what it was meant to do, and
what would be required to bring it back.

Line references point into the pre-port v2.42.0 single-file source, which is
retained outside this repository. Each entry quotes the removed code verbatim,
so the reference is a convenience rather than a requirement.

---

## `Modules.CardNameFormatter`

**Removed in:** 3.0.0-alpha.2 (Phase 2)
**Original location:** `v2.42.0-monolith.user.js:1269-1277`, registry entry at `1479-1485`

**Intent:** normalize ` - ` to a plain space inside card name nodes, so
`Griffey - Jr` renders as `Griffey Jr`.

**Why removed:** its only selector, `.card-name-selector`, is a placeholder that
does not exist in the site's markup. `querySelectorAll` returned an empty list
on every page, for every release that shipped it. It was a registered, enabled,
user-visible module in Settings that had never once done anything.

**Original code:**

```js
CardNameFormatter: () => {
    DOMUtils.assertContract('cardNameFormatter', [
        { selector: '.card-name-selector', label: '.card-name-selector (card name nodes)' }
    ]);
    const nameNodes = document.querySelectorAll('.card-name-selector');
    nameNodes.forEach(node => {
        node.textContent = node.textContent.replace(/(\w+)\s-\s(\w+)/g, '$1 $2').trim();
    });
},
```

**To revive:** identify the real class or structure that wraps a card name,
recreate `src/modules/cardNameFormatter.js` with the transform above, register
it, and add a `DEFAULT_CONFIG.modules.cardNameFormatter` block. The transform
itself is sound; only the selector was ever wrong.

---

## `checklistEnhancer.actions.inlineActionCells`

**Removed in:** 3.0.0-alpha.2 (Phase 2)
**Original location:** `v2.42.0-monolith.user.js:1311-1334`

**Intent:** add a column of quick-action buttons — add one to for-sale, add one
to wantlist, and five status toggles — to every checklist row, and relocate the
page's wantlist control into a top bar.

**Why removed:** three separate dead ends. None of `tr.checklist-row`,
`.action-cell-selector`, `.action-wantlist-selector`, or `.top-bar-selector`
exist in the site's markup. The `.tk-inline-action` class it applied had no CSS
rule anywhere in the script, so the buttons would have been unstyled text. And
the click handler only wrote a log line — no action was ever implemented. It
shipped disabled by default, labelled in Settings as "non-functional
placeholders".

**Original code:**

```js
const wantlistAction = document.querySelector('.action-wantlist-selector');
const topBar = document.querySelector('.top-bar-selector');
if (wantlistAction && topBar) topBar.prepend(wantlistAction);

const rows = document.querySelectorAll('tr.checklist-row');
rows.forEach((row, index) => {
    const actionCell = row.querySelector('.action-cell-selector') || row.insertCell();
    ['+1 FS', '+1 W', 'FS', 'FT', 'W', 'I', 'P'].forEach(action => {
        const span = document.createElement('span');
        span.className = 'tcdb-inline-action';
        span.innerText = `[${action}]`;
        span.title = `Perform ${action} action`;
        span.onclick = () => Log(`Triggered [${action}] on row index ${index}`);
        actionCell.appendChild(span);
    });
});
```

**To revive:** this is a feature to design, not code to restore. It needs the
real row selector, real CSS, and — the part that was never written — actual
implementations of the seven actions, each of which is a state-changing request
to the site. That last point makes it a much larger piece of work than the
stub suggests, and it would need its own entry in `docs/POLITE-USE.md`.

**Storage note:** a stored `inlineActionCells: true` from an earlier install is
dropped by `mergeWithDefaults`, which now keeps only action keys the current
build defines. The `schemaVersion` bump to 3 is what triggers that cleanup.

---

## The `icon` parameter of `DOMUtils.createBtn`

**Removed in:** 3.0.0-alpha.2 (Phase 2)
**Original location:** `v2.42.0-monolith.user.js:389-398`

**Intent:** let a toolbar button render a leading icon.

**Why removed:** no caller ever passed it. `Toolbar.addAction` — the only route
to `createBtn` — has no icon parameter of its own, so the argument was
unreachable. Every button rendered `${''}<span>…` and the empty interpolation
went unnoticed.

**Original code:**

```js
createBtn: (id, text, onClick, disabled = false, icon = '') => {
    const btn = document.createElement('button');
    btn.id = id;
    const iconSvg = icon && Icons[icon] ? Icons[icon]() : '';
    btn.innerHTML = `${iconSvg}<span>${text}</span>`;
    // ...
},
```

**To revive:** add the parameter back to both `createBtn` and
`Toolbar.addAction`, and use `renderBadgeSet`'s pattern of building the icon
element rather than interpolating markup — the original also set the label via
`innerHTML`, which is unnecessary for text that is always static.

---

## Route re-checking inside `ChecklistEnhancer`

**Removed in:** 3.0.0-alpha.2 (Phase 2)
**Original location:** `v2.42.0-monolith.user.js:1283`

**Intent:** restrict the filter bar to checklist-family pages.

**Why removed:** the registry already restricted it, using the user-editable
`urlMatch` rules. The module then applied a second, hardcoded check — so
editing the route patterns in Settings did nothing for this module. The
Settings route editor was, for the one module people would most want to move,
inert. The registry is now the only gate.

**Original code:**

```js
if (actionCfg.realtimeFilter && mainContent && (Routes.isChecklist() || Routes.isForSaleTrade() || Routes.isWantlist() || Routes.isAddMultiples()) && !document.getElementById('tk-checklist-filter-wrap')) {
```

**To revive:** don't. If the filter should be restricted further, the
restriction belongs in `DEFAULT_CONFIG.modules.checklistEnhancer.urlMatch`,
where a user can see and change it.

---

## Filename suffix taken from the current page

**Removed in:** 3.0.0-alpha.2 (Phase 2) — behaviour change

**Original location:** `v2.42.0-monolith.user.js:1150-1153`

**Intent:** label the exported file with the kind of listing it came from.

**Why removed:** the export runner always fetches `/Checklist.cfm`, but the
suffix was chosen from the route of whatever page the button was clicked on. A
full checklist exported from a wantlist page was written to disk named
`..._Wantlist.csv`. The file's contents and its name disagreed, and the name is
what the user sorts by later.

**Original code:**

```js
let pageSuffix = '_Checklist';
if (Routes.isForSaleTrade()) pageSuffix = '_ForSale';
else if (Routes.isWantlist()) pageSuffix = '_Wantlist';
else if (Routes.isAddMultiples()) pageSuffix = '_AddMultiples';
```

**To revive:** the suffix map survives as `EXPORT_KIND_SUFFIX` in
[`src/data/filename.js`](../src/data/filename.js), and `buildExportFilename`
still takes a `kind`. If a runner is added that genuinely fetches a for-sale or
wantlist listing, it passes the matching kind — derived from what it fetched.

---

## `Routes.isSetList()`

**Removed in:** 3.0.0-alpha.1 (Phase 1)
**Original location:** `v2.42.0-monolith.user.js:364`

**Intent:** identify a `/ViewSet.cfm` page.

**Why removed:** no call sites. `Routes.isSetPage()` re-listed `/viewset.cfm`
in its own path check rather than calling this, so the predicate was never
consulted by anything.

**Original code:**

```js
isSetList: () => window.location.pathname.toLowerCase().includes('/viewset.cfm'),
```

**To revive:** the predicate itself is back, renamed to `Routes.isViewSet()` in
[`src/core/routes.js`](../src/core/routes.js), and is now one of the components
`isSetPage()` is composed from. Nothing needs reviving — this entry records the
rename so the old name is searchable.

---

## `State.paginationComplete`, `State.activeModules`, `State.extractedData`

**Removed in:** 3.0.0-alpha.1 (Phase 1)
**Original location:** `v2.42.0-monolith.user.js:126-130`

**Intent:** a global scratchpad for cross-module coordination.

**Why removed:** `paginationComplete` was written by `PaginationLoader` and read
by nothing. `activeModules` and `extractedData` were never written *or* read —
they were initialised and then ignored for five feature phases.

**Original code:**

```js
const State = {
    paginationComplete: false,
    activeModules: [],
    extractedData: []
};
```

```js
setTimeout(() => {
    State.paginationComplete = true;
    resolve();
}, Config.global.paginationLoaderDelayMs);
```

**To revive:** the one genuinely shared field, `State.getValidInputs`, survives
as the `InputIndex` object exported from
[`src/modules/inputOptimization.js`](../src/modules/inputOptimization.js) — an
explicit, typed hand-off between two modules rather than a shared mutable bag.
Anything else that needs cross-module state should follow the same pattern.

---

## `EXPORT_CONFIG.blockCooldownMs`

**Removed in:** 3.0.0-alpha.1 (Phase 1)
**Original location:** `v2.42.0-monolith.user.js:108`

**Intent:** the anti-scraping cooldown duration.

**Why removed:** it was only ever read once, to seed
`DEFAULT_CONFIG.global.exportBlockCooldownMinutes`. The runtime cooldown check
read `Config.global.exportBlockCooldownMinutes` directly, and the
`Object.assign` that synced the other thresholds never refreshed this one — so
the field was permanently stale by construction and its staleness was invisible
because nothing read it.

**Original code:**

```js
const EXPORT_CONFIG = {
    // ...
    blockCooldownMs: 5 * 60 * 1000
};
```

```js
exportBlockCooldownMinutes: Math.round(EXPORT_CONFIG.blockCooldownMs / 60000),
```

**To revive:** nothing to revive. The default is now the literal `5` in
`DEFAULT_CONFIG.global.exportBlockCooldownMinutes`, in the same units the rest
of the code uses.

---

## `.card-name-selector` fallback in the card-page context label

**Removed in:** 3.0.0-alpha.1 (Phase 1)
**Original location:** `v2.42.0-monolith.user.js:824`

**Intent:** prefer a dedicated card-name node over the page's `h2` when
labelling a card page in the toolbar.

**Why removed:** `.card-name-selector` is a placeholder class that does not
exist in the site's markup, so the first operand of the `||` was always `null`
and the `h2` fallback always ran. Removing it changes nothing at runtime.

**Original code:**

```js
const playerNode = document.querySelector('.card-name-selector') || document.querySelector('#main-content-area h2');
```

**To revive:** if a real card-name class is identified, add it back as the first
operand in `Toolbar.renderCenterContext()` and register it with
`assertContract` so a future markup change is reported rather than silently
falling through.

---

## Fabricated SIDs for set links

**Removed in:** 3.0.0-alpha.1 (Phase 1) — behaviour change, not a pure extraction

**Original location:** `v2.42.0-monolith.user.js:1365`

**Intent:** give every set link a badge group, including links whose URL carries
no SID.

**Why removed:** the substitute SID was random, and it was then interpolated
into every shortcut URL — `/Inserts.cfm/sid/k3f9a2xqp/`, and so on. The badges
rendered and looked correct, and every one of them led to a page that cannot
exist. It also used the deprecated `String.prototype.substr`.

**Original code:**

```js
const setId = Sid.extract(link.href) || Math.random().toString(36).substr(2, 9);
```

**Replaced by:** links with no SID are skipped entirely, in
[`src/modules/setListEnhancer.js`](../src/modules/setListEnhancer.js):

```js
const setId = extractSid(link.href);
if (!setId) return;
```

**To revive:** don't. If those links need badges, the SID has to come from
somewhere real — a data attribute, or a lookup — not from a random number
generator.

---

## `innerText` in the export parser

**Removed in:** 3.0.0-alpha.1 (Phase 1)
**Original location:** `v2.42.0-monolith.user.js:997-1081`

**Intent:** read the rendered text of parsed checklist cells.

**Why removed:** these documents come from `DOMParser` and are never inserted
into a page, so they are not rendered — and the HTML spec defines `innerText` on
an unrendered element as returning `textContent`. The two were already the same
value; reading `textContent` directly removes a dependence on layout that never
existed here, and makes the parser testable outside a browser.

Live-page code that reads *rendered* text — the checklist filter, the toolbar
context label — still uses `innerText`, where visibility genuinely matters.

**To revive:** nothing to revive. If a future parser needs rendered text, it
needs a rendered document first.
