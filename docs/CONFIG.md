# SCToolkit Configuration Reference (`docs/CONFIG.md`)

This document provides a comprehensive reference for all configuration options, module rules, global settings, schema migrations, and customization features in **SCToolkit**.

---

## Overview & Configuration Architecture

SCToolkit manages settings through a live singleton object (`Config`) backed by persistent storage via userscript storage primitives (`GM_getValue` / `GM_setValue` with fallback to `localStorage`).

Key architectural principles of SCToolkit configuration:

1. **Live Mutability**: The Settings Modal mutates `Config` in place. Modifications to route patterns, theme choices, display modes, or pacing thresholds take effect immediately without requiring a full page refresh.
2. **Schema Versioning & Automatic Migration**: Saved settings include a `schemaVersion` identifier. When updating SCToolkit versions, `SettingsStore.migrate()` automatically upgrades older schemas (merging user preferences onto new defaults) while pruning obsolete parameters.
3. **Module Route Decoupling**: Modules do not hardcode route checks inside their execution loops. Instead, module execution is gated strictly by `Config.modules[moduleId].urlMatch` regex rules, allowing users to re-route or disable features directly from the Settings UI.

---

## 1. Global Settings (`Config.global`)

Global settings control cross-cutting features such as export pacing, UI theme preferences, button display modes, card formatting templates, logging, and toast notifications.

### 1.1 Export Pacing & Anti-Scraping Thresholds

These parameters control network request throttling, retry delays, and safety limits for multi-page CSV exporters (Set Checklists, Print Collections, and Set Hierarchy Scrapers).

| Setting                      | Type     | Default         | Description                                                                                                      |
| ---------------------------- | -------- | --------------- | ---------------------------------------------------------------------------------------------------------------- |
| `exportBaseDelayMs`          | `number` | `1000` (1.0s)   | Base delay between sequential HTTP page requests.                                                                |
| `exportJitterMaxMs`          | `number` | `700` (0.7s)    | Maximum randomized jitter added to inter-page request delays (`baseDelayMs + Math.random() * jitterMaxMs`).      |
| `exportMaxRetries`           | `number` | `3`             | Maximum number of retry attempts for failed HTTP requests.                                                       |
| `exportBackoffBaseMs`        | `number` | `1000` (1.0s)   | Base multiplier for exponential backoff delays on HTTP errors.                                                   |
| `exportBackoffCapMs`         | `number` | `15000` (15.0s) | Hard ceiling cap for exponential backoff delays.                                                                 |
| `exportMaxPages`             | `number` | `200`           | Safety limit capping total pages fetched per export session to prevent runaway loops.                            |
| `exportRequestTimeoutMs`     | `number` | `30000` (30.0s) | HTTP request abort timeout per individual page fetch.                                                            |
| `exportHierarchyMinDelayMs`  | `number` | `10000` (10.0s) | Minimum delay between sub-set fetches during recursive Set Hierarchy tree exports.                               |
| `exportHierarchyMaxDelayMs`  | `number` | `15000` (15.0s) | Maximum delay cap for recursive sub-set fetches during Set Hierarchy tree exports.                               |
| `exportBlockCooldownMinutes` | `number` | `5`             | Temporary cooldown duration (in minutes) triggered when HTTP 429/403 rate limits or CAPTCHA blocks are detected. |
| `exportCacheTtlHours`        | `number` | `24`            | TTL duration (in hours) for cached multi-page export datasets stored in session memory.                          |
| `exportCacheMaxEntries`      | `number` | `20`            | Maximum number of export result sets cached in memory simultaneously.                                            |
| `exportCacheMaxRows`         | `number` | `20000`         | Maximum total card rows stored across memory caches.                                                             |

---

### 1.2 Card Name Formatter Settings

Options governing text compilation, metadata tokenization, popovers, and quick-search buttons for cards.

