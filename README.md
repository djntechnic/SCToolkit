# SCToolkit

A userscript toolkit for sports card database browsing: instant table & set list filtering, keyboard-first data entry, set shortcut badges, checklist links, customizable button display modes, and polite, rate-limited CSV export.

> **Status:** v0.1 Beta is available. Featuring Set Hierarchy CSV export, Print Collection CSV export, Collection Quantity Counter live overlay widget, Parent Set ID resolution for sub-sets, alphabetized accordion Settings modal, unified toast stacking container, and universal real-time filtering.

---

## Quick Start & Installation

1. Install a userscript manager — [Tampermonkey](https://www.tampermonkey.net/) is the reference target.
2. Open **[dist/sctoolkit.user.js](https://raw.githubusercontent.com/djntechnic/SCToolkit/main/dist/sctoolkit.user.js)** — Tampermonkey will prompt to install/update.
3. Updates arrive automatically via `@updateURL` pointing to the main branch repository.

---

## Features Overview

| Feature | Scope / Location | Description |
|---|---|---|
| **Fixed Top Toolbar** | Global (Every Page) | Persistent toolbar with wordmark, context title, pinned sets dropdowns, status readout, and Settings modal trigger. |
| **Print Collection CSV Export** | `PrintYourCollectionPDF.cfm`, `Collection.cfm?MODE=PRINT*` | Calculates page count, probes multi-part print views, parses card metadata, and exports structured CSVs. |
| **Checklist & Listing Filter Bar** | Checklist, Collection Browse, Inserts, ViewAll | Real-time search filter bar for card tables. Filters by player, card number, parallel tags, or variations. |
| **Collection Quantity Counter Widget** | ViewCollectionForSaleTrade, ViewCollectionWantlist | Floating overlay widget tracking distinct collected cards vs total item quantity (`Qty >= 1`). |
| **Card Name Formatter Engine** | ViewCard, Checklist, Collections | Compiles structured card metadata into customizable tokenized text strings with floating popover or auto-copy. |
| **Set List Shortcut Badges** | ViewAll, Inserts, Set Lists | Injects inline badges (Checklist, Inserts, Parallels, For Sale, Wantlist, Add Multiples, Pin, CSV, Hierarchy) next to set links. |
| **Collection Defaulter** | ViewCollection | Automatically selects a preferred Collection ID on ViewCollection.cfm pages. |
| **Set Dropdown Search Enhancer** | Collection Pages | Intercepts native `#setSearch` input on collection pages with substring (`includes`) and OR condition matching. |
| **Keyboard-First Data Entry** | Add Multiples & Form Inputs | Converts `Enter` to `Tab` navigation across inputs and auto-scrolls focused fields into the middle 80% viewport zone. |
| **Paced Multi-Page Export Engine** | Set Checklists, Collections, Print Views | Multi-page checklist CSV exporter with rate limiting, exponential backoff, anti-scraping protection, and 24h caching. |
| **Interactive Settings Modal** | Toolbar Gear Icon / `Ctrl+K` | Comprehensive settings UI featuring module toggles, regex route editing, Pin Configuration, Badge Configuration (Toolbar & Set Links), global thresholds, log timezone/format, and diagnostics. |

---

## Modules & Core Purpose

SCToolkit features 12 modular engines. Each module can be toggled ON/OFF or re-routed via regex rules in the **Settings Modal**.

> 📖 **For exhaustive configuration schemas, token templates, anti-scraping pacing thresholds, and storage migration details, see [`docs/CONFIG.md`](docs/CONFIG.md).**

### 1. CSV Export Engine (`csvExportEngine`)
Multi-page checklist, collection, and print view CSV exporter with anti-scraping delay jitter and 24-hour dataset memory caching.
*Details: [`docs/CONFIG.md#21-complete-module-index`](docs/CONFIG.md#21-complete-module-index)*

### 2. Checklist Enhancer (`checklistEnhancer`)
Injects a real-time search filter bar above card tables to filter by player, card number, tags, or variations with instant match counting and parent set resolution.
*Details: [`docs/CONFIG.md#21-complete-module-index`](docs/CONFIG.md#21-complete-module-index)*

### 3. Collection Quantity Counter (`collectionQuantityCounter`)
Floating overlay widget tracking distinct card items collected versus total item quantity, with a detailed summary modal.
*Details: [`docs/CONFIG.md#13-ui-theme--display-customization`](docs/CONFIG.md#13-ui-theme--display-customization)*

### 4. Card Name Formatter Engine (`cardNameFormatter`)
Compiles structured metadata into customizable tokenized text strings for e-commerce listings or cataloging with quick-search buttons (`Copy`, `TSV`, `BRef`, `Google`).
*Details: [`docs/CONFIG.md#12-card-name-formatter-settings`](docs/CONFIG.md#12-card-name-formatter-settings)*

### 5. Set List Enhancer (`setListEnhancer`)
Injects inline shortcut badges (Checklist, Inserts, Parallels, For Sale, Wantlist, Add Multiples, Pin, CSV, Hierarchy) next to set links.
*Details: [`docs/CONFIG.md#31-badge-system-toolbarbadges--setlinkbadges`](docs/CONFIG.md#31-badge-system-toolbarbadges--setlinkbadges)*

### 6. Quick Add Grid Enhancer (`quickAddGridEnhancer`)
Injects inline quantity increment/decrement controls directly into card listing rows for fast collection management.
*Details: [`docs/CONFIG.md#21-complete-module-index`](docs/CONFIG.md#21-complete-module-index)*

### 7. Add Multiples Enhancer (`addMultiplesEnhancer`)
Optimizes bulk collection entry pages by setting default sale types, auto-focusing empty quantity inputs, and handling batch submissions.
*Details: [`docs/CONFIG.md#14-navigation-filters--data-entry`](docs/CONFIG.md#14-navigation-filters--data-entry)*

### 8. Input Optimization (`inputOptimization`)
Converts `Enter` to `Tab` navigation across forms and auto-scrolls active inputs into the middle 80% viewport zone.
*Details: [`docs/CONFIG.md#14-navigation-filters--data-entry`](docs/CONFIG.md#14-navigation-filters--data-entry)*

### 9. Pagination Loader (`paginationLoader`)
Infinite scroll pagination engine that appends next-page rows automatically when scrolling near the bottom of listing views.
*Details: [`docs/CONFIG.md#14-navigation-filters--data-entry`](docs/CONFIG.md#14-navigation-filters--data-entry)*

### 10. Set Dropdown Search Enhancer (`setDropdownSearchEnhancer`)
Overrides native set dropdown search with substring (`includes`) and OR condition matching across multiple delimiters (`,` `;` `|`).
*Details: [`docs/CONFIG.md#21-complete-module-index`](docs/CONFIG.md#21-complete-module-index)*

### 11. Set Hierarchy Exporter (`setHierarchyExport`)
Recursively discovers child sub-sets and parallel checklists to export structured set hierarchy trees to CSV.
*Details: [`docs/CONFIG.md#11-export-pacing--anti-scraping-thresholds`](docs/CONFIG.md#11-export-pacing--anti-scraping-thresholds)*

### 12. Collection Defaulter (`collectionDefaulter`)
Automatically selects a preferred default Collection ID on collection selection forms.
*Details: [`docs/CONFIG.md#14-navigation-filters--data-entry`](docs/CONFIG.md#14-navigation-filters--data-entry)*

---

## Interactive Settings Modal & Command Palette

Access the Settings Modal by clicking the **gear icon** in the top toolbar or pressing `Ctrl+K` $\rightarrow$ *"Open Settings"*.

- **`Ctrl+K`**: Opens the Command Palette from anywhere on the site (automatically stands down when typing in input fields).
- **`Escape`**: Closes the Command Palette, Settings Modal, or active popups.
- **Settings Tabs**: Global Pacing & UI, Pins Management, Badge Ordering, Module Accordions & Regex Routes, Regex Sandbox, Route Tester, and Diagnostics with a 1-click Cache Purge.

---

## Development & Testing

```bash
npm ci
npm run lint      # ESLint (includes userscript metadata rules)
npm run build     # esbuild compilation -> dist/sctoolkit.user.js
npm test          # Runs node --test suite (410+ automated tests)
npm run check     # Full validation: lint -> build -> test -> stale-dist check
```

For local iteration, point Tampermonkey at the local file on disk:
`@require file:///C:/Dev/SCToolkit/dist/sctoolkit.user.js` (with *Allow access to file URLs* enabled in Tampermonkey extension settings).

---

## Architecture & Codebase Layout

| Path | Purpose |
|---|---|
| [`src/core/`](file:///c:/Dev/SCToolkit/src/core/) | Logging engine, configuration store, storage wrappers, SID/route helpers, module registry. |
| [`src/net/`](file:///c:/Dev/SCToolkit/src/net/) | Fetch pacing, retry logic, anti-scraping block detection, print/set export queue orchestration. |
| [`src/data/`](file:///c:/Dev/SCToolkit/src/data/) | Page parsers (checklist, print collection, collection browse), CSV generator, filename builders. |
| [`src/ui/`](file:///c:/Dev/SCToolkit/src/ui/) | Design tokens, CSS styles, icon sprite, badges, fixed toolbar, toasts, settings modal. |
| [`src/modules/`](file:///c:/Dev/SCToolkit/src/modules/) | 12 user-facing feature modules registered and gated by configuration. |
| [`test/`](file:///c:/Dev/SCToolkit/test/) | Native `node --test` test suite with HTML page fixtures in `test/fixtures/`. |

---

## Responsible Use & Rate Limiting

Export features issue real HTTP requests to third-party servers. Adaptive pacing, request jitter, block detection cooldowns, and page safety limits are built-in defaults documented in [`docs/POLITE-USE.md`](docs/POLITE-USE.md).

---

## License

[MIT](LICENSE)
