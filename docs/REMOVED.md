# Removed functionality

A record of behaviour deleted during the v3.0 port, kept so nothing is lost
silently. Every entry states the original code, what it was meant to do, and
what would be required to bring it back.

Line references point into the pre-port v2.42.0 single-file source, which is
retained outside this repository. Each entry quotes the removed code verbatim,
so the reference is a convenience rather than a requirement.

> **Still present, still dead.** `Modules.CardNameFormatter` and the
> `checklistEnhancer.actions.inlineActionCells` block both target selectors that
> do not exist. Phase 1 ported them unchanged so the extraction stayed
> behaviour-preserving; deleting them is Phase 2. Both are annotated in source
> with a pointer to this file.

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