| Setting                             | Type      | Default                                                                                           | Description                                                                                                                                            |
| ----------------------------------- | --------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `cardFormatterTemplate`             | `string`  | `"{PlayerName} - {Year} {SetName} {Tags} {PR} #{CardNo}"`                                         | Token template string used when copying formatted card text to the clipboard.                                                                          |
| `cardFormatterTSVTemplate`          | `string`  | `"{Year}\\t{SetName}\\t{InsertSetName}\\t{PlayerName}\\t{PlayerTeam}\\t{Tags}\\t{PR}\\t{CardNo}"` | Tab-separated value (TSV) template string for spreadsheet clipboard exports.                                                                           |
| `cardFormatterIgnoredTags`          | `string`  | `"ASR, LL, TC, CL"`                                                                               | Comma-separated list of card tag tokens to exclude from formatting output.                                                                             |
| `cardFormatterOutputMode`           | `string`  | `"popover"`                                                                                       | Action mode when interacting with card formatters: `"popover"` (displays floating action widget) or `"clipboard"` (auto-copies directly to clipboard). |
| `cardFormatterLinkTarget`           | `string`  | `"background"`                                                                                    | Browser tab focus mode for quick-search links: `"background"` (opens in new inactive tab) vs `"focus"` (opens in new focused tab).                     |
| `cardFormatterPopoverDurationMs`    | `number`  | `4000` (4.0s)                                                                                     | Display duration (in ms) before floating popover automatically dismisses.                                                                              |
| `cardFormatterShowCopy`             | `boolean` | `true`                                                                                            | Show formatted text copy button (`Copy`).                                                                                                              |
| `cardFormatterShowTSV`              | `boolean` | `true`                                                                                            | Show tab-separated values copy button (`TSV`).                                                                                                         |
| `cardFormatterShowGoogleSheet`      | `boolean` | `false`                                                                                           | Show Send to Google Sheet button (`Send To`).                                                                                                          |
| `cardFormatterGoogleSheetId`        | `string`  | `"1E-lfRToeTTXyj8ht6gQVN-0DcKQusN_28U-wNaaOwDI"`                                                  | Target Google Sheet ID or URL.                                                                                                                         |
| `cardFormatterGoogleSheetWorksheet` | `string`  | `"Singles & Lots"`                                                                                | Target tab/worksheet name inside the Google Sheet.                                                                                                     |
| `cardFormatterGoogleSheetWebAppUrl` | `string`  | `""`                                                                                              | Deployed Google Apps Script Web App endpoint URL.                                                                                                      |
| `cardFormatterShowBRef`             | `boolean` | `true`                                                                                            | Show Baseball Reference quick-search button (`BRef`).                                                                                                  |
| `cardFormatterShowGoogle`           | `boolean` | `true`                                                                                            | Show Google quick-search button (`G`).                                                                                                                 |

#### Supported Metadata Tokens

- `{Year}`: Release year (e.g. `2023`).
- `{SetName}`: Main set name (e.g. `Bowman`).
- `{InsertSetName}`: Sub-set or parallel set name (e.g. `Chrome Prospects Mojo Refractors`).
- `{CardNo}`: Card number (e.g. `BCP-1`).
- `{PlayerName}`: Player or subject name (e.g. `Triston Casas`).
- `{PlayerTeam}`: Player team name (e.g. `Boston Red Sox`).
- `{Tags}`: Card tags (e.g. `RC`, `SP`, `VAR`, `AU`, `MEM`).
- `{PR}`: Serial number or print run limit (e.g. `/99`).
- `{Quantity}` / `{Qty}`: Quantity amount (default: `1`).
- `{Sport}`: Sport name (e.g. `Baseball`).

---

### 1.3 UI Theme & Display Customization

| Setting                   | Type     | Default          | Description                                                                                                                     |
| ------------------------- | -------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `theme`                   | `string` | `"auto"`         | Color theme: `"auto"` (follows OS `prefers-color-scheme`), `"light"`, or `"dark"`.                                              |
| `toolbarButtonDisplay`    | `string` | `"both"`         | Display style for persistent toolbar buttons: `"both"` (Icon + Label), `"icon"` (Icon only), or `"text"` (Text label only).     |
| `pinButtonDisplay`        | `string` | `"both"`         | Display style for Pinned Sets dropdown menu items.                                                                              |
| `setButtonDisplay`        | `string` | `"both"`         | Display style for inline set shortcut badges injected on index pages.                                                           |
| `quantityCounterPosition` | `string` | `"bottom-right"` | Screen placement for floating Quantity Counter widget: `"bottom-right"`, `"bottom-left"`, or `"toolbar"` (embedded in top bar). |

---

### 1.4 Navigation, Filters & Data Entry

