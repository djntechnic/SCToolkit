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
| **Keyboard-First Data Entry** | Add Multiples & Form Inputs | Converts `Enter` to `Tab` navigation across inputs and auto-scrolls focused fields into the middle 80% viewport zone. |
| **Paced Multi-Page Export Engine** | Set Checklists, Collections, Print Views | Multi-page checklist CSV exporter with rate limiting, exponential backoff, anti-scraping protection, and 24h caching. |
| **Interactive Settings Modal** | Toolbar Gear Icon / `Ctrl+K` | Comprehensive settings UI featuring module toggles, regex route editing, global thresholds, log timezone/format, and diagnostics. |

---

## Module Reference & Configuration

SCToolkit is built as a modular framework. Each feature is encapsulated in a dedicated module in `src/modules/` and can be individually configured, re-routed, or toggled on/off via the **Settings Modal**.

### 1. CSV Export Engine
- **Source File**: [`src/modules/csvExportEngine.js`](file:///c:/Dev/SCToolkit/src/modules/csvExportEngine.js)
- **Functions & Capabilities**:
  - **Set Checklist & Hierarchy Export**: Multi-page checklist scraper and parent set hierarchy exporter. Automatically discovers child sets, extracts notes, pacing scales dynamically for large sets, and exports structured CSVs.
  - **Collection & Browse Export**: Exports user collection tables, player collections, and team collections to CSV.
  - **Print Collection Export**: Operates on `PrintYourCollectionPDF.cfm` and `Collection.cfm?MODE=PRINT*` pages.
    1. Displays an initial **Calculate Page Count** button with an explanatory tooltip.
    2. Probes sequential parts (`Part=1`, `Part=2`, ...) using anti-scraping pacing delays (`jitteredDelay()`).
    3. Parses card metadata (Sport, Year, Set Name, Child Set, Card No, Player Name, Tags, Print Run, Qty, Price) and caches aggregated rows in session memory.
    4. Formats card totals with thousands separators (`Calculated 1 Page(s) (1,743 Cards)`).
    5. Replaces the calculation button with **`Export All Parts (1 - N)`**, allowing instant CSV download with 0 additional network requests.
- **Configurable Settings**:
  - `csvExportEngine.enabled`: Toggle module ON/OFF.
  - `csvExportEngine.urlMatch`: Regular expression rules governing where the module runs (e.g. `collection`, `printyourcollectionpdf.cfm`, `print.cfm`).
  - **Global Export Pacing**: Base Delay (`exportBaseDelayMs`, default `500ms`), Jitter (`exportJitterMaxMs`, default `700ms`), Max Retries (`exportMaxRetries`, default `3`), Backoff (`exportBackoffBaseMs`/`exportBackoffCapMs`), Safety Ceiling (`exportMaxPages`, default `200`), Request Timeout (`exportRequestTimeoutMs`, default `30s`), Block Cooldown (`exportBlockCooldownMinutes`, default `5 min`), and Cache TTL (`exportCacheTtlHours`, default `24 h`).

### 2. Checklist Enhancer
- **Source File**: [`src/modules/checklistEnhancer.js`](file:///c:/Dev/SCToolkit/src/modules/checklistEnhancer.js)
- **Functions & Capabilities**:
  - Injects a real-time search filter bar (`#tk-checklist-filter`) above card tables.
  - Performs instant client-side text matching against player names, card numbers, parallel tags, errors, and variation notes without re-querying the server.
  - Dynamically updates the visible match counter (`#tk-filter-count`).
  - Performs Parent Set ID (`parentSid`) resolution from breadcrumbs or navigation menus for sub-sets and parallel checklists.
- **Configurable Settings**:
  - `checklistEnhancer.enabled`: Toggle module ON/OFF.
  - `checklistEnhancer.actions.realtimeFilter`: Toggle the filter bar feature.
  - `global.checklistFilterDebounceMs`: Filter input debounce delay (default `150ms`).
  - `checklistEnhancer.urlMatch`: Route match patterns (`/checklist.cfm`, `/viewcollectionmode.cfm`, `/viewcollectionforsaletrade.cfm`, `/viewcollectionwantlist.cfm`, `/collectionaddmultiples`, `/inserts.cfm`, `/viewall.cfm`, `/viewallc.cfm`).

### 3. Collection Quantity Counter
- **Source File**: [`src/modules/collectionQuantityCounter.js`](file:///c:/Dev/SCToolkit/src/modules/collectionQuantityCounter.js)
- **Functions & Capabilities**:
  - Renders a real-time quantity counter widget (`.sctk-qty-counter`) on collection pages (`ViewCollectionMode.cfm`, `ViewCollectionForSaleTrade.cfm`, `ViewCollectionWantlist.cfm`).
  - Distinguishes between distinct card items collected and total item quantity (`Qty >= 1`).
  - Updates dynamically when input quantities change.
- **Configurable Settings**:
  - `collectionQuantityCounter.enabled`: Toggle module ON/OFF.
  - `global.quantityCounterPosition`: Choose widget placement: `bottom-right` (default floating corner overlay), `bottom-left`, or `toolbar` (embedded in top bar).
  - `collectionQuantityCounter.urlMatch`: Route match patterns.

### 4. Card Name Formatter Engine
- **Source File**: [`src/modules/cardNameFormatter.js`](file:///c:/Dev/SCToolkit/src/modules/cardNameFormatter.js)
- **Functions & Capabilities**:
  - Compiles card metadata into standardized text strings for e-commerce listings, cataloging, or social sharing.
  - Supports metadata tokens: `{Year}`, `{SetName}`, `{CardNo}`, `{PlayerName}`, `{Tags}`, `{PR}`, `{ChildSet}`, `{Sport}`.
  - Displays a floating popover widget or automatically copies the formatted text to the clipboard upon clicking a card name.
- **Configurable Settings**:
  - `cardNameFormatter.enabled`: Toggle module ON/OFF.
  - `global.cardFormatterTemplate`: Token template string (default `{PlayerName} - {Year} {SetName} {Tags} {PR} #{CardNo}`).
  - `global.cardFormatterOutputMode`: Output action (`popover` for floating preview box vs `clipboard` for auto-copy).
  - `global.cardFormatterPopoverDurationMs`: Popover display duration (default `4000ms`).
  - `cardNameFormatter.urlMatch`: Route match patterns (`/viewcard.cfm`, `/checklist.cfm`, `/viewcollectionforsaletrade.cfm`, `/viewcollectionwantlist.cfm`).

### 5. Set List Enhancer
- **Source File**: [`src/modules/setListEnhancer.js`](file:///c:/Dev/SCToolkit/src/modules/setListEnhancer.js)
- **Functions & Capabilities**:
  - Injects inline shortcut badge groups next to set links on index and listing pages (`ViewAll.cfm`, `Inserts.cfm`).
  - Badges include: Checklist (C), Inserts (I), Parallels (P), For Sale (FS), Wantlist (W), Add Multiples (+M), Pin (PIN), CSV Export (CSV), and Hierarchy Export (HIERARCHY).
  - Uses DOM mutation observers to enhance dynamically loaded set links automatically.
- **Configurable Settings**:
  - `setListEnhancer.enabled`: Toggle module ON/OFF.
  - `global.setButtonDisplay`: Set link badge display mode (`both` for Icon+Text, `icon` for Icon Only, `text` for Text Only).
  - `global.setListEnhancerChunkSize`: Processing chunk size for link enhancement.
  - `setListEnhancer.urlMatch`: Route match patterns (`/viewall.cfm`, `/inserts.cfm`).

### 6. Add Multiples Enhancer
- **Source File**: [`src/modules/addMultiplesEnhancer.js`](file:///c:/Dev/SCToolkit/src/modules/addMultiplesEnhancer.js)
- **Functions & Capabilities**:
  - Optimizes bulk collection entry pages (`CollectionAddMultiplesText.cfm`).
  - Automatically selects default sale types ("For Sale/Trade") across all rows on load.
  - Focuses the first empty quantity input field and auto-scrolls it into view.
- **Configurable Settings**:
  - `addMultiplesEnhancer.enabled`: Toggle module ON/OFF.
  - `global.addMultiplesFocusDeadlineMs`: Focus detection timeout (default `1200ms`).
  - `addMultiplesEnhancer.urlMatch`: Route match patterns (`/collectionaddmultiples`).

### 7. Input Optimization
- **Source File**: [`src/modules/inputOptimization.js`](file:///c:/Dev/SCToolkit/src/modules/inputOptimization.js)
- **Functions & Capabilities**:
  - Keyboard-first form navigation. Converts `Enter` key presses inside text and number fields into `Tab` navigation to allow rapid single-key data entry.
  - Automatically auto-scrolls focused fields into the middle 80% vertical viewport zone if obscured by fixed toolbars or page headers.
- **Configurable Settings**:
  - `inputOptimization.enabled`: Toggle module ON/OFF globally.

### 8. Pagination Loader
- **Source File**: [`src/modules/paginationLoader.js`](file:///c:/Dev/SCToolkit/src/modules/paginationLoader.js)
- **Functions & Capabilities**:
  - Infinite scroll pagination engine for listing views.
  - Automatically fetches and appends the next page of card rows when scrolling near the bottom of the document.
  - Converts POST pagination forms into GET URLs to preserve active filters and search parameters across page boundaries.
- **Configurable Settings**:
  - `paginationLoader.enabled`: Toggle module ON/OFF.
  - `global.paginationLoaderDelayMs`: Inter-page loading delay (default `1000ms`).
  - `global.paginationThrottleStartPage`: Page index threshold to initiate throttled fetches (default page `6`).
  - `paginationLoader.urlMatch`: Exclude rules (e.g., excludes `addmultiples`).

---

## Settings Modal Reference

Access the Settings Modal by clicking the **gear icon** in the top toolbar or using `Ctrl+K` $\rightarrow$ *"Open Settings"*.

### Modal Tabs & Features

1. **Modules Tab**:
   - Lists all 8 modules in alphabetical accordion cards.
   - Expand any module to toggle its master switch, view its target description, toggle sub-actions, or edit its regex route patterns directly.
2. **Global Tab**:
   - **Theme Selector**: Choose `auto` (follows OS preference), `light`, or `dark`.
   - **Button Display Modes**: Customize button modes (`both`, `icon`, `text`) independently for the main Toolbar, Pinned Sets dropdown, and Injected Set badges.
   - **Export Pacing & Thresholds**: Adjust base delay, jitter, max retries, backoff parameters, safety page ceilings, and request timeouts.
   - **Anti-Scraping & Cache**: Set block cooldown duration (default `5 min`) and export cache TTL (default `24 hours`).
   - **Card Formatter Options**: Edit token template string, output mode (`popover` vs `clipboard`), and popover duration.
   - **Quantity Counter Position**: Select widget placement (`bottom-right`, `bottom-left`, `toolbar`).
   - **Logging & Timezone**: Set console log level (`info`, `debug`, `warn`, `error`), log timezone (`auto` or IANA string), and timestamp pattern.
3. **RegEx Tester Tab**:
   - Interactive sandbox for testing custom regular expressions against sample URL strings with real-time match highlighting and capture group tables.
4. **Route Tester Tab**:
   - Evaluates any target URL string against all active module rules simultaneously to verify route matching.
5. **Diagnostics Tab**:
   - Displays real-time contract check results (verifying DOM elements exist), active modules, resolved theme, current pacing penalty, and an Export Cache Manager with a one-click **Purge Cache** button.

---

## Command Palette & Keyboard Shortcuts

- **`Ctrl+K`**: Opens the Command Palette from anywhere on the site (automatically stands down when typing in input fields).
- **`Escape`**: Closes the Command Palette, Settings Modal, or active dropdown menus.
- **`Enter`**: Inside form input fields, moves focus forward to the next input field (handled by Input Optimization).

---

## Troubleshooting & FAQ

- **A feature didn't appear on a page**:
  Open Settings $\rightarrow$ Diagnostics. If a contract check shows `MISSING`, the site's markup has changed. If the module is not listed under "Active Modules", its route patterns did not match the current URL (edit route rules in Settings $\rightarrow$ Modules).
- **An export made 0 requests and downloaded instantly**:
  The export was served from SCToolkit's 24-hour session cache. To force fresh fetches from the server, open Settings $\rightarrow$ Diagnostics $\rightarrow$ click **Purge Cache**.
- **`PrintYourCollectionPDF.cfm` says "Calculated 1 Page(s)"**:
  Click **Calculate Page Count** to probe all pages. SCToolkit will display progress, format the total card count (e.g., `(1,743 Cards)`), and reveal the **`Export All Parts (1 - N)`** button.
- **Console logging appears on two lines**:
  Ensure you are on v3.1.0+. Log URLs are truncated cleanly using concise parameter format (e.g. `PrintYourCollectionPDF.cfm?Part=1`) to prevent wrapping.

---

## Development & Testing

```bash
npm ci
npm run lint      # ESLint (includes userscript metadata rules)
npm run build     # esbuild compilation -> dist/sctoolkit.user.js
npm test          # Runs node --test suite (333+ automated tests)
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
| [`src/modules/`](file:///c:/Dev/SCToolkit/src/modules/) | 8 user-facing feature modules registered and gated by configuration. |
| [`test/`](file:///c:/Dev/SCToolkit/test/) | Native `node --test` test suite with HTML page fixtures in `test/fixtures/`. |

---

## Responsible Use & Rate Limiting

Export features issue real HTTP requests to third-party servers. Adaptive pacing, request jitter, block detection cooldowns, and page safety limits are built-in defaults documented in [docs/POLITE-USE.md](docs/POLITE-USE.md).

---

## License

[MIT](LICENSE)
