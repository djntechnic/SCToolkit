// ==UserScript==
// @name         SCToolkit
// @namespace    https://github.com/djntechnic/SCToolkit
// @version      3.0.0-alpha.0
// @description  Userscript toolkit for sports card database browsing: filtering, shortcuts, and polite CSV export.
// @author       djntechnic
// @license      MIT
// @homepageURL  https://github.com/djntechnic/SCToolkit
// @supportURL   https://github.com/djntechnic/SCToolkit/issues
// @updateURL    https://raw.githubusercontent.com/djntechnic/SCToolkit/main/dist/sctoolkit.user.js
// @downloadURL  https://raw.githubusercontent.com/djntechnic/SCToolkit/main/dist/sctoolkit.user.js
// @match        *://*.tcdb.com/*
// @match        *://tcdb.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_info
// @run-at       document-end
// ==/UserScript==

(() => {
  // src/core/log.js
  var LOG_LEVELS = ["debug", "info", "warn", "error"];
  var RuntimeSettings = { logLevel: "info" };
  var LOG_STYLES = {
    prefix: "color:#6c757d",
    source: {
      client: "color:#6c757d; font-weight:bold",
      server: "color:#0d6efd; font-weight:bold"
    },
    level: {
      debug: "color:#6c757d",
      info: "color:inherit",
      warn: "color:#d97706; font-weight:bold",
      error: "color:#dc3545; font-weight:bold"
    }
  };
  function formatCentralTimestamp() {
    try {
      return new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Chicago",
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        fractionalSecondDigits: 3
      }).format(/* @__PURE__ */ new Date()) + " CT";
    } catch {
      return (/* @__PURE__ */ new Date()).toISOString().split("T")[1].slice(0, -1) + " UTC";
    }
  }
  function Log(msg, level = "info", source = "client") {
    if (LOG_LEVELS.indexOf(level) < LOG_LEVELS.indexOf(RuntimeSettings.logLevel)) return;
    const timestamp = formatCentralTimestamp();
    const consoleMethod = level === "debug" ? "log" : level;
    const sourceLabel = source === "server" ? "[SERVER]" : "[CLIENT]";
    const sourceStyle = LOG_STYLES.source[source] || LOG_STYLES.source.client;
    const levelStyle = LOG_STYLES.level[level] || LOG_STYLES.level.info;
    console[consoleMethod](
      `%c[SCToolkit | ${timestamp}] %c${sourceLabel}%c ${msg}`,
      LOG_STYLES.prefix,
      sourceStyle,
      levelStyle
    );
  }

  // src/core/storage.js
  function getValue(key, fallback) {
    if (typeof GM_getValue !== "function") return fallback;
    try {
      return GM_getValue(key, fallback);
    } catch (error) {
      Log(`Storage read failed for '${key}': ${error.message}`, "warn");
      return fallback;
    }
  }
  function setValue(key, value) {
    if (typeof GM_setValue !== "function") return;
    try {
      GM_setValue(key, value);
    } catch (error) {
      Log(`Storage write failed for '${key}': ${error.message}`, "warn");
    }
  }
  var BLOCK_TS_KEY = "tk_last_block_ts";
  var PINNED_SETS_KEY = "tk_pinned_sets";
  var Pins = {
    /** @returns {Array<{id: string, name: string, url: string, year: string}>} */
    all: () => getValue(PINNED_SETS_KEY, []),
    /** @param {{id: string, name: string, url: string, year: string}} pin */
    add: (pin) => {
      const pins = Pins.all();
      if (pins.find((p) => p.id === pin.id)) return false;
      pins.push(pin);
      setValue(PINNED_SETS_KEY, pins);
      return true;
    },
    /** @param {string} id */
    remove: (id) => {
      setValue(PINNED_SETS_KEY, Pins.all().filter((p) => p.id !== id));
    }
  };
  function deriveSetYear(name, href = "") {
    const fromHref = href.match(/\/sid\/\d+\/(\d{4})/i) || href.match(/sid=\d+.*?(\d{4})/i);
    if (fromHref) return fromHref[1];
    const fromName = String(name || "").match(/^(\d{4})/);
    return fromName ? fromName[1] : "Misc";
  }

  // src/core/config.js
  var EXPORT_CONFIG = {
    baseDelayMs: 500,
    jitterMaxMs: 700,
    maxRetries: 3,
    backoffBaseMs: 1e3,
    backoffCapMs: 15e3,
    maxPages: 200
  };
  var DEFAULT_CONFIG = {
    schemaVersion: 2,
    modules: {
      inputOptimization: { enabled: true, urlMatch: [], actions: {} },
      cardNameFormatter: {
        enabled: true,
        urlMatch: [
          { pattern: "/checklist\\.cfm", exclude: false },
          { pattern: "/viewcollectionforsaletrade\\.cfm", exclude: false },
          { pattern: "/viewcollectionwantlist\\.cfm", exclude: false },
          { pattern: "/collectionaddmultiples", exclude: false }
        ],
        actions: {}
      },
      checklistEnhancer: {
        enabled: true,
        urlMatch: [
          { pattern: "/checklist\\.cfm", exclude: false },
          { pattern: "/viewcollectionforsaletrade\\.cfm", exclude: false },
          { pattern: "/viewcollectionwantlist\\.cfm", exclude: false },
          { pattern: "/collectionaddmultiples", exclude: false }
        ],
        actions: {
          realtimeFilter: true,
          inlineActionCells: false
        }
      },
      setListEnhancer: {
        enabled: true,
        urlMatch: [
          { pattern: "/viewall\\.cfm", exclude: false },
          { pattern: "/inserts\\.cfm", exclude: false }
        ],
        actions: {}
      },
      addMultiplesEnhancer: {
        enabled: true,
        urlMatch: [{ pattern: "/collectionaddmultiples", exclude: false }],
        actions: {}
      },
      csvExportEngine: {
        enabled: true,
        urlMatch: [
          { pattern: "/collection", exclude: false },
          { pattern: "(?=.*/person)(?=.*collection)", exclude: false },
          { pattern: "/print\\.cfm", exclude: false },
          { pattern: "addmultiples", exclude: true }
        ],
        actions: {}
      },
      paginationLoader: {
        enabled: true,
        urlMatch: [{ pattern: "addmultiples", exclude: true }],
        actions: {}
      }
    },
    global: {
      exportBaseDelayMs: EXPORT_CONFIG.baseDelayMs,
      exportJitterMaxMs: EXPORT_CONFIG.jitterMaxMs,
      exportMaxRetries: EXPORT_CONFIG.maxRetries,
      exportBackoffBaseMs: EXPORT_CONFIG.backoffBaseMs,
      exportBackoffCapMs: EXPORT_CONFIG.backoffCapMs,
      exportMaxPages: EXPORT_CONFIG.maxPages,
      exportBlockCooldownMinutes: 5,
      toastDurationMs: 4e3,
      checklistFilterDebounceMs: 150,
      paginationLoaderDelayMs: 1e3,
      settingsSaveDebounceMs: 400,
      logLevel: "info"
    }
  };
  var SettingsStore = {
    STORAGE_KEY: "tk_config_v1",
    cloneDefaults: () => JSON.parse(JSON.stringify(DEFAULT_CONFIG)),
    load: () => {
      const stored = getValue(SettingsStore.STORAGE_KEY, null);
      if (!stored) return SettingsStore.cloneDefaults();
      return SettingsStore.migrate(stored);
    },
    /**
     * Bring a stored config up to the current schema.
     *
     * v1 -> v2 was additive only, so it is handled by the same merge as a
     * same-version load. Any other version has no migration path and resets, on
     * the principle that a wrong config is worse than a default one.
     *
     * @param {object} stored
     * @returns {object} a config conforming to the current schema
     */
    migrate: (stored) => {
      if (stored.schemaVersion === DEFAULT_CONFIG.schemaVersion) {
        return SettingsStore.mergeWithDefaults(stored);
      }
      if (stored.schemaVersion === 1 && DEFAULT_CONFIG.schemaVersion === 2) {
        Log("Migrating stored config from schema v1 to v2 (additive fields only).", "info");
        return SettingsStore.mergeWithDefaults(stored);
      }
      Log(
        `Stored config schema v${stored.schemaVersion} has no migration path to v${DEFAULT_CONFIG.schemaVersion}. Resetting to defaults.`,
        "warn"
      );
      return SettingsStore.cloneDefaults();
    },
    /**
     * Overlay stored values onto a fresh default config. Modules the current
     * build does not know about are dropped with a warning rather than carried
     * forward, so a downgrade cannot resurrect a removed module's config.
     *
     * @param {object} stored
     * @returns {object}
     */
    mergeWithDefaults: (stored) => {
      const merged = SettingsStore.cloneDefaults();
      Object.keys(stored.modules || {}).forEach((id) => {
        if (merged.modules[id]) {
          merged.modules[id] = {
            ...merged.modules[id],
            ...stored.modules[id],
            actions: { ...merged.modules[id].actions, ...stored.modules[id].actions || {} }
          };
        } else {
          Log(`Stored config references unknown module '${id}' — dropped.`, "warn");
        }
      });
      merged.global = { ...merged.global, ...stored.global || {} };
      return merged;
    },
    save: (config) => {
      setValue(SettingsStore.STORAGE_KEY, config);
    }
  };
  var Config = SettingsStore.cloneDefaults();
  function syncExportConfig() {
    EXPORT_CONFIG.baseDelayMs = Config.global.exportBaseDelayMs;
    EXPORT_CONFIG.jitterMaxMs = Config.global.exportJitterMaxMs;
    EXPORT_CONFIG.maxRetries = Config.global.exportMaxRetries;
    EXPORT_CONFIG.backoffBaseMs = Config.global.exportBackoffBaseMs;
    EXPORT_CONFIG.backoffCapMs = Config.global.exportBackoffCapMs;
    EXPORT_CONFIG.maxPages = Config.global.exportMaxPages;
  }
  function initConfig() {
    const loaded = SettingsStore.load();
    Config.schemaVersion = loaded.schemaVersion;
    Config.modules = loaded.modules;
    Config.global = loaded.global;
    RuntimeSettings.logLevel = Config.global.logLevel || "info";
    syncExportConfig();
  }
  function testUrlMatch(rules, url) {
    if (!rules || rules.length === 0) return true;
    const safeTest = (pattern) => {
      try {
        return new RegExp(pattern, "i").test(url);
      } catch (error) {
        Log(`Invalid urlMatch pattern '${pattern}': ${error.message}`, "warn");
        return false;
      }
    };
    const includeRules = rules.filter((r) => !r.exclude);
    const excludeRules = rules.filter((r) => r.exclude);
    const included = includeRules.length === 0 ? true : includeRules.some((r) => safeTest(r.pattern));
    const excluded = excludeRules.some((r) => safeTest(r.pattern));
    return included && !excluded;
  }

  // src/modules/inputOptimization.js
  var InputIndex = {
    /** @type {() => HTMLInputElement[]} */
    getValidInputs: () => []
  };
  function getValidInputs() {
    return Array.from(document.querySelectorAll("input")).filter((el) => {
      const t = el.type ? el.type.toLowerCase() : "text";
      const isTextField = t === "text" || t === "number";
      const rect = el.getBoundingClientRect();
      const isVisible = rect.width > 0 && rect.height > 0 || el.value === "0";
      return isTextField && isVisible && !el.readOnly && !el.disabled;
    });
  }
  function initInputOptimization() {
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.code !== "NumpadEnter") return;
      const active = document.activeElement;
      if (!active || active.tagName !== "INPUT" || active.id === "tk-checklist-filter") return;
      const inputs = getValidInputs();
      const index = inputs.indexOf(active);
      if (index === -1) return;
      e.preventDefault();
      if (index < inputs.length - 1) {
        const nextInput = inputs[index + 1];
        nextInput.focus({ preventScroll: true });
        setTimeout(() => nextInput.select(), 20);
      }
    });
    InputIndex.getValidInputs = getValidInputs;
  }

  // src/ui/icons.js
  var Icons = {
    bolt: () => `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    gem: () => `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l4 6-10 12L2 9z"/><path d="M11 3 8 9l3 12"/><path d="M13 3l3 6-3 12"/><path d="M2 9h20"/></svg>`,
    tag: () => `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`,
    layers: () => `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
    star: () => `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    download: () => `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
    pin: () => `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
    x: () => `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    chevronUp: () => `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>`,
    plus: () => `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
    gear: () => `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`
  };

  // src/ui/dom.js
  function injectStyle(css) {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
    return style;
  }
  function createBtn(id, text, onClick, disabled = false, icon = "") {
    const btn = document.createElement("button");
    btn.id = id;
    btn.type = "button";
    const iconSvg = icon && Icons[icon] ? Icons[icon]() : "";
    btn.innerHTML = `${iconSvg}<span></span>`;
    btn.querySelector("span").textContent = text;
    btn.className = "sctk-btn";
    btn.disabled = disabled;
    btn.addEventListener("click", onClick);
    return btn;
  }
  function debounce(fn, waitMs) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), waitMs);
    };
  }
  function escapeHtml(str) {
    if (str === null || str === void 0) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function assertContract(moduleId, checks) {
    const failures = [];
    checks.forEach(({ selector, context = document, label }) => {
      let found;
      try {
        found = context.querySelector(selector);
      } catch {
        found = null;
      }
      if (!found) failures.push(label || selector);
    });
    if (failures.length > 0) {
      Log(
        `[Contract Check] Module '${moduleId}' — expected selector(s) not found: ${failures.join("; ")}. Site markup may have changed; affected functionality may silently no-op.`,
        "warn"
      );
      return false;
    }
    return true;
  }

  // src/modules/cardNameFormatter.js
  var CARD_NAME_SELECTOR = ".card-name-selector";
  function initCardNameFormatter() {
    assertContract("cardNameFormatter", [
      { selector: CARD_NAME_SELECTOR, label: `${CARD_NAME_SELECTOR} (card name nodes)` }
    ]);
    document.querySelectorAll(CARD_NAME_SELECTOR).forEach((node) => {
      node.textContent = node.textContent.replace(/(\w+)\s-\s(\w+)/g, "$1 $2").trim();
    });
  }

  // src/core/routes.js
  var path = () => window.location.pathname.toLowerCase();
  var SET_PAGE_PREDICATES = [
    "isChecklist",
    "isViewSet",
    "isViewAll",
    "isInserts",
    "isForSaleTrade",
    "isWantlist",
    "isAddMultiples"
  ];
  var Routes = {
    isCollection: () => path().includes("/collection") && !path().includes("addmultiples"),
    isPlayerCollection: () => path().includes("/person") && window.location.search.toLowerCase().includes("collection"),
    isPlayerPage: () => path().includes("/person.cfm"),
    isCardPage: () => path().includes("/viewcard.cfm"),
    isChecklist: () => path().includes("/checklist.cfm"),
    isViewSet: () => path().includes("/viewset.cfm"),
    isInserts: () => path().includes("/inserts.cfm"),
    isPrintPDF: () => path().includes("/print.cfm"),
    isViewAll: () => path().includes("/viewall.cfm") || path().includes("/inserts.cfm"),
    isForSaleTrade: () => path().includes("/viewcollectionforsaletrade.cfm"),
    isWantlist: () => path().includes("/viewcollectionwantlist.cfm"),
    isAddMultiples: () => path().includes("/collectionaddmultiples"),
    /**
     * True on any page scoped to one set. Composed from the individual
     * predicates rather than re-listing the same seven path fragments, so adding
     * a set-scoped route cannot leave this out of date.
     */
    isSetPage: () => SET_PAGE_PREDICATES.some((key) => Routes[key]()),
    hasPagination: () => !!document.querySelector(".pagination") && !path().includes("addmultiples")
  };

  // src/modules/checklistEnhancer.js
  var INLINE_ACTION_CONTRACT = [
    { selector: ".action-wantlist-selector", label: ".action-wantlist-selector (wantlist action to relocate)" },
    { selector: ".top-bar-selector", label: ".top-bar-selector (relocation target)" },
    { selector: "tr.checklist-row", label: "tr.checklist-row (inline action cell rows)" }
  ];
  var INLINE_ACTIONS = ["+1 FS", "+1 W", "FS", "FT", "W", "I", "P"];
  function installFilter(mainContent) {
    const targetTable = mainContent.querySelector("table");
    if (!targetTable) return;
    const filterWrap = document.createElement("div");
    filterWrap.id = "tk-checklist-filter-wrap";
    filterWrap.innerHTML = `
    <strong>Filter Items:</strong>
    <input type="text" id="tk-checklist-filter" placeholder="Filter by Player, Card #, Tag, Team..."
           title="Type to filter active table rows in real time" aria-label="Filter table rows">
  `;
    targetTable.before(filterWrap);
    const input = filterWrap.querySelector("#tk-checklist-filter");
    const applyFilter = debounce((term) => {
      mainContent.querySelectorAll("table tr").forEach((row) => {
        if (!row.querySelector('a[href*="ViewCard.cfm"], input, select')) return;
        row.style.display = row.innerText.toLowerCase().includes(term) ? "" : "none";
      });
    }, Config.global.checklistFilterDebounceMs);
    input.addEventListener("input", (e) => applyFilter(e.target.value.toLowerCase().trim()));
  }
  function initChecklistEnhancer() {
    const actionCfg = Config.modules.checklistEnhancer.actions;
    const mainContent = document.getElementById("main-content-area");
    const onFilterableRoute = Routes.isChecklist() || Routes.isForSaleTrade() || Routes.isWantlist() || Routes.isAddMultiples();
    if (actionCfg.realtimeFilter && mainContent && onFilterableRoute && !document.getElementById("tk-checklist-filter-wrap")) {
      installFilter(mainContent);
    }
    if (!actionCfg.inlineActionCells) return;
    assertContract("checklistEnhancer", INLINE_ACTION_CONTRACT);
    const wantlistAction = document.querySelector(".action-wantlist-selector");
    const topBar = document.querySelector(".top-bar-selector");
    if (wantlistAction && topBar) topBar.prepend(wantlistAction);
    document.querySelectorAll("tr.checklist-row").forEach((row, index) => {
      const actionCell = row.querySelector(".action-cell-selector") || row.insertCell();
      INLINE_ACTIONS.forEach((action) => {
        const span = document.createElement("span");
        span.className = "tk-inline-action";
        span.textContent = `[${action}]`;
        span.title = `Perform ${action} action`;
        span.addEventListener("click", () => Log(`Triggered [${action}] on row index ${index}`));
        actionCell.appendChild(span);
      });
    });
  }

  // src/core/sid.js
  function extractSid(url) {
    if (!url) return null;
    const match = String(url).match(/sid[=/](\d+)/i);
    return match ? match[1] : null;
  }

  // src/data/csv.js
  function escapeField(value) {
    const str = value === null || value === void 0 ? "" : String(value);
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }
  function buildRow(fields) {
    return fields.map(escapeField).join(",");
  }
  function toCSV(rows) {
    return rows.map(buildRow).join("\n");
  }
  function download(csvContent, filename) {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
  var CSV = { escapeField, buildRow, toCSV, download };

  // src/data/filename.js
  function sanitizeSegment(str) {
    return String(str || "").replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");
  }
  function compactSegment(str) {
    return String(str || "").replace(/[^a-z0-9]/gi, "");
  }
  function underscoreSegment(str) {
    return String(str || "").replace(/[^a-z0-9]/gi, "_");
  }
  var EXPORT_KIND_SUFFIX = {
    checklist: "_Checklist",
    forSale: "_ForSale",
    wantlist: "_Wantlist",
    addMultiples: "_AddMultiples"
  };
  function buildExportFilename({
    year = "",
    baseSet = "",
    setName = "",
    fallbackLabel = "",
    kind = "checklist"
  } = {}) {
    const cleanYear = year || (String(fallbackLabel || "").match(/^(\d{4})/)?.[1] ?? "");
    const cleanBaseSet = sanitizeSegment(baseSet);
    const cleanSubSet = setName ? `_${compactSegment(setName)}` : "";
    const suffix = EXPORT_KIND_SUFFIX[kind] ?? EXPORT_KIND_SUFFIX.checklist;
    return cleanYear ? `${cleanYear}_${cleanBaseSet}${cleanSubSet}${suffix}.csv` : `${cleanBaseSet}${cleanSubSet}${suffix}.csv`;
  }

  // src/data/checklistParser.js
  var CHECKLIST_HEADER = [
    "Year",
    "Base Set",
    "Set Name",
    "Card No",
    "Subject",
    "Tags",
    "Print Run",
    "Team"
  ];
  var NAME_SUFFIX = /^(Jr\.?|Sr\.?|II|III|IV|V)$/i;
  var PRINT_RUN = /^SN\d+$/i;
  var CAPTION_PREFIX = /^(VAR|ERR|UER):\s*/i;
  var DESCRIBABLE_TAG = /^(VAR|ERR|UER)$/i;
  var norm = (node) => node ? node.textContent.replace(/\s+/g, " ").trim() : "";
  function parseSubjectCell(rawSubject, captionDesc = "") {
    const tokens = String(rawSubject || "").split(" ");
    const subjectParts = [];
    let tagParts = [];
    let printRun = "";
    let foundNonTag = false;
    for (let i = tokens.length - 1; i >= 0; i--) {
      const token = tokens[i].trim();
      if (!token) continue;
      const cleanToken = token.replace(/,/g, "").trim();
      if (!foundNonTag && PRINT_RUN.test(cleanToken)) {
        printRun = cleanToken.replace(/^SN/i, "");
      } else if (!foundNonTag && NAME_SUFFIX.test(cleanToken)) {
        foundNonTag = true;
        subjectParts.unshift(token);
      } else if (!foundNonTag && /^[^a-z]+$/.test(cleanToken) && /[A-Z0-9]/.test(cleanToken)) {
        tagParts.unshift(cleanToken);
      } else {
        foundNonTag = true;
        subjectParts.unshift(token);
      }
    }
    if (captionDesc) {
      tagParts = tagParts.map((tag) => DESCRIBABLE_TAG.test(tag) ? `${tag} (${captionDesc})` : tag);
      if (!tagParts.some((t) => t.includes(captionDesc))) {
        tagParts.push(`VAR (${captionDesc})`);
      }
    }
    return {
      subject: subjectParts.join(" ").replace(/,\s*$/, "").trim(),
      tags: tagParts.join(", "),
      printRun
    };
  }
  function findSubjectCell(row, cardNoLink) {
    const personLink = row.querySelector('a[href*="Person.cfm"]');
    if (personLink) return personLink.closest("td");
    const cardTd = cardNoLink.closest("td");
    let cell = cardTd ? cardTd.nextElementSibling : null;
    while (cell && !cell.textContent.trim()) {
      cell = cell.nextElementSibling;
    }
    return cell;
  }
  function parseChecklistRow(row) {
    const cardLinks = Array.from(row.querySelectorAll('a[href*="ViewCard.cfm"]'));
    const cardNoLink = cardLinks.find((a) => a.textContent.trim().length > 0);
    if (!cardNoLink) return null;
    const teamLink = row.querySelector('a[href*="Team.cfm"]');
    const subjectTd = findSubjectCell(row, cardNoLink);
    let rawSubject = "";
    let captionDesc = "";
    if (subjectTd) {
      const figcaptionEl = subjectTd.querySelector("figcaption, .figure-caption");
      if (figcaptionEl) {
        captionDesc = norm(figcaptionEl).replace(CAPTION_PREFIX, "").trim();
      }
      const cloneTd = subjectTd.cloneNode(true);
      cloneTd.querySelectorAll("figcaption, .figure-caption").forEach((el) => el.remove());
      rawSubject = norm(cloneTd);
    }
    const { subject, tags, printRun } = parseSubjectCell(rawSubject, captionDesc);
    return {
      cardNo: cardNoLink.textContent.trim(),
      subject,
      tags,
      printRun,
      team: teamLink ? teamLink.textContent.trim() : ""
    };
  }
  function parseSetIdentity(doc) {
    let year = "";
    let baseSet = "";
    let setName = "";
    const setnameContent = doc.getElementById("setname-content");
    if (setnameContent) {
      const h1 = setnameContent.querySelector("h1");
      if (h1) {
        const h1Text = norm(h1).replace(/\s*-\s*Cards$/i, "").trim();
        const yearMatch = h1Text.match(/^(\d{4})\s+(.+)/);
        if (yearMatch) {
          year = yearMatch[1];
          baseSet = yearMatch[2];
        } else {
          baseSet = h1Text;
        }
      }
      const h3 = setnameContent.querySelector("h3");
      if (h3) setName = norm(h3);
    }
    return { year, baseSet, setName };
  }
  function parseTotalPages(doc) {
    let totalPages = 1;
    doc.querySelectorAll('.pagination a[href*="PageIndex="]').forEach((link) => {
      const href = link.getAttribute("href") || "";
      const pMatch = href.match(/PageIndex=(\d+)/i);
      if (pMatch) {
        const pNum = parseInt(pMatch[1], 10);
        if (pNum > totalPages) totalPages = pNum;
      }
    });
    return totalPages;
  }
  function parseChecklistDocument(doc) {
    const identity = parseSetIdentity(doc);
    const totalPages = parseTotalPages(doc);
    const rows = [];
    const mainContent = doc.getElementById("main-content-area");
    if (mainContent) {
      mainContent.querySelectorAll("table tr").forEach((row) => {
        const parsed = parseChecklistRow(row);
        if (parsed) rows.push(parsed);
      });
    }
    return { ...identity, totalPages, rows };
  }
  function toChecklistTable(identity, rows) {
    return [
      CHECKLIST_HEADER,
      ...rows.map((r) => [
        identity.year,
        identity.baseSet,
        identity.setName,
        r.cardNo,
        r.subject,
        r.tags,
        r.printRun,
        r.team
      ])
    ];
  }

  // src/ui/status.js
  function setStatus(text, tooltipText = "") {
    const status = document.getElementById("tk-status");
    if (!status) return;
    status.textContent = text;
    if (tooltipText) status.title = tooltipText;
  }
  function enableAction(id) {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = false;
  }

  // src/ui/toast.js
  function showToast({
    message = "",
    location = "bottom-right",
    duration = Config.global.toastDurationMs,
    accent = "var(--tk-teal)"
  } = {}) {
    const containerId = `tk-toast-container-${location}`;
    let container = document.getElementById(containerId);
    if (!container) {
      container = document.createElement("div");
      container.id = containerId;
      container.className = `tk-toast-container tk-toast-${location}`;
      document.body.appendChild(container);
    }
    const toast = document.createElement("div");
    toast.className = "tk-toast-message";
    toast.style.borderLeftColor = accent;
    toast.innerHTML = message;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add("tk-toast-show"), 10);
    setTimeout(() => {
      toast.classList.remove("tk-toast-show");
      setTimeout(() => {
        toast.remove();
        if (container.childNodes.length === 0) container.remove();
      }, 300);
    }, duration);
  }

  // src/net/blockDetect.js
  var BLOCK_MARKERS = [
    "g-recaptcha",
    "cf-browser-verification",
    "Access Denied"
  ];
  function detectBlock(html) {
    if (!html) return null;
    return BLOCK_MARKERS.find((marker) => html.includes(marker)) ?? null;
  }

  // src/net/fetcher.js
  var THROTTLE_STATUSES = [429, 503];
  var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  function jitteredDelay(baseMs = EXPORT_CONFIG.baseDelayMs, jitterMaxMs = EXPORT_CONFIG.jitterMaxMs) {
    return sleep(baseMs + Math.random() * jitterMaxMs);
  }
  function computeBackoff(attempt, baseMs, capMs) {
    return Math.min(baseMs * Math.pow(2, attempt - 1), capMs);
  }
  function parseRetryAfter(header, now = Date.now()) {
    if (!header) return 0;
    const asSeconds = Number(header);
    if (!Number.isNaN(asSeconds)) {
      return asSeconds > 0 ? asSeconds * 1e3 : 0;
    }
    const asDate = new Date(header).getTime();
    if (Number.isNaN(asDate)) return 0;
    return Math.max(0, asDate - now);
  }
  async function fetchPageWithRetry(fetchUrl, pageIndex, onStatus = () => {
  }) {
    let attempt = 0;
    for (; ; ) {
      attempt++;
      let response;
      try {
        response = await fetch(fetchUrl);
      } catch (networkError) {
        if (attempt > EXPORT_CONFIG.maxRetries) {
          throw new Error(
            `Network error fetching page ${pageIndex} after ${attempt - 1} retries: ${networkError.message}`
          );
        }
        const backoff = computeBackoff(attempt, EXPORT_CONFIG.backoffBaseMs, EXPORT_CONFIG.backoffCapMs);
        Log(`Network error on page ${pageIndex} (attempt ${attempt}). Retrying in ${backoff}ms.`, "warn", "server");
        await sleep(backoff);
        continue;
      }
      if (THROTTLE_STATUSES.includes(response.status)) {
        if (attempt > EXPORT_CONFIG.maxRetries) {
          throw new Error(
            `Server rate limit persisted on page ${pageIndex} after ${attempt - 1} retries (HTTP ${response.status}).`
          );
        }
        let backoff = parseRetryAfter(response.headers.get("Retry-After"));
        if (backoff <= 0) {
          backoff = computeBackoff(attempt, EXPORT_CONFIG.backoffBaseMs, EXPORT_CONFIG.backoffCapMs);
        }
        Log(`HTTP ${response.status} on page ${pageIndex} (attempt ${attempt}). Backing off ${backoff}ms.`, "warn", "server");
        onStatus(`Throttled — retrying in ${Math.round(backoff / 1e3)}s...`);
        await sleep(backoff);
        continue;
      }
      if (!response.ok) {
        throw new Error(`Server returned status HTTP ${response.status} on page ${pageIndex}`);
      }
      return response;
    }
  }

  // src/net/queue.js
  var ExportQueue = {
    queue: [],
    active: false,
    /**
     * @param {string} label human-readable job name, shown in toasts
     * @param {() => Promise<void>} task
     */
    enqueue: (label, task) => {
      ExportQueue.queue.push({ label, task });
      const position = ExportQueue.queue.length;
      if (ExportQueue.active) {
        Log(`Export queued behind ${position - 1} pending job(s): ${label}`, "info");
        showToast({
          message: `Queued: <b>${escapeHtml(label)}</b> (position ${position})`,
          accent: "var(--tk-text-muted)"
        });
        return;
      }
      ExportQueue.processNext();
    },
    processNext: async () => {
      if (ExportQueue.queue.length === 0) {
        ExportQueue.active = false;
        return;
      }
      ExportQueue.active = true;
      const { label, task } = ExportQueue.queue.shift();
      Log(`Export job starting: ${label}`, "info");
      try {
        await task();
      } catch (error) {
        Log(`Export job threw uncaught error: ${error.message}`, "error");
      }
      ExportQueue.processNext();
    }
  };

  // src/net/setExport.js
  function currentPageKind() {
    if (Routes.isForSaleTrade()) return "forSale";
    if (Routes.isWantlist()) return "wantlist";
    if (Routes.isAddMultiples()) return "addMultiples";
    return "checklist";
  }
  function cooldownRemainingMinutes(now = Date.now()) {
    const cooldownMs = (Config.global.exportBlockCooldownMinutes || 0) * 6e4;
    if (cooldownMs <= 0) return 0;
    const lastBlockTs = getValue(BLOCK_TS_KEY, 0);
    if (!lastBlockTs) return 0;
    const elapsed = now - lastBlockTs;
    if (elapsed >= cooldownMs) return 0;
    return Math.ceil((cooldownMs - elapsed) / 6e4);
  }
  function exportSetCSV(setId, setName) {
    ExportQueue.enqueue(setName || `Set ${setId}`, () => runExportSetCSV(setId, setName));
  }
  async function runExportSetCSV(setId, setName) {
    const remainingMin = cooldownRemainingMinutes();
    if (remainingMin > 0) {
      Log(`Export refused: anti-scraping cooldown active (${remainingMin} min remaining).`, "warn");
      setStatus("Export blocked (cooldown)");
      showToast({
        message: `Export paused — an anti-scraping block was detected recently. Try again in ~${remainingMin} min, or adjust the cooldown in Settings.`,
        accent: "var(--tk-red)"
      });
      return;
    }
    Log(`Starting checklist fetch for set ID ${setId} (${setName})`, "info", "server");
    setStatus(`Fetching ${setName}...`);
    try {
      let pageIndex = 1;
      let totalPages = 1;
      let identity = { year: "", baseSet: "", setName: "" };
      const allRows = [];
      do {
        if (pageIndex > 1) await jitteredDelay();
        setStatus(`Fetching Page ${pageIndex}${totalPages > 1 ? "/" + totalPages : ""}...`);
        const fetchUrl = `/Checklist.cfm/sid/${setId}/?PageIndex=${pageIndex}`;
        Log(`HTTP GET Request -> ${fetchUrl}`, "info", "server");
        const response = await fetchPageWithRetry(fetchUrl, pageIndex, setStatus);
        const html = await response.text();
        const blockMarker = detectBlock(html);
        if (blockMarker) {
          setValue(BLOCK_TS_KEY, Date.now());
          throw new Error(
            `Anti-scraping protection triggered by server (matched '${blockMarker}'). Fetch aborted.`
          );
        }
        const doc = new DOMParser().parseFromString(html, "text/html");
        const parsed = parseChecklistDocument(doc);
        if (pageIndex === 1) {
          identity = { year: parsed.year, baseSet: parsed.baseSet, setName: parsed.setName };
          totalPages = parsed.totalPages;
          if (totalPages > EXPORT_CONFIG.maxPages) {
            throw new Error(
              `Discovered page count (${totalPages}) exceeds safety ceiling (${EXPORT_CONFIG.maxPages}). Likely a pagination-parsing regression — export aborted before fetching.`
            );
          }
          Log(`Discovered ${totalPages} total page(s) for set ID ${setId}`, "info", "server");
        }
        allRows.push(...parsed.rows);
        Log(`Page ${pageIndex}/${totalPages} parsed successfully. ${parsed.rows.length} rows retrieved.`, "info", "server");
        pageIndex++;
      } while (pageIndex <= totalPages);
      if (allRows.length === 0) throw new Error("No valid checklist rows identified within tables.");
      let setLogLabel = identity.baseSet;
      if (identity.setName) setLogLabel += ` - ${identity.setName}`;
      Log(`Export complete for: ${setLogLabel} (${allRows.length} cards across ${totalPages} page(s))`, "info", "server");
      const filename = buildExportFilename({
        year: identity.year,
        baseSet: identity.baseSet,
        setName: identity.setName,
        fallbackLabel: setName,
        kind: currentPageKind()
      });
      CSV.download(CSV.toCSV(toChecklistTable(identity, allRows)), filename);
      setStatus("Export Complete");
      showToast({ message: `Exported <b>${allRows.length}</b> cards for ${escapeHtml(setLogLabel)}` });
    } catch (error) {
      Log(`CSV Export Failed: ${error.message}`, "error", "server");
      setStatus("Export Failed");
      showToast({ message: `Export Failed: ${escapeHtml(error.message)}`, accent: "var(--tk-red)" });
    }
  }

  // src/ui/badges.js
  var BADGES = {
    INSERTS: {
      icon: "bolt",
      text: "INS",
      cssClass: "tk-badge-link-i",
      title: "View Insert Sets",
      getUrl: (sid) => `/Inserts.cfm/sid/${sid}/#InsertSets`
    },
    PARALLELS: {
      icon: "gem",
      text: "PAR",
      cssClass: "tk-badge-link-p",
      title: "View Parallel Sets",
      getUrl: (sid) => `/Inserts.cfm/sid/${sid}/#ParallelSets`
    },
    FOR_SALE: {
      icon: "tag",
      text: "FS",
      cssClass: "tk-badge-link-fs",
      title: "View For Sale / For Trade Items",
      getUrl: (sid) => `/ViewCollectionForSaleTrade.cfm/sid/${sid}`
    },
    MULTI: {
      icon: "layers",
      text: "MULTI",
      cssClass: "tk-badge-link-fsm",
      title: "Add Multiples to For Sale / For Trade",
      getUrl: (sid) => `/CollectionAddMultiplesText.cfm/sid/${sid}`
    },
    WANTLIST: {
      icon: "star",
      text: "WANT",
      cssClass: "tk-badge-link-w",
      title: "View Collection Wantlist",
      getUrl: (sid) => `/ViewCollectionWantlist.cfm/sid/${sid}`
    },
    CSV: {
      icon: "download",
      text: "CSV",
      cssClass: "tk-badge-action",
      title: "Export Set Checklist to CSV"
    },
    PIN: {
      icon: "pin",
      text: "PIN",
      cssClass: "tk-badge-action",
      title: "Pin this set to the Global Toolbar"
    },
    REMOVE_PIN: {
      icon: "x",
      text: "",
      cssClass: "tk-pin-remove",
      title: "Remove Pin"
    }
  };
  var SHORTCUT_ORDER = ["INSERTS", "PARALLELS", "FOR_SALE", "MULTI", "WANTLIST"];
  function createBadge(badgeKey, sid = null, onClickOverride = null) {
    const config = BADGES[badgeKey];
    if (!config) return null;
    const iconSvg = config.icon && Icons[config.icon] ? Icons[config.icon]() : "";
    const inner = `${iconSvg}${config.text ? `<span class="tk-badge-label">${config.text}</span>` : ""}`;
    if (config.getUrl && !onClickOverride) {
      const link = document.createElement("a");
      link.href = config.getUrl(sid);
      link.innerHTML = inner;
      link.className = `sctk-badge ${config.cssClass}`;
      link.title = config.title;
      return link;
    }
    const btn = document.createElement("span");
    btn.innerHTML = inner;
    btn.className = `sctk-badge ${config.cssClass}`;
    btn.title = config.title;
    btn.tabIndex = 0;
    btn.setAttribute("role", "button");
    btn.setAttribute("aria-label", config.title);
    if (onClickOverride) {
      btn.addEventListener("click", onClickOverride);
      btn.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClickOverride(e);
        }
      });
    }
    return btn;
  }

  // src/ui/styles.js
  var TOOLBAR_CSS = `
/* ---- Design tokens (Light Theme) ---- */
:root {
    --tk-bg-base: #f8f9fa;
    --tk-bg-elevated: #ffffff;
    --tk-bg-hover: #e9ecef;
    --tk-border: #dee2e6;
    --tk-border-strong: #ced4da;
    --tk-text: #212529;
    --tk-text-muted: #6c757d;
    --tk-accent: #d97706;
    --tk-teal: #0d9488;
    --tk-blue: #0d6efd;
    --tk-violet: #7c3aed;
    --tk-magenta: #db2777;
    --tk-green: #198754;
    --tk-red: #dc3545;
    --tk-font-ui: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    --tk-font-mono: ui-monospace, "SF Mono", "Cascadia Code", "Roboto Mono", Menlo, Consolas, monospace;
    --tk-radius-sm: 4px;
    --tk-radius-md: 6px;
    --tk-shadow-elevated: 0 4px 16px rgba(0,0,0,0.12);
}

#sctk-toolbar { position: fixed; top: 0; left: 0; width: 100%; z-index: 99999; background: var(--tk-bg-base); color: var(--tk-text); display: flex; align-items: center; min-height: 34px; padding: 2px 8px; font-family: var(--tk-font-ui); font-size: 11px; border-bottom: 1px solid var(--tk-border); box-shadow: 0 2px 8px rgba(0,0,0,0.06); box-sizing: border-box; flex-wrap: wrap; }

/* Wordmark */
#sctk-toolbar .tk-wordmark { display: flex; flex-direction: column; justify-content: center; padding: 2px 6px; margin-right: 8px; flex-shrink: 0; background: var(--tk-bg-elevated); border: 1px solid var(--tk-border-strong); border-top: 2px solid var(--tk-accent); border-radius: 0 0 3px 3px; line-height: 1.1; }
#sctk-toolbar .tk-wordmark-title { font-family: var(--tk-font-mono); font-weight: 700; font-size: 11px; letter-spacing: 0.02em; color: var(--tk-text); }
#sctk-toolbar .tk-wordmark-sub { font-family: var(--tk-font-mono); font-size: 7.5px; letter-spacing: 0.14em; color: var(--tk-text-muted); text-transform: uppercase; }

#sctk-toolbar .toolbar-group { display: flex; gap: 4px; margin-right: 8px; border-right: 1px solid var(--tk-border); padding-right: 8px; flex-shrink: 0; align-items: center; }

/* Responsive Center Context Bar */
#tk-center-context { flex-grow: 1; flex-shrink: 1; display: flex; align-items: center; justify-content: center; gap: 4px; overflow: hidden; min-width: 120px; padding: 0 4px; }
#tk-center-context .tk-scroll-btn { background: var(--tk-bg-elevated); color: var(--tk-teal); border: 1px solid var(--tk-border-strong); border-radius: var(--tk-radius-sm); padding: 2px 6px; cursor: pointer; font-family: var(--tk-font-mono); font-size: 9.5px; font-weight: 700; letter-spacing: 0.02em; flex-shrink: 0; user-select: none; display: inline-flex; align-items: center; gap: 3px; line-height: 1.2; }
#tk-center-context .tk-scroll-btn:hover { background: var(--tk-bg-hover); border-color: var(--tk-teal); color: #000000; }
#tk-center-context .context-label { font-family: var(--tk-font-mono); font-weight: 600; color: var(--tk-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; }

/* Right-Aligned Status Bar */
#tk-status { flex-shrink: 0; border-right: none; margin: 0; font-family: var(--tk-font-mono); font-weight: 700; font-size: 10px; letter-spacing: 0.02em; color: var(--tk-teal); cursor: pointer; text-align: right; justify-content: flex-end; padding-left: 4px; white-space: nowrap; }

#tk-settings-trigger.tk-scroll-btn { margin-left: 4px; padding: 2px 5px; }

.sctk-btn { display: inline-flex; align-items: center; gap: 4px; background: var(--tk-bg-elevated); color: var(--tk-text); border: 1px solid var(--tk-border-strong); border-radius: var(--tk-radius-sm); padding: 2px 7px; cursor: pointer; font-family: var(--tk-font-ui); font-size: 10.5px; font-weight: 600; white-space: nowrap; line-height: 1.2; }
.sctk-btn svg { flex-shrink: 0; }
.sctk-btn:hover:not(:disabled) { background: var(--tk-bg-hover); border-color: var(--tk-teal); color: #000000; }
.sctk-btn:disabled { background: var(--tk-bg-base); border-color: var(--tk-border); color: var(--tk-text-muted); cursor: not-allowed; opacity: 0.7; }

/* Visible keyboard focus */
#sctk-toolbar button:focus-visible,
#sctk-toolbar a:focus-visible,
#sctk-toolbar span[role="button"]:focus-visible,
#sctk-toolbar input:focus-visible,
.tk-dropdown-content a:focus-visible,
.tk-dropdown-content span[role="button"]:focus-visible {
    outline: 2px solid var(--tk-accent); outline-offset: 1px; border-radius: var(--tk-radius-sm);
}

@media (prefers-reduced-motion: no-preference) {
    #tk-center-context .tk-scroll-btn, .sctk-btn, .sctk-badge, .tk-dropbtn, .tk-pin-remove {
        transition: background-color .15s ease, border-color .15s ease, color .15s ease, box-shadow .15s ease;
    }
}

/* Dropdown Styling for Pins */
.tk-dropdown { position: relative; display: inline-block; }
.tk-dropdown-content { display: none; position: absolute; left: 0; top: 100%; margin-top: 2px; background-color: var(--tk-bg-elevated); min-width: 320px; box-shadow: var(--tk-shadow-elevated); z-index: 100000; border-radius: var(--tk-radius-md); border: 1px solid var(--tk-border-strong); max-height: 450px; overflow-y: auto; text-align: left; }
.tk-dropdown:hover .tk-dropdown-content, .tk-dropdown:focus-within .tk-dropdown-content, .tk-dropdown.tk-show .tk-dropdown-content { display: block; }

.tk-dropdown-content .tk-pin-item { color: var(--tk-text); padding: 6px 8px; display: flex; flex-direction: column; gap: 3px; font-size: 10.5px; border-bottom: 1px solid var(--tk-border); }
.tk-dropdown-content .tk-pin-item:last-child { border-bottom: none; }
.tk-dropdown-content .tk-pin-item:hover { background-color: var(--tk-bg-hover); }
.tk-dropdown-content .tk-pin-header { display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 6px; }
.tk-dropdown-content .tk-pin-title { font-family: var(--tk-font-mono); font-weight: 700; font-size: 10.5px; color: var(--tk-accent); text-decoration: none; flex-grow: 1; text-align: left; line-height: 1.2; white-space: normal; }
.tk-dropdown-content .tk-pin-title:hover { text-decoration: underline; color: #b45309; }

.tk-dropdown-content .tk-pin-actions { display: flex; gap: 3px; align-items: center; flex-wrap: wrap; margin-top: 1px; }
.tk-dropdown-content .tk-pin-actions .sctk-badge { margin-left: 0; margin-right: 0; flex-shrink: 0; }

.tk-pin-remove { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border: 1px solid var(--tk-red); background: transparent; color: var(--tk-red); border-radius: var(--tk-radius-sm); cursor: pointer; flex-shrink: 0; }
.tk-pin-remove:hover { background: var(--tk-red); color: #fff; }

.tk-dropbtn { display: inline-flex; align-items: center; gap: 3px; background: var(--tk-bg-elevated); border: 1px solid var(--tk-border-strong); color: var(--tk-text); border-radius: var(--tk-radius-sm); padding: 2px 6px; cursor: pointer; font-family: var(--tk-font-mono); font-size: 10px; font-weight: 700; line-height: 1.2; }
.tk-dropbtn:hover { border-color: var(--tk-accent); color: var(--tk-accent); background: var(--tk-bg-hover); }
.tk-dropbtn:focus-visible { outline: 2px solid var(--tk-accent); outline-offset: 1px; }

/* Compact Badge Styles */
.sctk-badge { display: inline-flex; align-items: center; gap: 3px; font-family: var(--tk-font-mono); padding: 2px 5px; margin-left: 2px; text-decoration: none !important; font-size: 9.5px; font-weight: 700; letter-spacing: 0.01em; border-radius: var(--tk-radius-sm); line-height: 1; vertical-align: middle; box-sizing: border-box; cursor: pointer; white-space: nowrap; border: 1px solid transparent; }

.tk-badge-action { background: var(--tk-bg-elevated); border-color: var(--tk-blue); color: var(--tk-blue); }
.tk-badge-action:hover { background: var(--tk-blue); color: #ffffff; }

.tk-badge-link-i { background: var(--tk-bg-elevated); border-color: var(--tk-violet); color: var(--tk-violet); }
.tk-badge-link-i:hover { background: var(--tk-violet); color: #ffffff; }

.tk-badge-link-p { background: var(--tk-bg-elevated); border-color: var(--tk-magenta); color: var(--tk-magenta); }
.tk-badge-link-p:hover { background: var(--tk-magenta); color: #ffffff; }

.tk-badge-link-fs { background: var(--tk-green); border-color: var(--tk-green); color: #ffffff; }
.tk-badge-link-fs:hover { background: #146c43; border-color: #146c43; }

.tk-badge-link-fsm { background: var(--tk-bg-elevated); border-color: var(--tk-green); color: var(--tk-green); }
.tk-badge-link-fsm:hover { background: var(--tk-green); color: #ffffff; }

.tk-badge-link-w { background: var(--tk-red); border-color: var(--tk-red); color: #ffffff; }
.tk-badge-link-w:hover { background: #b02a37; border-color: #b02a37; }

/* Filter Bar CSS */
#tk-checklist-filter-wrap { margin: 8px 0; display: flex; align-items: center; gap: 6px; background: var(--tk-bg-elevated); border: 1px solid var(--tk-border-strong); border-left: 3px solid var(--tk-accent); padding: 6px 10px; border-radius: 4px; font-family: var(--tk-font-ui); color: var(--tk-text); font-size: 11.5px; }
#tk-checklist-filter-wrap strong { font-family: var(--tk-font-mono); font-size: 9.5px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--tk-accent); font-weight: 700; }
#tk-checklist-filter { padding: 3px 6px; border: 1px solid var(--tk-border-strong); background: var(--tk-bg-elevated); color: var(--tk-text); border-radius: 3px; font-size: 11.5px; width: 240px; font-family: var(--tk-font-ui); }
#tk-checklist-filter:focus-visible { outline: 2px solid var(--tk-accent); outline-offset: 1px; border-color: var(--tk-accent); }

/* Responsive Breakpoints */
@media (max-width: 900px) {
    #sctk-toolbar .tk-wordmark { display: none; }
    #tk-center-context .context-label { max-width: 160px; }
}

@media (max-width: 650px) {
    #tk-center-context .context-label { display: none; }
    #tk-center-context { justify-content: flex-start; }
    #tk-checklist-filter { width: 160px; }
}

/* Toast System */
.tk-toast-container { position: fixed; z-index: 100000; display: flex; flex-direction: column; gap: 6px; pointer-events: none; font-family: var(--tk-font-ui); }
.tk-toast-bottom-right { bottom: 16px; right: 16px; }
.tk-toast-bottom-left { bottom: 16px; left: 16px; }
.tk-toast-top-right { top: 44px; right: 16px; }
.tk-toast-top-left { top: 44px; left: 16px; }
.tk-toast-message { padding: 8px 12px; border-radius: var(--tk-radius-sm); background: var(--tk-bg-elevated); color: var(--tk-text); border: 1px solid var(--tk-border); border-left: 3px solid var(--tk-teal); box-shadow: var(--tk-shadow-elevated); opacity: 0; pointer-events: auto; line-height: 1.35; max-width: 320px; word-wrap: break-word; text-align: left; font-size: 11.5px; }
.tk-toast-message.tk-toast-show { opacity: 1; }
@media (prefers-reduced-motion: no-preference) {
    .tk-toast-message { transform: translateY(8px); transition: opacity 0.25s ease, transform 0.25s ease; }
    .tk-toast-message.tk-toast-show { transform: translateY(0); }
}
.tk-toast-message ul, .tk-toast-message ol { text-align: left; margin: 3px 0 0 0; padding-left: 16px; }
.tk-toast-message li { text-align: left; margin-bottom: 2px; }

body { padding-top: 38px !important; }
`;
  var SETTINGS_CSS = `
#tk-settings-overlay { position: fixed; inset: 0; z-index: 200000; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; font-family: var(--tk-font-ui); }
#tk-settings-panel { background: var(--tk-bg-elevated); color: var(--tk-text); width: min(720px, 92vw); max-height: 85vh; border-radius: var(--tk-radius-md); border: 1px solid var(--tk-border-strong); box-shadow: var(--tk-shadow-elevated); display: flex; flex-direction: column; overflow: hidden; }
#tk-settings-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid var(--tk-border); flex-shrink: 0; background: var(--tk-bg-base); }
#tk-settings-header h2 { margin: 0; font-family: var(--tk-font-mono); font-size: 12px; font-weight: 700; letter-spacing: 0.02em; color: var(--tk-accent); }
#tk-settings-close { display: inline-flex; align-items: center; justify-content: center; background: transparent; border: 1px solid var(--tk-border-strong); color: var(--tk-text-muted); border-radius: var(--tk-radius-sm); width: 22px; height: 22px; cursor: pointer; }
#tk-settings-close:hover { background: var(--tk-red); border-color: var(--tk-red); color: #fff; }
#tk-settings-close:focus-visible { outline: 2px solid var(--tk-accent); outline-offset: 1px; }
#tk-settings-body { display: flex; flex-direction: column; overflow: hidden; flex-grow: 1; }
#tk-settings-tabs { display: flex; gap: 2px; padding: 4px 14px 0; border-bottom: 1px solid var(--tk-border); flex-shrink: 0; background: var(--tk-bg-base); }
.tk-settings-tab { background: transparent; border: none; border-bottom: 2px solid transparent; color: var(--tk-text-muted); font-family: var(--tk-font-mono); font-size: 10px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; padding: 6px 8px; cursor: pointer; }
.tk-settings-tab:hover { color: var(--tk-text); }
.tk-settings-tab.active { color: var(--tk-accent); border-bottom-color: var(--tk-accent); }
.tk-settings-tab:focus-visible { outline: 2px solid var(--tk-accent); outline-offset: -2px; }
#tk-settings-tab-content { overflow-y: auto; flex-grow: 1; padding: 12px 14px; }
#tk-settings-modules, #tk-settings-global { width: 100%; }
.tk-settings-section-title { font-family: var(--tk-font-mono); font-size: 10px; font-weight: 700; color: var(--tk-teal); text-transform: uppercase; letter-spacing: 0.06em; margin: 0 0 8px 0; }
.tk-settings-module-row { border-bottom: 1px solid var(--tk-border); padding: 6px 0; }
.tk-settings-module-row:last-child { border-bottom: none; }
.tk-settings-module-row label.tk-module-label { display: flex; align-items: flex-start; gap: 6px; cursor: pointer; font-size: 11.5px; font-weight: 700; }
.tk-settings-module-desc { font-size: 10.5px; color: var(--tk-text-muted); margin: 2px 0 0 20px; line-height: 1.35; }
.tk-settings-actions { margin: 4px 0 0 20px; display: flex; flex-direction: column; gap: 3px; }
.tk-settings-actions label { display: flex; align-items: center; gap: 5px; font-size: 10.5px; font-weight: 400; cursor: pointer; color: var(--tk-text-muted); }
.tk-settings-field { margin-bottom: 10px; }
.tk-settings-field label { display: block; font-size: 10.5px; font-weight: 700; margin-bottom: 3px; }
.tk-settings-field .tk-field-value { color: var(--tk-teal); font-weight: 400; font-family: var(--tk-font-mono); }
.tk-settings-field input[type="range"] { width: 100%; accent-color: var(--tk-accent); }
.tk-settings-field select { width: 100%; padding: 4px; background: var(--tk-bg-base); color: var(--tk-text); border: 1px solid var(--tk-border-strong); border-radius: var(--tk-radius-sm); font-size: 11px; }
.tk-settings-field select:focus-visible,
#tk-settings-panel input[type="checkbox"]:focus-visible { outline: 2px solid var(--tk-accent); outline-offset: 1px; }
#tk-settings-panel input[type="checkbox"] { accent-color: var(--tk-accent); }
#tk-settings-help { margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--tk-border); font-size: 10.5px; color: var(--tk-text-muted); line-height: 1.5; }
#tk-settings-help a { color: var(--tk-blue); }

.tk-settings-hint { font-size: 10px; color: var(--tk-text-muted); margin-top: 2px; line-height: 1.3; }

.tk-route-editor { margin: 8px 0 4px 20px; }
.tk-route-editor-title { font-family: var(--tk-font-mono); font-size: 9px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--tk-text-muted); margin-bottom: 4px; }
.tk-route-rows { display: flex; flex-direction: column; gap: 4px; }
.tk-route-row { display: flex; gap: 4px; align-items: center; }
.tk-route-row input[type="text"] { flex: 1 1 auto; min-width: 0; padding: 4px 6px; background: var(--tk-bg-elevated); color: var(--tk-text); border: 1px solid var(--tk-border-strong); border-radius: var(--tk-radius-sm); font-family: var(--tk-font-mono); font-size: 10px; }
.tk-route-row input[type="text"]:focus-visible { outline: 2px solid var(--tk-accent); outline-offset: 1px; }
.tk-route-row.tk-route-row-invalid input[type="text"] { border-color: var(--tk-red); }
.tk-route-row select { flex-shrink: 0; padding: 4px 5px; background: var(--tk-bg-base); color: var(--tk-text); border: 1px solid var(--tk-border-strong); border-radius: var(--tk-radius-sm); font-size: 10px; font-family: var(--tk-font-ui); }
.tk-route-row select:focus-visible { outline: 2px solid var(--tk-accent); outline-offset: 1px; }
.tk-route-remove-btn { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; background: transparent; border: 1px solid var(--tk-border-strong); color: var(--tk-text-muted); border-radius: var(--tk-radius-sm); cursor: pointer; }
.tk-route-remove-btn:hover { background: var(--tk-red); border-color: var(--tk-red); color: #fff; }
.tk-route-remove-btn:focus-visible { outline: 2px solid var(--tk-accent); outline-offset: 1px; }
.tk-route-add-btn { display: inline-flex; align-items: center; gap: 4px; margin-top: 4px; padding: 4px 8px; background: var(--tk-bg-base); border: 1px solid var(--tk-border-strong); color: var(--tk-teal); border-radius: var(--tk-radius-sm); font-family: var(--tk-font-ui); font-size: 10.5px; font-weight: 600; cursor: pointer; }
.tk-route-add-btn:hover { border-color: var(--tk-teal); color: #fff; background: var(--tk-teal); }
.tk-route-add-btn:focus-visible { outline: 2px solid var(--tk-accent); outline-offset: 1px; }
.tk-route-error { font-size: 9.5px; color: var(--tk-red); margin-top: 3px; line-height: 1.3; min-height: 0; }

@media (max-width: 480px) {
    .tk-route-row { flex-wrap: wrap; }
    .tk-route-row input[type="text"] { flex-basis: 100%; }
}
`;

  // src/ui/toolbar.js
  function appendShortcutBadges(container, sid, label = "Set") {
    SHORTCUT_ORDER.forEach((key) => container.appendChild(createBadge(key, sid)));
    container.appendChild(createBadge("CSV", sid, (e) => {
      e.preventDefault();
      exportSetCSV(sid, label);
    }));
  }
  function cleanDocTitle() {
    let t = document.title || "";
    t = t.replace(/\s*\|\s*Trading Card Database.*/i, "");
    t = t.replace(/\s*(Baseball|Basketball|Football|Hockey|Gaming|Boxing|Cricket|Golf|MMA|Multi-Sport|Non-Sport|Racing|Soccer|Tennis|Wrestling)?\s*(Checklist|Inserts and Related Sets|Overview|Cards)?$/i, "");
    t = t.replace(/\s*-\s*(Cards|Checklist|Overview|For Sale\/Trade|Wantlist)$/i, "");
    return t.trim();
  }
  function appendContextLabel(container, text) {
    const label = document.createElement("span");
    label.className = "context-label";
    label.textContent = text;
    label.title = text;
    container.appendChild(label);
    return label;
  }
  var Toolbar = {
    init: () => {
      injectStyle(TOOLBAR_CSS);
      const bar = document.createElement("div");
      bar.id = "sctk-toolbar";
      bar.innerHTML = `
      <div class="tk-wordmark"><span class="tk-wordmark-title">SC</span><span class="tk-wordmark-sub">Toolkit</span></div>
      <div id="tk-actions" class="toolbar-group"></div>
      <div id="tk-pinned" class="toolbar-group"></div>
      <div id="tk-center-context"></div>
      <div id="tk-status">Initializing...</div>
    `;
      document.body.prepend(bar);
      document.addEventListener("click", (e) => {
        if (!e.target.closest(".tk-dropdown")) {
          document.querySelectorAll(".tk-dropdown.tk-show").forEach((d) => d.classList.remove("tk-show"));
        }
      });
      Toolbar.renderPins();
      Toolbar.renderCenterContext();
    },
    /**
     * @param {string} id
     * @param {string} text
     * @param {(e: Event) => void} onClick
     * @param {boolean} [disabled]
     */
    addAction: (id, text, onClick, disabled = false) => {
      const container = document.getElementById("tk-actions");
      if (container) container.appendChild(createBtn(id, text, onClick, disabled));
    },
    /** Rebuild the pinned-set dropdowns, grouped by year, newest first. */
    renderPins: () => {
      const container = document.getElementById("tk-pinned");
      if (!container) return;
      container.innerHTML = "";
      const pins = Pins.all();
      if (pins.length === 0) return;
      const grouped = pins.reduce((acc, pin) => {
        const year = /^\d{4}$/.test(pin.year) ? pin.year : deriveSetYear(pin.name, pin.url);
        (acc[year] ||= []).push(pin);
        return acc;
      }, {});
      Object.keys(grouped).sort((a, b) => b.localeCompare(a)).forEach((year) => {
        const dropDiv = document.createElement("div");
        dropDiv.className = "tk-dropdown";
        const dropBtn = document.createElement("button");
        dropBtn.type = "button";
        dropBtn.className = "tk-dropbtn";
        dropBtn.textContent = `${year} ▾`;
        dropBtn.title = `View pinned sets for ${year}`;
        dropBtn.addEventListener("click", (e) => {
          e.preventDefault();
          const isShowing = dropDiv.classList.contains("tk-show");
          document.querySelectorAll(".tk-dropdown.tk-show").forEach((d) => d.classList.remove("tk-show"));
          if (!isShowing) dropDiv.classList.add("tk-show");
        });
        dropDiv.appendChild(dropBtn);
        const dropContent = document.createElement("div");
        dropContent.className = "tk-dropdown-content";
        grouped[year].forEach((pin) => {
          const itemDiv = document.createElement("div");
          itemDiv.className = "tk-pin-item";
          const headerDiv = document.createElement("div");
          headerDiv.className = "tk-pin-header";
          const itemLink = document.createElement("a");
          itemLink.className = "tk-pin-title";
          itemLink.href = pin.url;
          itemLink.textContent = pin.name;
          itemLink.title = `Navigate to ${pin.name}`;
          const removeBtn = createBadge("REMOVE_PIN", null, (e) => {
            e.preventDefault();
            e.stopPropagation();
            Pins.remove(pin.id);
            Toolbar.renderPins();
            Log(`Removed Pin: ${pin.name}`);
          });
          headerDiv.appendChild(itemLink);
          headerDiv.appendChild(removeBtn);
          const actionsDiv = document.createElement("div");
          actionsDiv.className = "tk-pin-actions";
          appendShortcutBadges(actionsDiv, pin.id, pin.name);
          itemDiv.appendChild(headerDiv);
          itemDiv.appendChild(actionsDiv);
          dropContent.appendChild(itemDiv);
        });
        dropDiv.appendChild(dropContent);
        container.appendChild(dropDiv);
      });
    },
    /** Fill the centre of the toolbar with a label describing the current page. */
    renderCenterContext: () => {
      const container = document.getElementById("tk-center-context");
      if (!container) return;
      container.innerHTML = "";
      const currentSid = extractSid(window.location.href);
      const scrollTopBtn = document.createElement("button");
      scrollTopBtn.type = "button";
      scrollTopBtn.className = "tk-scroll-btn";
      scrollTopBtn.innerHTML = `${Icons.chevronUp()}<span>Top</span>`;
      scrollTopBtn.title = "Scroll to top of page";
      scrollTopBtn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
      container.appendChild(scrollTopBtn);
      if (Routes.isCardPage()) {
        const titleNode = document.querySelector("#setname-content h1") || document.querySelector("#main-content-area h1");
        const subTitleNode = document.querySelector("#setname-content h3") || document.querySelector("#main-content-area h3");
        const playerNode = document.querySelector("#main-content-area h2");
        const yearSet = titleNode ? titleNode.innerText.replace(/\s*-\s*Cards$/i, "").trim() : "";
        const cardNo = subTitleNode ? subTitleNode.innerText.trim() : "";
        const player = playerNode ? playerNode.innerText.trim() : "";
        const cardSummary = `${player ? player + " - " : ""}${yearSet}${cardNo ? " " + cardNo : ""}`.trim();
        appendContextLabel(container, cardSummary || cleanDocTitle() || "Card View");
        if (currentSid) appendShortcutBadges(container, currentSid, cardSummary || "Set");
        return;
      }
      if (currentSid && Routes.isSetPage()) {
        let setName = cleanDocTitle();
        if (!setName) {
          const setHeader = document.querySelector("#setname-content h1") || document.querySelector("#main-content-area h2") || document.querySelector("#main-content-area h1");
          const subHeader = document.querySelector("#setname-content h3") || document.querySelector("#main-content-area h3");
          if (setHeader && !setHeader.innerText.toLowerCase().includes("set links")) {
            setName = setHeader.innerText.replace(/\s*-\s*Cards$/i, "").trim();
          }
          if (subHeader && !setName.includes(subHeader.innerText.trim())) {
            setName += (setName ? " - " : "") + subHeader.innerText.trim();
          }
        }
        appendContextLabel(container, setName || "Set View");
        appendShortcutBadges(container, currentSid, setName || "Set");
        return;
      }
      if (Routes.isPlayerPage()) {
        const playerHeader = document.querySelector("#main-content-area h1") || document.querySelector("h1");
        appendContextLabel(container, playerHeader ? playerHeader.innerText.trim() : "Player Profile");
        return;
      }
      appendContextLabel(container, cleanDocTitle() || "SCToolkit Active");
    }
  };

  // src/modules/setListEnhancer.js
  var LATE_RENDER_DELAY_MS = 500;
  var SET_LINK_SELECTOR = [
    'a[href*="ViewSet" i]',
    'a[href*="CollectionSummary" i]',
    'a[href*="Checklist" i]',
    'a[href*="sid=" i]',
    'a[href*="/sid/" i]'
  ].join(", ");
  function findSetLinks() {
    return Array.from(document.querySelectorAll(SET_LINK_SELECTOR)).filter((link) => link.textContent.trim().length > 0 && !link.querySelector("img, i, svg"));
  }
  function isExpandableParent(link) {
    const parentLi = link.closest("li");
    if (!parentLi) return false;
    if (parentLi.querySelector("ul") !== null) return true;
    let prev = link.previousElementSibling;
    while (prev) {
      const isToggleImage = prev.tagName === "IMG" && (prev.src.includes("plus") || prev.src.includes("minus") || prev.hasAttribute("onclick"));
      const isCaret = prev.tagName === "I" && prev.className.includes("caret");
      if (isToggleImage || isCaret || prev.hasAttribute("onclick")) return true;
      prev = prev.previousElementSibling;
    }
    return false;
  }
  function injectSetActions(setLinks) {
    const currentPageSid = extractSid(window.location.href);
    setLinks.forEach((link) => {
      if (link.dataset.tkInjected) return;
      const setId = extractSid(link.href);
      if (!setId) return;
      link.dataset.tkInjected = "true";
      if (currentPageSid && setId === currentPageSid) return;
      const setName = link.textContent.trim();
      const container = document.createElement("span");
      container.style.display = "inline-flex";
      container.style.alignItems = "center";
      container.appendChild(createBadge("PIN", setId, (e) => {
        e.preventDefault();
        const added = Pins.add({
          id: setId,
          name: setName,
          url: link.href,
          year: deriveSetYear(setName, link.href)
        });
        if (!added) return;
        Toolbar.renderPins();
        showToast({ message: `Pinned: <b>${escapeHtml(setName)}</b>` });
      }));
      container.appendChild(createBadge("CSV", setId, (e) => {
        e.preventDefault();
        exportSetCSV(setId, setName);
      }));
      if (isExpandableParent(link)) {
        container.appendChild(createBadge("INSERTS", setId));
        container.appendChild(createBadge("PARALLELS", setId));
      }
      container.appendChild(createBadge("FOR_SALE", setId));
      container.appendChild(createBadge("MULTI", setId));
      container.appendChild(createBadge("WANTLIST", setId));
      link.after(container);
    });
  }
  function initSetListEnhancer() {
    const setLinks = findSetLinks();
    if (setLinks.length === 0) {
      setTimeout(() => injectSetActions(findSetLinks()), LATE_RENDER_DELAY_MS);
      return;
    }
    injectSetActions(setLinks);
    Log(`Set List Enhancer: badges injected for ${setLinks.length} link(s).`, "debug");
  }

  // src/modules/addMultiplesEnhancer.js
  var FOCUS_RETRIES = 5;
  var FOCUS_INTERVAL_MS = 250;
  function initAddMultiplesEnhancer() {
    document.querySelectorAll("select").forEach((select) => {
      const fsOpt = Array.from(select.options).find((opt) => opt.text.includes("For Sale/Trade"));
      if (fsOpt) select.value = fsOpt.value;
    });
    const forceFocus = () => {
      const inputs = InputIndex.getValidInputs();
      const firstQtyBox = inputs.find((el) => el.value === "0") || inputs[0];
      if (!firstQtyBox) return;
      firstQtyBox.focus({ preventScroll: true });
      setTimeout(() => firstQtyBox.select(), 50);
    };
    forceFocus();
    let attempts = 0;
    const timer = setInterval(() => {
      forceFocus();
      if (++attempts >= FOCUS_RETRIES) clearInterval(timer);
    }, FOCUS_INTERVAL_MS);
  }

  // src/modules/csvExportEngine.js
  function generateCSV(type) {
    setStatus(`Exporting ${type}...`);
    const csvRows = Array.from(document.querySelectorAll("table tr")).map(
      (row) => Array.from(row.querySelectorAll("td, th")).map((c) => c.innerText.trim())
    );
    let filename = `SCToolkit_${type}_Export_${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.csv`;
    if (Routes.isPlayerCollection()) {
      const playerHeader = document.querySelector("#main-content-area h1") || document.querySelector("h1");
      const rawPlayerName = (playerHeader ? playerHeader.innerText.trim() : "Player").replace(/\s*Collection$/i, "").trim();
      const href = window.location.href.toLowerCase();
      let subType = "Collection";
      if (href.includes("wantlist")) subType = "Wantlist";
      else if (href.includes("forsale")) subType = "ForSale";
      filename = `${underscoreSegment(rawPlayerName)}_${subType}.csv`;
    }
    CSV.download(CSV.toCSV(csvRows), filename);
    setStatus("Export Complete");
    showToast({ message: `Exported ${type} CSV successfully.` });
  }
  function initCsvExportEngine() {
    if (Routes.isCollection()) {
      Toolbar.addAction("btn-csv-coll", "Export Collection", () => generateCSV("Collection"), true);
    } else if (Routes.isPlayerCollection()) {
      Toolbar.addAction("btn-csv-player", "Export Player Collection", () => generateCSV("Player_Collection"), true);
    } else if (Routes.isPrintPDF()) {
      Toolbar.addAction("btn-csv-pdf", "Export Print View", () => generateCSV("Print_View"), true);
    }
  }
  var EXPORT_BUTTON_IDS = ["btn-csv-coll", "btn-csv-player", "btn-csv-pdf"];

  // src/modules/paginationLoader.js
  function initPaginationLoader() {
    if (!Routes.hasPagination()) return Promise.resolve();
    setStatus("Loading Pagination...");
    return new Promise((resolve) => {
      setTimeout(resolve, Config.global.paginationLoaderDelayMs);
    });
  }

  // src/core/registry.js
  var ModuleRegistry = [
    {
      id: "inputOptimization",
      name: "Input Optimization",
      description: "Enter-to-Tab across visible number/text inputs, for keyboard-only bulk entry.",
      init: initInputOptimization,
      isAsync: false
    },
    {
      id: "cardNameFormatter",
      name: "Card Name Formatter",
      description: "Normalizes spaced hyphens in card name nodes on checklist-family pages.",
      init: initCardNameFormatter,
      isAsync: false
    },
    {
      id: "checklistEnhancer",
      name: "Checklist Enhancer",
      description: "Real-time table filter bar, plus (disabled by default) inline action-cell stubs.",
      init: initChecklistEnhancer,
      isAsync: false,
      actionLabels: {
        realtimeFilter: "Real-time table filter bar",
        inlineActionCells: "Inline action-cell stubs (non-functional placeholders — off by default)"
      }
    },
    {
      id: "setListEnhancer",
      name: "Set List Enhancer",
      description: "Injects pin/CSV/shortcut badges next to set links on set-listing pages.",
      init: initSetListEnhancer,
      isAsync: false
    },
    {
      id: "addMultiplesEnhancer",
      name: "Add Multiples Enhancer",
      description: "Defaults sale-type dropdown and focuses the first zero-qty input for bulk entry.",
      init: initAddMultiplesEnhancer,
      isAsync: false
    },
    {
      id: "csvExportEngine",
      name: "CSV Export Engine",
      description: "Adds a raw-table-dump CSV export button on Collection/Player Collection/Print pages.",
      init: initCsvExportEngine,
      isAsync: false
    },
    {
      id: "paginationLoader",
      name: "Pagination Loader",
      description: "Async gate that defers CSV-export-button enablement until pagination is ready. Route pattern only excludes Add Multiples — the real gate is a DOM check for a pagination element, done inside the module itself, because it is not expressible as a URL pattern.",
      init: initPaginationLoader,
      isAsync: true
    }
  ];
  function resolveModules(url = window.location.href) {
    return ModuleRegistry.filter((mod) => {
      const cfg = Config.modules[mod.id];
      if (!cfg || !cfg.enabled) return false;
      try {
        return testUrlMatch(cfg.urlMatch, url);
      } catch (error) {
        Log(`urlMatch resolution threw for module '${mod.id}': ${error.message}`, "error");
        return false;
      }
    });
  }

  // src/ui/settings.js
  var SettingsUI = {
    overlayId: "tk-settings-overlay",
    /** Debounced writer, rebuilt whenever the debounce interval itself changes. */
    _persist: () => {
    },
    init: () => {
      injectStyle(SETTINGS_CSS);
      SettingsUI._rebuildPersist();
      const trigger = document.createElement("button");
      trigger.id = "tk-settings-trigger";
      trigger.type = "button";
      trigger.className = "tk-scroll-btn";
      trigger.innerHTML = Icons.gear();
      trigger.title = "SCToolkit Settings";
      trigger.setAttribute("aria-label", "SCToolkit Settings");
      trigger.addEventListener("click", () => SettingsUI.open());
      const statusEl = document.getElementById("tk-status");
      if (statusEl && statusEl.parentNode) {
        statusEl.parentNode.insertBefore(trigger, statusEl);
      }
    },
    /**
     * Rebuild the debounced save.
     *
     * v2.42.0 built this once at startup, so changing the debounce slider had no
     * effect until the next page load — the setting silently described something
     * that was not happening.
     */
    _rebuildPersist: () => {
      SettingsUI._persist = debounce(() => {
        SettingsStore.save(Config);
        Log("Settings saved to GM storage.", "info");
        showToast({
          message: "Settings saved — reload the page to apply changes.",
          accent: "var(--tk-green)"
        });
      }, Config.global.settingsSaveDebounceMs);
    },
    open: () => {
      if (document.getElementById(SettingsUI.overlayId)) return;
      const overlay = document.createElement("div");
      overlay.id = SettingsUI.overlayId;
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) SettingsUI.close();
      });
      const panel = document.createElement("div");
      panel.id = "tk-settings-panel";
      panel.appendChild(SettingsUI._buildHeader());
      panel.appendChild(SettingsUI._buildTabbedBody());
      overlay.appendChild(panel);
      document.body.appendChild(overlay);
    },
    close: () => {
      const overlay = document.getElementById(SettingsUI.overlayId);
      if (overlay) overlay.remove();
    },
    _buildHeader: () => {
      const header = document.createElement("div");
      header.id = "tk-settings-header";
      const title = document.createElement("h2");
      title.textContent = "SCToolkit Settings";
      const closeBtn = document.createElement("button");
      closeBtn.id = "tk-settings-close";
      closeBtn.type = "button";
      closeBtn.innerHTML = Icons.x();
      closeBtn.title = "Close";
      closeBtn.setAttribute("aria-label", "Close settings");
      closeBtn.addEventListener("click", () => SettingsUI.close());
      header.appendChild(title);
      header.appendChild(closeBtn);
      return header;
    },
    _buildTabbedBody: () => {
      const body = document.createElement("div");
      body.id = "tk-settings-body";
      const tabBar = document.createElement("div");
      tabBar.id = "tk-settings-tabs";
      const globalTab = document.createElement("button");
      globalTab.type = "button";
      globalTab.className = "tk-settings-tab active";
      globalTab.textContent = "Global";
      const routesTab = document.createElement("button");
      routesTab.type = "button";
      routesTab.className = "tk-settings-tab";
      routesTab.textContent = "Modules & Routes";
      tabBar.appendChild(globalTab);
      tabBar.appendChild(routesTab);
      const content = document.createElement("div");
      content.id = "tk-settings-tab-content";
      const globalPane = SettingsUI._buildGlobalPane();
      const modulesPane = SettingsUI._buildModulesPane();
      modulesPane.style.display = "none";
      content.appendChild(globalPane);
      content.appendChild(modulesPane);
      const activate = (tab) => {
        globalTab.classList.toggle("active", tab === "global");
        routesTab.classList.toggle("active", tab === "routes");
        globalPane.style.display = tab === "global" ? "" : "none";
        modulesPane.style.display = tab === "routes" ? "" : "none";
        content.scrollTop = 0;
      };
      globalTab.addEventListener("click", () => activate("global"));
      routesTab.addEventListener("click", () => activate("routes"));
      body.appendChild(tabBar);
      body.appendChild(content);
      return body;
    },
    _buildModulesPane: () => {
      const pane = document.createElement("div");
      pane.id = "tk-settings-modules";
      const sectionTitle = document.createElement("div");
      sectionTitle.className = "tk-settings-section-title";
      sectionTitle.textContent = "Modules & Routes";
      pane.appendChild(sectionTitle);
      ModuleRegistry.forEach((mod) => {
        const cfg = Config.modules[mod.id];
        if (!cfg) return;
        const row = document.createElement("div");
        row.className = "tk-settings-module-row";
        const label = document.createElement("label");
        label.className = "tk-module-label";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = !!cfg.enabled;
        checkbox.title = "Enable or disable this module on matching pages.";
        checkbox.addEventListener("change", () => {
          cfg.enabled = checkbox.checked;
          Log(`Config change: module '${mod.id}' enabled = ${cfg.enabled}`, "info");
          SettingsUI._persist();
        });
        const nameSpan = document.createElement("span");
        nameSpan.textContent = mod.name;
        label.appendChild(checkbox);
        label.appendChild(nameSpan);
        row.appendChild(label);
        const desc = document.createElement("div");
        desc.className = "tk-settings-module-desc";
        desc.textContent = mod.description;
        row.appendChild(desc);
        if (mod.actionLabels && Object.keys(mod.actionLabels).length > 0) {
          const actionsWrap = document.createElement("div");
          actionsWrap.className = "tk-settings-actions";
          Object.keys(mod.actionLabels).forEach((actionKey) => {
            const actionLabel = document.createElement("label");
            const actionCheckbox = document.createElement("input");
            actionCheckbox.type = "checkbox";
            actionCheckbox.checked = !!cfg.actions[actionKey];
            actionCheckbox.title = "Toggle this sub-feature independently of the module itself.";
            actionCheckbox.addEventListener("change", () => {
              cfg.actions[actionKey] = actionCheckbox.checked;
              Log(`Config change: module '${mod.id}' action '${actionKey}' = ${actionCheckbox.checked}`, "info");
              SettingsUI._persist();
            });
            const actionText = document.createElement("span");
            actionText.textContent = mod.actionLabels[actionKey];
            actionLabel.appendChild(actionCheckbox);
            actionLabel.appendChild(actionText);
            actionsWrap.appendChild(actionLabel);
          });
          row.appendChild(actionsWrap);
        }
        row.appendChild(SettingsUI._buildRouteEditor(mod, cfg));
        pane.appendChild(row);
      });
      return pane;
    },
    _buildRouteEditor: (mod, cfg) => {
      const wrap = document.createElement("div");
      wrap.className = "tk-route-editor";
      const title = document.createElement("div");
      title.className = "tk-route-editor-title";
      title.textContent = "Route patterns";
      wrap.appendChild(title);
      const rowsEl = document.createElement("div");
      rowsEl.className = "tk-route-rows";
      wrap.appendChild(rowsEl);
      const errorEl = document.createElement("div");
      errorEl.className = "tk-route-error";
      const commit = debounce(() => {
        const rules = [];
        const errors = [];
        Array.from(rowsEl.children).forEach((rowEl, idx) => {
          const input = rowEl.querySelector('input[type="text"]');
          const select = rowEl.querySelector("select");
          const pattern = input.value.trim();
          rowEl.classList.remove("tk-route-row-invalid");
          if (!pattern) return;
          try {
            new RegExp(pattern, "i");
            rules.push({ pattern, exclude: select.value === "exclude" });
          } catch (error) {
            rowEl.classList.add("tk-route-row-invalid");
            errors.push(`Row ${idx + 1}: ${error.message}`);
          }
        });
        if (errors.length > 0) {
          errorEl.textContent = errors.join(" · ");
          return;
        }
        errorEl.textContent = "";
        cfg.urlMatch = rules;
        Log(`Config change: module '${mod.id}' urlMatch updated (${rules.length} rule(s))`, "info");
        SettingsUI._persist();
      }, 500);
      const addRow = (pattern, exclude) => {
        const rowEl = document.createElement("div");
        rowEl.className = "tk-route-row";
        const input = document.createElement("input");
        input.type = "text";
        input.value = pattern || "";
        input.placeholder = "regex pattern (matches full page URL)";
        input.addEventListener("input", commit);
        const select = document.createElement("select");
        select.title = "Include: page must match this pattern. Exclude: page must NOT match this pattern.";
        [["include", "Include"], ["exclude", "Exclude"]].forEach(([value, text]) => {
          const opt = document.createElement("option");
          opt.value = value;
          opt.textContent = text;
          if (value === "exclude" === !!exclude) opt.selected = true;
          select.appendChild(opt);
        });
        select.addEventListener("change", commit);
        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "tk-route-remove-btn";
        removeBtn.innerHTML = Icons.x();
        removeBtn.title = "Remove this pattern";
        removeBtn.setAttribute("aria-label", "Remove this pattern");
        removeBtn.addEventListener("click", () => {
          rowEl.remove();
          commit();
        });
        rowEl.appendChild(input);
        rowEl.appendChild(select);
        rowEl.appendChild(removeBtn);
        rowsEl.appendChild(rowEl);
      };
      const existing = cfg.urlMatch || [];
      if (existing.length === 0) {
        addRow("", false);
      } else {
        existing.forEach((r) => addRow(r.pattern, r.exclude));
      }
      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "tk-route-add-btn";
      addBtn.innerHTML = `${Icons.plus()}<span>Add pattern</span>`;
      addBtn.addEventListener("click", () => addRow("", false));
      wrap.appendChild(errorEl);
      wrap.appendChild(addBtn);
      return wrap;
    },
    _buildGlobalPane: () => {
      const pane = document.createElement("div");
      pane.id = "tk-settings-global";
      const sectionTitle = document.createElement("div");
      sectionTitle.className = "tk-settings-section-title";
      sectionTitle.textContent = "Global Settings";
      pane.appendChild(sectionTitle);
      GLOBAL_FIELDS.forEach((field) => pane.appendChild(SettingsUI._buildRangeField(field)));
      const logField = document.createElement("div");
      logField.className = "tk-settings-field";
      const logLabel = document.createElement("label");
      logLabel.textContent = "Console log level";
      const logSelect = document.createElement("select");
      logSelect.title = "debug: everything. info: normal operation (default). warn: only problems worth noticing. error: only failures.";
      ["debug", "info", "warn", "error"].forEach((lvl) => {
        const opt = document.createElement("option");
        opt.value = lvl;
        opt.textContent = lvl;
        if (Config.global.logLevel === lvl) opt.selected = true;
        logSelect.appendChild(opt);
      });
      logSelect.addEventListener("change", () => {
        Config.global.logLevel = logSelect.value;
        RuntimeSettings.logLevel = logSelect.value;
        Log(`Config change: global.logLevel = ${logSelect.value}`, "info");
        SettingsUI._persist();
      });
      logField.appendChild(logLabel);
      logField.appendChild(logSelect);
      pane.appendChild(logField);
      const help = document.createElement("div");
      help.id = "tk-settings-help";
      help.innerHTML = `Module, action, route-pattern, and threshold changes apply on next page load. The log level change above applies immediately to this page’s console output.<br><br>Version: ${SettingsUI._version()}<br>Documentation and issue tracker: <a href="https://github.com/djntechnic/SCToolkit" target="_blank" rel="noopener noreferrer">github.com/djntechnic/SCToolkit</a>`;
      pane.appendChild(help);
      return pane;
    },
    /**
     * @param {{label: string, key: string, min: number, max: number, step: number,
     *   unit: string, hint: string}} spec
     */
    _buildRangeField: ({ label: labelText, key, min, max, step, unit, hint }) => {
      const field = document.createElement("div");
      field.className = "tk-settings-field";
      const label = document.createElement("label");
      const valueSpan = document.createElement("span");
      valueSpan.className = "tk-field-value";
      valueSpan.textContent = `${Config.global[key]}${unit}`;
      label.append(`${labelText}: `, valueSpan);
      const input = document.createElement("input");
      input.type = "range";
      input.min = String(min);
      input.max = String(max);
      input.step = String(step);
      input.value = String(Config.global[key]);
      if (hint) input.title = hint;
      input.setAttribute("aria-label", labelText);
      input.addEventListener("input", () => {
        valueSpan.textContent = `${input.value}${unit}`;
      });
      input.addEventListener("change", () => {
        Config.global[key] = Number(input.value);
        syncExportConfig();
        if (key === "settingsSaveDebounceMs") SettingsUI._rebuildPersist();
        Log(`Config change: global.${key} = ${Config.global[key]}`, "info");
        SettingsUI._persist();
      });
      field.appendChild(label);
      field.appendChild(input);
      if (hint) {
        const hintEl = document.createElement("div");
        hintEl.className = "tk-settings-hint";
        hintEl.textContent = hint;
        field.appendChild(hintEl);
      }
      return field;
    },
    _version: () => {
      try {
        if (typeof GM_info !== "undefined" && GM_info.script && GM_info.script.version) {
          return GM_info.script.version;
        }
      } catch {
      }
      return "unknown";
    }
  };
  var GLOBAL_FIELDS = [
    {
      label: "Export base delay",
      key: "exportBaseDelayMs",
      min: 200,
      max: 2e3,
      step: 50,
      unit: "ms",
      hint: "Minimum wait between paginated checklist-fetch requests."
    },
    {
      label: "Export jitter",
      key: "exportJitterMaxMs",
      min: 0,
      max: 2e3,
      step: 50,
      unit: "ms",
      hint: "Random amount added on top of the base delay, so request timing isn’t a fixed, fingerprintable interval."
    },
    {
      label: "Max retries per page",
      key: "exportMaxRetries",
      min: 0,
      max: 8,
      step: 1,
      unit: "",
      hint: "Retry attempts for a single page on HTTP 429/503 before the export fails."
    },
    {
      label: "Retry backoff — base",
      key: "exportBackoffBaseMs",
      min: 250,
      max: 5e3,
      step: 250,
      unit: "ms",
      hint: "Starting wait before the first retry; doubles on each subsequent attempt up to the cap below."
    },
    {
      label: "Retry backoff — cap",
      key: "exportBackoffCapMs",
      min: 2e3,
      max: 6e4,
      step: 1e3,
      unit: "ms",
      hint: "Upper limit on the doubling backoff delay, regardless of retry count."
    },
    {
      label: "Pagination safety ceiling",
      key: "exportMaxPages",
      min: 20,
      max: 500,
      step: 10,
      unit: " pages",
      hint: "Hard stop on discovered page count — protects against a pagination-parsing bug turning into a runaway fetch loop."
    },
    {
      label: "Anti-scraping cooldown",
      key: "exportBlockCooldownMinutes",
      min: 0,
      max: 30,
      step: 1,
      unit: " min",
      hint: "After a detected block (captcha/verification page), refuse new exports for this long. 0 disables the cooldown."
    },
    {
      label: "Toast display duration",
      key: "toastDurationMs",
      min: 1500,
      max: 1e4,
      step: 250,
      unit: "ms",
      hint: "How long status/confirmation toasts stay visible before fading out."
    },
    {
      label: "Checklist filter debounce",
      key: "checklistFilterDebounceMs",
      min: 0,
      max: 500,
      step: 25,
      unit: "ms",
      hint: "Delay after typing stops before the real-time table filter re-scans rows."
    },
    {
      label: "Pagination loader delay",
      key: "paginationLoaderDelayMs",
      min: 300,
      max: 3e3,
      step: 100,
      unit: "ms",
      hint: "Fixed wait before the CSV export button is enabled on paginated pages. Not a real completion signal — still a timing guess, just a configurable one."
    },
    {
      label: "Settings save debounce",
      key: "settingsSaveDebounceMs",
      min: 100,
      max: 2e3,
      step: 100,
      unit: "ms",
      hint: "How long to wait after the last settings change before writing to storage."
    }
  ];

  // src/main.js
  async function boot() {
    initConfig();
    Log("Starting core execution sequence");
    Toolbar.init();
    SettingsUI.init();
    const activeModules = resolveModules();
    const loadedModuleNames = [];
    const pendingAsyncTasks = [];
    activeModules.forEach((mod) => {
      try {
        Log(`Module init starting: ${mod.name}`, "debug");
        const result = mod.init();
        if (mod.isAsync) pendingAsyncTasks.push(result);
        loadedModuleNames.push(mod.name);
      } catch (error) {
        Log(`Module '${mod.name}' failed to initialize: ${error.message}`, "error");
      }
    });
    if (pendingAsyncTasks.length > 0) {
      await Promise.all(pendingAsyncTasks);
    }
    EXPORT_BUTTON_IDS.forEach(enableAction);
    setStatus(
      `${loadedModuleNames.length} Modules Active`,
      `Active Modules:
• ${loadedModuleNames.join("\n• ")}`
    );
    showToast({
      message: `<b>SCToolkit Active</b><ul>${loadedModuleNames.map((m) => `<li>${escapeHtml(m)}</li>`).join("")}</ul>`,
      location: "bottom-right",
      accent: "var(--tk-accent)"
    });
    Log(`Core execution sequence complete. ${loadedModuleNames.length} modules loaded: ${loadedModuleNames.join(", ")}`);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