| Setting                       | Type      | Default       | Description                                                                       |
| ----------------------------- | --------- | ------------- | --------------------------------------------------------------------------------- |
| `checklistFilterDebounceMs`   | `number`  | `150`         | Input debounce delay (ms) for the real-time card table filter bar.                |
| `paginationLoaderDelayMs`     | `number`  | `1000` (1.0s) | Delay (ms) between automated page fetches during infinite scrolling.              |
| `paginationThrottleStartPage` | `number`  | `6`           | Page index threshold after which pagination fetches add throttled delays.         |
| `addMultiplesFocusDeadlineMs` | `number`  | `1200`        | Maximum wait timeout (ms) for focusing the first empty field on bulk entry pages. |
| `addMultiplesPauseDurationMs` | `number`  | `3000`        | Pause duration (ms) before auto-submitting bulk additions.                        |
| `addMultiplesAutoAdvance`     | `boolean` | `true`        | Auto-advance focus to the next field when quantity inputs change.                 |
| `setListEnhancerChunkSize`    | `number`  | `25`          | Processing chunk batch size when enhancing set link lists.                        |
| `defaultCollectionId`         | `number`  | `6`           | Default preferred Collection ID selected by `collectionDefaulter`.                |

---

### 1.5 Logging & Toast System

| Setting           | Type     | Default             | Description                                                                           |
| ----------------- | -------- | ------------------- | ------------------------------------------------------------------------------------- |
| `logLevel`        | `string` | `"info"`            | Console logging threshold: `"debug"`, `"info"`, `"warn"`, or `"error"`.               |
| `timezone`        | `string` | `"auto"`            | Timezone for log timestamps (`"auto"` or valid IANA string e.g. `"America/Chicago"`). |
| `timestampFormat` | `string` | `"HH:mm:ss.SSS TZ"` | Format string for console timestamps.                                                 |
| `toastDurationMs` | `number` | `4000` (4.0s)       | Duration (ms) before UI toast notifications auto-dismiss.                             |
| `toastStackLimit` | `number` | `4`                 | Maximum number of toast notifications stacked on screen simultaneously.               |

---

## 2. Module Configurations (`Config.modules`)

Each user-facing feature module in `src/modules/` has an entry under `Config.modules[moduleId]`:

```json
{
  "enabled": true,
  "urlMatch": [{ "pattern": "/checklist\\.cfm", "exclude": false }],
  "actions": {}
}
```

- `enabled` (`boolean`): Master toggle for the module.
- `urlMatch` (`array`): List of route rules evaluated against `window.location.href`. Rules consist of a regex `pattern` and an `exclude` flag.
- `actions` (`object`): Optional sub-feature flags specific to the module.

### 2.1 Complete Module Index

| Module ID                   | Default Target Routes                                                                                                                                                                     | Key Actions / Sub-features | Summary Purpose                                                                                                   |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `inputOptimization`         | Global (All Pages)                                                                                                                                                                        | N/A                        | Converts `Enter` key to `Tab` navigation in forms; auto-scrolls focused fields into the middle 80% viewport zone. |
| `checklistEnhancer`         | `/checklist.cfm`, `/viewcollectionmode.cfm`, `/viewcollectionforsaletrade.cfm`, `/viewcollectionwantlist.cfm`, `/collectionaddmultiples`, `/inserts.cfm`, `/viewall.cfm`, `/viewallc.cfm` | `realtimeFilter: true`     | Injects real-time search filter bar above card tables with match counters and parent SID resolution.              |
| `setListEnhancer`           | `/viewall.cfm`, `/inserts.cfm`                                                                                                                                                            | N/A                        | Injects inline action shortcut badges (C, P, I, FS, W, +M, PIN, CSV, Hierarchy) next to set links.                |
| `setDropdownSearchEnhancer` | `collectionsummary`, `viewcollection`, `collectionaddcardnumber`, `collectionaddmultiples`, `collectionaddmultiplestext`, `collectiondelmultiples`                                        | `substringSearch: true`    | Overrides native set dropdown search with substring (`includes`) and OR condition matching across delimiters.     |
| `addMultiplesEnhancer`      | `/collectionaddmultiples`, `/collectionaddm`                                                                                                                                              | N/A                        | Optimizes bulk add pages by setting default sale types, focusing empty quantity inputs, and managing batch saves. |
| `csvExportEngine`           | `collection`, `/print.cfm`, `printyourcollectionpdf.cfm` (Excludes: `addmultiples`)                                                                                                       | N/A                        | Multi-page checklist, collection, and print view CSV exporter with anti-scraping delays and memory caching.       |
| `paginationLoader`          | Global (Excludes: `addmultiples`)                                                                                                                                                         | N/A                        | Infinite scroll pagination engine that appends subsequent pages and converts POST forms to GET URLs.              |
| `cardNameFormatter`         | `/viewcard.cfm`, `/checklist.cfm`, `/viewcollectionforsaletrade.cfm`, `/viewcollectionwantlist.cfm`                                                                                       | N/A                        | Formats card metadata into tokenized copyable strings with floating popover or direct clipboard copy.             |
| `collectionQuantityCounter` | `/viewcollectionmode.cfm`, `/viewcollectionforsaletrade.cfm`, `/viewcollectionwantlist.cfm`                                                                                               | N/A                        | Floating overlay widget displaying distinct card count vs total quantity with detailed summary modal.             |
| `setHierarchyExport`        | `/viewall.cfm`, `/viewallc.cfm`                                                                                                                                                           | N/A                        | Recursively discovers sub-sets/parallels and exports structured parent set hierarchy trees.                       |
| `collectionDefaulter`       | `/viewcollection.cfm`                                                                                                                                                                     | N/A                        | Automatically selects preferred default Collection ID on collection selection forms.                              |
| `quickAddGridEnhancer`      | `/viewcollection.cfm`, `/viewcollectionwantlist.cfm`, `/viewcollectionforsaletrade.cfm`                                                                                                   | N/A                        | Injects inline quantity increment/decrement controls directly into card listing rows.                             |

---

## 3. Badges, Hotlinks & Pins Schemas

### 3.1 Badge System (`toolbarBadges` & `setLinkBadges`)

SCToolkit features 10 standardized shortcut badges available in both the persistent top toolbar (`toolbarBadges`) and inline set links (`setLinkBadges`):

| Badge Key   | Default Label | Icon       | Action / Target URL                                   |
| ----------- | ------------- | ---------- | ----------------------------------------------------- |
| `CHECKLIST` | Checklist     | `list`     | Direct link to base set `Checklist.cfm`               |
| `PIN`       | Pin           | `pin`      | Pin/unpin set in persistent Toolbar Pins menu         |
| `YEAR`      | Year          | `calendar` | View all sets for year in collection (`ViewAllC.cfm`) |
| `INSERTS`   | Inserts       | `layers`   | View set inserts (`Inserts.cfm`)                      |
| `PARALLELS` | Parallels     | `copy`     | View set parallels                                    |
| `FOR_SALE`  | For Sale      | `tag`      | View items for sale/trade in collection               |
| `MULTI`     | Multi         | `plus`     | Bulk add cards (`CollectionAddMultiples.cfm`)         |
| `WANTLIST`  | Wantlist      | `heart`    | View items on wantlist                                |
| `CSV`       | CSV           | `download` | Trigger Paced CSV Export                              |
| `HIERARCHY` | Hierarchy     | `folder`   | Trigger Set Hierarchy Tree Export                     |

---

### 3.2 Toolbar Hotlinks (`Config.global.hotlinks`)

Hotlinks provide quick navigation buttons embedded in the center section of the top toolbar.

```json
{
  "id": "search",
  "url": "https://www.tcdb.com/AdvancedSearch.cfm",
  "text": "Search",
  "tooltip": "Perform Advanced Search",
  "placement": 3,
  "enabled": true,
  "icon": "search",
  "target": "inline"
}
```

- Supported Built-in Actions (`action` field):
  - `"scrollToTop"`: Smoothly scroll page to top.
  - `"scrollToBottom"`: Smoothly scroll page to bottom.
  - `"viewAllC"`: Resolves current page sport/year and navigates to `ViewAllC.cfm`.

---

### 3.3 Pinned Sets Schema (`Config.global.pins`)

Pinned sets appear in the persistent Toolbar **Pins** dropdown for instant access across the database:

```json
{
  "sid": "357729",
  "name": "2023 Bowman",
  "sport": "Baseball",
  "year": "2023",
  "enabled": true,
  "order": 1
}
```

---

## 4. Settings Storage & Migration Lifecycle

SCToolkit persists configuration under Tampermonkey storage key `tk_config_v1`.

### Migration Process (`SettingsStore.migrate`)

1. **Schema Check**: Validates `stored.schemaVersion` against current `DEFAULT_CONFIG.schemaVersion` (`v3`).
2. **Backward Compatibility Merge**: Older config schemas (`v1`, `v2`) undergo zero-data-loss upgrades by calling `mergeWithDefaults(stored)`:
   - Preserves user custom regex patterns, pins, display preferences, and template choices.
   - Automatically populates new build default parameters.
   - Prunes deprecated keys from storage to prevent orphaned settings.
3. **Reset Safety Guard**: If stored data is corrupt or from an incompatible future schema, settings gracefully reset to defaults.
