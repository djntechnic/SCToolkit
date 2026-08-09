// ==UserScript==
// @name         SCToolkit
// @namespace    https://github.com/djntechnic/SCToolkit
// @version      0.1-beta
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
  var RuntimeSettings = {
    logLevel: "info",
    timezone: "auto",
    timestampFormat: "HH:mm:ss.SSS TZ"
  };
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
  function resolveTimezone(preferredZone = RuntimeSettings.timezone) {
    if (preferredZone && preferredZone !== "auto") {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: preferredZone });
        return preferredZone;
      } catch {
      }
    }
    try {
      if (typeof Intl !== "undefined" && Intl.DateTimeFormat) {
        const clientZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (clientZone && typeof clientZone === "string") {
          new Intl.DateTimeFormat("en-US", { timeZone: clientZone });
          return clientZone;
        }
      }
    } catch {
    }
    return "America/Chicago";
  }
  function getZonedDateParts(date = /* @__PURE__ */ new Date(), timeZone = "America/Chicago") {
    try {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZoneName: "short"
      });
      const parts = formatter.formatToParts(date);
      const getPart = (type) => parts.find((p) => p.type === type)?.value || "";
      const year = getPart("year");
      const month = getPart("month");
      const day = getPart("day");
      let hour24 = parseInt(getPart("hour"), 10);
      if (isNaN(hour24)) hour24 = date.getHours();
      if (hour24 === 24) hour24 = 0;
      const minute = getPart("minute");
      const second = getPart("second");
      const ms = String(date.getMilliseconds()).padStart(3, "0");
      const hour12Num = hour24 % 12 || 12;
      const hour12 = String(hour12Num).padStart(2, "0");
      const hour24Str = String(hour24).padStart(2, "0");
      const ampm = hour24 >= 12 ? "PM" : "AM";
      const tzName = getPart("timeZoneName") || "UTC";
      return {
        YYYY: year,
        YY: year.slice(-2),
        MM: month,
        DD: day,
        HH: hour24Str,
        hh: hour12,
        mm: minute,
        ss: second,
        SSS: ms,
        mmm: ms,
        A: ampm,
        a: ampm.toLowerCase(),
        TZ: tzName,
        Z: tzName
      };
    } catch {
      const year = String(date.getUTCFullYear());
      const month = String(date.getUTCMonth() + 1).padStart(2, "0");
      const day = String(date.getUTCDate()).padStart(2, "0");
      const hour24 = String(date.getUTCHours()).padStart(2, "0");
      const minute = String(date.getUTCMinutes()).padStart(2, "0");
      const second = String(date.getUTCSeconds()).padStart(2, "0");
      const ms = String(date.getUTCMilliseconds()).padStart(3, "0");
      return {
        YYYY: year,
        YY: year.slice(-2),
        MM: month,
        DD: day,
        HH: hour24,
        hh: hour24,
        mm: minute,
        ss: second,
        SSS: ms,
        mmm: ms,
        A: "UTC",
        a: "utc",
        TZ: "UTC",
        Z: "UTC"
      };
    }
  }
  function formatLogTimestamp(date = /* @__PURE__ */ new Date(), formatPattern = RuntimeSettings.timestampFormat || "HH:mm:ss.SSS TZ", preferredZone = RuntimeSettings.timezone || "auto") {
    const zone = resolveTimezone(preferredZone);
    const parts = getZonedDateParts(date, zone);
    let pattern = formatPattern || "HH:mm:ss.SSS TZ";
    if (/YYYYmmDD/i.test(pattern)) {
      pattern = pattern.replace(/YYYY/g, parts.YYYY).replace(/YY/g, parts.YY).replace(/mm/g, parts.MM).replace(/DD/gi, parts.DD).replace(/HH/gi, parts.HH).replace(/MM/g, parts.mm).replace(/SS/gi, parts.ss);
    } else {
      pattern = pattern.replace(/YYYY/g, parts.YYYY).replace(/YY/g, parts.YY).replace(/MM/g, parts.MM).replace(/DD/gi, parts.DD).replace(/HH/g, parts.HH).replace(/hh/g, parts.hh).replace(/mm/g, parts.mm).replace(/SSS/g, parts.SSS).replace(/ss/gi, parts.ss).replace(/\bTZ\b|\bZ\b/g, parts.TZ).replace(/\bA\b/g, parts.A).replace(/\ba\b/g, parts.a);
    }
    return pattern;
  }
  function Log(msg, level = "info", source = "client") {
    if (LOG_LEVELS.indexOf(level) < LOG_LEVELS.indexOf(RuntimeSettings.logLevel)) return;
    const consoleMethod = level === "debug" ? "log" : level;
    const timestamp = formatLogTimestamp();
    const cleanMsg = String(msg || "").replace(/^\[(CLIENT|SERVER)\]\s*/i, "");
    if (level === "error") {
      const sourceTag = source === "server" ? "[SERVER]" : "[CLIENT]";
      const sourceStyle = source === "server" ? LOG_STYLES.source.server : LOG_STYLES.source.client;
      console.error(
        `%c[SCToolkit | ${timestamp}] %c${sourceTag}%c ${cleanMsg}`,
        LOG_STYLES.prefix,
        sourceStyle,
        "color:#dc3545; font-weight:bold"
      );
      return;
    }
    if (source === "server") {
      console[consoleMethod](
        `%c[SCToolkit | ${timestamp}] %c[SERVER]%c ${cleanMsg}`,
        LOG_STYLES.prefix,
        LOG_STYLES.source.server,
        "color:#0d6efd; font-weight:bold"
      );
      return;
    }
    const levelStyle = LOG_STYLES.level[level] || LOG_STYLES.level.info;
    console[consoleMethod](
      `%c[SCToolkit | ${timestamp}] %c[CLIENT]%c ${cleanMsg}`,
      LOG_STYLES.prefix,
      LOG_STYLES.source.client,
      levelStyle
    );
  }

  // src/core/utils.js
  var LEADING_YEAR_REGEX = /^(\d{4})/;
  var Utils = {
    /**
     * Extract a four-digit year from a text label or URL href.
     *
     * @param {string} [text] e.g. "2024 Topps Chrome"
     * @param {string} [href] e.g. "/Checklist.cfm/sid/123/2024"
     * @returns {string|null} four-digit year string, or null
     */
    extractYear(text = "", href = "") {
      if (href) {
        const fromHref = href.match(/\/sid\/\d+\/(\d{4})/i) || href.match(/sid=\d+.*?(\d{4})/i) || href.match(/[?&]year=(\d{4})/i) || href.match(/\/(\d{4})(?:[/-]|\b)/);
        if (fromHref) return fromHref[1];
      }
      const match = String(text || "").match(LEADING_YEAR_REGEX);
      return match ? match[1] : null;
    },
    /**
     * Convert a path or relative URL to a complete absolute URL.
     *
     * @param {string} [path] e.g. "/Checklist.cfm/sid/311171/"
     * @returns {string} full URL e.g. "https://www.tcdb.com/Checklist.cfm/sid/311171/"
     */
    toFullUrl(path2 = "") {
      if (!path2) return "";
      if (path2.startsWith("http://") || path2.startsWith("https://")) return path2;
      const origin = typeof window !== "undefined" && window.location && window.location.origin ? window.location.origin : "https://www.tcdb.com";
      return `${origin}${path2.startsWith("/") ? "" : "/"}${path2}`;
    },
    /**
     * Format a URL into a concise, readable string for console logging.
     * Prevents long URLs from causing ugly line wrapping in developer tools.
     *
     * @param {string} [url]
     * @returns {string} e.g. "ViewCollectionMode.cfm?PageIndex=2"
     */
    formatLogUrl(url = "") {
      if (!url) return "";
      try {
        const parsed = new URL(url, typeof window !== "undefined" && window.location ? window.location.href : "https://www.tcdb.com");
        const filename = parsed.pathname.split("/").pop() || parsed.pathname;
        const partParam = parsed.searchParams.get("Part");
        if (partParam) {
          return `${filename}?Part=${partParam}`;
        }
        const pageIndex = parsed.searchParams.get("PageIndex") || parsed.searchParams.get("page");
        if (pageIndex) {
          return `${filename}?PageIndex=${pageIndex}`;
        }
        const search = parsed.search;
        if (search && search.length > 40) {
          return `${filename}${search.slice(0, 37)}...`;
        }
        return `${filename}${search}`;
      } catch {
        return url;
      }
    },
    escape: {
      /**
       * Escape a string for safe HTML interpolation.
       *
       * @param {*} str
       * @returns {string}
       */
      html(str) {
        if (str === null || str === void 0) return "";
        return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
      },
      /**
       * Escape a string for safe XML interpolation.
       *
       * @param {*} str
       * @returns {string}
       */
      xml(str) {
        if (str === null || str === void 0) return "";
        return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
      },
      /**
       * Escape a field for RFC 4180 CSV serialization.
       *
       * @param {*} value
       * @returns {string}
       */
      csv(value) {
        const str = value === null || value === void 0 ? "" : String(value);
        if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }
    }
  };

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
    /**
     * All stored pins in their persisted order.
     *
     * The `enabled` field is optional — pins created before this field was added
     * have no `enabled` key, which is treated the same as `enabled: true`.
     *
     * @returns {Array<{id: string, name: string, url: string, year: string, enabled?: boolean}>}
     */
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
    },
    /**
     * Replace the entire stored pin list in one write.
     *
     * Used by drag-and-drop reordering: the caller assembles the new order and
     * passes it here so storage is always consistent with the UI.
     *
     * @param {Array<{id: string, name: string, url: string, year: string, enabled?: boolean}>} pins
     */
    reorder: (pins) => {
      setValue(PINNED_SETS_KEY, pins);
    },
    /**
     * Flip the `enabled` field for a single pin and persist.
     *
     * Pins with no `enabled` field are treated as enabled; toggling them once
     * sets `enabled: false`.
     *
     * @param {string} id
     * @returns {boolean} the new enabled state, or `true` if pin not found
     */
    toggle: (id) => {
      const pins = Pins.all();
      const pin = pins.find((p) => p.id === id);
      if (!pin) return true;
      pin.enabled = !(pin.enabled !== false);
      setValue(PINNED_SETS_KEY, pins);
      return pin.enabled;
    }
  };
  var SET_YEAR_REGEX = /^(\d{4})/;
  function deriveSetYear(name, href = "") {
    return Utils.extractYear(name, href) || "Misc";
  }

  // src/core/config.js
  var EXPORT_CONFIG = {
    baseDelayMs: 1e3,
    jitterMaxMs: 700,
    maxRetries: 3,
    backoffBaseMs: 1e3,
    backoffCapMs: 15e3,
    maxPages: 200,
    requestTimeoutMs: 3e4,
    hierarchyMinDelayMs: 1e4,
    hierarchyMaxDelayMs: 15e3
  };
  var DEFAULT_CONFIG = {
    schemaVersion: 3,
    modules: {
      inputOptimization: { enabled: true, urlMatch: [], actions: {} },
      checklistEnhancer: {
        enabled: true,
        // These patterns are the only gate on where the filter appears. The
        // module does not re-check the route; editing this list in Settings is
        // what moves the feature.
        urlMatch: [
          { pattern: "/checklist\\.cfm", exclude: false },
          { pattern: "/viewcollectionmode\\.cfm", exclude: false },
          { pattern: "/viewcollectionforsaletrade\\.cfm", exclude: false },
          { pattern: "/viewcollectionwantlist\\.cfm", exclude: false },
          { pattern: "/collectionaddmultiples", exclude: false },
          { pattern: "/inserts\\.cfm", exclude: false },
          { pattern: "/viewall\\.cfm", exclude: false },
          { pattern: "/viewallc\\.cfm", exclude: false }
        ],
        actions: {
          realtimeFilter: true
        }
      },
      setListEnhancer: {
        enabled: true,
        urlMatch: [
          { pattern: "/viewall\\.cfm", exclude: false },
          { pattern: "/inserts\\.cfm", exclude: false },
          { pattern: "/checklist\\.cfm", exclude: false },
          { pattern: "/viewset\\.cfm", exclude: false },
          { pattern: "collection", exclude: false }
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
          { pattern: "collection", exclude: false },
          { pattern: "(?=.*/person)(?=.*collection)", exclude: false },
          { pattern: "/print\\.cfm", exclude: false },
          { pattern: "printyourcollectionpdf\\.cfm", exclude: false },
          { pattern: "addmultiples", exclude: true }
        ],
        actions: {}
      },
      paginationLoader: {
        enabled: true,
        urlMatch: [{ pattern: "addmultiples", exclude: true }],
        actions: {}
      },
      cardNameFormatter: {
        enabled: true,
        urlMatch: [
          { pattern: "/viewcard\\.cfm", exclude: false },
          { pattern: "/checklist\\.cfm", exclude: false },
          { pattern: "/viewcollectionforsaletrade\\.cfm", exclude: false },
          { pattern: "/viewcollectionwantlist\\.cfm", exclude: false }
        ],
        actions: {}
      },
      collectionQuantityCounter: {
        enabled: true,
        urlMatch: [
          { pattern: "/viewcollectionmode\\.cfm", exclude: false },
          { pattern: "/viewcollectionforsaletrade\\.cfm", exclude: false },
          { pattern: "/viewcollectionwantlist\\.cfm", exclude: false }
        ],
        actions: {}
      },
      setHierarchyExport: {
        enabled: true,
        urlMatch: [
          { pattern: "/viewall\\.cfm", exclude: false },
          { pattern: "/viewallc\\.cfm", exclude: false }
        ],
        actions: {}
      },
      collectionDefaulter: {
        enabled: true,
        urlMatch: [{ pattern: "/viewcollection\\.cfm", exclude: false }],
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
      exportRequestTimeoutMs: EXPORT_CONFIG.requestTimeoutMs,
      exportHierarchyMinDelayMs: EXPORT_CONFIG.hierarchyMinDelayMs,
      exportHierarchyMaxDelayMs: EXPORT_CONFIG.hierarchyMaxDelayMs,
      exportBlockCooldownMinutes: 5,
      exportCacheTtlHours: 24,
      toastDurationMs: 4e3,
      toastStackLimit: 4,
      checklistFilterDebounceMs: 150,
      paginationLoaderDelayMs: 1e3,
      paginationThrottleStartPage: 6,
      pacingPenaltyStepMs: 500,
      pacingPenaltyCapMs: 8e3,
      pacingSlowResponseMs: 4e3,
      pacingSampleWindow: 10,
      pacingReliefStepMs: 100,
      throttleMaxSliceMs: 250,
      exportCacheMaxEntries: 20,
      exportCacheMaxRows: 2e4,
      addMultiplesFocusDeadlineMs: 1200,
      setListEnhancerChunkSize: 25,
      settingsSaveDebounceMs: 400,
      cardFormatterTemplate: "{PlayerName} - {Year} {SetName} {Tags} {PR} #{CardNo}",
      cardFormatterOutputMode: "popover",
      cardFormatterPopoverDurationMs: 4e3,
      cardFormatterShowCopy: true,
      cardFormatterShowBRef: true,
      cardFormatterShowGoogle: true,
      quantityCounterPosition: "bottom-right",
      theme: "auto",
      logLevel: "info",
      timezone: "auto",
      timestampFormat: "HH:mm:ss.SSS TZ",
      toolbarButtonDisplay: "both",
      pinButtonDisplay: "both",
      setButtonDisplay: "both",
      defaultCollectionId: 6,
      toolbarBadges: [
        { key: "CHECKLIST", enabled: true },
        { key: "INSERTS", enabled: true },
        { key: "PARALLELS", enabled: true },
        { key: "FOR_SALE", enabled: true },
        { key: "MULTI", enabled: true },
        { key: "WANTLIST", enabled: true },
        { key: "CSV", enabled: true },
        { key: "HIERARCHY", enabled: true }
      ],
      setLinkBadges: [
        { key: "CHECKLIST", enabled: true },
        { key: "PIN", enabled: true },
        { key: "CSV", enabled: true },
        { key: "HIERARCHY", enabled: true },
        { key: "INSERTS", enabled: true },
        { key: "PARALLELS", enabled: true },
        { key: "FOR_SALE", enabled: true },
        { key: "MULTI", enabled: true },
        { key: "WANTLIST", enabled: true }
      ]
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
     * Every schema change so far has been expressible as a merge onto fresh
     * defaults: new keys arrive with their default value, removed modules are
     * dropped, and the user's own choices survive. So any older version upgrades
     * by merging, rather than each bump needing its own hardcoded branch — the
     * previous shape of this function knew only about v1 -> v2, which meant the
     * next bump would silently have reset everyone's settings.
     *
     * A version *newer* than this build, or one that is missing or not a
     * positive integer, has no safe interpretation and resets: a wrong config is
     * worse than a default one.
     *
     * @param {object} stored
     * @returns {object} a config conforming to the current schema
     */
    migrate: (stored) => {
      const current = DEFAULT_CONFIG.schemaVersion;
      const version = stored?.schemaVersion;
      if (version === current) {
        return SettingsStore.mergeWithDefaults(stored);
      }
      if (Number.isInteger(version) && version >= 1 && version < current) {
        Log(
          `Migrating stored config from schema v${version} to v${current}.`,
          "info"
        );
        return SettingsStore.mergeWithDefaults(stored);
      }
      Log(
        `Stored config schema v${version} has no migration path to v${current}. Resetting to defaults.`,
        "warn"
      );
      return SettingsStore.cloneDefaults();
    },
    /**
     * Overlay stored values onto a fresh default config. Modules and action
     * toggles the current build does not know about are dropped rather than
     * carried forward, so a removed feature's config cannot linger in storage
     * indefinitely, invisible and unreachable from the settings UI.
     *
     * @param {object} stored
     * @returns {object}
     */
    mergeWithDefaults: (stored) => {
      const merged = SettingsStore.cloneDefaults();
      Object.keys(stored.modules || {}).forEach((id) => {
        const defaults = merged.modules[id];
        if (!defaults) {
          Log(
            `Stored config references unknown module '${id}' — dropped.`,
            "warn"
          );
          return;
        }
        const storedActions = stored.modules[id].actions || {};
        const actions = { ...defaults.actions };
        Object.keys(actions).forEach((key) => {
          if (key in storedActions) actions[key] = storedActions[key];
        });
        merged.modules[id] = { ...defaults, ...stored.modules[id], actions };
      });
      const validGlobalKeys = new Set(Object.keys(DEFAULT_CONFIG.global));
      const storedGlobal = stored.global || {};
      const global = { ...merged.global };
      Object.keys(storedGlobal).forEach((key) => {
        if (validGlobalKeys.has(key)) {
          global[key] = storedGlobal[key];
        } else {
          Log(
            `Stored config contains obsolete global setting '${key}' — pruned during migration.`,
            "warn"
          );
        }
      });
      merged.global = global;
      return merged;
    },
    save: (config) => {
      setValue(SettingsStore.STORAGE_KEY, config);
    }
  };
  var Config = SettingsStore.cloneDefaults();
  function syncExportConfig() {
    EXPORT_CONFIG.baseDelayMs = Config.global.exportBaseDelayMs ?? 1e3;
    EXPORT_CONFIG.jitterMaxMs = Config.global.exportJitterMaxMs ?? 700;
    EXPORT_CONFIG.maxRetries = Config.global.exportMaxRetries ?? 3;
    EXPORT_CONFIG.backoffBaseMs = Config.global.exportBackoffBaseMs ?? 1e3;
    EXPORT_CONFIG.backoffCapMs = Config.global.exportBackoffCapMs ?? 15e3;
    EXPORT_CONFIG.maxPages = Config.global.exportMaxPages ?? 200;
    EXPORT_CONFIG.requestTimeoutMs = Config.global.exportRequestTimeoutMs ?? 3e4;
    EXPORT_CONFIG.hierarchyMinDelayMs = Config.global.exportHierarchyMinDelayMs ?? 1e4;
    EXPORT_CONFIG.hierarchyMaxDelayMs = Config.global.exportHierarchyMaxDelayMs ?? 15e3;
  }
  function initConfig() {
    const loaded = SettingsStore.load();
    Config.schemaVersion = loaded.schemaVersion;
    Config.modules = loaded.modules;
    Config.global = loaded.global;
    RuntimeSettings.logLevel = Config.global.logLevel || "info";
    RuntimeSettings.timezone = Config.global.timezone || "auto";
    RuntimeSettings.timestampFormat = Config.global.timestampFormat || "HH:mm:ss.SSS TZ";
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
  function escapeXml(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  }
  function configToXml(config) {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += `<sctoolkit-settings schemaVersion="${config.schemaVersion || DEFAULT_CONFIG.schemaVersion}">
`;
    xml += "  <global>\n";
    if (config.global) {
      Object.entries(config.global).forEach(([k, v]) => {
        xml += `    <${k}>${escapeXml(v)}</${k}>
`;
      });
    }
    xml += "  </global>\n";
    xml += "  <modules>\n";
    if (config.modules) {
      Object.entries(config.modules).forEach(([id, modCfg]) => {
        xml += `    <module id="${escapeXml(id)}" enabled="${!!modCfg.enabled}">
`;
        xml += "      <urlMatch>\n";
        (modCfg.urlMatch || []).forEach((rule) => {
          xml += `        <rule pattern="${escapeXml(rule.pattern)}" exclude="${!!rule.exclude}" />
`;
        });
        xml += "      </urlMatch>\n";
        xml += "      <actions>\n";
        Object.entries(modCfg.actions || {}).forEach(([actionKey, actionVal]) => {
          xml += `        <action key="${escapeXml(actionKey)}" enabled="${!!actionVal}" />
`;
        });
        xml += "      </actions>\n";
        xml += "    </module>\n";
      });
    }
    xml += "  </modules>\n";
    xml += "</sctoolkit-settings>";
    return xml;
  }
  function xmlToConfig(xmlText) {
    const ParserClass = typeof DOMParser !== "undefined" ? DOMParser : typeof globalThis !== "undefined" && globalThis.DOMParser ? globalThis.DOMParser : typeof window !== "undefined" && window.DOMParser ? window.DOMParser : null;
    if (!ParserClass) {
      throw new Error("DOMParser is not available in this environment");
    }
    const parser = new ParserClass();
    const doc = parser.parseFromString(xmlText, "text/xml");
    const errorNode = doc.querySelector("parsererror");
    if (errorNode) {
      throw new Error(`XML Parse Error: ${errorNode.textContent}`);
    }
    const root = doc.querySelector("sctoolkit-settings") || doc.documentElement;
    if (!root || root.nodeName !== "sctoolkit-settings") {
      throw new Error("Invalid XML: Root element must be <sctoolkit-settings>");
    }
    const schemaVersion = parseInt(root.getAttribute("schemaVersion") || "3", 10);
    const config = {
      schemaVersion,
      global: {},
      modules: {}
    };
    const globalNode = root.querySelector("global");
    if (globalNode) {
      Array.from(globalNode.children).forEach((child) => {
        const key = child.tagName;
        const valText = child.textContent.trim();
        if (valText === "true" || valText === "false") {
          config.global[key] = valText === "true";
        } else if (!isNaN(Number(valText)) && valText !== "") {
          config.global[key] = Number(valText);
        } else {
          config.global[key] = valText;
        }
      });
    }
    const modulesNode = root.querySelector("modules");
    if (modulesNode) {
      const modNodes = modulesNode.querySelectorAll("module");
      modNodes.forEach((modNode) => {
        const id = modNode.getAttribute("id");
        if (!id) return;
        const enabled = modNode.getAttribute("enabled") === "true";
        const urlMatch = [];
        modNode.querySelectorAll("urlMatch rule").forEach((ruleNode) => {
          const pattern = ruleNode.getAttribute("pattern") || "";
          const exclude = ruleNode.getAttribute("exclude") === "true";
          urlMatch.push({ pattern, exclude });
        });
        const actions = {};
        modNode.querySelectorAll("actions action").forEach((actNode) => {
          const actKey = actNode.getAttribute("key");
          if (actKey) {
            actions[actKey] = actNode.getAttribute("enabled") === "true";
          }
        });
        config.modules[id] = { enabled, urlMatch, actions };
      });
    }
    return SettingsStore.migrate(config);
  }

  // src/core/contracts.js
  var results = [];
  var getContractResults = () => results.slice();
  function assertContract(moduleId, checks) {
    const failures = [];
    checks.forEach(({ selector, context = document, label, optional = false }) => {
      let found;
      try {
        found = context.querySelector(selector);
      } catch {
        found = null;
      }
      results.push({ moduleId, label: label || selector, selector, ok: !!found });
      if (!found && !optional) failures.push(label || selector);
    });
    if (failures.length === 0) return true;
    Log(
      `[Contract] '${moduleId}' — selector(s) not found: ${failures.join("; ")}. Site markup may have changed; affected functionality may silently no-op. Settings → Diagnostics lists every check.`,
      "warn"
    );
    return false;
  }
  function recordContract(moduleId, label, ok) {
    results.push({ moduleId, label, selector: "(runtime check)", ok });
  }

  // src/ui/dom.js
  function injectStyle(css) {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
    return style;
  }
  function createBtn(id, text, onClick, disabled = false) {
    const btn = document.createElement("button");
    btn.id = id;
    btn.type = "button";
    btn.className = "sctk-btn";
    btn.textContent = text;
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

  // src/modules/inputOptimization.js
  var InputIndex = {
    /** @type {() => HTMLInputElement[]} */
    getValidInputs: () => []
  };
  var INPUT_SELECTOR = "input[type='text' i], input[type='number' i], input:not([type])";
  function isEligibleInput(el) {
    if (!el) return false;
    const type = el.type ? el.type.toLowerCase() : "text";
    if (type !== "text" && type !== "number") return false;
    if (el.readOnly || el.disabled || el.hidden || el.getAttribute("hidden") !== null) return false;
    if (el.name && el.name.toLowerCase() === "pageindex") return false;
    if (el.id && el.id.toLowerCase() === "pageindex") return false;
    return el.offsetParent !== null || el.value === "0";
  }
  var cache = { inputs: null };
  function invalidateInputCache() {
    cache.inputs = null;
  }
  function getValidInputs() {
    if (cache.inputs === null) {
      const root = typeof document !== "undefined" && document.getElementById("main-content-area") || (typeof document !== "undefined" ? document.body : null);
      cache.inputs = root ? Array.from(root.querySelectorAll(INPUT_SELECTOR)).filter(isEligibleInput) : [];
    }
    return cache.inputs;
  }
  function initInputOptimization() {
    recordContract(
      "inputOptimization",
      `${getValidInputs().length} eligible input(s)`,
      true
    );
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.code !== "NumpadEnter") return;
      const active = document.activeElement;
      if (!active || active.tagName !== "INPUT" || active.id === "tk-checklist-filter" || active.name?.toLowerCase() === "pageindex" || active.id?.toLowerCase() === "pageindex") return;
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
    const target = typeof document !== "undefined" && document.getElementById("main-content-area") || (typeof document !== "undefined" ? document.body : null);
    if (target && typeof MutationObserver === "function") {
      const debouncedInvalidate = debounce(invalidateInputCache, 200);
      const observer = new MutationObserver(debouncedInvalidate);
      observer.observe(target, { childList: true, subtree: true });
    }
    if (typeof window !== "undefined") {
      window.addEventListener("resize", invalidateInputCache, { passive: true });
    }
    InputIndex.getValidInputs = getValidInputs;
  }

  // src/ui/icons.js
  var ICONS = {
    list: {
      size: 12,
      strokeWidth: 2,
      body: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>'
    },
    bolt: {
      size: 12,
      strokeWidth: 2,
      body: '<path d="M15.914 4a1.5 1.5 0 0 0-2.474-1.561l-9 9A1.5 1.5 0 0 0 5.5 14h4.002a.5.5 0 0 1 .471.666L8.086 20a1.5 1.5 0 0 0 2.475 1.56l9-9A1.5 1.5 0 0 0 18.5 10h-3.997a.5.5 0 0 1-.472-.667z"/>'
    },
    gem: {
      size: 12,
      strokeWidth: 2,
      body: '<path d="M10.5 3 8 9l4 13 4-13-2.5-6"/><path d="M17 3a2 2 0 0 1 1.6.8l3 4a2 2 0 0 1 .013 2.382l-7.99 10.986a2 2 0 0 1-3.247 0l-7.99-10.986A2 2 0 0 1 2.4 7.8l2.998-3.997A2 2 0 0 1 7 3z"/><path d="M2 9h20"/>'
    },
    tag: {
      size: 12,
      strokeWidth: 2,
      body: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>'
    },
    layers: {
      size: 12,
      strokeWidth: 2,
      body: '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/>'
    },
    star: {
      size: 12,
      strokeWidth: 2,
      body: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>'
    },
    download: {
      size: 12,
      strokeWidth: 2,
      body: '<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>'
    },
    pin: {
      size: 12,
      strokeWidth: 2,
      body: '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>'
    },
    x: {
      size: 11,
      strokeWidth: 2,
      body: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'
    },
    chevronUp: {
      size: 12,
      strokeWidth: 2,
      body: '<path d="m18 15-6-6-6 6"/>'
    },
    chevronDown: {
      size: 12,
      strokeWidth: 2,
      body: '<path d="m6 9 6 6 6-6"/>'
    },
    plus: {
      size: 11,
      strokeWidth: 2,
      body: '<path d="M5 12h14"/><path d="M12 5v14"/>'
    },
    gear: {
      size: 12,
      strokeWidth: 2,
      body: '<path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/>'
    },
    copy: {
      size: 12,
      strokeWidth: 2,
      body: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>'
    },
    bref: {
      size: 12,
      strokeWidth: 2,
      body: '<circle cx="12" cy="12" r="9"/><path d="M8.5 3.5a10.5 10.5 0 0 0 0 17"/><path d="M15.5 3.5a10.5 10.5 0 0 1 0 17"/><path d="M7 7h3M6 10.5h3.5M6 13.5h3.5M7 17h3"/><path d="M14 7h3M14.5 10.5H18M14.5 13.5H18M14 17h3"/>'
    },
    google: {
      size: 12,
      strokeWidth: 2,
      body: '<path d="M12 12h8.5A8.5 8.5 0 1 1 17.8 6.2"/><path d="m21 21-4.3-4.3"/>'
    },
    check: {
      size: 12,
      strokeWidth: 2,
      body: '<path d="M20 6 9 17l-5-5"/>'
    },
    downloadHierarchy: {
      size: 12,
      strokeWidth: 2,
      body: '<path d="M12 12V3"/><path d="m8 8 4 4 4-4"/><path d="M4 16h16"/><path d="M4 16v4"/><path d="M12 16v4"/><path d="M20 16v4"/>'
    }
  };
  var SPRITE_ID = "sctk-icon-sprite";
  var symbolId = (name) => `tk-i-${name}`;
  function buildSprite() {
    const symbols = Object.entries(ICONS).map(
      ([name, { strokeWidth, body }]) => `<symbol id="${symbolId(name)}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${body}</symbol>`
    ).join("");
    return `<svg id="${SPRITE_ID}" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden">${symbols}</svg>`;
  }
  function installIconSprite() {
    const existing = document.getElementById(SPRITE_ID);
    if (existing) existing.remove();
    const holder = document.createElement("div");
    holder.innerHTML = buildSprite();
    document.body.prepend(holder.firstChild);
  }
  function icon(name) {
    const def = ICONS[name];
    if (!def) return "";
    return `<svg class="tk-icon" width="${def.size}" height="${def.size}" aria-hidden="true"><use href="#${symbolId(name)}"/></svg>`;
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
    isCollection: () => path().includes("collection") && !path().includes("addmultiples") && !path().includes("printyourcollection") && !window.location.search.toLowerCase().includes("mode=print"),
    isCollectionBrowse: () => path().includes("collectionbrowse.cfm") && !path().includes("collectionbrowsep.cfm") && !path().includes("collectionbrowset.cfm"),
    isCollectionBrowseP: () => path().includes("collectionbrowsep.cfm"),
    isCollectionBrowseT: () => path().includes("collectionbrowset.cfm"),
    isPlayerCollection: () => path().includes("/person") && window.location.search.toLowerCase().includes("collection"),
    isPlayerPage: () => path().includes("/person.cfm"),
    isCardPage: () => path().includes("/viewcard.cfm"),
    isChecklist: () => path().includes("/checklist.cfm"),
    isViewSet: () => path().includes("/viewset.cfm"),
    isInserts: () => path().includes("/inserts.cfm"),
    isPrintPDF: () => path().includes("/print.cfm") || path().includes("printyourcollectionpdf.cfm") || path().includes("printyourcollection") || path().includes("collection") && window.location.search.toLowerCase().includes("mode=print"),
    isViewAll: () => path().includes("/viewall.cfm") || path().includes("/inserts.cfm"),
    isViewAllSets: () => (path().includes("/viewall.cfm") || path().includes("/viewallc.cfm")) && path().includes("/sp/") && path().includes("/year/"),
    isForSaleTrade: () => path().includes("/viewcollectionforsaletrade.cfm"),
    isWantlist: () => path().includes("/viewcollectionwantlist.cfm"),
    isAddMultiples: () => path().includes("/collectionaddmultiples"),
    /**
     * True on any page scoped to one set. Composed from the individual
     * predicates rather than re-listing the same seven path fragments, so adding
     * a set-scoped route cannot leave this out of date.
     */
    isSetPage: () => SET_PAGE_PREDICATES.some((key) => Routes[key]()),
    hasPagination: (root = document) => !path().includes("addmultiples") && (!!root.querySelector(".pagination") || Routes.isSetPage() || Routes.isCollection() || Routes.isPlayerCollection())
  };

  // src/core/selectors.js
  var SELECTOR_REGISTRY = {
    checklist: {
      scopes: ["#main-content-area", "#content"],
      dataRows: 'a[href*="ViewCard.cfm"], a[href*="Checklist.cfm"], a[href*="ViewSet.cfm"], a[href*="/sid/"], a[href*="ViewAll.cfm"], a[href*="Person.cfm"], a[href*="Team.cfm"], input, select',
      itemElements: "table tr, ul > li, ol > li",
      chrome: ".col-md-3, .col-md-4, nav, .breadcrumb, .navbar, #topnav, #sctk-toolbar, .menu-linksV, .list-unstyled, .set-wrapper, .set-dropdown, #setDropdown, #setList, .offcanvas, .dropdown-menu, .dropdown, .modal, .btn-group"
    },
    setDropdown: {
      wrapper: "#setWrapper",
      dropdown: "#setDropdown",
      search: "#setSearch",
      list: "#setList"
    },
    setLinks: [
      'a[href*="ViewSet" i]',
      'a[href*="CollectionSummary" i]',
      'a[href*="Checklist" i]',
      'a[href*="sid=" i]',
      'a[href*="/sid/" i]'
    ]
  };

  // src/modules/checklistEnhancer.js
  function getFilterPlaceholder() {
    if (Routes.isViewAll()) {
      return "Filter sets by name, year, or category...";
    }
    if (Routes.isChecklist() || Routes.isViewSet()) {
      return "Filter cards by #, player, team, note, or serial #...";
    }
    if (Routes.isCollection() || Routes.isForSaleTrade() || Routes.isWantlist()) {
      return "Filter collection by player, set, card #, or status...";
    }
    if (Routes.isPlayerPage() || Routes.isPlayerCollection()) {
      return "Filter cards by set, year, card #, or attribute...";
    }
    return "Filter items by name, number, or keyword...";
  }
  var FILTER_SCOPES = SELECTOR_REGISTRY.checklist.scopes;
  var DATA_ROW_SELECTOR = SELECTOR_REGISTRY.checklist.dataRows;
  var ITEM_ELEMENT_SELECTOR = SELECTOR_REGISTRY.checklist.itemElements;
  var HIDDEN_CLASS = "tk-hidden";
  var SIDEBAR_CHROME_SELECTOR = SELECTOR_REGISTRY.checklist.chrome;
  function buildRowIndex(mainContent) {
    const index = [];
    const elements = mainContent.querySelectorAll(ITEM_ELEMENT_SELECTOR);
    elements.forEach((el) => {
      if (el.closest(SIDEBAR_CHROME_SELECTOR)) return;
      if (el.parentElement && el.parentElement.closest(ITEM_ELEMENT_SELECTOR)) return;
      if (el.tagName === "TR" && el.querySelector("th")) return;
      if (!el.querySelector(DATA_ROW_SELECTOR)) return;
      index.push({ el, haystack: el.textContent.replace(/\s+/g, " ").toLowerCase() });
    });
    return index;
  }
  function applyFilter(index, term) {
    let visible = 0;
    const updates = [];
    const rawTerm = (term || "").trim().toLowerCase();
    const conditions = rawTerm ? rawTerm.split(/[,;|\s]+/).filter(Boolean) : [];
    index.forEach(({ el, haystack }) => {
      const match = conditions.length === 0 || conditions.some((cond) => haystack.includes(cond));
      updates.push({ el, match });
      if (match) visible++;
    });
    const updateVisibility = () => {
      updates.forEach(({ el, match }) => {
        el.classList.toggle(HIDDEN_CLASS, !match);
      });
    };
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(updateVisibility);
    } else {
      updateVisibility();
    }
    return visible;
  }
  function findFilterScope(root = document) {
    for (const selector of FILTER_SCOPES) {
      const el = root.querySelector(selector);
      if (el && (el.querySelector("table") || el.querySelector("ul, ol"))) return el;
    }
    return null;
  }
  function findFilterTarget(mainContent) {
    const moreDiv = mainContent.querySelector("div.more");
    if (moreDiv && !moreDiv.closest(SIDEBAR_CHROME_SELECTOR)) return moreDiv;
    const targets = mainContent.querySelectorAll("table, ul, ol");
    for (const el of targets) {
      if (el.closest(SIDEBAR_CHROME_SELECTOR)) continue;
      return el;
    }
    return null;
  }
  function installFilter(mainContent) {
    const targetElement = findFilterTarget(mainContent);
    if (!targetElement) return;
    const index = buildRowIndex(mainContent);
    Log(`Checklist filter indexed ${index.length} data item(s).`, "info");
    recordContract("checklistEnhancer", `indexed ${index.length} data item(s)`, index.length > 0);
    const placeholderText = getFilterPlaceholder();
    const filterWrap = document.createElement("div");
    filterWrap.id = "tk-checklist-filter-wrap";
    filterWrap.innerHTML = `
    <strong>Filter Items:</strong>
    <div id="tk-checklist-filter-container">
      <input type="text" id="tk-checklist-filter" placeholder="${placeholderText}"
             title="Type to filter active listing items in real time" aria-label="Filter items">
      <button type="button" id="tk-checklist-filter-clear" title="Clear filter" aria-label="Clear filter" style="display: none;">
        ${icon("x")}
      </button>
    </div>
    <span id="tk-filter-count" aria-live="polite"></span>
  `;
    targetElement.before(filterWrap);
    const countEl = filterWrap.querySelector("#tk-filter-count");
    const input = filterWrap.querySelector("#tk-checklist-filter");
    const clearBtn = filterWrap.querySelector("#tk-checklist-filter-clear");
    const updateClearVisibility = () => {
      if (clearBtn) {
        clearBtn.style.display = input.value.trim() !== "" ? "inline-flex" : "none";
      }
    };
    const run = debounce((term) => {
      const visible = applyFilter(index, term);
      countEl.textContent = term === "" ? "" : `${visible} of ${index.length}`;
    }, Config.global.checklistFilterDebounceMs);
    const performFilter = () => {
      const val = input.value.toLowerCase().trim();
      updateClearVisibility();
      run(val);
    };
    input.addEventListener("input", performFilter);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && input.value !== "") {
        e.stopPropagation();
        input.value = "";
        performFilter();
      }
    });
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        input.value = "";
        input.focus();
        performFilter();
      });
    }
  }
  function initChecklistEnhancer() {
    if (!Config.modules.checklistEnhancer.actions.realtimeFilter) return;
    if (document.getElementById("tk-checklist-filter-wrap")) return;
    const scope = findFilterScope();
    if (!scope) {
      assertContract("checklistEnhancer", [
        { selector: FILTER_SCOPES.join(", "), label: "a listing container holding a table or list" }
      ]);
      return;
    }
    installFilter(scope);
  }

  // src/core/sid.js
  function extractSid(url) {
    if (!url) return null;
    const match = String(url).match(/sid[=/](\d+)/i);
    return match ? match[1] : null;
  }
  function extractParentSid(doc = document, currentSid = null) {
    if (!doc || typeof doc.querySelector !== "function") return null;
    const getHref = (el) => (el ? el.getAttribute ? el.getAttribute("href") || el.href : el.href : "") || "";
    const candidateAnchors = Array.from(
      doc.querySelectorAll(
        '.menu-linksV a, .menu-listV a, #offcanvas a, #content a[href*="ViewSet.cfm/sid/"], a[href*="ViewSet.cfm/sid/"]'
      )
    );
    const overviewLink = candidateAnchors.find((a) => {
      const text = (a.textContent || "").trim().toLowerCase();
      const href = getHref(a).toLowerCase();
      return text.includes("overview") || href.includes("viewset.cfm/sid/");
    });
    if (overviewLink) {
      const sid = extractSid(getHref(overviewLink));
      if (sid && sid !== currentSid) return sid;
    }
    for (const link of candidateAnchors) {
      const sid = extractSid(getHref(link));
      if (sid && sid !== currentSid) return sid;
    }
    const breadcrumbLinks = doc.querySelectorAll(
      '.breadcrumb a[href*="/sid/"], .breadcrumb a[href*="sid="], ol.breadcrumb a[href*="/sid/"], ul.breadcrumb a[href*="/sid/"], nav a[href*="/sid/"]'
    );
    for (const link of breadcrumbLinks) {
      const sid = extractSid(getHref(link));
      if (sid && sid !== currentSid) return sid;
    }
    const headerLink = doc.querySelector(
      '#setname-content h1 a[href*="/sid/"], #main-content-area h1 a[href*="/sid/"]'
    );
    if (headerLink) {
      const sid = extractSid(getHref(headerLink));
      if (sid && sid !== currentSid) return sid;
    }
    return null;
  }

  // src/data/csv.js
  function escapeField(value) {
    return Utils.escape.csv(value);
  }
  function buildRow(fields) {
    return fields.map(Utils.escape.csv).join(",");
  }
  function toCSV(rows) {
    return rows.map(buildRow).join("\n");
  }
  function download(csvContent, filename) {
    const bom = new Uint8Array([239, 187, 191]);
    const blob = new Blob([bom, csvContent], { type: "text/csv;charset=utf-8;" });
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
    const cleanYear = year || Utils.extractYear(fallbackLabel) || "";
    const cleanBaseSet = sanitizeSegment(baseSet);
    const cleanSubSet = setName ? `_${compactSegment(setName)}` : "";
    const suffix = EXPORT_KIND_SUFFIX[kind] ?? EXPORT_KIND_SUFFIX.checklist;
    return cleanYear ? `${cleanYear}_${cleanBaseSet}${cleanSubSet}${suffix}.csv` : `${cleanBaseSet}${cleanSubSet}${suffix}.csv`;
  }
  function buildPrintCollectionFilename({
    includePrice = false,
    part = null,
    date = /* @__PURE__ */ new Date()
  } = {}) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const dateStr = `${yyyy}${mm}${dd}`;
    const priceSuffix = includePrice ? "WithPrice" : "";
    const pageSegment = part ? `Page${part}` : "Full";
    return `${dateStr}_TCDBCollection${pageSegment}${priceSuffix}.csv`;
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
    "Team",
    "Variations"
  ];
  var NAME_SUFFIX = /^(Jr\.?|Sr\.?|II|III|IV|V)$/i;
  var PRINT_RUN = /^SN\d+$/i;
  var KNOWN_TAGS = /* @__PURE__ */ new Set([
    "RC",
    "AU",
    "AUTO",
    "MEM",
    "MEMO",
    "FS",
    "DP",
    "SP",
    "SSP",
    "VAR",
    "ERR",
    "UER",
    "COR",
    "SN",
    "HL",
    "CL",
    "TL",
    "LL",
    "ROY",
    "MVP",
    "HOF",
    "AS",
    "CY",
    "SH",
    "CO",
    "MGR",
    "TC",
    "FC",
    "1ST",
    "RET",
    "DK",
    "IN",
    "PR",
    "BC",
    "NNO",
    "PUP",
    "IA",
    "ASG",
    "GL",
    "MG",
    "FF",
    "AL",
    "NL",
    "TR",
    "FB",
    "BB",
    "BK",
    "HK",
    "PAR",
    "INS",
    "REF",
    "FOIL",
    "EXCH",
    "RED",
    "PROMO"
  ]);
  function isTagToken(token) {
    if (!token || token.includes(".")) return false;
    if (/[a-z]/.test(token)) return false;
    if (NAME_SUFFIX.test(token)) return false;
    const upper = token.toUpperCase();
    if (KNOWN_TAGS.has(upper)) return true;
    return /^[A-Z0-9]{1,3}$/.test(upper);
  }
  var CAPTION_TAGS = ["VAR", "ERR", "UER", "COR"];
  var CAPTION_SEGMENT = new RegExp(`^(${CAPTION_TAGS.join("|")}):\\s*`, "i");
  var DESCRIBABLE_TAG = new RegExp(`^(${CAPTION_TAGS.join("|")})$`, "i");
  var TAG_CELL = /^[A-Z0-9]{1,6}(\s*,\s*[A-Z0-9]{1,6})*$/;
  var VARIATION_CARD_NO = /\d+[a-z]$/i;
  var norm = (node) => node ? node.textContent.replace(/\s+/g, " ").trim() : "";
  function parseSubjectCell(rawSubject, caption = {}) {
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
      } else if (!foundNonTag && isTagToken(cleanToken)) {
        tagParts.unshift(cleanToken);
      } else {
        foundNonTag = true;
        subjectParts.unshift(token);
      }
    }
    (caption.extraTags ?? []).forEach((tag) => {
      if (!tagParts.some((t) => t.toUpperCase() === tag.toUpperCase())) tagParts.push(tag);
    });
    tagParts = mergeCaption(tagParts, caption);
    return {
      subject: subjectParts.join(" ").replace(/,\s*$/, "").trim(),
      tags: tagParts.join(", "),
      printRun
    };
  }
  function parseCaptionSegments(raw) {
    const text = String(raw || "").replace(/\s+/g, " ").trim();
    if (!text) return [];
    const segments = [];
    text.split(";").forEach((piece) => {
      const part = piece.trim();
      if (!part) return;
      const match = part.match(CAPTION_SEGMENT);
      if (match) {
        segments.push({ tag: match[1].toUpperCase(), desc: part.slice(match[0].length).trim() });
      } else if (segments.length > 0) {
        segments[segments.length - 1].desc += `; ${part}`;
      } else {
        segments.push({ tag: null, desc: part });
      }
    });
    return segments.filter((s) => s.desc !== "" || s.tag);
  }
  function mergeCaption(tagParts, caption) {
    const segments = caption.segments ?? [];
    if (segments.length === 0) return tagParts;
    let tags = [...tagParts];
    segments.forEach(({ tag, desc }) => {
      if (!desc) return;
      if (tag) {
        const at = tags.findIndex((t) => t.toUpperCase() === tag);
        if (at >= 0) tags[at] = `${tag} (${desc})`;
        else tags.push(`${tag} (${desc})`);
        return;
      }
      const attached = tags.some((t) => DESCRIBABLE_TAG.test(t));
      if (!attached && !caption.variantCardNo) return;
      tags = tags.map((t) => DESCRIBABLE_TAG.test(t) ? `${t} (${desc})` : t);
      if (!tags.some((t) => t.includes(desc))) tags.push(`VAR (${desc})`);
    });
    return tags;
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
    const cardNo = cardNoLink.textContent.trim();
    let rawSubject = "";
    let segments = [];
    if (subjectTd) {
      const figcaptionEl = subjectTd.querySelector("figcaption, .figure-caption");
      if (figcaptionEl) segments = parseCaptionSegments(norm(figcaptionEl));
      const cloneTd = subjectTd.cloneNode(true);
      cloneTd.querySelectorAll("figcaption, .figure-caption").forEach((el) => el.remove());
      rawSubject = norm(cloneTd);
    }
    const variations = parseVariationPanel(row);
    const panelTags = [...new Set(variations.flatMap((v) => v.tags))];
    const { subject, tags, printRun } = parseSubjectCell(rawSubject, {
      segments,
      variantCardNo: VARIATION_CARD_NO.test(cardNo),
      extraTags: panelTags
    });
    return {
      cardNo,
      subject,
      tags,
      printRun,
      team: teamLink ? teamLink.textContent.trim() : "",
      variations: variations.map((v) => v.desc).filter(Boolean).join(" | ")
    };
  }
  function parseVariationPanel(row) {
    const toggle = row.querySelector('a[aria-controls], [data-bs-toggle="collapse"][aria-controls]');
    const panelId = toggle?.getAttribute("aria-controls");
    if (!panelId) return [];
    const panel = row.ownerDocument.getElementById(panelId);
    if (!panel) return [];
    return Array.from(panel.querySelectorAll("tr")).map((tr) => {
      const cells = Array.from(tr.querySelectorAll("td")).map((td) => norm(td)).filter((text) => text !== "" && text !== " ");
      const tags = [];
      const description = [];
      cells.forEach((text) => {
        if (TAG_CELL.test(text)) tags.push(...text.split(",").map((t) => t.trim()));
        else description.push(text);
      });
      return { tags, desc: description.join(" ") };
    }).filter((v) => v.tags.length > 0 || v.desc !== "");
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
        const yearStr = Utils.extractYear(h1Text);
        if (yearStr && h1Text.startsWith(yearStr)) {
          year = yearStr;
          baseSet = h1Text.slice(yearStr.length).trim();
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
      const tables = Array.from(mainContent.querySelectorAll("table")).filter((tbl) => {
        if (tbl.closest(".col-md-3, .col-md-4, nav, .navbar, #topnav, .ad-container, .banner-ad")) return false;
        if (tbl.classList.contains("checklist-table") || tbl.classList.contains("table-striped")) return true;
        return tbl.querySelector('a[href*="ViewCard.cfm"]') !== null;
      });
      tables.forEach((tbl) => {
        tbl.querySelectorAll("tr").forEach((row) => {
          const parsed = parseChecklistRow(row);
          if (parsed) rows.push(parsed);
        });
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
        r.team,
        r.variations ?? ""
      ])
    ];
  }

  // src/ui/status.js
  function setStatus(text, tooltipText = "", modulesList = []) {
    const status = document.getElementById("tk-status");
    if (!status) return;
    status.textContent = text;
    if (tooltipText) status.title = tooltipText;
    const titleEl = document.getElementById("tk-status-popover-title");
    const listEl = document.getElementById("tk-status-popover-list");
    if (titleEl && listEl) {
      const list = Array.isArray(modulesList) && modulesList.length > 0 ? modulesList : [];
      if (list.length > 0) {
        titleEl.textContent = `Active Modules (${list.length})`;
        listEl.innerHTML = list.map((m) => `<li>${Utils.escape.html(m)}</li>`).join("");
      } else {
        titleEl.textContent = "Status Details";
        listEl.innerHTML = `<li>${Utils.escape.html(text)}</li>`;
      }
    }
  }
  function enableAction(id) {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = false;
  }

  // src/ui/toast.js
  var TOAST_VARIANTS = {
    info: "var(--tk-teal)",
    success: "var(--tk-green)",
    warn: "var(--tk-accent)",
    error: "var(--tk-red)",
    progress: "var(--tk-blue)",
    muted: "var(--tk-text-muted)"
  };
  var STACK_LIMIT = 4;
  function containerFor(location) {
    const id = `tk-toast-container-${location}`;
    let container = document.getElementById(id);
    if (!container) {
      container = document.createElement("div");
      container.id = id;
      container.className = `tk-toast-container tk-toast-${location}`;
      container.setAttribute("aria-live", "polite");
      container.setAttribute("role", "status");
      document.body.appendChild(container);
    }
    return container;
  }
  function showToast({
    message = "",
    variant = "info",
    location = "bottom-right",
    duration = Config.global.toastDurationMs,
    accent
  } = {}) {
    const container = containerFor(location);
    const toasts = Array.from(container.querySelectorAll(".tk-toast-message"));
    const stackLimit = Config.global?.toastStackLimit ?? STACK_LIMIT;
    while (toasts.length >= stackLimit) {
      const oldest = toasts.shift();
      oldest.remove();
    }
    const toast = document.createElement("div");
    toast.className = "tk-toast-message";
    toast.style.borderLeftColor = accent ?? TOAST_VARIANTS[variant] ?? TOAST_VARIANTS.info;
    toast.innerHTML = message;
    const widget = container.querySelector(".sctk-qty-counter");
    if (widget) {
      container.insertBefore(toast, widget);
    } else {
      container.appendChild(toast);
    }
    setTimeout(() => toast.classList.add("tk-toast-show"), 10);
    if (duration !== Infinity) scheduleDismiss(toast, container, duration);
    return toast;
  }
  function scheduleDismiss(toast, container, delay) {
    setTimeout(() => {
      toast.classList.remove("tk-toast-show");
      setTimeout(() => {
        toast.remove();
        if (container.children.length === 0) container.remove();
      }, 300);
    }, delay);
  }
  function showProgressToast({ title = "Working", onCancel = null } = {}) {
    const toast = showToast({ variant: "progress", duration: Infinity, message: "" });
    const heading = document.createElement("b");
    heading.textContent = title;
    const detail = document.createElement("div");
    detail.className = "tk-toast-detail";
    toast.append(heading, detail);
    if (onCancel) {
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "tk-toast-cancel";
      cancel.textContent = "Cancel";
      cancel.addEventListener("click", () => {
        cancel.disabled = true;
        onCancel();
      });
      toast.appendChild(cancel);
    }
    return {
      update: (message) => {
        detail.textContent = message;
      },
      finish: (message, variant = "success") => {
        detail.textContent = message;
        toast.querySelector(".tk-toast-cancel")?.remove();
        toast.style.borderLeftColor = TOAST_VARIANTS[variant] ?? TOAST_VARIANTS.info;
        scheduleDismiss(toast, toast.parentElement, Config.global.toastDurationMs);
      }
    };
  }

  // src/net/cache.js
  var CACHE_KEY = "tk_export_cache_v1";
  var MAX_ENTRIES = 20;
  var MAX_ROWS = 2e4;
  function readAll() {
    const raw = getValue(CACHE_KEY, {});
    return raw && typeof raw === "object" ? raw : {};
  }
  function prune(entries, ttlMs2, now) {
    const maxEntries = Config.global?.exportCacheMaxEntries ?? MAX_ENTRIES;
    const live = Object.entries(entries).filter(([, entry]) => entry && typeof entry.ts === "number" && now - entry.ts < ttlMs2).sort(([, a], [, b]) => b.ts - a.ts).slice(0, maxEntries);
    return Object.fromEntries(live);
  }
  var ttlMs = (ttlHours) => ttlHours * 36e5;
  function read(sid, ttlHours, now = Date.now()) {
    if (ttlHours <= 0) return null;
    const entry = readAll()[sid];
    if (!entry || typeof entry.ts !== "number") return null;
    if (now - entry.ts >= ttlMs(ttlHours)) return null;
    return entry.payload;
  }
  function write(sid, payload, ttlHours, now = Date.now()) {
    if (ttlHours <= 0) return false;
    const maxRows = Config.global?.exportCacheMaxRows ?? MAX_ROWS;
    if (payload.rows.length > maxRows) {
      Log(`Export of ${payload.rows.length} rows exceeds the cache limit (${maxRows}) — not cached.`, "debug");
      return false;
    }
    const entries = prune(readAll(), ttlMs(ttlHours), now);
    entries[sid] = { ts: now, payload };
    setValue(CACHE_KEY, prune(entries, ttlMs(ttlHours), now));
    return true;
  }
  function stats(ttlHours, now = Date.now()) {
    const entries = ttlHours > 0 ? prune(readAll(), ttlMs(ttlHours), now) : {};
    const values = Object.values(entries);
    return {
      sets: values.length,
      rows: values.reduce((total, e) => total + (e.payload?.rows?.length ?? 0), 0)
    };
  }
  function clear() {
    setValue(CACHE_KEY, {});
    Log("Export cache cleared.", "info");
  }

  // src/net/blockDetect.js
  var BLOCK_MARKERS = [
    "g-recaptcha",
    "cf-browser-verification",
    "cf-challenge",
    "__cf_chl",
    "challenge-platform",
    "Just a moment",
    "hcaptcha",
    "h-captcha"
  ];
  var DENIAL_HEADINGS = [
    /<title[^>]*>[^<]*\b(access denied|forbidden|blocked|rate limited)\b/i,
    /<h1[^>]*>\s*(access denied|forbidden|blocked|rate limited)\b/i
  ];
  var BLOCK_STATUSES = [401, 403];
  function detectBlock(html) {
    if (!html) return null;
    const marker = BLOCK_MARKERS.find((m) => html.includes(m));
    if (marker) return marker;
    const denial = DENIAL_HEADINGS.find((re) => re.test(html));
    return denial ? "denial page heading" : null;
  }
  function isBlockedStatus(status) {
    return BLOCK_STATUSES.includes(status);
  }

  // src/net/pacing.js
  var PENALTY_STEP_MS = 500;
  var PENALTY_CAP_MS = 8e3;
  var RELIEF_STEP_MS = 100;
  var SAMPLE_WINDOW = 10;
  var SLOW_RESPONSE_MS = 4e3;
  function median(values) {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }
  function nextPenalty(current, signal) {
    const step = Config.global?.pacingPenaltyStepMs ?? PENALTY_STEP_MS;
    const cap = Config.global?.pacingPenaltyCapMs ?? PENALTY_CAP_MS;
    const relief = Config.global?.pacingReliefStepMs ?? RELIEF_STEP_MS;
    if (signal === "throttled" || signal === "slow") {
      return Math.min(current + step, cap);
    }
    return Math.max(current - relief, 0);
  }
  var Pacing = {
    penaltyMs: 0,
    /** Latency of the most recent response in ms. */
    lastLatencyMs: 0,
    /** @type {number[]} */
    samples: [],
    reset() {
      Pacing.penaltyMs = 0;
      Pacing.lastLatencyMs = 0;
      Pacing.samples = [];
    },
    /**
     * Record a completed response.
     *
     * @param {number} latencyMs
     * @param {boolean} [throttled] true when the response was an HTTP 429/503
     */
    record(latencyMs, throttled = false) {
      const sampleWindow = Config.global?.pacingSampleWindow ?? SAMPLE_WINDOW;
      Pacing.lastLatencyMs = latencyMs;
      Pacing.samples.push(latencyMs);
      if (Pacing.samples.length > sampleWindow) Pacing.samples.shift();
      const slowThreshold = Config.global?.pacingSlowResponseMs ?? SLOW_RESPONSE_MS;
      const signal = throttled ? "throttled" : median(Pacing.samples) > slowThreshold ? "slow" : "ok";
      Pacing.penaltyMs = nextPenalty(Pacing.penaltyMs, signal);
      return signal;
    },
    /** Raise the penalty without a latency sample, for a signal that is not a response. */
    penalize() {
      Pacing.penaltyMs = nextPenalty(Pacing.penaltyMs, "throttled");
    },
    /** @returns {number} rolling median latency in ms */
    medianLatencyMs: () => median(Pacing.samples),
    /**
     * Human-readable pacing state for the status readout, so a slowdown is
     * visible rather than mysterious.
     *
     * @returns {string} empty when pacing is nominal
     */
    describe: () => Pacing.penaltyMs > 0 ? ` (pacing +${Pacing.penaltyMs}ms)` : ""
  };

  // src/net/throttle.js
  var LAST_REQUEST_KEY = "tk_last_request_ts";
  var MAX_SLICE_MS = 250;
  function computeSlotWait(lastTs, intervalMs, now) {
    if (!lastTs || lastTs > now) return lastTs > now ? intervalMs : 0;
    const elapsed = now - lastTs;
    return elapsed >= intervalMs ? 0 : intervalMs - elapsed;
  }
  async function waitForSlot(intervalMs, deps = {}) {
    const {
      now = () => Date.now(),
      sleep: sleep2 = (ms) => new Promise((r) => setTimeout(r, ms)),
      read: read2 = () => getValue(LAST_REQUEST_KEY, 0),
      write: write2 = (ts) => setValue(LAST_REQUEST_KEY, ts),
      jitter = deps.jitter ?? (deps.now || deps.sleep ? () => 0 : () => Math.floor(20 + Math.random() * 60))
    } = deps;
    let waited = 0;
    for (; ; ) {
      const current = now();
      const wait = computeSlotWait(read2(), intervalMs, current);
      if (wait === 0) {
        const offset = jitter();
        if (offset > 0) {
          await sleep2(offset);
          waited += offset;
          const recheckNow = now();
          if (computeSlotWait(read2(), intervalMs, recheckNow) > 0) {
            continue;
          }
        }
        const claimTs = now();
        write2(claimTs);
        return waited;
      }
      const maxSlice = Config.global?.throttleMaxSliceMs ?? MAX_SLICE_MS;
      const slice = Math.min(wait, maxSlice);
      await sleep2(slice);
      waited += slice;
    }
  }

  // src/net/fetcher.js
  var THROTTLE_STATUSES = [429, 503];
  var AbortedError = class extends Error {
    /** @param {string} message @param {boolean} byUser */
    constructor(message, byUser) {
      super(message);
      this.name = "AbortedError";
      this.byUser = byUser;
    }
  };
  var BlockedError = class extends Error {
    constructor(message) {
      super(message);
      this.name = "BlockedError";
    }
  };
  var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  function currentDelayMs() {
    return EXPORT_CONFIG.baseDelayMs + Pacing.penaltyMs + Math.random() * EXPORT_CONFIG.jitterMaxMs;
  }
  function jitteredDelay() {
    return sleep(currentDelayMs());
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
  function interruptibleSleep(ms, signal) {
    if (!signal) return sleep(ms);
    if (signal.aborted) return Promise.resolve();
    return new Promise((resolve) => {
      const timer = setTimeout(finish, ms);
      function finish() {
        clearTimeout(timer);
        signal.removeEventListener("abort", finish);
        resolve();
      }
      signal.addEventListener("abort", finish, { once: true });
    });
  }
  async function timedFetch(url, runSignal) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort("timeout"), EXPORT_CONFIG.requestTimeoutMs);
    const forward = () => controller.abort("cancelled");
    if (runSignal) {
      if (runSignal.aborted) throw new AbortedError("Export cancelled.", true);
      runSignal.addEventListener("abort", forward, { once: true });
    }
    const startedAt = Date.now();
    try {
      return await fetch(url, { signal: controller.signal });
    } catch (error) {
      if (error.name === "AbortError") {
        throw runSignal?.aborted ? new AbortedError("Export cancelled.", true) : new AbortedError(
          `Request timed out after ${Math.round(EXPORT_CONFIG.requestTimeoutMs / 1e3)}s for ${Utils.toFullUrl(url)}.`,
          false
        );
      }
      throw error;
    } finally {
      clearTimeout(timeout);
      runSignal?.removeEventListener("abort", forward);
      Pacing.lastLatencyMs = Date.now() - startedAt;
    }
  }
  async function fetchPageWithRetry(fetchUrl, pageIndex, { onStatus = () => {
  }, signal } = {}) {
    const fullUrl = Utils.toFullUrl(fetchUrl);
    let attempt = 0;
    for (; ; ) {
      attempt++;
      if (signal?.aborted) throw new AbortedError("Export cancelled.", true);
      const slotWaitMs = EXPORT_CONFIG.baseDelayMs + Pacing.penaltyMs;
      Log(`Reserving request slot for ${Utils.formatLogUrl(fullUrl)} (base delay ${EXPORT_CONFIG.baseDelayMs}ms, pacing penalty ${Pacing.penaltyMs}ms)...`, "debug", "client");
      await waitForSlot(slotWaitMs);
      let response;
      try {
        response = await timedFetch(fullUrl, signal);
      } catch (error) {
        if (error instanceof AbortedError) throw error;
        if (attempt > EXPORT_CONFIG.maxRetries) {
          throw new Error(
            `Network error fetching page ${pageIndex} (${fullUrl}) after ${attempt - 1} retries: ${error.message}`
          );
        }
        const backoff = computeBackoff(attempt, EXPORT_CONFIG.backoffBaseMs, EXPORT_CONFIG.backoffCapMs);
        Log(`Network error on page ${pageIndex} (${fullUrl}) (attempt ${attempt}): ${error.message}. Retrying in ${backoff}ms.`, "warn", "server");
        await interruptibleSleep(backoff, signal);
        continue;
      }
      if (isBlockedStatus(response.status)) {
        Pacing.penalize();
        throw new BlockedError(`Server refused the request for ${fullUrl} (HTTP ${response.status}).`);
      }
      if (THROTTLE_STATUSES.includes(response.status)) {
        Pacing.record(Pacing.lastLatencyMs ?? 0, true);
        if (attempt > EXPORT_CONFIG.maxRetries) {
          throw new Error(
            `Server rate limit persisted on page ${pageIndex} (${fullUrl}) after ${attempt - 1} retries (HTTP ${response.status}).`
          );
        }
        let backoff = parseRetryAfter(response.headers.get("Retry-After"));
        if (backoff <= 0) {
          backoff = computeBackoff(attempt, EXPORT_CONFIG.backoffBaseMs, EXPORT_CONFIG.backoffCapMs);
        }
        Log(`HTTP ${response.status} rate limit on page ${pageIndex} (${fullUrl}) (attempt ${attempt}). Backing off ${backoff}ms.`, "warn", "server");
        onStatus(`Throttled — retrying in ${Math.round(backoff / 1e3)}s...`);
        await interruptibleSleep(backoff, signal);
        continue;
      }
      if (!response.ok) {
        throw new Error(`Server returned status HTTP ${response.status} on page ${pageIndex} for ${fullUrl}`);
      }
      Pacing.record(Pacing.lastLatencyMs ?? 0, false);
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
        Log(`[CLIENT] Export job queued behind ${position - 1} pending job(s): '${label}' (Queue position: #${position})`, "info", "client");
        showToast({
          message: `Queued: <b>${Utils.escape.html(label)}</b> (position ${position})`,
          variant: "muted"
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
      const remaining = ExportQueue.queue.length;
      Log(`[CLIENT] Export job starting: '${label}' (${remaining} job(s) remaining in queue)`, "info", "client");
      try {
        await task();
      } catch (error) {
        Log(`[CLIENT] Export job threw uncaught error for '${label}': ${error.message}`, "error", "client");
      }
      ExportQueue.processNext();
    }
  };

  // src/net/setExport.js
  var CurrentRun = {
    /** @type {AbortController|null} */
    controller: null,
    /** @type {(() => void)|null} set by the toolbar to show/hide its Cancel button */
    onStart: null,
    /** @type {(() => void)|null} */
    onEnd: null
  };
  function cancelCurrentExport() {
    if (!CurrentRun.controller) return false;
    Log("Export cancelled by user.", "info");
    CurrentRun.controller.abort();
    return true;
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
  function recordBlock(detail, targetUrl = "") {
    setValue(BLOCK_TS_KEY, Date.now());
    const fullUrl = targetUrl ? Utils.toFullUrl(targetUrl) : "";
    const urlLabel = fullUrl ? ` for ${fullUrl}` : "";
    Log(`Anti-scraping block detected${urlLabel} (${detail}). Cooldown started.`, "warn", "server");
  }
  function exportSetCSV(setId, setName) {
    const fullUrl = Utils.toFullUrl(`/Checklist.cfm/sid/${setId}/`);
    Log(`[CLIENT] Checklist CSV Export queued for set ID ${setId} (${setName}) — ${fullUrl}`, "debug", "client");
    ExportQueue.enqueue(setName || `Set ${setId}`, () => runExportSetCSV(setId, setName));
  }
  function downloadResult({ identity, rows }, fallbackLabel) {
    const filename = buildExportFilename({
      year: identity.year,
      baseSet: identity.baseSet,
      setName: identity.setName,
      fallbackLabel,
      kind: "checklist"
    });
    CSV.download(CSV.toCSV(toChecklistTable(identity, rows)), filename);
    return filename;
  }
  async function fetchAllPages(setId, signal, progress) {
    let pageIndex = 1;
    let totalPages = 1;
    let totalDiscoveredPages = 1;
    let identity = { year: "", baseSet: "", setName: "" };
    const rows = [];
    try {
      do {
        if (signal.aborted) throw new AbortedError("Export cancelled.", true);
        if (pageIndex > 1) await jitteredDelay();
        const fetchUrl = `/Checklist.cfm/sid/${setId}/?PageIndex=${pageIndex}`;
        const fullFetchUrl = Utils.toFullUrl(fetchUrl);
        fetchAllPages.lastRequestedUrl = fullFetchUrl;
        const label = `Page ${pageIndex}${totalPages > 1 ? " of " + totalPages : ""}${Pacing.describe()}`;
        setStatus(`Fetching ${label}...`);
        progress?.update(label);
        Log(`HTTP GET Request -> ${fullFetchUrl}`, "info", "server");
        const response = await fetchPageWithRetry(fetchUrl, pageIndex, { onStatus: setStatus, signal });
        const html = await response.text();
        Log(
          `[CLIENT] HTTP ${response.status} response received for ${fullFetchUrl} (${Math.round(html.length / 1024)} KB, latency ${Pacing.lastLatencyMs || 0}ms)`,
          "debug",
          "client"
        );
        const blockMarker = detectBlock(html);
        if (blockMarker) {
          throw new BlockedError(`Challenge page received instead of content (matched '${blockMarker}').`);
        }
        const doc = new DOMParser().parseFromString(html, "text/html");
        const parsed = parseChecklistDocument(doc);
        if (pageIndex === 1) {
          identity = { year: parsed.year, baseSet: parsed.baseSet, setName: parsed.setName };
          totalDiscoveredPages = parsed.totalPages;
          if (totalDiscoveredPages > EXPORT_CONFIG.maxPages) {
            totalPages = EXPORT_CONFIG.maxPages;
            const cappedStatus = `Export capped at ${EXPORT_CONFIG.maxPages} pages (Set has ${totalDiscoveredPages})`;
            setStatus(cappedStatus);
            Log(
              `[CLIENT] Discovered page count (${totalDiscoveredPages}) for ${fullFetchUrl} exceeds safety ceiling (${EXPORT_CONFIG.maxPages}). Capping fetch to ${EXPORT_CONFIG.maxPages} pages.`,
              "warn",
              "client"
            );
            showToast({
              message: `Set has <b>${totalDiscoveredPages}</b> pages, exceeding max limit (${EXPORT_CONFIG.maxPages}). Exporting first ${EXPORT_CONFIG.maxPages} pages only.`,
              variant: "warn"
            });
          } else {
            totalPages = totalDiscoveredPages;
            Log(`[CLIENT] Discovered ${totalPages} total page(s) for set ID ${setId} (${fullFetchUrl})`, "info", "client");
          }
        }
        rows.push(...parsed.rows);
        Log(`[CLIENT] Page ${pageIndex}/${totalPages} parsed successfully for ${fullFetchUrl}. ${parsed.rows.length} rows retrieved (Total accumulated: ${rows.length}).`, "info", "client");
        pageIndex++;
      } while (pageIndex <= totalPages);
    } catch (error) {
      if (error instanceof AbortedError && rows.length > 0) {
        Log(`[CLIENT] Fetch loop aborted. Delivering ${rows.length} partially extracted rows.`, "warn", "client");
        return { identity, rows, totalPages, totalDiscoveredPages, isPartial: true, originalError: error };
      }
      throw error;
    }
    return { identity, rows, totalPages, totalDiscoveredPages };
  }
  async function runExportSetCSV(setId, setName) {
    const fullTargetUrl = Utils.toFullUrl(`/Checklist.cfm/sid/${setId}/`);
    Log(`[CLIENT] Step 1/4: Checking anti-scraping cooldown status for ${fullTargetUrl}...`, "debug", "client");
    const remainingMin = cooldownRemainingMinutes();
    if (remainingMin > 0) {
      Log(`Export refused: anti-scraping cooldown active (${remainingMin} min remaining) for ${fullTargetUrl}.`, "warn", "client");
      setStatus("Export blocked (cooldown)");
      showToast({
        message: `Export paused — an anti-scraping block was detected recently. Try again in ~${remainingMin} min, or adjust the cooldown in Settings.`,
        variant: "error"
      });
      return;
    }
    Log(`[CLIENT] Cooldown check passed for ${fullTargetUrl}.`, "debug", "client");
    Log(`[CLIENT] Step 2/4: Checking export cache for ${fullTargetUrl}...`, "debug", "client");
    const ttlHours = Config.global.exportCacheTtlHours;
    const cached = read(setId, ttlHours);
    if (cached) {
      const filename = downloadResult(cached, setName);
      Log(`Export served from cache for ${fullTargetUrl}: ${filename} (${cached.rows.length} rows, 0 network requests).`, "info", "client");
      setStatus("Export Complete (cached)");
      showToast({
        message: `Exported <b>${cached.rows.length}</b> cards from cache — no requests made.`,
        variant: "success"
      });
      return;
    }
    Log(`[CLIENT] Cache miss for ${fullTargetUrl}. Initializing network fetch...`, "debug", "client");
    Log(`[CLIENT] Step 3/4: Starting checklist fetch for set ID ${setId} (${setName}) at ${fullTargetUrl}...`, "info", "client");
    const controller = new AbortController();
    CurrentRun.controller = controller;
    CurrentRun.onStart?.();
    setStatus(`Fetching ${setName}...`);
    const progress = showProgressToast({
      title: `Exporting ${setName}`,
      onCancel: () => cancelCurrentExport()
    });
    try {
      const result = await fetchAllPages(setId, controller.signal, progress);
      if (result.rows.length === 0) throw new Error(`No valid checklist rows identified within tables at ${fullTargetUrl}.`);
      let label = result.identity.baseSet;
      if (result.identity.setName) label += ` - ${result.identity.setName}`;
      Log(
        `[CLIENT] Step 4/4: Export complete for ${fullTargetUrl}: ${label} (${result.rows.length} cards across ${result.totalPages} page(s), median latency ${Math.round(Pacing.medianLatencyMs())}ms)`,
        "info",
        "client"
      );
      write(setId, result, ttlHours);
      const filename = downloadResult(result, setName);
      Log(`[CLIENT] CSV file generated and download triggered: ${filename} (${result.rows.length} rows).`, "info", "client");
      if (result.isPartial) {
        setStatus("Export cancelled (partial delivered)");
        progress.finish(`Cancelled — ${result.rows.length} cards downloaded.`, "warning");
        return;
      }
      if (result.totalDiscoveredPages > EXPORT_CONFIG.maxPages) {
        const cappedStatus = `Export capped at ${EXPORT_CONFIG.maxPages} pages (Set has ${result.totalDiscoveredPages})`;
        setStatus(cappedStatus);
        progress.finish(`${result.rows.length} cards exported (capped at ${EXPORT_CONFIG.maxPages} pages).`, "warning");
      } else {
        setStatus("Export Complete");
        progress.finish(`${result.rows.length} cards exported.`, "success");
      }
    } catch (error) {
      if (error instanceof BlockedError) {
        const lastUrl = fetchAllPages.lastRequestedUrl || fullTargetUrl;
        recordBlock(error.message, lastUrl);
        progress.finish("Stopped — the site returned a challenge.", "error");
        setStatus("Export blocked");
      } else if (error instanceof AbortedError) {
        Log(`Export stopped for ${fullTargetUrl}: ${error.message}`, error.byUser ? "info" : "warn", "client");
        progress.finish(error.byUser ? "Cancelled." : "Timed out.", error.byUser ? "muted" : "error");
        setStatus(error.byUser ? "Export cancelled" : "Export timed out");
      } else {
        Log(`CSV Export Failed for ${fullTargetUrl}: ${error.message}`, "error", "client");
        progress.finish(`Failed: ${error.message}`, "error");
        setStatus("Export Failed");
      }
    } finally {
      CurrentRun.controller = null;
      CurrentRun.onEnd?.();
    }
  }

  // src/ui/badges.js
  var BADGES = {
    CHECKLIST: {
      icon: "list",
      text: "CHK",
      cssClass: "tk-badge-link-c",
      title: "View Set Checklist",
      getUrl: (sid) => `/Checklist.cfm/sid/${sid}`
    },
    INSERTS: {
      icon: "bolt",
      text: "INS",
      cssClass: "tk-badge-link-i",
      title: "View Insert Sets",
      getUrl: (sid, parentSid) => `/Inserts.cfm/sid/${parentSid || sid}/#InsertSets`
    },
    PARALLELS: {
      icon: "gem",
      text: "PAR",
      cssClass: "tk-badge-link-p",
      title: "View Parallel Sets",
      getUrl: (sid, parentSid) => `/Inserts.cfm/sid/${parentSid || sid}/#ParallelSets`
    },
    FOR_SALE: {
      icon: "tag",
      text: "FS",
      cssClass: "tk-badge-link-fs",
      title: "Add For Sale / For Trade Items",
      getUrl: (sid) => `/ViewCollectionForSaleTrade.cfm/sid/${sid}`
    },
    MULTI: {
      icon: "layers",
      text: "MULTI",
      cssClass: "tk-badge-link-fsm",
      title: "Add For Sale / For Trade Items",
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
    },
    HIERARCHY: {
      icon: "downloadHierarchy",
      text: "HIERARCHY",
      cssClass: "tk-badge-action-h",
      title: "Export Set Hierarchy"
    }
  };
  var SHORTCUT_KEYS = ["CHECKLIST", "INSERTS", "PARALLELS", "FOR_SALE", "MULTI", "WANTLIST"];
  var TOOLBAR_BADGES = ["CHECKLIST", "INSERTS", "PARALLELS", "FOR_SALE", "MULTI", "WANTLIST", "CSV", "HIERARCHY"];
  var SET_LINK_BADGES = ["CHECKLIST", "PIN", "CSV", "HIERARCHY", "INSERTS", "PARALLELS", "FOR_SALE", "MULTI", "WANTLIST"];
  function getToolbarBadges() {
    const cfg = Config.global?.toolbarBadges;
    if (!Array.isArray(cfg) || cfg.length === 0) return TOOLBAR_BADGES;
    return cfg.filter((b) => b.enabled !== false).map((b) => b.key);
  }
  function getSetLinkBadges() {
    const cfg = Config.global?.setLinkBadges;
    if (!Array.isArray(cfg) || cfg.length === 0) return SET_LINK_BADGES;
    return cfg.filter((b) => b.enabled !== false).map((b) => b.key);
  }
  function createBadge(badgeKey, sid = null, onClickOverride = null, displayMode = "both", parentSid = null) {
    const config = BADGES[badgeKey];
    if (!config) return null;
    const showIcon = displayMode === "both" || displayMode === "icon";
    const showText = (displayMode === "both" || displayMode === "text") && !!config.text;
    const actualShowIcon = showIcon || !showText && !config.text;
    const iconSvg = actualShowIcon ? icon(config.icon) : "";
    const textSpan = showText ? `<span class="tk-badge-label">${config.text}</span>` : "";
    const inner = `${iconSvg}${textSpan}`;
    if (config.getUrl && !onClickOverride) {
      const link = document.createElement("a");
      link.href = config.getUrl(sid, parentSid);
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
  function renderBadgeSet(container, sid, {
    include = TOOLBAR_BADGES,
    onExport = null,
    onExportHierarchy = null,
    onPin = null,
    displayMode = "both",
    parentSid = null
  } = {}) {
    const handlers = { CSV: onExport, PIN: onPin, HIERARCHY: onExportHierarchy };
    include.forEach((key) => {
      const isAction = key in handlers;
      if (isAction && !handlers[key]) return;
      const badge = createBadge(key, sid, isAction ? handlers[key] : null, displayMode, parentSid);
      if (badge) container.appendChild(badge);
    });
    return container;
  }

  // src/data/setHierarchyParser.js
  function parseViewAllSets(doc, year) {
    const parentSets = [];
    const h3Elements = doc.querySelectorAll("h3.site");
    h3Elements.forEach((h3) => {
      if (h3.classList.contains("bottomnav") || h3.closest(".bottomnav") || h3.closest("footer") || h3.closest("#footer")) {
        return;
      }
      const categoryName = h3.textContent.trim();
      let next = h3.nextElementSibling;
      while (next && next.tagName !== "UL" && next.tagName !== "H3") {
        next = next.nextElementSibling;
      }
      if (next && next.tagName === "UL") {
        const liElements = next.querySelectorAll("li");
        liElements.forEach((li) => {
          const primaryAnchor = li.querySelector('a[href*="/sid/"]');
          if (!primaryAnchor) return;
          const href = primaryAnchor.getAttribute("href") || "";
          const setId = extractSid(href);
          if (!setId) return;
          let setName = primaryAnchor.textContent.trim();
          const yearRegex = new RegExp(`^${year}\\s+`);
          setName = setName.replace(yearRegex, "").trim();
          const nextEl = li.nextElementSibling;
          const hasHideDiv = !!(nextEl && nextEl.tagName === "DIV" && nextEl.id.startsWith("hideDiv"));
          parentSets.push({
            category: categoryName,
            setId,
            setName,
            hasHideDiv
          });
        });
      }
    });
    return parentSets;
  }
  function parseChildSets(doc) {
    const childSets = [];
    const h3Elements = doc.querySelectorAll("h3.site");
    h3Elements.forEach((h3) => {
      if (h3.classList.contains("bottomnav") || h3.closest(".bottomnav") || h3.closest("footer") || h3.closest("#footer")) {
        return;
      }
      const categoryName = h3.textContent.trim().replace(/\s*\(\d+\)$/, "");
      if (categoryName.toLowerCase() === "inserts") {
        return;
      }
      const insideTable = h3.closest("table");
      const startElement = insideTable || h3;
      let next = startElement.nextElementSibling;
      let table = null;
      while (next) {
        if (next.tagName === "TABLE") {
          table = next;
          break;
        }
        if (next.querySelector("h3.site") || next.tagName === "H3") {
          break;
        }
        next = next.nextElementSibling;
      }
      if (table) {
        const rows = table.querySelectorAll("tr");
        rows.forEach((tr) => {
          const anchors = Array.from(tr.querySelectorAll('a[href*="/sid/"]'));
          const setAnchor = anchors.find((a) => {
            const href = a.getAttribute("href") || "";
            const text = a.textContent.trim();
            return text.length > 0 && extractSid(href) && (href.includes("/Checklist.cfm/") || href.includes("/ViewSet.cfm/") || href.includes("Checklist.cfm?") || href.includes("ViewSet.cfm?"));
          });
          if (setAnchor) {
            const href = setAnchor.getAttribute("href") || "";
            const childSetId = extractSid(href);
            const childSetName = setAnchor.textContent.trim();
            const figcaptionEl = tr.querySelector("figcaption.figure-caption") || tr.querySelector("figcaption");
            const childSetNotes = figcaptionEl ? figcaptionEl.textContent.trim() : "";
            if (childSetId) {
              childSets.push({
                childCategory: categoryName,
                childSetId,
                childSetName,
                childSetNotes
              });
            }
          }
        });
      }
    });
    return childSets;
  }

  // src/net/setHierarchyExport.js
  function exportSetHierarchyCSV(url) {
    Log(`[CLIENT] Set Hierarchy CSV Export queued for URL: ${url}`, "debug", "client");
    ExportQueue.enqueue("Set Hierarchy Export", () => runExportSetHierarchyCSV(url));
  }
  async function runExportSetHierarchyCSV(url) {
    const remainingMin = cooldownRemainingMinutes();
    if (remainingMin > 0) {
      Log(`Export refused: anti-scraping cooldown active (${remainingMin} min remaining).`, "warn", "client");
      setStatus("Export blocked (cooldown)");
      showToast({
        message: `Export paused — an anti-scraping block was detected recently. Try again in ~${remainingMin} min.`,
        variant: "error"
      });
      return;
    }
    const sportMatch = url.match(/\/sp\/([^/]+)/i);
    const yearMatch = url.match(/\/year\/([^/]+)/i);
    if (!sportMatch || !yearMatch) {
      Log(`Failed to parse Sport and Year from URL: ${url}`, "error", "client");
      setStatus("Export Failed");
      showToast({ message: "Failed to parse Sport and Year from current URL.", variant: "error" });
      return;
    }
    const rawSport = decodeURIComponent(sportMatch[1]);
    const sport = rawSport.charAt(0).toUpperCase() + rawSport.slice(1);
    const year = decodeURIComponent(yearMatch[1]);
    setStatus("Parsing parent sets...");
    const parentSets = parseViewAllSets(document, year);
    if (parentSets.length === 0) {
      setStatus("No parent sets found");
      showToast({ message: "No parent sets matching hierarchy requirements found on this page.", variant: "warn" });
      return;
    }
    Log(`[CLIENT] Extracted ${parentSets.length} parent set(s) from current page`, "info", "client");
    const controller = new AbortController();
    CurrentRun.controller = controller;
    CurrentRun.onStart?.();
    const progress = showProgressToast({
      title: "Exporting Set Hierarchy",
      onCancel: () => {
        controller.abort();
      }
    });
    const csvRows = [
      ["Sport", "Year", "Set Category", "Set ID", "Set Name", "Child Set Category", "Child Set ID", "Child Set Name", "Child Set Notes", "Full Set Name", "Full Set Name (Trunc)"]
    ];
    let isPartial = false;
    let networkRequestsMade = 0;
    try {
      for (let i = 0; i < parentSets.length; i++) {
        if (controller.signal.aborted) {
          throw new AbortedError("Export cancelled.", true);
        }
        const parent = parentSets[i];
        const parentLabel = `Parent ${i + 1}/${parentSets.length}: ${parent.setName}`;
        setStatus(`Processing ${parent.setName}...`);
        progress.update(parentLabel);
        const parentLogMsg = `Processing Parent Set [${i + 1}/${parentSets.length}]: ${parent.setName} (ID: ${parent.setId})`;
        Log(parentLogMsg, "info");
        if (!parent.hasHideDiv) {
          const fullName = buildFullSetName(year, parent.setName, "");
          const fullNameTrunc = buildFullSetNameTrunc(year, parent.setName, "");
          csvRows.push([sport, year, parent.category, parent.setId, parent.setName, "", "", "", "", fullName, fullNameTrunc]);
          continue;
        }
        if (networkRequestsMade > 0) {
          const min = EXPORT_CONFIG.hierarchyMinDelayMs ?? 1e4;
          const max = Math.max(min, EXPORT_CONFIG.hierarchyMaxDelayMs ?? 15e3);
          let sleepMs = 0;
          if (parentSets.length > 50) {
            if (networkRequestsMade % 15 === 0) {
              const longPauseMinMs = 3e5;
              const longPauseMaxMs = 42e4;
              sleepMs = longPauseMinMs + Math.random() * (longPauseMaxMs - longPauseMinMs);
              const longPauseMinText = Math.round(sleepMs / 1e3 / 60);
              const logMsg = `Pacing safeguard: Triggering a long pause of ${longPauseMinText} minutes to prevent rate-limiting...`;
              Log(logMsg, "warn");
              setStatus(`Pausing for ${longPauseMinText} min...`);
              progress.update(`Pause (${longPauseMinText}m)`);
            } else {
              const scale = 1 + networkRequestsMade * 0.02;
              const scaledMin = min * scale;
              const scaledMax = max * scale;
              sleepMs = scaledMin + Math.random() * (scaledMax - scaledMin);
              Log(`[CLIENT] Scaled pacing: Sleeping ${Math.round(sleepMs / 1e3)} seconds (scale: ${scale.toFixed(2)}x)...`, "debug", "client");
            }
          } else {
            sleepMs = min + Math.random() * (max - min);
            Log(`[CLIENT] Sleeping ${Math.round(sleepMs / 1e3)} seconds before next parent set request...`, "debug", "client");
          }
          await interruptibleSleep(sleepMs, controller.signal);
        }
        networkRequestsMade++;
        const fetchUrl = `/Inserts.cfm/sid/${parent.setId}/`;
        const fullFetchUrl = Utils.toFullUrl(fetchUrl);
        Log(`HTTP GET Request -> ${fullFetchUrl}`, "info", "server");
        try {
          const response = await fetchPageWithRetry(fetchUrl, i + 1, { onStatus: setStatus, signal: controller.signal });
          const html = await response.text();
          Log(
            `[CLIENT] HTTP ${response.status} response received for ${fullFetchUrl} (${Math.round(html.length / 1024)} KB)`,
            "debug",
            "client"
          );
          const blockMarker = detectBlock(html);
          if (blockMarker) {
            throw new BlockedError(`Challenge page received instead of content (matched '${blockMarker}').`);
          }
          const doc = new DOMParser().parseFromString(html, "text/html");
          const childSets = parseChildSets(doc);
          const countLogMsg = `Found ${childSets.length} child sets on Inserts.cfm for Set ID ${parent.setId}`;
          Log(countLogMsg, "info");
          const fullNameBase = buildFullSetName(year, parent.setName, "");
          const fullNameTruncBase = buildFullSetNameTrunc(year, parent.setName, "");
          csvRows.push([sport, year, parent.category, parent.setId, parent.setName, "", "", "", "", fullNameBase, fullNameTruncBase]);
          childSets.forEach((child, j) => {
            const childLogMsg = `Processing Child Set [${j + 1}/${childSets.length}]: ${child.childSetName} (ID: ${child.childSetId})`;
            Log(childLogMsg, "debug", "client");
            const fullNameChild = buildFullSetName(year, parent.setName, child.childSetName);
            const fullNameTruncChild = buildFullSetNameTrunc(year, parent.setName, child.childSetName);
            csvRows.push([sport, year, parent.category, parent.setId, parent.setName, child.childCategory, child.childSetId, child.childSetName, child.childSetNotes || "", fullNameChild, fullNameTruncChild]);
          });
        } catch (err) {
          if (err instanceof AbortedError) {
            if (csvRows.length > 1) {
              isPartial = true;
              break;
            }
          }
          throw err;
        }
      }
      const filename = `${year}_${sport}_SetHierarchy.csv`;
      CSV.download(CSV.toCSV(csvRows), filename);
      setStatus("Export Complete");
      progress.finish(`${parentSets.length} sets exported successfully.`, "success");
    } catch (error) {
      if (isPartial || error instanceof AbortedError || controller.signal.aborted) {
        const filename = `${year}_${sport}_SetHierarchy.csv`;
        CSV.download(CSV.toCSV(csvRows), filename);
        setStatus("Export cancelled (partial delivered)");
        progress.finish(`Cancelled — ${csvRows.length - 1} records downloaded.`, "warning");
      } else if (error instanceof BlockedError) {
        const parentId = parentSets[networkRequestsMade - 1]?.setId || "";
        const lastUrl = `/Inserts.cfm/sid/${parentId}/`;
        recordBlock(error.message, lastUrl);
        if (csvRows.length > 1) {
          const filename = `${year}_${sport}_SetHierarchy.csv`;
          CSV.download(CSV.toCSV(csvRows), filename);
          setStatus("Export blocked (partial delivered)");
          progress.finish(`Blocked — ${csvRows.length - 1} records downloaded.`, "error");
        } else {
          progress.finish("Stopped — the site returned a challenge.", "error");
          setStatus("Export blocked");
        }
      } else {
        Log(`Set Hierarchy Export Failed: ${error.message}`, "error", "client");
        progress.finish(`Failed: ${error.message}`, "error");
        setStatus("Export Failed");
      }
    } finally {
      CurrentRun.controller = null;
      CurrentRun.onEnd?.();
    }
  }
  function buildFullSetName(year, setName, childSetName) {
    if (childSetName) {
      return `${year} ${setName} - ${childSetName}`;
    }
    return `${year} ${setName}`;
  }
  function buildFullSetNameTrunc(year, setName, childSetName) {
    const pName = setName || "";
    const cName = childSetName || "";
    if (pName.length >= 31) {
      const truncatedParent = pName.slice(0, 32).trimEnd();
      return `${year} ${truncatedParent}`;
    }
    if (cName) {
      const combined = `${pName} - ${cName}`;
      if (combined.length >= 30) {
        const truncatedCombined = combined.slice(0, 30).trimEnd();
        return `${year} ${truncatedCombined}`;
      }
      return `${year} ${combined}`;
    }
    return `${year} ${pName}`;
  }
  function resolveSportFromDocument() {
    const sportBreadcrumb = document.querySelector('ol.breadcrumb li a[href*="/sp/"]');
    if (sportBreadcrumb) {
      const match2 = sportBreadcrumb.getAttribute("href").match(/\/sp\/([^/]+)/i);
      if (match2) return decodeURIComponent(match2[1]);
      return sportBreadcrumb.textContent.trim();
    }
    const match = document.URL.match(/\/sp\/([^/]+)/i);
    if (match) return decodeURIComponent(match[1]);
    return "Misc";
  }
  function resolveYearFromDocument(setName) {
    const match = document.URL.match(/\/year\/([^/]+)/i);
    if (match) return decodeURIComponent(match[1]);
    const docTitle = document.title || "";
    const yearMatch = docTitle.match(/\b(18|19|20)\d{2}\b/) || setName.match(/\b(18|19|20)\d{2}\b/);
    if (yearMatch) return yearMatch[0];
    return "Misc";
  }
  function stripYearPrefix(setName, year) {
    if (!setName || !year) return setName;
    const yearRegex = new RegExp(`^${year}\\s+`);
    return setName.replace(yearRegex, "").trim();
  }
  function exportSingleParentSetHierarchy(setId, setName, options = {}) {
    const sport = options.sport || resolveSportFromDocument();
    const year = options.year || resolveYearFromDocument(setName);
    const cleanSetName = stripYearPrefix(setName, year);
    const category = options.category || "Major Releases";
    const hasHideDiv = options.hasHideDiv !== void 0 ? options.hasHideDiv : true;
    Log(`[CLIENT] Single Set Hierarchy CSV Export queued for Set ID: ${setId} (${cleanSetName})`, "debug", "client");
    ExportQueue.enqueue(
      `Set Hierarchy Export: ${cleanSetName}`,
      () => runExportSingleParentSetHierarchy(setId, cleanSetName, { sport, year, category, hasHideDiv })
    );
  }
  async function runExportSingleParentSetHierarchy(setId, setName, { sport, year, category, hasHideDiv }) {
    const remainingMin = cooldownRemainingMinutes();
    if (remainingMin > 0) {
      Log(`Export refused: anti-scraping cooldown active (${remainingMin} min remaining).`, "warn", "client");
      setStatus("Export blocked (cooldown)");
      showToast({
        message: `Export paused — an anti-scraping block was detected recently. Try again in ~${remainingMin} min.`,
        variant: "error"
      });
      return;
    }
    const controller = new AbortController();
    CurrentRun.controller = controller;
    CurrentRun.onStart?.();
    const progress = showProgressToast({
      title: "Exporting Set Hierarchy",
      onCancel: () => {
        controller.abort();
      }
    });
    const csvRows = [
      ["Sport", "Year", "Set Category", "Set ID", "Set Name", "Child Set Category", "Child Set ID", "Child Set Name", "Child Set Notes", "Full Set Name", "Full Set Name (Trunc)"]
    ];
    try {
      setStatus(`Processing ${setName}...`);
      progress.update(`Exporting ${setName}`);
      if (hasHideDiv === false) {
        const fullName = buildFullSetName(year, setName, "");
        const fullNameTrunc = buildFullSetNameTrunc(year, setName, "");
        csvRows.push([sport, year, category, setId, setName, "", "", "", "", fullName, fullNameTrunc]);
      } else {
        const fetchUrl = `/Inserts.cfm/sid/${setId}/`;
        const fullFetchUrl = Utils.toFullUrl(fetchUrl);
        Log(`HTTP GET Request -> ${fullFetchUrl}`, "info", "server");
        const response = await fetchPageWithRetry(fetchUrl, 1, { onStatus: setStatus, signal: controller.signal });
        const html = await response.text();
        const blockMarker = detectBlock(html);
        if (blockMarker) {
          throw new BlockedError(`Challenge page received instead of content (matched '${blockMarker}').`);
        }
        const doc = new DOMParser().parseFromString(html, "text/html");
        const childSets = parseChildSets(doc);
        Log(`Found ${childSets.length} child sets on Inserts.cfm for Set ID ${setId}`, "info");
        const fullNameBase = buildFullSetName(year, setName, "");
        const fullNameTruncBase = buildFullSetNameTrunc(year, setName, "");
        csvRows.push([sport, year, category, setId, setName, "", "", "", "", fullNameBase, fullNameTruncBase]);
        childSets.forEach((child) => {
          const fullNameChild = buildFullSetName(year, setName, child.childSetName);
          const fullNameTruncChild = buildFullSetNameTrunc(year, setName, child.childSetName);
          csvRows.push([sport, year, category, setId, setName, child.childCategory, child.childSetId, child.childSetName, child.childSetNotes || "", fullNameChild, fullNameTruncChild]);
        });
      }
      const setNameNoSpaces = setName.replace(/\s+/g, "");
      const filename = `${year}_${sport}_${setNameNoSpaces}_SetHierarchy.csv`;
      CSV.download(CSV.toCSV(csvRows), filename);
      setStatus("Export Complete");
      progress.finish(`Exported ${setName} successfully.`, "success");
    } catch (error) {
      if (error instanceof AbortedError || controller.signal.aborted) {
        const setNameNoSpaces = setName.replace(/\s+/g, "");
        const filename = `${year}_${sport}_${setNameNoSpaces}_SetHierarchy.csv`;
        CSV.download(CSV.toCSV(csvRows), filename);
        setStatus("Export cancelled (partial delivered)");
        progress.finish("Cancelled — partial downloaded.", "warning");
      } else if (error instanceof BlockedError) {
        const lastUrl = `/Inserts.cfm/sid/${setId}/`;
        recordBlock(error.message, lastUrl);
        if (csvRows.length > 1) {
          const setNameNoSpaces = setName.replace(/\s+/g, "");
          const filename = `${year}_${sport}_${setNameNoSpaces}_SetHierarchy.csv`;
          CSV.download(CSV.toCSV(csvRows), filename);
          setStatus("Export blocked (partial delivered)");
          progress.finish("Blocked — partial downloaded.", "error");
        } else {
          progress.finish("Stopped — the site returned a challenge.", "error");
          setStatus("Export blocked");
        }
      } else {
        Log(`Set Hierarchy Export Failed: ${error.message}`, "error", "client");
        progress.finish(`Failed: ${error.message}`, "error");
        setStatus("Export Failed");
      }
    } finally {
      CurrentRun.controller = null;
      CurrentRun.onEnd?.();
    }
  }

  // src/ui/styles.js
  var TOOLBAR_CSS = `
/* ---- Design tokens ----
   Kept on :root rather than a scoping class because the toolbar, toasts,
   settings modal, and filter bar mount in four different places in the page.
   The --tk- prefix is specific enough that collision with the site's own
   variables is not a real risk. Dark values override by attribute below. */
:root {
    /* Surfaces & Neutrals (Light Mode - Deep Blue Slate Tint) */
    --tk-bg-base: #f0f4f8;
    --tk-bg-elevated: #ffffff;
    --tk-bg-hover: #e2e8f0;
    --tk-border: #7d8597;
    --tk-border-strong: #5c677d;
    --tk-text: #001233;
    --tk-text-muted: #33415c;

    /* Accents & Signals (Palette: #0466c8, #0353a4, #023e7d) */
    --tk-accent: #0466c8;
    --tk-teal: #0891b2;
    --tk-blue: #0353a4;
    --tk-violet: #7c3aed;
    --tk-magenta: #db2777;
    --tk-green: #059669;
    --tk-red: #dc2626;

    /* Typography & Elevation */
    --tk-font-ui: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    --tk-font-mono: "JetBrains Mono", "Geist Mono", "SF Mono", "Cascadia Code", monospace;
    --tk-radius-sm: 4px;
    --tk-radius-md: 6px;
    --tk-shadow-elevated: 0 10px 25px -5px rgba(2, 62, 125, 0.15), 0 8px 10px -6px rgba(2, 62, 125, 0.08);
}

/* Icons are <use> references into the injected sprite. */
.tk-icon { flex-shrink: 0; display: block; align-self: center; }

/* Filter hiding. A class rather than an inline style so the filter never has
   to read or restore a row's own display value. */
.tk-hidden { display: none !important; }

/* Dark palette. Only the values change; every rule below is theme-agnostic. */
:root[data-sctk-theme="dark"] {
    /* Surfaces & Neutrals (Dark Mode - Midnight Navy Deep) */
    --tk-bg-base: #001233;
    --tk-bg-elevated: #001845;
    --tk-bg-hover: #002855;
    --tk-border: #002855;
    --tk-border-strong: #33415c;
    --tk-text: #f1f5f9;
    --tk-text-muted: #979dac;

    /* Accents & Signals */
    --tk-accent: #0466c8;
    --tk-teal: #2dd4bf;
    --tk-blue: #0353a4;
    --tk-violet: #c084fc;
    --tk-magenta: #f472b6;
    --tk-green: #34d399;
    --tk-red: #f87171;

    --tk-shadow-elevated: 0 20px 25px -5px rgba(0, 18, 51, 0.7), 0 8px 10px -6px rgba(0, 18, 51, 0.5);
}

/* Solid-fill badges need dark text against the brighter dark-mode accents. */
:root[data-sctk-theme="dark"] .tk-badge-link-fs,
:root[data-sctk-theme="dark"] .tk-badge-link-w { color: #16181b; }
:root[data-sctk-theme="dark"] .sctk-btn:hover:not(:disabled),
:root[data-sctk-theme="dark"] #tk-center-context .tk-scroll-btn:hover { color: #ffffff; }

#sctk-toolbar { position: fixed; top: 0; left: 0; width: 100%; z-index: 99999; background: linear-gradient(180deg, #e4eef8 0%, #d1e2f3 100%); color: var(--tk-text); display: flex; align-items: center; min-height: 34px; padding: 2px 8px; font-family: var(--tk-font-ui); font-size: 11px; border-bottom: 2px solid var(--tk-accent); box-shadow: 0 3px 10px rgba(4, 102, 200, 0.18); box-sizing: border-box; flex-wrap: nowrap; }

:root[data-sctk-theme="dark"] #sctk-toolbar { background: linear-gradient(180deg, #001845 0%, #001233 100%); border-bottom: 2px solid var(--tk-accent); box-shadow: 0 4px 14px rgba(0, 18, 51, 0.6); }

/* Wordmark */
#sctk-toolbar .tk-wordmark { display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 2px 6px; margin-right: 8px; flex-shrink: 0; background: var(--tk-bg-elevated); border: 1px solid var(--tk-border-strong); border-top: 2px solid var(--tk-accent); border-radius: 0 0 3px 3px; line-height: 1.1; }
#sctk-toolbar .tk-wordmark-title { font-family: var(--tk-font-mono); font-weight: 700; font-size: 11px; letter-spacing: 0.02em; color: var(--tk-text); text-align: center; display: block; width: 100%; }
#sctk-toolbar .tk-wordmark-sub { font-family: var(--tk-font-mono); font-size: 7.5px; letter-spacing: 0.14em; color: var(--tk-text-muted); text-transform: uppercase; text-align: center; display: block; width: 100%; }

#sctk-toolbar .toolbar-group { display: flex; gap: 4px; margin-right: 8px; border-right: 1px solid var(--tk-border); padding-right: 8px; flex-shrink: 0; align-items: center; }

/* Responsive Center Context Bar */
#tk-center-context { flex-grow: 1; flex-shrink: 1; display: flex; align-items: center; justify-content: center; gap: 4px; overflow: hidden; min-width: 120px; padding: 0 4px; }
#tk-center-context .tk-scroll-btn { background: var(--tk-bg-elevated); color: var(--tk-blue); border: 1px solid var(--tk-border-strong); border-radius: var(--tk-radius-sm); padding: 1px 6px 0 6px; height: 20px; cursor: pointer; font-family: var(--tk-font-mono); font-size: 9.5px; font-weight: 700; letter-spacing: 0.02em; flex-shrink: 0; user-select: none; display: inline-flex; align-items: center; justify-content: center; gap: 3px; line-height: 1; box-sizing: border-box; }
#tk-center-context .tk-scroll-btn:hover { background: var(--tk-bg-hover); border-color: var(--tk-accent); color: #000000; }
#tk-center-context .context-label { display: inline-flex; align-items: center; height: 20px; font-family: var(--tk-font-mono); font-weight: 600; color: var(--tk-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; line-height: 1; margin: 0 2px; padding-top: 1px; box-sizing: border-box; }

/* Right-Aligned Status Bar */
#tk-status-wrap { position: relative; display: inline-flex; flex-shrink: 0; align-items: center; }
#tk-status { flex-shrink: 0; background: transparent; border: none; margin: 0; font-family: var(--tk-font-mono); font-weight: 700; font-size: 10px; letter-spacing: 0.02em; color: var(--tk-accent); cursor: pointer; text-align: right; justify-content: flex-end; padding: 1px 4px 0 4px; white-space: nowrap; display: inline-flex; align-items: center; height: 20px; box-sizing: border-box; }
#tk-status:hover { color: var(--tk-blue); text-decoration: underline; }
:root[data-sctk-theme="dark"] #tk-status:hover { color: var(--tk-teal); }

#tk-settings-trigger.tk-scroll-btn { background: var(--tk-bg-elevated); color: #000000; border: 1px solid var(--tk-border-strong); border-radius: var(--tk-radius-sm); padding: 1px 7px 0 7px; height: 20px; margin-left: 4px; display: inline-flex; align-items: center; justify-content: center; gap: 4px; font-family: var(--tk-font-mono); font-size: 9.5px; font-weight: 700; letter-spacing: 0.02em; flex-shrink: 0; cursor: pointer; box-sizing: border-box; }
#tk-settings-trigger.tk-scroll-btn:hover { background: var(--tk-bg-hover); border-color: var(--tk-accent); color: #000000; }
:root[data-sctk-theme="dark"] #tk-settings-trigger.tk-scroll-btn { background: var(--tk-bg-elevated); color: #ffffff; border-color: var(--tk-border-strong); }
:root[data-sctk-theme="dark"] #tk-settings-trigger.tk-scroll-btn:hover { background: var(--tk-bg-hover); border-color: var(--tk-accent); color: #ffffff; }

.sctk-btn, .sctk-btn:visited { display: inline-flex; align-items: center; justify-content: center; gap: 4px; background: var(--tk-bg-elevated); color: var(--tk-text); border: 1px solid var(--tk-border-strong); border-radius: var(--tk-radius-sm); padding: 1px 7px 0 7px; height: 22px; cursor: pointer; font-family: var(--tk-font-ui); font-size: 10.5px; font-weight: 600; white-space: nowrap; line-height: 1; box-sizing: border-box; }
.sctk-btn svg { flex-shrink: 0; }
.sctk-btn:hover:not(:disabled), .sctk-btn:hover:not(:disabled):visited { background: var(--tk-bg-hover); border-color: var(--tk-accent); color: #000000; }
.sctk-btn-danger { border-color: var(--tk-red); color: var(--tk-red); }
.sctk-btn-danger:hover:not(:disabled) { background: var(--tk-red); border-color: var(--tk-red); color: #ffffff; }
.sctk-btn[hidden] { display: none; }
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
.tk-dropdown-content { display: none; position: absolute; left: 0; top: 100%; margin-top: 2px; background-color: var(--tk-bg-elevated); min-width: 460px; max-width: 640px; box-shadow: var(--tk-shadow-elevated); z-index: 100000; border-radius: var(--tk-radius-md); border: 1px solid var(--tk-border-strong); max-height: 450px; overflow-y: auto; text-align: left; }
/* Click-only. Hover-open cannot be dismissed on a touch device and fires by
   accident on the way to something else on desktop. */
.tk-dropdown.tk-show .tk-dropdown-content { display: block; }

.tk-dropdown-content .tk-pin-item { color: var(--tk-text); padding: 5px 8px; display: flex; flex-direction: column; gap: 1.5px; font-size: 10.5px; border-bottom: 1px solid var(--tk-border); }
.tk-dropdown-content .tk-pin-item:last-child { border-bottom: none; }
.tk-dropdown-content .tk-pin-item:hover { background-color: var(--tk-bg-hover); }
.tk-dropdown-content .tk-pin-header { display: flex; justify-content: space-between; align-items: flex-start; width: 100%; gap: 6px; }
.tk-dropdown-content .tk-pin-title { font-family: var(--tk-font-mono); font-weight: 700; font-size: 10.5px; color: var(--tk-accent); text-decoration: none; flex: 1 1 auto; min-width: 0; word-break: break-word; text-align: left; line-height: 1.2; white-space: normal; }
.tk-dropdown-content .tk-pin-title:hover { text-decoration: underline; color: var(--tk-blue); }

.tk-dropdown-content .tk-pin-actions { display: flex; gap: 3px; align-items: center; flex-wrap: wrap; margin-top: 0; }
.tk-dropdown-content .tk-pin-actions .sctk-badge { margin-left: 0; margin-right: 0; flex-shrink: 0; }

.tk-pin-remove { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border: 1px solid var(--tk-red); background: transparent; color: var(--tk-red); border-radius: var(--tk-radius-sm); cursor: pointer; flex-shrink: 0; }
.tk-pin-remove:hover { background: var(--tk-red); color: #fff; }

.tk-dropbtn { display: inline-flex; align-items: center; gap: 3px; background: var(--tk-bg-elevated); border: 1px solid var(--tk-border-strong); color: var(--tk-text); border-radius: var(--tk-radius-sm); padding: 1px 6px 0 6px; height: 20px; cursor: pointer; font-family: var(--tk-font-mono); font-size: 10px; font-weight: 700; line-height: 1; box-sizing: border-box; }
.tk-dropbtn:hover { border-color: var(--tk-accent); color: var(--tk-accent); background: var(--tk-bg-hover); }
.tk-dropbtn:focus-visible { outline: 2px solid var(--tk-accent); outline-offset: 1px; }

/* Injected Badge Group Container */
.tk-injected-badge-group { margin-left: 8px; vertical-align: middle; }

/* Overflow menu — the toolbar no longer wraps, so anything that does not fit
   moves in here rather than pushing page content down. */
#tk-overflow { flex-shrink: 0; }
#tk-overflow[hidden] { display: none; }
#tk-overflow .tk-dropdown-content { right: 0; left: auto; min-width: 220px; padding: 4px; }
#tk-overflow .tk-dropdown-content .sctk-btn { width: 100%; justify-content: flex-start; margin: 2px 0; }

/* Compact Badge Styles */
.sctk-badge, .sctk-badge:visited { display: inline-flex; align-items: center; justify-content: center; gap: 3px; font-family: var(--tk-font-mono); padding: 1px 5px 0 5px; height: 20px; margin-left: 2px; text-decoration: none !important; font-size: 9.5px; font-weight: 700; letter-spacing: 0.01em; border-radius: var(--tk-radius-sm); line-height: 1; box-sizing: border-box; cursor: pointer; white-space: nowrap; border: 1px solid transparent; }

.tk-badge-action, .tk-badge-action:visited { background: var(--tk-bg-elevated); border-color: var(--tk-blue); color: var(--tk-blue); }
.tk-badge-action:hover, .tk-badge-action:hover:visited { background: var(--tk-blue); color: #ffffff; }

.tk-badge-action-h, .tk-badge-action-h:visited { background: var(--tk-bg-elevated); border-color: var(--tk-teal); color: var(--tk-teal); }
.tk-badge-action-h:hover, .tk-badge-action-h:hover:visited { background: var(--tk-teal); color: #ffffff; }

.tk-badge-link-c, .tk-badge-link-c:visited { background: var(--tk-bg-elevated); border-color: var(--tk-blue); color: var(--tk-blue); }
.tk-badge-link-c:hover, .tk-badge-link-c:hover:visited { background: var(--tk-blue); color: #ffffff; }

.tk-badge-link-i, .tk-badge-link-i:visited { background: var(--tk-bg-elevated); border-color: var(--tk-violet); color: var(--tk-violet); }
.tk-badge-link-i:hover, .tk-badge-link-i:hover:visited { background: var(--tk-violet); color: #ffffff; }

.tk-badge-link-p, .tk-badge-link-p:visited { background: var(--tk-bg-elevated); border-color: var(--tk-magenta); color: var(--tk-magenta); }
.tk-badge-link-p:hover, .tk-badge-link-p:hover:visited { background: var(--tk-magenta); color: #ffffff; }

.tk-badge-link-fs, .tk-badge-link-fs:visited { background: var(--tk-green); border-color: var(--tk-green); color: #ffffff; }
.tk-badge-link-fs:hover, .tk-badge-link-fs:hover:visited { background: #146c43; border-color: #146c43; color: #ffffff; }

.tk-badge-link-fsm, .tk-badge-link-fsm:visited { background: var(--tk-bg-elevated); border-color: var(--tk-green); color: var(--tk-green); }
.tk-badge-link-fsm:hover, .tk-badge-link-fsm:hover:visited { background: var(--tk-green); color: #ffffff; }

.tk-badge-link-w, .tk-badge-link-w:visited { background: var(--tk-red); border-color: var(--tk-red); color: #ffffff; }
.tk-badge-link-w:hover, .tk-badge-link-w:hover:visited { background: #b02a37; border-color: #b02a37; color: #ffffff; }

/* Filter Bar CSS */
#tk-checklist-filter-wrap { margin: 8px 0; display: flex; align-items: center; gap: 6px; background: var(--tk-bg-elevated); border: 1px solid var(--tk-border-strong); border-left: 3px solid var(--tk-accent); padding: 6px 10px; border-radius: 4px; font-family: var(--tk-font-ui); color: var(--tk-text); font-size: 11.5px; }
#tk-checklist-filter-wrap strong { font-family: var(--tk-font-mono); font-size: 9.5px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--tk-accent); font-weight: 700; flex-shrink: 0; }
#tk-checklist-filter-container { position: relative; display: inline-flex; align-items: center; }
#tk-checklist-filter { padding: 3px 22px 3px 6px; border: 1px solid var(--tk-border-strong); background: var(--tk-bg-elevated); color: var(--tk-text); border-radius: 3px; font-size: 11.5px; width: 320px; font-family: var(--tk-font-ui); box-sizing: border-box; }
#tk-checklist-filter-clear { position: absolute; right: 4px; background: transparent; border: none; color: var(--tk-text-muted); padding: 2px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; border-radius: 2px; height: 16px; width: 16px; margin: 0; }
#tk-checklist-filter-clear:hover { color: var(--tk-red); background: var(--tk-bg-hover); }
#tk-filter-count { font-family: var(--tk-font-mono); font-size: 10px; color: var(--tk-text-muted); white-space: nowrap; flex-shrink: 0; }
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

/* Command palette */
#tk-palette-overlay { position: fixed; inset: 0; z-index: 200001; background: rgba(0,0,0,0.45); display: flex; align-items: flex-start; justify-content: center; padding-top: 12vh; font-family: var(--tk-font-ui); }
#tk-palette-panel { background: var(--tk-bg-elevated); color: var(--tk-text); width: min(560px, 92vw); border-radius: var(--tk-radius-md); border: 1px solid var(--tk-border-strong); box-shadow: var(--tk-shadow-elevated); overflow: hidden; }
#tk-palette-input { width: 100%; box-sizing: border-box; padding: 10px 12px; border: none; border-bottom: 1px solid var(--tk-border); background: var(--tk-bg-elevated); color: var(--tk-text); font-family: var(--tk-font-ui); font-size: 13px; }
#tk-palette-input:focus { outline: none; }
#tk-palette-results { max-height: 46vh; overflow-y: auto; }
.tk-palette-item { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 7px 12px; cursor: pointer; font-size: 11.5px; border-left: 2px solid transparent; }
.tk-palette-item:hover { background: var(--tk-bg-hover); }
.tk-palette-item.active { background: var(--tk-bg-hover); border-left-color: var(--tk-accent); }
.tk-palette-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tk-palette-hint { flex-shrink: 0; font-family: var(--tk-font-mono); font-size: 9.5px; color: var(--tk-text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
.tk-palette-empty { padding: 12px; color: var(--tk-text-muted); font-size: 11.5px; }

/* Toast System */
.tk-toast-container { position: fixed; z-index: 100000; display: flex; flex-direction: column; gap: 6px; pointer-events: none; font-family: var(--tk-font-ui); }
.tk-toast-bottom-right { bottom: 16px; right: 16px; align-items: flex-end; }
.tk-toast-bottom-left { bottom: 16px; left: 16px; align-items: flex-start; }
.tk-toast-top-right { top: 44px; right: 16px; align-items: flex-end; }
.tk-toast-top-left { top: 44px; left: 16px; align-items: flex-start; }
.tk-toast-message { padding: 8px 12px; border-radius: var(--tk-radius-sm); background: var(--tk-bg-elevated); color: var(--tk-text); border: 1px solid var(--tk-border); border-left: 3px solid var(--tk-teal); box-shadow: var(--tk-shadow-elevated); opacity: 0; pointer-events: auto; line-height: 1.35; max-width: 320px; word-wrap: break-word; text-align: left; font-size: 11.5px; }
.tk-toast-message.tk-toast-show { opacity: 1; }
@media (prefers-reduced-motion: no-preference) {
    .tk-toast-message, .sctk-qty-counter { transition: opacity 0.25s ease, transform 0.25s ease; }
    .tk-toast-message { transform: translateY(8px); }
    .tk-toast-message.tk-toast-show { transform: translateY(0); }
}
.tk-toast-hint { font-family: var(--tk-font-mono); font-size: 9px; color: var(--tk-text-muted); border: 1px solid var(--tk-border-strong); border-radius: 3px; padding: 0 3px; }
.tk-toast-detail { color: var(--tk-text-muted); margin-top: 3px; font-variant-numeric: tabular-nums; }
.tk-toast-cancel { margin-top: 6px; background: transparent; border: 1px solid var(--tk-border-strong); color: var(--tk-text); border-radius: var(--tk-radius-sm); padding: 2px 8px; font-family: var(--tk-font-ui); font-size: 10.5px; font-weight: 600; cursor: pointer; }
.tk-toast-cancel:hover:not(:disabled) { background: var(--tk-red); border-color: var(--tk-red); color: #fff; }
.tk-toast-cancel:disabled { opacity: 0.6; cursor: default; }
.tk-toast-cancel:focus-visible { outline: 2px solid var(--tk-accent); outline-offset: 1px; }
.tk-toast-message ul, .tk-toast-message ol { text-align: left; margin: 3px 0 0 0; padding-left: 16px; }
.tk-toast-message li { text-align: left; margin-bottom: 2px; }

/* Card Name Formatter Popover */
.tk-formatter-popover { position: absolute; z-index: 200000; background: var(--tk-bg-elevated); color: var(--tk-text); border: 1px solid var(--tk-border-strong); border-radius: var(--tk-radius-sm); padding: 4px 8px; box-shadow: var(--tk-shadow-elevated); font-family: var(--tk-font-ui); font-size: 11px; display: flex; align-items: center; gap: 8px; }
.tk-popover-label { font-family: var(--tk-font-mono); white-space: nowrap; max-width: 300px; overflow: hidden; text-overflow: ellipsis; }

/* Quantity Counter Widget */
.sctk-qty-counter { font-family: var(--tk-font-ui); font-size: 11.5px; color: var(--tk-text); background: var(--tk-bg-elevated); border: 1px solid var(--tk-border-strong); border-left: 3px solid var(--tk-accent); border-radius: var(--tk-radius-sm); padding: 5px 10px; box-shadow: var(--tk-shadow-elevated); display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; user-select: none; pointer-events: auto; }
.sctk-qty-counter-bottom-right { position: relative; inset: auto; z-index: auto; }
.sctk-qty-counter-bottom-left { position: relative; inset: auto; z-index: auto; }
.sctk-qty-counter-toolbar { position: relative; z-index: auto; border-radius: var(--tk-radius-sm); margin-left: 6px; padding: 2px 8px; height: 22px; box-shadow: none; }
.sctk-qty-counter .tk-qty-label { font-family: var(--tk-font-mono); font-size: 10px; font-weight: 700; color: var(--tk-accent); text-transform: uppercase; }
.sctk-qty-counter .tk-qty-val { font-family: var(--tk-font-mono); font-size: 12px; font-weight: 700; color: var(--tk-text); }
.sctk-qty-counter .tk-qty-sep, .sctk-qty-counter .tk-qty-total { font-family: var(--tk-font-mono); font-size: 11px; color: var(--tk-text-muted); }
.sctk-qty-counter .tk-qty-sub { font-size: 10.5px; color: var(--tk-text-muted); margin-left: 4px; }

/* Height is measured and written to this variable by a ResizeObserver. The
   old fixed 38px was wrong the moment the toolbar wrapped to a second row, and
   the toolbar covered the top of the page. */
body { padding-top: var(--tk-toolbar-height, 38px) !important; }
`;
  var SETTINGS_CSS = `
#tk-settings-overlay { position: fixed; inset: 0; z-index: 200000; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; font-family: var(--tk-font-ui); }
#tk-settings-panel { background: var(--tk-bg-elevated); color: var(--tk-text); width: min(580px, 92vw); height: min(580px, 85vh); min-height: 480px; border-radius: var(--tk-radius-md); border: 1px solid var(--tk-border-strong); box-shadow: var(--tk-shadow-elevated); display: flex; flex-direction: column; overflow: hidden; text-align: left; }
#tk-settings-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid var(--tk-border); flex-shrink: 0; background: var(--tk-bg-base); text-align: left; }
#tk-settings-header h2 { margin: 0; font-family: var(--tk-font-mono); font-size: 12px; font-weight: 700; letter-spacing: 0.02em; color: var(--tk-accent); text-align: left; }
#tk-settings-close { display: inline-flex; align-items: center; justify-content: center; background: transparent; border: 1px solid var(--tk-border-strong); color: var(--tk-text-muted); border-radius: var(--tk-radius-sm); width: 22px; height: 22px; cursor: pointer; }
#tk-settings-close:hover { background: var(--tk-red); border-color: var(--tk-red); color: #fff; }
#tk-settings-close:focus-visible { outline: 2px solid var(--tk-accent); outline-offset: 1px; }
#tk-settings-body { display: flex; flex-direction: column; overflow: hidden; flex-grow: 1; text-align: left; }
#tk-settings-tabs { display: flex; gap: 2px; padding: 4px 14px 0; border-bottom: 1px solid var(--tk-border); flex-shrink: 0; background: var(--tk-bg-base); text-align: left; }
.tk-settings-tab { background: transparent; border: none; border-bottom: 2px solid transparent; color: var(--tk-text-muted); font-family: var(--tk-font-mono); font-size: 10px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; padding: 6px 8px; cursor: pointer; }
.tk-settings-tab:hover { color: var(--tk-text); }
.tk-settings-tab.active { color: var(--tk-accent); border-bottom-color: var(--tk-accent); }
.tk-settings-tab:focus-visible { outline: 2px solid var(--tk-accent); outline-offset: -2px; }
#tk-settings-tab-content { overflow-y: auto; flex-grow: 1; padding: 14px 16px; text-align: left; }
#tk-settings-modules, #tk-settings-global { width: 100%; text-align: left; }
.tk-settings-section-title { font-family: var(--tk-font-mono); font-size: 10px; font-weight: 700; color: var(--tk-teal); text-transform: uppercase; letter-spacing: 0.06em; margin: 0 0 8px 0; text-align: left; }
.tk-settings-module-row { border-bottom: 1px solid var(--tk-border); padding: 4px 0; text-align: left; }
.tk-settings-module-row:last-child { border-bottom: none; }
.tk-accordion-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; cursor: pointer; padding: 6px 8px; border-radius: var(--tk-radius-sm); user-select: none; }
.tk-accordion-header:hover { background: var(--tk-bg-hover); }
.tk-accordion-header-left { display: flex; flex-direction: column; gap: 3px; flex: 1 1 auto; min-width: 0; }
.tk-accordion-header label.tk-module-label { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; font-size: 11.5px; font-weight: 700; text-align: left; margin: 0; }
.tk-settings-module-desc { font-size: 10.5px; color: var(--tk-text-muted); margin: 0 0 0 20px; line-height: 1.35; text-align: left; white-space: normal; word-break: break-word; }
.tk-accordion-toggle-btn { display: inline-flex; align-items: center; justify-content: center; background: transparent; border: none; color: var(--tk-text-muted); padding: 2px; margin-top: 2px; border-radius: var(--tk-radius-sm); cursor: pointer; flex-shrink: 0; transition: transform 0.2s ease, color 0.2s ease; }
.tk-accordion-toggle-btn:hover { color: var(--tk-accent); }
.tk-accordion-toggle-btn:focus-visible { outline: 2px solid var(--tk-accent); }
.tk-accordion-open .tk-accordion-toggle-btn { transform: rotate(180deg); color: var(--tk-accent); }
.tk-accordion-body { padding: 6px 8px 6px 20px; }
.tk-settings-actions { margin: 4px 0 6px 0; display: flex; flex-direction: column; gap: 3px; text-align: left; }
.tk-settings-actions label { display: flex; align-items: center; gap: 5px; font-size: 10.5px; font-weight: 400; cursor: pointer; color: var(--tk-text-muted); text-align: left; }
.tk-settings-field { margin-bottom: 12px; text-align: left; }
.tk-settings-field label { display: block; font-size: 10.5px; font-weight: 700; margin-bottom: 3px; text-align: left; }
.tk-settings-field .tk-field-value { color: var(--tk-teal); font-weight: 400; font-family: var(--tk-font-mono); }
.tk-settings-field input[type="range"] { width: 100%; accent-color: var(--tk-accent); }
.tk-settings-field select { width: 100%; padding: 4px; background: var(--tk-bg-base); color: var(--tk-text); border: 1px solid var(--tk-border-strong); border-radius: var(--tk-radius-sm); font-size: 11px; }
.tk-settings-field select:focus-visible,
#tk-settings-panel input[type="checkbox"]:focus-visible { outline: 2px solid var(--tk-accent); outline-offset: 1px; }
#tk-settings-panel input[type="checkbox"] { accent-color: var(--tk-accent); }
.tk-contract-list { list-style: none; margin: 4px 0 0 0; padding: 0; font-family: var(--tk-font-mono); font-size: 10px; line-height: 1.5; text-align: left; }
.tk-contract-list li { text-align: left; }
.tk-contract-list li.ok { color: var(--tk-text-muted); }
.tk-contract-list li.bad { color: var(--tk-red); font-weight: 700; }
#tk-settings-diagnostics { text-align: left; }
#tk-settings-diagnostics .tk-settings-section-title { text-align: left; }
#tk-settings-diagnostics .tk-settings-field { text-align: left; }
#tk-settings-diagnostics .tk-settings-field label { text-align: left; }
.tk-diag-list { display: grid; grid-template-columns: 140px 1fr; gap: 6px 16px; margin: 0 0 14px 0; font-size: 11px; text-align: left; align-items: baseline; }
.tk-diag-list dt { font-family: var(--tk-font-mono); font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--tk-text-muted); text-align: left; }
.tk-diag-list dd { margin: 0; word-break: break-word; text-align: left; color: var(--tk-text); }
#tk-settings-help { margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--tk-border); font-size: 10.5px; color: var(--tk-text-muted); line-height: 1.5; text-align: left; }
#tk-settings-help a { color: var(--tk-blue); }

.tk-settings-hint { font-size: 10px; color: var(--tk-text-muted); margin-top: 2px; line-height: 1.3; text-align: left; }

.tk-route-editor { margin: 6px 0 4px 16px; text-align: left; }
.tk-route-editor-title { font-family: var(--tk-font-mono); font-size: 9px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--tk-text-muted); margin-bottom: 4px; text-align: left; }
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

/* RegEx & Route Tester Panes */
.tk-tester-pane { display: flex; flex-direction: column; gap: 10px; width: 100%; text-align: left; }
.tk-tester-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.tk-tester-row-input { flex: 1 1 auto; min-width: 0; }
.tk-tester-input { width: 100%; box-sizing: border-box; padding: 6px 8px; background: var(--tk-bg-base); color: var(--tk-text); border: 1px solid var(--tk-border-strong); border-radius: var(--tk-radius-sm); font-family: var(--tk-font-mono); font-size: 11px; }
.tk-tester-input:focus-visible, .tk-tester-textarea:focus-visible { outline: 2px solid var(--tk-accent); outline-offset: 1px; }
.tk-tester-textarea { width: 100%; box-sizing: border-box; min-height: 70px; padding: 6px 8px; background: var(--tk-bg-base); color: var(--tk-text); border: 1px solid var(--tk-border-strong); border-radius: var(--tk-radius-sm); font-family: var(--tk-font-mono); font-size: 11px; resize: vertical; line-height: 1.4; }
.tk-regex-flags { display: flex; gap: 6px; align-items: center; user-select: none; }
.tk-regex-flag-label { display: inline-flex; align-items: center; gap: 3px; font-family: var(--tk-font-mono); font-size: 10.5px; cursor: pointer; color: var(--tk-text-muted); }
.tk-regex-flag-label input { accent-color: var(--tk-accent); margin: 0; }
.tk-preset-chips { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px; }
.tk-preset-chip { font-family: var(--tk-font-mono); font-size: 9.5px; background: var(--tk-bg-base); color: var(--tk-text-muted); border: 1px solid var(--tk-border-strong); border-radius: 12px; padding: 2px 8px; cursor: pointer; user-select: none; }
.tk-preset-chip:hover { border-color: var(--tk-accent); color: var(--tk-accent); background: var(--tk-bg-hover); }
.tk-tester-status-bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 10px; border-radius: var(--tk-radius-sm); font-family: var(--tk-font-mono); font-size: 11px; font-weight: 700; background: var(--tk-bg-base); border: 1px solid var(--tk-border-strong); }
.tk-status-badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: var(--tk-radius-sm); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
.tk-status-badge.matched { background: rgba(5, 150, 105, 0.2); color: var(--tk-green); border: 1px solid var(--tk-green); }
.tk-status-badge.unmatched { background: rgba(220, 38, 38, 0.15); color: var(--tk-red); border: 1px solid var(--tk-red); }
.tk-status-badge.error { background: rgba(220, 38, 38, 0.25); color: var(--tk-red); border: 1px solid var(--tk-red); }
.tk-status-badge.disabled { background: rgba(151, 157, 172, 0.2); color: var(--tk-text-muted); border: 1px solid var(--tk-border-strong); }
.tk-regex-highlight-box { background: var(--tk-bg-base); border: 1px solid var(--tk-border-strong); border-radius: var(--tk-radius-sm); padding: 8px 10px; font-family: var(--tk-font-mono); font-size: 11px; line-height: 1.5; max-height: 140px; overflow-y: auto; white-space: pre-wrap; word-break: break-all; }
.tk-regex-match-hl { background: rgba(4, 102, 200, 0.35); color: var(--tk-text); border-bottom: 2px solid var(--tk-accent); border-radius: 2px; padding: 0 1px; font-weight: 700; }
.tk-regex-groups-table { width: 100%; border-collapse: collapse; font-family: var(--tk-font-mono); font-size: 10.5px; margin-top: 4px; }
.tk-regex-groups-table th { text-align: left; padding: 4px 6px; border-bottom: 1px solid var(--tk-border-strong); color: var(--tk-text-muted); font-size: 9.5px; text-transform: uppercase; }
.tk-regex-groups-table td { padding: 4px 6px; border-bottom: 1px solid var(--tk-border); color: var(--tk-text); word-break: break-all; }
.tk-route-card { border: 1px solid var(--tk-border-strong); border-radius: var(--tk-radius-sm); padding: 8px 10px; background: var(--tk-bg-base); display: flex; flex-direction: column; gap: 4px; }
.tk-route-card-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.tk-route-card-title { font-weight: 700; font-size: 11.5px; color: var(--tk-text); }
.tk-route-rules-list { font-family: var(--tk-font-mono); font-size: 10px; margin-top: 4px; display: flex; flex-direction: column; gap: 2px; }
.tk-route-rule-item { display: flex; align-items: center; gap: 6px; color: var(--tk-text-muted); }
.tk-route-rule-item.pass { color: var(--tk-green); }
.tk-route-rule-item.fail { color: var(--tk-red); }

/* Pin Configuration Tab */
#tk-settings-pins { text-align: left; }
.tk-pin-config-list { display: flex; flex-direction: column; gap: 2px; margin-top: 8px; }
.tk-pin-config-row { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border: 1px solid var(--tk-border); border-radius: var(--tk-radius-sm); background: var(--tk-bg-base); cursor: default; user-select: none; transition: background 0.1s ease, opacity 0.15s ease; }
.tk-pin-config-row:hover { background: var(--tk-bg-hover); }
.tk-pin-config-row.tk-pin-row-dragging { opacity: 0.4; }
.tk-pin-config-row.tk-pin-row-drag-over { border-color: var(--tk-accent); background: var(--tk-bg-hover); box-shadow: 0 0 0 2px rgba(4,102,200,0.25); }
.tk-pin-config-row.tk-pin-disabled { opacity: 0.5; }
.tk-pin-drag-handle { display: inline-flex; align-items: center; justify-content: center; color: var(--tk-text-muted); cursor: grab; flex-shrink: 0; width: 16px; padding: 0 2px; }
.tk-pin-drag-handle:active { cursor: grabbing; }
.tk-pin-config-toggle { flex-shrink: 0; accent-color: var(--tk-accent); width: 14px; height: 14px; cursor: pointer; }
.tk-pin-config-name { flex: 1 1 auto; min-width: 0; font-size: 11px; font-weight: 600; color: var(--tk-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tk-pin-config-name a { color: inherit; text-decoration: none; }
.tk-pin-config-name a:hover { color: var(--tk-accent); text-decoration: underline; }
.tk-pin-config-year { font-family: var(--tk-font-mono); font-size: 9.5px; color: var(--tk-text-muted); flex-shrink: 0; }
.tk-pin-config-actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
.tk-pin-reorder-btn { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; background: transparent; border: 1px solid var(--tk-border-strong); color: var(--tk-text-muted); border-radius: var(--tk-radius-sm); cursor: pointer; padding: 0; }
.tk-pin-reorder-btn:hover:not(:disabled) { background: var(--tk-bg-hover); border-color: var(--tk-accent); color: var(--tk-accent); }
.tk-pin-reorder-btn:disabled { opacity: 0.25; cursor: default; }
.tk-pin-reorder-btn:focus-visible { outline: 2px solid var(--tk-accent); outline-offset: 1px; }
.tk-pin-remove-btn { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; background: transparent; border: 1px solid var(--tk-border-strong); color: var(--tk-text-muted); border-radius: var(--tk-radius-sm); cursor: pointer; padding: 0; }
.tk-pin-remove-btn:hover { background: var(--tk-red); border-color: var(--tk-red); color: #fff; }
.tk-pin-remove-btn:focus-visible { outline: 2px solid var(--tk-accent); outline-offset: 1px; }
.tk-pin-config-empty { color: var(--tk-text-muted); font-size: 11px; padding: 16px 0; text-align: center; }

@media (max-width: 480px) {
    .tk-route-row { flex-wrap: wrap; }
    .tk-route-row input[type="text"] { flex-basis: 100%; }
}
`;

  // src/ui/dropdown.js
  function closeAllDropdowns(except = null) {
    document.querySelectorAll(".tk-dropdown.tk-show").forEach((el) => {
      if (el === except) return;
      el.classList.remove("tk-show");
      el.querySelector("[aria-expanded]")?.setAttribute("aria-expanded", "false");
    });
  }
  var itemsOf = (dropdown) => Array.from(dropdown.querySelectorAll('.tk-dropdown-content a, .tk-dropdown-content button, .tk-dropdown-content [role="button"]')).filter((el) => el.offsetParent !== null || el.hidden === false);
  function initDropdown(dropdown, trigger) {
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-haspopup", "true");
    const setOpen = (open) => {
      dropdown.classList.toggle("tk-show", open);
      trigger.setAttribute("aria-expanded", String(open));
    };
    trigger.addEventListener("click", (e) => {
      e.preventDefault();
      const willOpen = !dropdown.classList.contains("tk-show");
      closeAllDropdowns(dropdown);
      setOpen(willOpen);
      if (willOpen) itemsOf(dropdown)[0]?.focus();
    });
    dropdown.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.focus();
        return;
      }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
      const items = itemsOf(dropdown);
      if (items.length === 0) return;
      e.preventDefault();
      const current = items.indexOf(document.activeElement);
      const next = {
        ArrowDown: current < 0 ? 0 : (current + 1) % items.length,
        ArrowUp: current < 0 ? items.length - 1 : (current - 1 + items.length) % items.length,
        Home: 0,
        End: items.length - 1
      }[e.key];
      items[next].focus();
    });
  }
  function initDropdownDismissal() {
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".tk-dropdown")) closeAllDropdowns();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeAllDropdowns();
    });
  }

  // src/ui/toolbar.js
  function appendShortcutBadges(container, sid, label = "Set", displayMode = Config.global?.toolbarButtonDisplay || "both", parentSid = null) {
    renderBadgeSet(container, sid, {
      include: getToolbarBadges(),
      onExport: (e) => {
        e.preventDefault();
        const fullUrl = Utils.toFullUrl(`/Checklist.cfm/sid/${sid}/`);
        Log(`[CLIENT] Toolbar CSV Export button clicked for set ID ${sid} (${label}) — ${fullUrl}`, "info", "client");
        exportSetCSV(sid, label);
      },
      onExportHierarchy: (e) => {
        e.preventDefault();
        Log(`[CLIENT] Toolbar Hierarchy CSV Export button clicked for set ID ${sid} (${label})`, "info", "client");
        exportSingleParentSetHierarchy(sid, label);
      },
      displayMode,
      parentSid
    });
  }
  function cleanDocTitle(rawTitle) {
    let t = (rawTitle !== void 0 ? rawTitle : typeof document !== "undefined" ? document.title : "") || "";
    t = t.replace(/\s*([|-])\s*(Trading Card Database|TCDB).*/i, "");
    t = t.replace(/^(Collection(\s+[^-\n]+)?|.*?'s\s+Collection)\s*-\s*/i, "");
    t = t.replace(
      /\s*-\s*(Inserts and Related Sets|Inserts & Related Sets|Inserts|Checklist|Overview|Cards|For Sale\/Trade|For Sale|Trade|Wantlist|Add Multiples(\s+Text)?|Add\/Edit|Member Ratings|Ratings|User Comments|Comments|Price Guide|Trivia|Gallery|Errors\s*\/\s*Variations|Packaging|Documentation)\s*$/i,
      ""
    );
    t = t.replace(/\s*[-|:/]\s*$/g, "");
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
      installIconSprite();
      const bar = document.createElement("div");
      bar.id = "sctk-toolbar";
      bar.innerHTML = `
      <div class="tk-wordmark"><span class="tk-wordmark-title">SC</span><span class="tk-wordmark-sub">Toolkit</span></div>
      <div id="tk-actions" class="toolbar-group"></div>
      <div id="tk-pinned" class="toolbar-group"></div>
      <div id="tk-center-context"></div>
      <div id="tk-status-wrap" class="tk-dropdown">
        <button id="tk-status" type="button" class="tk-status-btn" aria-haspopup="true" aria-expanded="false">Initializing...</button>
        <div id="tk-status-dropdown" class="tk-dropdown-content" style="right: 0; left: auto; padding: 8px 12px; min-width: 220px; text-align: left;">
          <div id="tk-status-popover-title" style="font-weight: 700; font-family: var(--tk-font-mono); font-size: 11px; color: var(--tk-accent); border-bottom: 1px solid var(--tk-border); padding-bottom: 4px; margin-bottom: 6px;">
            Active Modules
          </div>
          <ul id="tk-status-popover-list" style="margin: 0; padding-left: 16px; font-family: var(--tk-font-mono); font-size: 10.5px; color: var(--tk-text); line-height: 1.5;">
          </ul>
        </div>
      </div>
    `;
      document.body.prepend(bar);
      const wrap = bar.querySelector("#tk-status-wrap");
      const statusBtn = bar.querySelector("#tk-status");
      if (wrap && statusBtn) {
        initDropdown(wrap, statusBtn);
      }
      initDropdownDismissal();
      Toolbar.observeHeight(bar);
      Toolbar.renderPins();
      Toolbar.renderCenterContext();
      Toolbar.installCancelControl();
    },
    /**
     * Wire a Cancel button that appears only while an export is running.
     *
     * A 200-page run is three minutes or more of requests. Until now the only way
     * to stop one was to close the tab, which is not a control — it is a
     * workaround for the absence of one.
     */
    installCancelControl: () => {
      const container = document.getElementById("tk-actions");
      if (!container) return;
      const btn = createBtn("tk-cancel-export", "Cancel Export", () => {
        if (cancelCurrentExport()) btn.disabled = true;
      });
      btn.hidden = true;
      btn.classList.add("sctk-btn-danger");
      container.appendChild(btn);
      CurrentRun.onStart = () => {
        btn.hidden = false;
        btn.disabled = false;
        const hierarchyBtn = document.getElementById("btn-export-hierarchy");
        if (hierarchyBtn) hierarchyBtn.hidden = true;
      };
      CurrentRun.onEnd = () => {
        btn.hidden = true;
        const hierarchyBtn = document.getElementById("btn-export-hierarchy");
        if (hierarchyBtn) hierarchyBtn.hidden = false;
      };
    },
    /**
     * Publish the toolbar's real height so the page can be offset by exactly it.
     *
     * The old rule was a fixed `body { padding-top: 38px }`. The toolbar was
     * `flex-wrap: wrap`, so the moment it wrapped to a second row it covered the
     * top of the page — the compensation and the thing it compensated for were
     * free to disagree. The toolbar no longer wraps, and the offset is measured
     * rather than assumed.
     *
     * @param {HTMLElement} bar
     */
    observeHeight: (bar) => {
      const publish = () => {
        const height = Math.ceil(bar.getBoundingClientRect().height);
        if (height > 0) document.documentElement.style.setProperty("--tk-toolbar-height", `${height}px`);
      };
      publish();
      if (typeof ResizeObserver === "function") new ResizeObserver(publish).observe(bar);
      else window.addEventListener("resize", publish, { passive: true });
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
      const pins = Pins.all().filter((p) => p.enabled !== false);
      if (pins.length === 0) return;
      const grouped = pins.reduce((acc, pin) => {
        const year = SET_YEAR_REGEX.test(pin.year) ? pin.year : Utils.extractYear(pin.name, pin.url) || "Misc";
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
        dropDiv.appendChild(dropBtn);
        initDropdown(dropDiv, dropBtn);
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
          appendShortcutBadges(actionsDiv, pin.id, pin.name, Config.global?.pinButtonDisplay || "both");
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
      scrollTopBtn.innerHTML = `${icon("chevronUp")}<span>Top</span>`;
      scrollTopBtn.title = "Scroll to top of page";
      scrollTopBtn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
      container.appendChild(scrollTopBtn);
      const scrollBottomBtn = document.createElement("button");
      scrollBottomBtn.type = "button";
      scrollBottomBtn.className = "tk-scroll-btn";
      scrollBottomBtn.innerHTML = `${icon("chevronDown")}<span>Bottom</span>`;
      scrollBottomBtn.title = "Scroll to bottom of page";
      scrollBottomBtn.addEventListener("click", () => {
        const footer = document.querySelector("#bottomnav, footer, #footer, .footer");
        if (footer) {
          footer.scrollIntoView({ behavior: "smooth", block: "start" });
        } else {
          window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
        }
      });
      container.appendChild(scrollBottomBtn);
      if (Routes.isCardPage()) {
        const titleNode = document.querySelector("#setname-content h1") || document.querySelector("#main-content-area h1");
        const subTitleNode = document.querySelector("#setname-content h3") || document.querySelector("#main-content-area h3");
        const playerNode = document.querySelector("#main-content-area h2");
        const yearSet = titleNode ? titleNode.innerText.replace(/\s*-\s*Cards$/i, "").trim() : "";
        const cardNo = subTitleNode ? subTitleNode.innerText.trim() : "";
        const player = playerNode ? playerNode.innerText.trim() : "";
        const cardSummary = `${player ? player + " - " : ""}${yearSet}${cardNo ? " " + cardNo : ""}`.trim();
        appendContextLabel(container, cardSummary || cleanDocTitle() || "Card View");
        if (currentSid) {
          const parentSid = extractParentSid(document, currentSid);
          if (parentSid) {
            Log(`Determined parent set ID ${parentSid} for set ID ${currentSid}`, "debug");
          } else {
            Log(`No parent set ID found for set ID ${currentSid}`, "debug");
          }
          appendShortcutBadges(container, currentSid, cardSummary || "Set", Config.global?.toolbarButtonDisplay || "both", parentSid);
        }
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
        const parentSid = extractParentSid(document, currentSid);
        if (parentSid) {
          Log(`Determined parent set ID ${parentSid} for set ID ${currentSid}`, "debug");
        } else {
          Log(`No parent set ID found for set ID ${currentSid}`, "debug");
        }
        appendContextLabel(container, setName || "Set View");
        appendShortcutBadges(container, currentSid, setName || "Set", Config.global?.toolbarButtonDisplay || "both", parentSid);
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
  var CHUNK_SIZE = Config.global?.setListEnhancerChunkSize ?? 25;
  var SET_LINK_SELECTOR = SELECTOR_REGISTRY.setLinks.join(", ");
  var onIdle = typeof requestIdleCallback === "function" ? (fn) => requestIdleCallback(fn, { timeout: 500 }) : (fn) => setTimeout(fn, 16);
  function findSetLinks(root = document) {
    return Array.from(root.querySelectorAll(SET_LINK_SELECTOR)).filter((link) => {
      if (link.closest("#sctk-toolbar")) return false;
      if (!extractSid(link.href)) return false;
      const text = link.textContent.trim();
      if (text.length === 0) return false;
      if (/^[\u25B6\u25C0\u25BC\u25B2►◄▼▲\s+-]+$/.test(text)) return false;
      return true;
    });
  }
  function findUninjectedSetLinks(root = document) {
    return findSetLinks(root).filter((link) => !link.dataset.tkInjected);
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
  function buildBadgeGroup(link, setId, currentPageSid) {
    if (currentPageSid && setId === currentPageSid) return null;
    const setName = link.textContent.trim();
    const container = document.createElement("span");
    container.className = "tk-injected-badge-group";
    container.style.display = "inline-flex";
    container.style.alignItems = "center";
    container.style.marginLeft = "8px";
    const expandable = isExpandableParent(link);
    const include = getSetLinkBadges().filter(
      (key) => expandable || key !== "INSERTS" && key !== "PARALLELS"
    );
    renderBadgeSet(container, setId, {
      include,
      onPin: (e) => {
        e.preventDefault();
        const added = Pins.add({
          id: setId,
          name: setName,
          url: link.href,
          year: deriveSetYear(setName, link.href)
        });
        if (!added) return;
        Toolbar.renderPins();
        showToast({ message: `Pinned: <b>${Utils.escape.html(setName)}</b>` });
      },
      onExport: (e) => {
        e.preventDefault();
        const fullUrl = Utils.toFullUrl(link.getAttribute("href") || `/Checklist.cfm/sid/${setId}/`);
        Log(`[CLIENT] Set list badge CSV Export requested for set ID ${setId} (${setName}) — ${fullUrl}`, "info", "client");
        exportSetCSV(setId, setName);
      },
      onExportHierarchy: (e) => {
        e.preventDefault();
        const parentLi = link.closest("li");
        let category = "Major Releases";
        if (parentLi) {
          let prev = parentLi.previousElementSibling;
          while (prev) {
            if (prev.tagName === "H3" && prev.classList.contains("site")) {
              category = prev.textContent.trim().replace(/\s*\(\d+\)$/, "");
              break;
            }
            prev = prev.previousElementSibling;
          }
        }
        const nextEl = parentLi ? parentLi.nextElementSibling : null;
        const hasHideDiv = !!(nextEl && nextEl.tagName === "DIV" && nextEl.id.startsWith("hideDiv"));
        const sport = resolveSportFromDocument();
        const year = resolveYearFromDocument(setName);
        exportSingleParentSetHierarchy(setId, setName, { sport, year, category, hasHideDiv });
      },
      displayMode: Config.global?.setButtonDisplay || "both"
    });
    return container;
  }
  function reinjectSetActions() {
    document.querySelectorAll(".tk-injected-badge-group").forEach((el) => el.remove());
    document.querySelectorAll("[data-tk-injected]").forEach((el) => {
      delete el.dataset.tkInjected;
    });
    const links = findSetLinks();
    injectSetActions(links);
  }
  function injectSetActions(links) {
    const currentPageSid = extractSid(window.location.href);
    let injected = 0;
    links.forEach((link) => {
      if (link.dataset.tkInjected) return;
      const setId = extractSid(link.href);
      if (!setId) return;
      link.dataset.tkInjected = "true";
      const group = buildBadgeGroup(link, setId, currentPageSid);
      if (!group) return;
      const fragment = document.createDocumentFragment();
      fragment.appendChild(group);
      link.after(fragment);
      injected++;
    });
    return injected;
  }
  function injectInChunks(links, onDone = () => {
  }) {
    let cursor = 0;
    let total = 0;
    const chunkSize = Config.global?.setListEnhancerChunkSize ?? CHUNK_SIZE;
    const step = () => {
      const slice = links.slice(cursor, cursor + chunkSize);
      cursor += chunkSize;
      total += injectSetActions(slice);
      if (cursor < links.length) {
        onIdle(step);
      } else {
        onDone(total);
      }
    };
    step();
  }
  var ActiveObservers = /* @__PURE__ */ new Set();
  function disconnectSetListEnhancer() {
    ActiveObservers.forEach((obs) => {
      try {
        obs.disconnect();
      } catch {
      }
    });
    ActiveObservers.clear();
  }
  function observeSetLinks(options = {}) {
    disconnectSetListEnhancer();
    if (typeof MutationObserver !== "function" || typeof document === "undefined") return null;
    const target = document.getElementById("main-content-area") || document.body;
    if (!target) return null;
    let debounceTimer = null;
    const observer = new MutationObserver((mutations) => {
      const isSelfMutation = mutations.every((m) => Array.from(m.addedNodes).every((node) => node.nodeType === 1 && (node.classList?.contains("tk-injected-badge-group") || node.querySelector?.(".tk-injected-badge-group") !== null)));
      if (isSelfMutation) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        try {
          enhanceSetDropdownSearch(target.ownerDocument || document);
          const pending = findUninjectedSetLinks();
          if (pending.length > 0) {
            injectInChunks(pending, (n) => {
              if (n > 0) {
                Log(`Set List Enhancer: Enhanced ${n} late-rendered / dynamic set link(s).`, "info");
              }
            });
          }
        } catch (err) {
          Log(`Set List Enhancer observer error: ${err.message}`, "warn");
        }
      }, 150);
    });
    try {
      observer.observe(target, { childList: true, subtree: true });
      ActiveObservers.add(observer);
      if (options.timeoutMs > 0) {
        setTimeout(() => {
          if (debounceTimer) clearTimeout(debounceTimer);
          try {
            observer.disconnect();
          } finally {
            ActiveObservers.delete(observer);
          }
        }, options.timeoutMs);
      }
    } catch (err) {
      Log(`Set List Enhancer: Failed to observe target element: ${err.message}`, "warn");
      observer.disconnect();
      return null;
    }
    return observer;
  }
  function enhanceSetDropdownSearch(doc = document) {
    const searchInput = doc.querySelector(SELECTOR_REGISTRY.setDropdown.search);
    const setList = doc.querySelector(SELECTOR_REGISTRY.setDropdown.list);
    if (!searchInput || !setList) return false;
    if (searchInput.dataset.tkEnhanced) return true;
    searchInput.dataset.tkEnhanced = "true";
    searchInput.addEventListener(
      "input",
      (e) => {
        e.stopImmediatePropagation();
        const term = searchInput.value.trim().toLowerCase();
        const conditions = term ? term.split(/[,;|\s]+/).filter(Boolean) : [];
        const listItems = setList.querySelectorAll("li");
        listItems.forEach((li) => {
          const link = li.querySelector("a");
          if (!link) return;
          const text = link.textContent.trim().toLowerCase();
          const match = conditions.length === 0 || conditions.some((cond) => text.includes(cond));
          li.classList.toggle("hidden", !match);
        });
      },
      true
    );
    Log("Set List Enhancer: Enhanced set dropdown search with substring and OR matching.", "info");
    recordContract("setListEnhancer", "enhanced set dropdown search", true);
    return true;
  }
  function initSetListEnhancer() {
    disconnectSetListEnhancer();
    enhanceSetDropdownSearch();
    const setLinks = findSetLinks();
    if (setLinks.length === 0) {
      Log("Set List Enhancer: Waiting for set links to render...", "info");
      assertContract("setListEnhancer", [
        { selector: SET_LINK_SELECTOR, label: "set links (pin/export badge anchors)", optional: true }
      ]);
    } else {
      const pending = findUninjectedSetLinks();
      injectInChunks(pending, () => {
        const injectedCount = setLinks.filter((link) => link.dataset.tkInjected).length;
        Log(`Set List Enhancer: Enhanced ${injectedCount} of ${setLinks.length} set link(s).`, "info");
        recordContract("setListEnhancer", `badges on ${injectedCount} of ${setLinks.length} set link(s)`, injectedCount > 0);
      });
    }
    observeSetLinks();
  }

  // src/modules/addMultiplesEnhancer.js
  var FOCUS_DEADLINE_MS = 1200;
  var USER_INTENT_EVENTS = ["keydown", "pointerdown", "wheel"];
  function applySaleTypeDefaults(root = document) {
    let changed = 0;
    root.querySelectorAll("select").forEach((select) => {
      const fsOpt = Array.from(select.options).find((opt) => opt.text.includes("For Sale/Trade"));
      if (!fsOpt || select.value === fsOpt.value) return;
      select.value = fsOpt.value;
      changed++;
    });
    return changed;
  }
  function autoScrollIfOutsideMiddle80(el) {
    if (!el || typeof el.getBoundingClientRect !== "function") return false;
    const viewportHeight = typeof window !== "undefined" && window.innerHeight || (typeof document !== "undefined" && document.documentElement ? document.documentElement.clientHeight : 0);
    if (!viewportHeight) return false;
    const rect = el.getBoundingClientRect();
    const topThreshold = viewportHeight * 0.1;
    const bottomThreshold = viewportHeight * 0.9;
    if (rect.top < topThreshold || rect.bottom > bottomThreshold) {
      if (typeof el.scrollIntoView === "function") {
        el.scrollIntoView({ block: "center", inline: "nearest" });
      }
      return true;
    }
    return false;
  }
  function focusFirstQuantityField() {
    const target = (() => {
      const inputs = InputIndex.getValidInputs();
      return inputs.find((el) => el.value === "0") || inputs[0] || null;
    })();
    if (!target) return;
    let cancelled = false;
    const focusDeadlineMs = Config.global?.addMultiplesFocusDeadlineMs ?? FOCUS_DEADLINE_MS;
    const deadline = Date.now() + focusDeadlineMs;
    const stop = () => {
      if (cancelled) return;
      cancelled = true;
      USER_INTENT_EVENTS.forEach((type) => document.removeEventListener(type, stop, true));
    };
    USER_INTENT_EVENTS.forEach((type) => document.addEventListener(type, stop, true));
    const assert = () => {
      if (cancelled) return;
      if (document.activeElement !== target) {
        target.focus({ preventScroll: true });
        target.select();
      }
      autoScrollIfOutsideMiddle80(target);
      if (Date.now() < deadline) {
        const raf = typeof requestAnimationFrame === "function" ? requestAnimationFrame : typeof window !== "undefined" && typeof window.requestAnimationFrame === "function" ? window.requestAnimationFrame : null;
        if (raf) raf(assert);
      } else {
        stop();
      }
    };
    assert();
  }
  function initAddMultiplesEnhancer() {
    if (typeof document !== "undefined") {
      document.addEventListener("focusin", (e) => {
        if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA")) {
          autoScrollIfOutsideMiddle80(e.target);
        }
      });
    }
    const changed = applySaleTypeDefaults();
    if (changed > 0) Log(`Add Multiples: defaulted ${changed} sale-type select(s).`, "debug");
    recordContract(
      "addMultiplesEnhancer",
      `${changed} sale-type select(s) defaulted`,
      document.querySelectorAll("select").length > 0
    );
    focusFirstQuantityField();
  }

  // src/data/collectionBrowseParser.js
  var COLLECTION_BROWSE_HEADER = [
    "Sport",
    "Year",
    "Set Name",
    "Child Set",
    "Card No",
    "Player Name",
    "Tags",
    "Print Run",
    "Qty"
  ];
  function parseSetAndChildSet(setDetails) {
    const clean = String(setDetails || "").trim();
    if (!clean) return { setName: "Unknown", childSet: "" };
    const setParts = clean.split(" - ");
    const setName = setParts[0].trim();
    const childSet = setParts.length > 1 ? setParts.slice(1).join(" - ").trim() : "";
    return { setName, childSet };
  }
  function parseQuantity(cell) {
    if (!cell) return "1";
    const badge = cell.querySelector(".badge, span.badge");
    if (badge && badge.textContent.trim()) {
      const bMatch = badge.textContent.trim().match(/^(\d+)/);
      if (bMatch) return bMatch[1];
    }
    const raw = (cell.innerText || cell.textContent || "").replace(/(\r\n|\n|\r|,|\[|\])/gm, " ").trim();
    const match = raw.match(/^(\d+)/);
    return match ? match[1] : raw || "1";
  }
  function detectPageSport(root) {
    const text = root.body ? root.body.textContent || "" : root.textContent || "";
    if (text.includes("Baseball")) return "Baseball";
    if (text.includes("Basketball")) return "Basketball";
    if (text.includes("Football")) return "Football";
    if (text.includes("Hockey")) return "Hockey";
    return "Unknown";
  }
  function normalizeListType(root = document) {
    let rawText = "";
    const filterSelect = root.querySelector ? root.querySelector('select[name="Filter"]') : null;
    if (filterSelect && filterSelect.options && filterSelect.options.length > 0) {
      const selected = filterSelect.options[filterSelect.selectedIndex];
      if (selected) {
        rawText = (selected.text || selected.value || "").trim();
      }
    }
    let href = "";
    if (root.defaultView && root.defaultView.location) {
      href = root.defaultView.location.href || "";
    } else if (typeof window !== "undefined" && window.location) {
      href = window.location.href || "";
    }
    if (root.childNodes) {
      Array.from(root.childNodes).forEach((node) => {
        if (node.nodeType === 8) {
          href += ` ${node.nodeValue || ""}`;
        }
      });
    }
    const strongHeaders = Array.from(root.querySelectorAll ? root.querySelectorAll("td strong, h3, h4") : []);
    const headerTexts = strongHeaders.map((el) => el.textContent.trim()).join(" ");
    const scriptsText = Array.from(root.querySelectorAll ? root.querySelectorAll("script") : []).map((s) => s.textContent).join(" ");
    const combined = `${rawText} ${href} ${headerTexts} ${scriptsText}`.toLowerCase();
    if (combined.includes("/col/wantlist") || combined.includes("wantlist6") || combined.includes("status=w") || combined.includes("wantlist") || combined.includes("wants") || combined.includes("filter=w")) {
      return "Wantlist";
    }
    if (combined.includes("/col/forsale") || combined.includes("forsale-trade") || combined.includes("status=s") || combined.includes("status=f") || combined.includes("forsale") || combined.includes("for sale") || combined.includes("trade") || combined.includes("filter=fs") || combined.includes("filter=s") || combined.includes("filter=f") || combined.includes("filter=t")) {
      return "ForSale";
    }
    return "Collection";
  }
  function parseCollectionBrowseSet(root) {
    let year = "Unknown";
    let sport = "Unknown";
    let setName = "Unknown";
    let childSet = "";
    const listType = normalizeListType(root);
    const docTitle = root.title || "";
    try {
      const titleData = docTitle.split("|")[0].trim();
      const prefixMatch = titleData.match(/^Collection\s+-\s+.*?\s+-\s+(\d{4}.*)$/);
      if (prefixMatch) {
        let details = prefixMatch[1];
        const sportMatch = details.match(/(.*)\s+([a-zA-Z-]+)$/);
        if (sportMatch) {
          sport = sportMatch[2];
          details = sportMatch[1];
        }
        const yearMatch = details.match(/^(\d{4}(?:-\d{2})?)\s+(.*)$/);
        if (yearMatch) {
          year = yearMatch[1];
          details = yearMatch[2];
        }
        const setInfo = parseSetAndChildSet(details);
        setName = setInfo.setName;
        childSet = setInfo.childSet;
      }
    } catch (e) {
      Log(`Title parsing failed for CollectionBrowse: ${e.message}`, "error");
    }
    Log(
      `[CLIENT] Parsed CollectionBrowse set context: Sport='${sport}', Year='${year}', SetName='${setName}', ChildSet='${childSet}', ListType='${listType}'`,
      "debug",
      "client"
    );
    const rowEls = Array.from(
      root.querySelectorAll('tr.collection_row, tr[class*="collection_row"], tr.collection.row')
    );
    const dataRows = [];
    rowEls.forEach((tr) => {
      const cells = Array.from(tr.querySelectorAll("td"));
      if (cells.length >= 5) {
        const qty = parseQuantity(cells[0]);
        const cardNo = (cells[2] ? cells[2].innerText || cells[2].textContent : "").replace(/(\r\n|\n|\r|,)/gm, " ").trim();
        const rawPlayerText = (cells[4] ? cells[4].innerText || cells[4].textContent : "").replace(/(\r\n|\n|\r|,)/gm, " ").trim();
        const { subject: playerName, tags, printRun } = parseSubjectCell(rawPlayerText);
        dataRows.push([sport, year, setName, childSet, cardNo, playerName, tags, printRun, qty]);
      }
    });
    const listSuffix = listType === "Collection" ? "" : `_${listType}`;
    const filename = `${compactSegment(sport)}_${compactSegment(year)}${compactSegment(setName)}${compactSegment(childSet)}${listSuffix}.csv`;
    Log(`[CLIENT] Extracted ${dataRows.length} data rows for CollectionBrowse set export: ${filename}`, "debug", "client");
    return {
      type: "set",
      sport,
      year,
      setName,
      childSet,
      listType,
      rows: dataRows,
      filename
    };
  }
  function parseCollectionBrowsePlayer(root) {
    let globalPlayer = "Unknown";
    const globalSport = detectPageSport(root);
    const listType = normalizeListType(root);
    const docTitle = root.title || "";
    try {
      const titleData = docTitle.split("|")[0].replace("Trading Card Database", "").trim();
      const titleMatch = titleData.match(/^Collection\s+-\s+.*?\s+-\s+(.*)$/);
      if (titleMatch) {
        globalPlayer = titleMatch[1].trim();
      }
    } catch (e) {
      Log(`Title parsing failed for CollectionBrowseP: ${e.message}`, "error");
    }
    Log(
      `[CLIENT] Parsed CollectionBrowseP player context: Player='${globalPlayer}', Sport='${globalSport}', ListType='${listType}'`,
      "debug",
      "client"
    );
    const rowEls = Array.from(
      root.querySelectorAll('tr.collection.row, tr[class*="collection row"], tr.collection_row')
    );
    const dataRows = [];
    rowEls.forEach((tr) => {
      const cells = Array.from(tr.querySelectorAll("td"));
      if (cells.length >= 2) {
        const qtyRaw = (cells[0] ? cells[0].innerText || cells[0].textContent : "").replace(/(\r\n|\n|\r|,|\[|\])/gm, " ").trim();
        const qtyMatch = qtyRaw.match(/^(\d+)/);
        if (!qtyMatch) return;
        const qty = qtyMatch[1];
        const cardCell = cells[1] && (cells[1].innerText || cells[1].textContent || "").includes("#") ? cells[1] : cells[2] || cells[1];
        if (!cardCell) return;
        const cardText = (cardCell.innerText || cardCell.textContent || "").replace(/(\r\n|\n|\r|,)/gm, " ").trim();
        const cardMatch = cardText.match(/^(\d{4}(?:-\d{2})?)\s+(.*?)\s+#([^\s]+)\s+(.*)$/);
        let year = "Unknown";
        let setName = "Unknown";
        let childSet = "";
        let cardNo = "Unknown";
        let playerName = globalPlayer;
        let tags = "";
        let printRun = "";
        if (cardMatch) {
          year = cardMatch[1];
          const setDetails = cardMatch[2];
          cardNo = cardMatch[3];
          const setInfo = parseSetAndChildSet(setDetails);
          setName = setInfo.setName;
          childSet = setInfo.childSet;
          const parsedSubject = parseSubjectCell(cardMatch[4].trim());
          playerName = parsedSubject.subject || globalPlayer;
          tags = parsedSubject.tags;
          printRun = parsedSubject.printRun;
        } else {
          setName = cardText;
          const parsedSubject = parseSubjectCell(globalPlayer);
          playerName = parsedSubject.subject || globalPlayer;
          tags = parsedSubject.tags;
          printRun = parsedSubject.printRun;
        }
        dataRows.push([globalSport, year, setName, childSet, cardNo, playerName, tags, printRun, qty]);
      }
    });
    const filename = `${compactSegment(globalPlayer)}_${compactSegment(listType)}.csv`;
    Log(`[CLIENT] Extracted ${dataRows.length} data rows for CollectionBrowseP player export: ${filename}`, "debug", "client");
    return {
      type: "player",
      globalPlayer,
      globalSport,
      listType,
      rows: dataRows,
      filename
    };
  }
  function parseCollectionBrowseTeam(root) {
    let globalTeam = "Unknown";
    const globalSport = detectPageSport(root);
    const listType = normalizeListType(root);
    const docTitle = root.title || "";
    try {
      const titleData = docTitle.split("|")[0].replace("Trading Card Database", "").trim();
      const titleMatch = titleData.match(/^Collection\s+-\s+.*?\s+-\s+(.*)$/);
      if (titleMatch) {
        globalTeam = titleMatch[1].trim();
      }
    } catch (e) {
      Log(`Title parsing failed for CollectionBrowseT: ${e.message}`, "error");
    }
    Log(
      `[CLIENT] Parsed CollectionBrowseT team context: Team='${globalTeam}', Sport='${globalSport}', ListType='${listType}'`,
      "debug",
      "client"
    );
    const playerResult = parseCollectionBrowsePlayer(root);
    const filename = `${compactSegment(globalTeam)}_${compactSegment(listType)}.csv`;
    Log(`[CLIENT] Extracted ${playerResult.rows.length} data rows for CollectionBrowseT team export: ${filename}`, "debug", "client");
    return {
      type: "team",
      globalTeam,
      globalSport,
      listType,
      rows: playerResult.rows,
      filename
    };
  }
  function parseCollectionBrowseDocument(root = document) {
    let isTeamBrowse = false;
    let isPlayerBrowse = false;
    let href = "";
    if (root.defaultView && root.defaultView.location) {
      href = root.defaultView.location.href || "";
    } else if (typeof window !== "undefined" && window.location) {
      href = window.location.href || "";
    }
    if (root.childNodes) {
      Array.from(root.childNodes).forEach((node) => {
        if (node.nodeType === 8) {
          href += ` ${node.nodeValue || ""}`;
        }
      });
    }
    const hrefLower = href.toLowerCase();
    if (hrefLower.includes("collectionbrowset.cfm")) {
      isTeamBrowse = true;
    } else if (hrefLower.includes("collectionbrowsep.cfm")) {
      isPlayerBrowse = true;
    } else {
      const docTitle = root.title || "";
      const titleData = docTitle.split("|")[0].trim();
      if (/^Collection\s+-\s+.*?\s+-\s+[^\d]/i.test(titleData)) {
        isPlayerBrowse = true;
      }
    }
    const result = isTeamBrowse ? parseCollectionBrowseTeam(root) : isPlayerBrowse ? parseCollectionBrowsePlayer(root) : parseCollectionBrowseSet(root);
    return {
      header: COLLECTION_BROWSE_HEADER,
      rows: [COLLECTION_BROWSE_HEADER, ...result.rows],
      filename: result.filename,
      type: result.type,
      meta: result
    };
  }

  // src/data/printCollectionParser.js
  var PRINT_COLLECTION_HEADER = [
    "Sport",
    "Year",
    "Set Name",
    "Child Set",
    "Card No",
    "Player Name",
    "Tags",
    "Print Run",
    "Qty"
  ];
  function checkIncludePrice(doc = document) {
    let search = "";
    if (doc.defaultView && doc.defaultView.location) {
      search = doc.defaultView.location.search || "";
    } else if (typeof window !== "undefined" && window.location) {
      search = window.location.search || "";
    }
    const partLink = doc.querySelector?.('a[href*="PrintYourCollectionPDF"], a[href*="PrintCenter.cfm"], a[href*="prices="]');
    if (partLink && partLink.href) {
      search += (search ? "&" : "?") + (partLink.href.split("?")[1] || "");
    }
    const params = new URLSearchParams(search);
    return params.get("prices") === "Y" || params.get("prices") === "y";
  }
  function getSportFromDoc(doc = document) {
    let search = "";
    if (doc.defaultView && doc.defaultView.location) {
      search = doc.defaultView.location.search || "";
    } else if (typeof window !== "undefined" && window.location) {
      search = window.location.search || "";
    }
    const partLink = doc.querySelector?.('a[href*="PrintYourCollectionPDF"], a[href*="PrintCenter.cfm"], a[href*="Type="]');
    if (partLink && partLink.href) {
      search += (search ? "&" : "?") + (partLink.href.split("?")[1] || "");
    }
    const params = new URLSearchParams(search);
    const type = params.get("Type");
    if (type) return type;
    const headerTitle = doc.querySelector?.(".yourcol-title h4");
    if (headerTitle) {
      const text = headerTitle.textContent.trim();
      const parts = text.split("-");
      if (parts.length > 1) {
        return parts[parts.length - 1].trim();
      }
    }
    return "Unknown";
  }
  function buildPrintCollectionUrlFromDoc(doc = document, part = 1) {
    const currentUrl = typeof window !== "undefined" && window.location ? window.location.href : "";
    const searchParams = new URLSearchParams(typeof window !== "undefined" && window.location ? window.location.search : "");
    const existingLink = doc.querySelector?.('a[href*="PrintYourCollectionPDF"], a[href*="PrintCenter.cfm"], a[href*="Part="]');
    let linkParams = new URLSearchParams();
    if (existingLink && existingLink.href) {
      try {
        const q = existingLink.href.split("?")[1];
        if (q) linkParams = new URLSearchParams(q);
      } catch {
      }
    }
    const memberMatch = currentUrl.match(/\/member\/([^/?]+)/i);
    const member = memberMatch ? memberMatch[1] : linkParams.get("Member") || searchParams.get("Member") || "";
    const collectionMatch = currentUrl.match(/\/collection\/(\d+)/i);
    const collectionId = collectionMatch ? collectionMatch[1] : linkParams.get("CollectionID") || searchParams.get("CollectionID") || "";
    let sport = searchParams.get("Type") || linkParams.get("Type") || "";
    if (!sport && doc.querySelector) {
      const strongEl = doc.querySelector("#content div.col-md-8 p strong, .block1 p strong, p strong");
      if (strongEl) {
        sport = strongEl.textContent.trim();
      }
    }
    if (!sport) sport = "Baseball";
    let filter = searchParams.get("Filter") || linkParams.get("Filter") || "";
    if (!filter && doc.querySelector) {
      const h3El = doc.querySelector("#content div.col-md-8 h3, .block1 h3, h3");
      const h3Text = h3El ? h3El.textContent.trim().toLowerCase() : "";
      if (h3Text.includes("wantlist")) {
        filter = "W";
      } else if (h3Text.includes("for sale") || h3Text.includes("trade")) {
        filter = "FS";
      } else {
        filter = "S";
      }
    }
    if (!filter) filter = "S";
    const prices = searchParams.get("prices") === "Y" || linkParams.get("prices") === "Y" ? "Y" : "N";
    return `PrintYourCollectionPDF.cfm?Type=${encodeURIComponent(sport)}&CollectionID=${encodeURIComponent(collectionId)}&Part=${part}&columns=2&fontsize=1&prices=${prices}&SetID=&Member=${encodeURIComponent(member)}&Filter=${encodeURIComponent(filter)}&sTeamID=`;
  }
  function parsePrintItem(item, options = {}) {
    const sport = options.sport || "Unknown";
    const includePrice = !!options.includePrice;
    const textSpan = item.querySelector(".yourcol-text");
    if (!textSpan) return null;
    let qty = 1;
    const qtySpan = item.querySelector(".yourcol-qty");
    if (qtySpan) {
      const qtyMatch = qtySpan.textContent.match(/\d+/);
      if (qtyMatch) {
        qty = parseInt(qtyMatch[0], 10);
      }
    }
    let entry = textSpan.textContent.replace(/\s+/g, " ").trim();
    let price = "";
    if (includePrice) {
      const dollarParts = entry.split("$");
      if (dollarParts.length > 1) {
        let lastPart = dollarParts.pop().trim();
        lastPart = lastPart.replace(/\$/g, "").trim();
        if (lastPart.length > 0) {
          const num = parseFloat(lastPart.replace(/,/g, ""));
          if (!isNaN(num)) {
            price = num.toFixed(2);
          } else {
            price = lastPart;
          }
        }
        entry = dollarParts.join("$").trim();
      }
    }
    entry = entry.replace(/(?:\s*\$)+$/, "").trim();
    if (!entry) return null;
    let year = "";
    const yearMatch = entry.match(/^(\d{4})\s+/);
    if (yearMatch) {
      year = yearMatch[1];
      entry = entry.substring(yearMatch[0].length).trim();
    }
    const childSet = "";
    const tokens = entry.split(" ");
    let cardIdx = -1;
    for (let i = tokens.length - 2; i >= 0; i--) {
      const part = tokens[i];
      if (/\d/.test(part) || /^[A-Z0-9-]+$/.test(part) && (part.length >= 3 || /-/.test(part))) {
        cardIdx = i;
        break;
      }
    }
    let setName = "";
    let cardNo = "";
    let remainingSubject = "";
    if (cardIdx !== -1) {
      setName = tokens.slice(0, cardIdx).join(" ");
      cardNo = tokens[cardIdx];
      remainingSubject = tokens.slice(cardIdx + 1).join(" ");
    } else {
      setName = entry;
    }
    const subTokens = remainingSubject.split(" ");
    const playerParts = [];
    const tagParts = [];
    let printRun = "";
    let foundNonTag = false;
    for (let i = subTokens.length - 1; i >= 0; i--) {
      const token = subTokens[i].trim();
      if (!token) continue;
      const cleanToken = token.replace(/,/g, "").trim();
      if (!foundNonTag && PRINT_RUN.test(cleanToken)) {
        printRun = cleanToken.replace(/^SN/i, "");
      } else if (!foundNonTag && NAME_SUFFIX.test(cleanToken)) {
        foundNonTag = true;
        playerParts.unshift(token);
      } else if (!foundNonTag && isTagToken(cleanToken)) {
        tagParts.unshift(cleanToken);
      } else {
        foundNonTag = true;
        playerParts.unshift(token);
      }
    }
    const playerName = playerParts.join(" ").replace(/,\s*$/, "").trim();
    const tags = tagParts.join(", ");
    const row = [
      sport,
      year,
      setName,
      childSet,
      cardNo,
      playerName,
      tags,
      printRun,
      qty
    ];
    if (includePrice) {
      row.push(price);
    }
    return { row, qty };
  }
  function parsePrintCollectionDocument(doc = document, options = {}) {
    const includePrice = options.includePrice !== void 0 ? options.includePrice : checkIncludePrice(doc);
    const sport = options.sport || getSportFromDoc(doc);
    const items = Array.from(doc.querySelectorAll(".yourcol-item"));
    const header = [...PRINT_COLLECTION_HEADER];
    if (includePrice) {
      header.push("Price");
    }
    const rows = options.includeHeader !== false ? [header] : [];
    let count = 0;
    let quantity = 0;
    let skipped = 0;
    items.forEach((item) => {
      try {
        const parsed = parsePrintItem(item, { sport, includePrice });
        if (parsed) {
          rows.push(parsed.row);
          count++;
          quantity += parsed.qty;
        } else {
          skipped++;
        }
      } catch {
        skipped++;
      }
    });
    return { rows, count, quantity, skipped, header };
  }

  // src/net/printCollectionExport.js
  var assessmentCache = null;
  var CurrentPrintRun = {
    /** @type {AbortController|null} */
    controller: null
  };
  async function assessPrintCollectionPageCount(doc = document, callbacks = {}, signal = null) {
    const remainingMin = cooldownRemainingMinutes();
    if (remainingMin > 0) {
      setStatus("Export blocked (cooldown)");
      showToast({
        message: `Assessment paused — an anti-scraping block was detected recently. Try again in ~${remainingMin} min.`,
        variant: "error"
      });
      return null;
    }
    const includePrice = checkIncludePrice(doc);
    const sport = getSportFromDoc(doc);
    const initialUrlStr = buildPrintCollectionUrlFromDoc(doc, 1);
    const baseUrl = new URL(initialUrlStr, typeof window !== "undefined" && window.location ? window.location.href : "https://www.tcdb.com");
    let part = 1;
    let hasData = true;
    const maxParts = EXPORT_CONFIG.maxPages || 20;
    const aggregatedRows = [];
    let totalCards = 0;
    let totalQuantity = 0;
    setStatus("Calculating page count...");
    Log("[CLIENT] Starting Print Collection page count assessment...", "info", "client");
    while (hasData) {
      if (part > maxParts) {
        Log(`[CLIENT] Assessment safeguard: hit max limit of ${maxParts} parts.`, "warn", "client");
        break;
      }
      if (signal?.aborted) throw new AbortedError("Export cancelled.", true);
      if (part > 1) {
        callbacks.onProgress?.(`Waiting anti-scraping delay...`);
        await jitteredDelay();
      }
      baseUrl.searchParams.set("Part", part);
      const fetchUrl = baseUrl.pathname + baseUrl.search;
      const fullFetchUrl = Utils.toFullUrl(fetchUrl);
      callbacks.onProgress?.(`Probing Part ${part}...`);
      setStatus(`Assessing Part ${part}...`);
      Log(`Assessment fetching Part ${part}: ${Utils.formatLogUrl(fullFetchUrl)}`, "info", "server");
      try {
        let pageDoc = doc;
        if (part > 1 || !doc.querySelector(".yourcol-item")) {
          const response = await fetchPageWithRetry(fetchUrl, part, { onStatus: setStatus, signal });
          const html = await response.text();
          const blockMarker = detectBlock(html);
          if (blockMarker) {
            throw new BlockedError(`Challenge page received instead of content (matched '${blockMarker}').`);
          }
          pageDoc = new DOMParser().parseFromString(html, "text/html");
        }
        const parsed = parsePrintCollectionDocument(pageDoc, {
          includeHeader: part === 1,
          includePrice,
          sport
        });
        if (parsed.count === 0) {
          Log(`[CLIENT] Page Part ${part} contains 0 items. Stopping assessment.`, "info", "client");
          hasData = false;
        } else {
          const dataRows = part === 1 ? parsed.rows : parsed.rows;
          aggregatedRows.push(...dataRows);
          totalCards += parsed.count;
          totalQuantity += parsed.quantity;
          part++;
        }
      } catch (err) {
        if (err instanceof AbortedError && aggregatedRows.length > 0) {
          assessmentCache = {
            totalPages: part - 1,
            totalCards,
            totalQuantity,
            rows: aggregatedRows,
            includePrice,
            sport,
            isPartial: true
          };
          return assessmentCache;
        }
        Log(`[CLIENT] Assessment halted at Part ${part}: ${err.message}`, "error", "client");
        if (part === 1) throw err;
        break;
      }
    }
    const totalPages = part - 1;
    assessmentCache = {
      totalPages,
      totalCards,
      totalQuantity,
      rows: aggregatedRows,
      includePrice,
      sport
    };
    Log(
      `[CLIENT] Page count assessment complete: ${totalPages} page(s), ${totalCards.toLocaleString()} card(s), ${totalQuantity.toLocaleString()} total qty.`,
      "info",
      "client"
    );
    setStatus(`Calculated ${totalPages} Page(s) (${totalCards.toLocaleString()} Cards)`);
    return assessmentCache;
  }
  function exportPrintCollectionCSV(doc = document) {
    const sport = getSportFromDoc(doc);
    const label = `Print Collection (${sport})`;
    Log(`[CLIENT] Enqueuing Print Collection CSV Export for ${label}`, "info", "client");
    ExportQueue.enqueue(label, () => runExportPrintCollectionCSV(doc));
  }
  async function runExportPrintCollectionCSV(doc = document) {
    const remainingMin = cooldownRemainingMinutes();
    if (remainingMin > 0) {
      setStatus("Export blocked (cooldown)");
      showToast({
        message: `Export paused — anti-scraping cooldown active (~${remainingMin} min left).`,
        variant: "error"
      });
      return;
    }
    const controller = new AbortController();
    CurrentPrintRun.controller = controller;
    const progress = showProgressToast({
      title: "Exporting Print Collection",
      onCancel: () => {
        controller.abort();
        Log("[CLIENT] Print Collection Export cancelled by user.", "info", "client");
      }
    });
    try {
      let data = assessmentCache;
      if (!data || !data.rows || data.rows.length === 0) {
        progress.update("Calculating page count...");
        data = await assessPrintCollectionPageCount(doc, {
          onProgress: (msg) => progress.update(msg)
        }, controller.signal);
      }
      if (!data || !data.rows || data.rows.length === 0) {
        throw new Error("No printable card data found across pages.");
      }
      if (data.isPartial || controller.signal.aborted) {
        const filename2 = buildPrintCollectionFilename({
          includePrice: data.includePrice
        });
        const csvContent2 = CSV.toCSV(data.rows);
        CSV.download(csvContent2, filename2);
        setStatus("Export cancelled (partial delivered)");
        progress.finish(`Cancelled — ${data.totalCards.toLocaleString()} cards downloaded.`, "warning");
        return;
      }
      progress.update(`Compiling ${data.totalCards.toLocaleString()} cards...`);
      const filename = buildPrintCollectionFilename({
        includePrice: data.includePrice
      });
      const csvContent = CSV.toCSV(data.rows);
      CSV.download(csvContent, filename);
      setStatus("Export Complete");
      progress.finish(`Exported ${data.totalCards.toLocaleString()} cards (${data.totalQuantity.toLocaleString()} total qty) to ${filename}`, "success");
      Log(`[CLIENT] Exported Print Collection CSV successfully: ${filename}`, "info", "client");
    } catch (error) {
      if (error instanceof BlockedError) {
        progress.finish("Stopped — anti-scraping challenge page received.", "error");
        setStatus("Export blocked");
      } else if (error instanceof AbortedError || controller.signal.aborted) {
        progress.finish("Cancelled.", "muted");
        setStatus("Export cancelled");
      } else {
        progress.finish(`Export failed: ${error.message}`, "error");
        setStatus("Export Failed");
        Log(`[CLIENT] Print Collection CSV Export failed: ${error.message}`, "error", "client");
      }
    } finally {
      CurrentPrintRun.controller = null;
    }
  }

  // src/modules/csvExportEngine.js
  var PRINT_ITEM_SELECTOR = ".yourcol-item";
  function collectRows(root = document) {
    let href = "";
    if (root.defaultView && root.defaultView.location) {
      href = root.defaultView.location.href || "";
    } else if (typeof window !== "undefined" && window.location) {
      href = window.location.href || "";
    }
    const docTitle = root.title || "";
    const titleData = docTitle.split("|")[0].trim();
    const isCollBrowse = href.toLowerCase().includes("collectionbrowse.cfm") || href.toLowerCase().includes("collectionbrowsep.cfm") || /^Collection\s+-\s+/i.test(titleData);
    if (isCollBrowse) {
      const parsed = parseCollectionBrowseDocument(root);
      return parsed.rows;
    }
    const collectionRows = Array.from(root.querySelectorAll("tr.collection_row"));
    if (collectionRows.length > 0) {
      const rows = [["Qty", "Status", "Card Description", "Notes"]];
      collectionRows.forEach((tr) => {
        let qty = "1";
        const badge = tr.querySelector(".badge, span.badge");
        if (badge) {
          const text = badge.textContent.trim();
          if (text) qty = text;
        }
        let status = "";
        const statusIcon = tr.querySelector("i[title], img[title]");
        if (statusIcon) {
          status = statusIcon.getAttribute("title") || "";
        }
        let cardText = "";
        const cardLink = tr.querySelector('a[href*="ViewCard.cfm"], a[href*="CollectionEdit.cfm"]');
        if (cardLink) {
          cardText = cardLink.textContent.trim();
        }
        const cells = Array.from(tr.children);
        const notes = [];
        cells.forEach((td, idx) => {
          if (td.querySelector(".dropdown-menu, .btn-group, button")) return;
          if (idx === 0) return;
          const text = td.textContent.replace(/\s+/g, " ").trim();
          if (text && text !== cardText && !text.includes(cardText)) {
            notes.push(text);
          }
        });
        rows.push([qty, status, cardText, notes.join(" ")]);
      });
      return rows;
    }
    const rawTables = Array.from(
      root.querySelectorAll("#main-content-area table tr, #content table tr, table tr")
    ).filter((tr) => {
      if (tr.closest("#sctk-toolbar") || tr.closest("#topnav") || tr.closest("#cse-search-box") || tr.closest(".col-md-3") || tr.closest(".col-md-4") || tr.closest("#offcanvas") || tr.closest(".sidebar") || tr.closest(".dropdown-menu")) {
        return false;
      }
      return tr.querySelector('a[href*="ViewCard.cfm"], a[href*="CollectionEdit.cfm"], a[href*="Checklist.cfm"]') !== null;
    });
    if (rawTables.length > 0) {
      const tableRows = rawTables.map((tr) => {
        const cloned = tr.cloneNode(true);
        cloned.querySelectorAll(".dropdown-menu, .btn-group, button, select, form, script, style").forEach((el) => el.remove());
        const cells = Array.from(cloned.querySelectorAll("td, th")).map((c) => c.textContent.replace(/\s+/g, " ").trim()).filter((text) => text.length > 0);
        return cells;
      }).filter((cells) => cells.length > 0);
      if (tableRows.length > 0) return tableRows;
    }
    if (root.querySelector(PRINT_ITEM_SELECTOR)) {
      const parsed = parsePrintCollectionDocument(root);
      return parsed.rows;
    }
    return [];
  }
  function generateCSV(type) {
    setStatus(`Exporting ${type}...`);
    Log(`[CLIENT] Exporting ${type} CSV...`, "info", "client");
    if (Routes.isCollectionBrowse() || Routes.isCollectionBrowseP() || Routes.isCollectionBrowseT()) {
      const parsed = parseCollectionBrowseDocument();
      if (parsed.rows.length <= 1) {
        setStatus("Nothing to export");
        showToast({ message: "Nothing to export — no rows found on this page.", variant: "error" });
        Log(`[CLIENT] Export aborted: no rows found for ${type}.`, "warn", "client");
        return;
      }
      CSV.download(CSV.toCSV(parsed.rows), parsed.filename);
      setStatus("Export Complete");
      showToast({ message: `Exported ${type} CSV successfully.` });
      Log(`[CLIENT] Exported ${type} CSV successfully: ${parsed.filename} (${parsed.rows.length - 1} data rows).`, "info", "client");
      return;
    }
    const csvRows = collectRows();
    if (csvRows.length === 0) {
      setStatus("Nothing to export");
      showToast({ message: "Nothing to export — no rows found on this page.", variant: "error" });
      Log(`[CLIENT] Export aborted: no rows found for ${type}.`, "warn", "client");
      return;
    }
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
    Log(`[CLIENT] Exported ${type} CSV successfully: ${filename} (${csvRows.length - 1} data rows).`, "info", "client");
  }
  function initCsvExportEngine() {
    recordContract("csvExportEngine", `${collectRows().length} exportable row(s)`, collectRows().length > 0);
    if (Routes.isPrintPDF()) {
      Toolbar.addAction("btn-calc-pages", "Calculate Page Count", async () => {
        const btnCalc2 = document.querySelector("#btn-calc-pages");
        if (btnCalc2) {
          btnCalc2.disabled = true;
          btnCalc2.textContent = "Calculating...";
        }
        const assessment = await assessPrintCollectionPageCount(document);
        if (assessment && assessment.totalPages > 0) {
          if (btnCalc2) btnCalc2.remove();
          Toolbar.addAction("btn-csv-pdf-all", `Export All Parts (1 - ${assessment.totalPages})`, () => {
            exportPrintCollectionCSV(document);
          }, false);
        } else if (btnCalc2) {
          btnCalc2.disabled = false;
          btnCalc2.textContent = "Calculate Page Count";
        }
      }, false);
      const btnCalc = document.querySelector("#btn-calc-pages");
      if (btnCalc) {
        btnCalc.title = "Calculate total pages prior to exporting";
      }
    } else if (Routes.isCollection()) {
      Toolbar.addAction("btn-csv-coll", "Export Collection", () => generateCSV("Collection"), true);
    } else if (Routes.isPlayerCollection()) {
      Toolbar.addAction("btn-csv-player", "Export Player Collection", () => generateCSV("Player_Collection"), true);
    }
  }
  var EXPORT_BUTTON_IDS = ["btn-csv-coll", "btn-csv-player", "btn-calc-pages", "btn-csv-pdf-all", "btn-export-hierarchy"];

  // src/modules/paginationLoader.js
  function normalizePaginationForms(root = document) {
    if (typeof root.querySelectorAll !== "function") return;
    const forms = root.querySelectorAll("form");
    forms.forEach((form) => {
      const hasPaginationInput = form.querySelector(
        'input[name*="PageIndex" i], select[name*="Filter" i], input[name="Submit"][validate="submitonce" i]'
      );
      if (!hasPaginationInput) return;
      form.removeAttribute("onsubmit");
      form.onsubmit = null;
      const rawAction = form.getAttribute("action") || "";
      if (rawAction) {
        try {
          const baseOrigin = typeof window !== "undefined" ? window.location.href : "http://localhost";
          const actionUrl = new URL(rawAction, baseOrigin);
          actionUrl.searchParams.forEach((val, key) => {
            const existing = form.querySelector(`[name="${key}"]`);
            if (!existing && form.ownerDocument) {
              const hidden = form.ownerDocument.createElement("input");
              hidden.type = "hidden";
              hidden.name = key;
              hidden.value = val;
              form.appendChild(hidden);
            }
          });
          actionUrl.search = "";
          form.setAttribute("action", actionUrl.toString());
        } catch {
        }
      }
      form.setAttribute("method", "get");
      if (form.dataset?.sctkNormalized) return;
      if (form.dataset) form.dataset.sctkNormalized = "true";
      form.addEventListener("submit", (e) => {
        try {
          const actionAttr = form.getAttribute("action") || (typeof window !== "undefined" ? window.location.href : "");
          if (!actionAttr) return;
          const baseOrigin = typeof window !== "undefined" ? window.location.href : "http://localhost";
          const targetUrl = new URL(actionAttr, baseOrigin);
          const inputs = form.querySelectorAll("input[name], select[name], textarea[name]");
          inputs.forEach((el) => {
            if (el.disabled) return;
            if ((el.type === "checkbox" || el.type === "radio") && !el.checked) return;
            if (el.type === "submit" || el.type === "button") return;
            const val = el.value;
            if (val !== void 0 && val !== null) {
              targetUrl.searchParams.set(el.name, String(val).trim());
            }
          });
          e.preventDefault();
          if (typeof window !== "undefined") {
            window.location.href = targetUrl.toString();
          }
        } catch {
        }
      });
    });
  }
  function initPaginationLoader(root = document) {
    if (!Routes.hasPagination(root)) return Promise.resolve();
    setStatus("Loading Pagination...");
    normalizePaginationForms(root);
    const delayMs = Config.global.paginationLoaderDelayMs || 1e3;
    const pollIntervalMs = 50;
    return new Promise((resolve) => {
      const startTime = Date.now();
      const timer = setInterval(() => {
        const elapsed = Date.now() - startTime;
        if (root.querySelector(".pagination") || elapsed >= delayMs) {
          clearInterval(timer);
          const getMainTable = (context) => {
            const tables = Array.from(context.querySelectorAll("table"));
            if (!tables.length) return null;
            return tables.reduce((largest, current) => current.rows.length > largest.rows.length ? current : largest);
          };
          const targetTable = getMainTable(root);
          if (!targetTable) {
            Log("[PaginationLoader] No target table found. Resolving immediately.", "debug", "client");
            return resolve();
          }
          const targetBody = targetTable.querySelector("tbody") || targetTable;
          let maxPage = 1;
          const currentUrl = new URL(window.location.href);
          const currentPageIndex = parseInt(currentUrl.searchParams.get("PageIndex") || currentUrl.searchParams.get("page")) || 1;
          root.querySelectorAll('a[href*="PageIndex=" i], a[href*="page=" i]').forEach((link) => {
            try {
              const url = new URL(link.getAttribute("href"), window.location.href);
              const page = parseInt(url.searchParams.get("PageIndex") || url.searchParams.get("page"));
              if (page && page > maxPage) maxPage = page;
            } catch {
            }
          });
          Log(`[PaginationLoader] Detected currentPage: ${currentPageIndex}, maxPage: ${maxPage}`, "info", "client");
          if (maxPage <= currentPageIndex) {
            Log("[PaginationLoader] No subsequent pages to load.", "info", "client");
            return resolve();
          }
          const targetMaxPage = Math.min(maxPage, EXPORT_CONFIG.maxPages || 200);
          if (targetMaxPage < maxPage) {
            Log(
              `[PaginationLoader] Discovered maxPage (${maxPage}) exceeds safety ceiling (${targetMaxPage}). Capping auto-fetch to ${targetMaxPage}.`,
              "warn",
              "client"
            );
          }
          const urlsToFetch = [];
          for (let i = currentPageIndex + 1; i <= targetMaxPage; i++) {
            const nextUrl = new URL(window.location.href);
            nextUrl.searchParams.set("PageIndex", i);
            urlsToFetch.push({ pageIndex: i, href: nextUrl.href });
          }
          root.querySelectorAll('ul.pagination, .pagination, [class*="pagination"]').forEach((el) => el.remove());
          root.querySelectorAll("form").forEach((form) => {
            if (form.querySelector('input[name*="PageIndex" i]')) form.remove();
          });
          (async () => {
            for (let i = 0; i < urlsToFetch.length; i++) {
              const item = urlsToFetch[i];
              const pageNum = item.pageIndex;
              const nextUrl = item.href;
              const shortUrl = Utils.formatLogUrl(nextUrl);
              const throttleThreshold = Math.max(1, Config.global.paginationThrottleStartPage || 6);
              const shouldThrottle = pageNum >= throttleThreshold;
              if (shouldThrottle) {
                const pacedMs = Math.round(EXPORT_CONFIG.baseDelayMs + (Pacing.penaltyMs || 0) + Math.random() * EXPORT_CONFIG.jitterMaxMs);
                Log(`[PaginationLoader] Page ${pageNum}/${targetMaxPage} reached threshold (${throttleThreshold}+). Applying pacing delay (~${pacedMs}ms)...`, "debug", "client");
                await jitteredDelay();
              }
              Log(`HTTP GET Request -> ${shortUrl}`, "info", "server");
              setStatus(`Loading Page ${pageNum} of ${targetMaxPage}...`);
              try {
                const response = await fetchPageWithRetry(nextUrl, pageNum, { onStatus: setStatus });
                const html = await response.text();
                Log(`HTTP ${response.status} response received for ${shortUrl} (${Math.round(html.length / 1024)} KB)`, "debug", "client");
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, "text/html");
                const incomingTable = getMainTable(doc);
                if (incomingTable) {
                  const incomingRows = incomingTable.querySelectorAll("tr");
                  let rowsAdded = 0;
                  incomingRows.forEach((row) => {
                    const rowText = row.textContent.trim();
                    if (!row.querySelector("th") && !row.querySelector(".pagination") && rowText.length > 0 && rowText !== "Quantity") {
                      targetBody.appendChild(row.cloneNode(true));
                      rowsAdded++;
                    }
                  });
                  Log(`[PaginationLoader] Appended ${rowsAdded} rows from page ${pageNum}/${targetMaxPage}`, "info", "client");
                } else {
                  Log(`[PaginationLoader] No main table found on page ${pageNum}/${targetMaxPage}`, "warn", "client");
                }
              } catch (err) {
                Log(`Network error fetching page ${pageNum} (${shortUrl}): ${err.message}`, "error", "server");
              }
            }
            Log("[PaginationLoader] All pages loaded successfully.", "info", "client");
            resolve();
          })();
        }
      }, pollIntervalMs);
    });
  }

  // src/modules/cardNameFormatter.js
  var CardMetadataExtractor = {
    /**
     * Extract token values for a given window Selection
     * @param {Selection} selection
     * @param {Document} [doc=document] - Document object (supports mock DOM in tests)
     * @returns {Object|null} Token dictionary or null if invalid
     */
    extract: function(selection, doc = document) {
      if (!selection || selection.isCollapsed) return null;
      const anchorNode = selection.anchorNode;
      if (!anchorNode) return null;
      const containerEl = anchorNode.nodeType === 1 ? anchorNode : anchorNode.parentElement;
      if (!containerEl) return null;
      const row = containerEl.closest("tr, .yourcol-item, #main-content-area");
      if (!row) return null;
      const selectedText = selection.toString().trim();
      if (!selectedText) return null;
      let year = "";
      let setName = "";
      const setHeader = doc.querySelector("#setname-content h1") || doc.querySelector("#main-content-area h1");
      if (setHeader) {
        const headerText = setHeader.textContent.replace(/\s*-\s*Cards$/i, "").trim();
        const yearMatch = headerText.match(/^(\d{4})\s+(.+)/);
        if (yearMatch) {
          year = yearMatch[1];
          setName = yearMatch[2];
        } else {
          setName = headerText;
        }
      }
      const subHeader = doc.querySelector("#setname-content h3");
      if (subHeader && setName) {
        setName += ` ${subHeader.textContent.trim()}`;
      } else if (subHeader && !setName) {
        setName = subHeader.textContent.trim();
      }
      let cardNo = "";
      let cardLink = null;
      const cardLinks = row.querySelectorAll(
        'a[href*="ViewCard.cfm"], a[href*="/cid/"], a[href*="cid="]'
      );
      for (const link of cardLinks) {
        if (link.querySelector("img")) continue;
        const text = link.textContent.trim();
        if (text) {
          cardNo = text;
          cardLink = link;
          break;
        }
      }
      if (!cardNo) {
        const firstTd = row.querySelector("td");
        if (firstTd) {
          const text = firstTd.textContent.trim();
          if (/^#?[A-Z0-9-]{1,10}$/i.test(text) && !firstTd.querySelector("img")) {
            cardNo = text;
          }
        }
      }
      let tags = "";
      let printRun = "";
      const personLink = row.querySelector('a[href*="Person.cfm"]');
      const subjectTd = personLink ? personLink.closest("td") : cardLink ? cardLink.closest("td")?.nextElementSibling : null;
      if (subjectTd) {
        const rawSubject = subjectTd.textContent.replace(/\s+/g, " ").trim();
        const tokens = rawSubject.split(" ");
        const tagParts = [];
        tokens.forEach((token) => {
          const clean = token.replace(/,/g, "").trim();
          if (/^SN\d+$/i.test(clean)) {
            printRun = clean.replace(/^SN/i, "");
          } else if (/^[A-Z0-9]{2,4}$/.test(clean) && !/^(Jr|Sr|II|III|IV|V)$/i.test(clean)) {
            tagParts.push(clean);
          }
        });
        tags = tagParts.join(" ");
      }
      let playerName = "";
      if (personLink) {
        playerName = personLink.textContent.trim();
      } else if (subjectTd) {
        let rawName = subjectTd.textContent.replace(/\s+/g, " ").trim();
        if (printRun) {
          rawName = rawName.replace(new RegExp(`\\bSN${printRun}\\b`, "i"), "");
        }
        if (tags) {
          const tagList = tags.split(" ");
          tagList.forEach((t) => {
            const escT = String(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            rawName = rawName.replace(new RegExp(`\\b${escT}\\b`, "g"), "");
          });
        }
        playerName = rawName.replace(/\s+/g, " ").trim();
      }
      if (!playerName) {
        playerName = selectedText;
        if (cardNo) {
          const cleanCardNo = cardNo.replace(/^#/, "");
          const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const prefixRegex = new RegExp(
            `^(?:#?${escapeRegExp(cardNo)}|#?${escapeRegExp(cleanCardNo)})\\b\\s*`,
            "i"
          );
          playerName = playerName.replace(prefixRegex, "").trim();
        }
        if (/^#?\d+[a-z]?\s+/i.test(playerName) && cardNo) {
          playerName = playerName.replace(/^#?\d+[a-z]?\s+/i, "").trim();
        }
        if (!playerName) playerName = selectedText;
      }
      return {
        Year: year,
        SetName: setName,
        PlayerName: playerName,
        CardNo: cardNo,
        Tags: tags,
        PR: printRun ? `/${printRun}` : ""
      };
    },
    /**
     * Replace tokens in template string with extracted values
     * @param {string} template - Tokenized template (e.g. "{PlayerName} - {Year}")
     * @param {Object} tokens - Extracted token dictionary
     * @returns {string} Formatted output string
     */
    compile: function(template, tokens) {
      if (!tokens || !template) return "";
      let result = template;
      if (!tokens.CardNo) {
        result = result.replace(/#\{CardNo\}/g, "{CardNo}");
      }
      Object.keys(tokens).forEach((key) => {
        const pattern = new RegExp(`\\{${key}\\}`, "g");
        const val = (tokens[key] || "").trim();
        result = result.replace(pattern, val);
      });
      return result.replace(/\s+/g, " ").replace(/\s+#$/, "").replace(/\s+-\s+$/, "").replace(/^\s+-\s+/, "").replace(/\s+-\s+(?=-|\s|$)/g, " ").trim();
    }
  };
  var FormattedCopyPopover = {
    elementId: "tk-card-formatter-popover",
    _dismissTimer: null,
    /**
     * Render popover near user selection coordinates
     * @param {Selection} selection
     * @param {string} formattedText
     * @param {Object|Document} [tokensOrDoc=document] - Tokens dictionary or Document object
     * @param {Document} [doc=document] - Document object
     */
    show: function(selection, formattedText, tokensOrDoc, doc) {
      const defaultDoc = typeof document !== "undefined" ? document : null;
      let tokens = null;
      let targetDoc = doc || defaultDoc;
      if (tokensOrDoc && (tokensOrDoc.nodeType === 9 || tokensOrDoc.defaultView)) {
        targetDoc = tokensOrDoc;
        tokens = null;
      } else if (tokensOrDoc && typeof tokensOrDoc === "object") {
        tokens = tokensOrDoc;
        if (!doc) targetDoc = defaultDoc;
      }
      if (!targetDoc) return;
      this.hide(targetDoc);
      if (!selection || selection.rangeCount === 0) return;
      let rect;
      try {
        const range = selection.getRangeAt(0);
        rect = range.getBoundingClientRect();
      } catch {
        return;
      }
      const win = targetDoc.defaultView || window;
      const top = (win.scrollY || 0) + rect.bottom + 6;
      const left = Math.max(10, (win.scrollX || 0) + rect.left);
      const popover = targetDoc.createElement("div");
      popover.id = this.elementId;
      popover.className = "tk-formatter-popover";
      popover.style.top = `${top}px`;
      popover.style.left = `${left}px`;
      const label = targetDoc.createElement("span");
      label.className = "tk-popover-label";
      label.textContent = formattedText;
      label.title = formattedText;
      popover.appendChild(label);
      if (Config.global.cardFormatterShowCopy !== false) {
        const copyBtn = targetDoc.createElement("button");
        copyBtn.type = "button";
        copyBtn.className = "sctk-btn";
        copyBtn.innerHTML = icon("copy");
        copyBtn.title = "Copy formatted text";
        copyBtn.setAttribute("aria-label", "Copy formatted text");
        copyBtn.style.height = "20px";
        copyBtn.style.padding = "0 6px";
        copyBtn.addEventListener("click", () => {
          const writePromise = win.navigator?.clipboard?.writeText ? win.navigator.clipboard.writeText(formattedText) : Promise.resolve();
          writePromise.then(() => {
            copyBtn.innerHTML = icon("check");
            showToast({
              message: `Copied: <b>${Utils.escape.html(formattedText)}</b>`,
              variant: "success"
            });
            setTimeout(() => this.hide(targetDoc), 1e3);
          }).catch((err) => {
            Log(`Clipboard write failed: ${err.message}`, "error");
          });
        });
        popover.appendChild(copyBtn);
      }
      const playerName = tokens?.PlayerName || "";
      if (playerName) {
        const searchQuery = encodeURIComponent(playerName.trim()).replace(/%20/g, "+");
        if (Config.global.cardFormatterShowBRef !== false) {
          const brefBtn = targetDoc.createElement("button");
          brefBtn.type = "button";
          brefBtn.className = "sctk-btn";
          brefBtn.innerHTML = icon("bref");
          brefBtn.title = "Search Baseball Reference";
          brefBtn.setAttribute("aria-label", "Search Baseball Reference");
          brefBtn.style.height = "20px";
          brefBtn.style.padding = "0 6px";
          brefBtn.addEventListener("click", () => {
            const brefUrl = `https://www.baseball-reference.com/search/search.fcgi?search=${searchQuery}`;
            win.open(brefUrl, "_blank", "noopener,noreferrer");
          });
          popover.appendChild(brefBtn);
        }
        if (Config.global.cardFormatterShowGoogle !== false) {
          const googleBtn = targetDoc.createElement("button");
          googleBtn.type = "button";
          googleBtn.className = "sctk-btn";
          googleBtn.innerHTML = icon("google");
          googleBtn.title = "Search Google";
          googleBtn.setAttribute("aria-label", "Search Google");
          googleBtn.style.height = "20px";
          googleBtn.style.padding = "0 6px";
          googleBtn.addEventListener("click", () => {
            const googleUrl = `https://www.google.com/search?q=${searchQuery}`;
            win.open(googleUrl, "_blank", "noopener,noreferrer");
          });
          popover.appendChild(googleBtn);
        }
      }
      targetDoc.body.appendChild(popover);
      const duration = Config.global.cardFormatterPopoverDurationMs || 4e3;
      this._dismissTimer = setTimeout(() => {
        this.hide(targetDoc);
      }, duration);
    },
    /**
     * Remove popover element if present
     * @param {Document} [doc=document]
     */
    hide: function(doc) {
      const targetDoc = doc || (typeof document !== "undefined" ? document : null);
      if (!targetDoc) return;
      if (this._dismissTimer) {
        clearTimeout(this._dismissTimer);
        this._dismissTimer = null;
      }
      const existing = targetDoc.getElementById(this.elementId);
      if (existing) existing.remove();
    }
  };
  function initCardNameFormatter() {
    Log("Initializing Card Name Formatter module", "info");
    const handleSelection = debounce(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        FormattedCopyPopover.hide();
        return;
      }
      const tokens = CardMetadataExtractor.extract(selection);
      if (!tokens || !tokens.PlayerName) {
        FormattedCopyPopover.hide();
        return;
      }
      const template = Config.global.cardFormatterTemplate || "{PlayerName} - {Year} {SetName} {Tags} {PR} #{CardNo}";
      const formatted = CardMetadataExtractor.compile(template, tokens);
      if (!formatted) {
        FormattedCopyPopover.hide();
        return;
      }
      const showCopy = Config.global.cardFormatterShowCopy !== false;
      const showBRef = Config.global.cardFormatterShowBRef !== false;
      const showGoogle = Config.global.cardFormatterShowGoogle !== false;
      const hasSearch = showBRef || showGoogle;
      if (!showCopy && !hasSearch) {
        FormattedCopyPopover.hide();
        return;
      }
      if (!hasSearch && showCopy && Config.global.cardFormatterOutputMode === "clipboard") {
        if (window.navigator?.clipboard?.writeText) {
          window.navigator.clipboard.writeText(formatted).then(() => {
            showToast({
              message: `Copied: <b>${Utils.escape.html(formatted)}</b>`,
              variant: "success"
            });
          });
        }
      } else {
        FormattedCopyPopover.show(selection, formatted, tokens);
      }
    }, 250);
    document.addEventListener("selectionchange", handleSelection);
    document.addEventListener("mousedown", (e) => {
      const popover = document.getElementById(FormattedCopyPopover.elementId);
      if (popover && !popover.contains(e.target)) {
        FormattedCopyPopover.hide();
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        FormattedCopyPopover.hide();
      }
    });
  }

  // src/modules/collectionQuantityCounter.js
  var activeObserver = null;
  var boundListeners = [];
  function countCollectionQuantities(root = document) {
    let distinctQtyCount = 0;
    let totalCardRows = 0;
    let totalQuantitySum = 0;
    let cardRows = Array.from(root.querySelectorAll("tr.collection_row"));
    if (cardRows.length === 0) {
      cardRows = Array.from(
        root.querySelectorAll("#main-content-area table tr, #content table tr")
      ).filter((tr) => {
        if (tr.closest("#sctk-toolbar") || tr.closest("#tk-checklist-filter-wrap") || tr.closest(".col-md-3") || tr.closest(".col-lg-3") || tr.closest("#offcanvas") || tr.closest(".sidebar")) {
          return false;
        }
        return !!tr.querySelector('a[href*="ViewCard.cfm"], a[href*="CollectionEdit.cfm"]');
      });
    }
    totalCardRows = cardRows.length;
    cardRows.forEach((row) => {
      let qty = 0;
      const badge = row.querySelector('.badge, span.badge, a[href*="CollectionEdit.cfm"] .badge');
      if (badge) {
        const parsed = parseInt(badge.textContent.trim(), 10);
        if (!isNaN(parsed)) qty = Math.max(0, parsed);
      }
      if (qty === 0) {
        const qtyInput = row.querySelector('input[name*="QTY" i], input[type="number"]');
        if (qtyInput && qtyInput.value) {
          const parsed = parseInt(qtyInput.value.trim(), 10);
          if (!isNaN(parsed)) qty = Math.max(0, parsed);
        } else {
          const checkbox = row.querySelector('input[type="checkbox"]');
          if (checkbox && checkbox.checked) {
            qty = 1;
          }
        }
      }
      if (qty >= 1) {
        distinctQtyCount++;
        totalQuantitySum += qty;
      }
    });
    return { distinctQtyCount, totalCardRows, totalQuantitySum };
  }
  function updateQuantityCounterWidget(counts) {
    let widget = document.getElementById("sctk-qty-counter");
    if (!widget) {
      widget = document.createElement("div");
      widget.id = "sctk-qty-counter";
    }
    const position = Config.global?.quantityCounterPosition || "bottom-right";
    widget.className = `sctk-qty-counter sctk-qty-counter-${position}`;
    const html = `
    <span class="tk-qty-label">Card Count:</span>
    <strong class="tk-qty-val">${counts.distinctQtyCount}</strong>
    <span class="tk-qty-sep">/</span>
    <span class="tk-qty-total">${counts.totalCardRows}</span>
    <span class="tk-qty-sub">(Total Count: <strong>${counts.totalQuantitySum}</strong>)</span>
  `;
    widget.innerHTML = html;
    widget.title = `Card Count: ${counts.distinctQtyCount} / ${counts.totalCardRows} (Total Count: ${counts.totalQuantitySum})`;
    if (position === "toolbar") {
      const toolbarCenter = document.getElementById("tk-center-context") || document.getElementById("tk-actions");
      if (toolbarCenter && widget.parentElement !== toolbarCenter) {
        toolbarCenter.appendChild(widget);
      }
    } else {
      const container = containerFor(position);
      if (widget.parentElement !== container) {
        container.appendChild(widget);
      }
    }
  }
  function initCollectionQuantityCounter() {
    Log("Initializing Collection Quantity Counter module", "debug");
    const update = () => {
      const counts = countCollectionQuantities(document);
      updateQuantityCounterWidget(counts);
    };
    update();
    cleanupCollectionQuantityCounter();
    const handleEvent = (e) => {
      const target = e.target;
      if (target && (target.tagName === "INPUT" || target.tagName === "SELECT" || target.classList?.contains("badge") || target.closest?.(".badge"))) {
        setTimeout(update, 50);
      }
    };
    document.addEventListener("change", handleEvent, true);
    document.addEventListener("input", handleEvent, true);
    document.addEventListener("click", handleEvent, true);
    boundListeners.push({ type: "change", fn: handleEvent }, { type: "input", fn: handleEvent }, { type: "click", fn: handleEvent });
    const targetArea = document.querySelector("#main-content-area") || document.querySelector("#content") || document.body;
    if (targetArea && typeof MutationObserver !== "undefined") {
      let debounceTimer = null;
      activeObserver = new MutationObserver(() => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(update, 100);
      });
      activeObserver.observe(targetArea, { childList: true, subtree: true, attributes: true });
    }
  }
  function cleanupCollectionQuantityCounter() {
    if (activeObserver) {
      activeObserver.disconnect();
      activeObserver = null;
    }
    boundListeners.forEach(({ type, fn }) => {
      document.removeEventListener(type, fn, true);
    });
    boundListeners = [];
  }

  // src/modules/setHierarchyExport.js
  function initSetHierarchyExport() {
    if (Routes.isViewAllSets()) {
      Toolbar.addAction(
        "btn-export-hierarchy",
        "Export Set Hierarchy",
        () => {
          exportSetHierarchyCSV(window.location.href);
        },
        true
      );
    }
  }

  // src/modules/collectionDefaulter.js
  var COLLECTION_SELECT_SELECTOR = "#CFForm_1 > select";
  function getDefaultCollectionId() {
    const id = Config.global?.defaultCollectionId;
    if (!id && id !== 0) return null;
    return String(id);
  }
  function applyCollectionDefault(select, targetId = getDefaultCollectionId()) {
    if (!select || !targetId) return false;
    const optionExists = Array.from(select.options).some((o) => o.value === targetId);
    if (!optionExists) {
      Log(
        `Collection Defaulter: option value="${targetId}" not found in #CFForm_1 select — skipping.`,
        "warn"
      );
      return false;
    }
    if (select.value === targetId) {
      Log(`Collection Defaulter: already on collection ${targetId} — no change needed.`, "debug");
      return false;
    }
    Log(`Collection Defaulter: switching collection from "${select.value}" → "${targetId}".`, "debug");
    select.value = targetId;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }
  function initCollectionDefaulter() {
    const ok = assertContract("collectionDefaulter", [
      { selector: COLLECTION_SELECT_SELECTOR, label: "#CFForm_1 > select (collection picker)" }
    ]);
    if (!ok) return;
    const select = document.querySelector(COLLECTION_SELECT_SELECTOR);
    const changed = applyCollectionDefault(select);
    if (changed) {
      Log("Collection Defaulter: collection redirect triggered.", "info");
    }
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
      id: "checklistEnhancer",
      name: "Checklist Enhancer",
      description: "Real-time table filter bar on listing pages.",
      init: initChecklistEnhancer,
      isAsync: false,
      actionLabels: {
        realtimeFilter: "Real-Time Table Filter Bar"
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
    },
    {
      id: "cardNameFormatter",
      name: "Card Name Formatter",
      description: "Dynamically extracts card metadata based on text selection and formats/copies card strings according to a customizable template.",
      init: initCardNameFormatter,
      isAsync: false
    },
    {
      id: "collectionQuantityCounter",
      name: "Collection Quantity Counter",
      description: "Counts distinct cards with Qty >= 1, total cards, and total item quantity on For Sale/Trade and Wantlist pages.",
      init: initCollectionQuantityCounter,
      isAsync: false
    },
    {
      id: "setHierarchyExport",
      name: "Set Hierarchy Export",
      description: "Extract set hierarchies from ViewAll pages and output a CSV.",
      init: initSetHierarchyExport,
      isAsync: false
    },
    {
      id: "collectionDefaulter",
      name: "Collection Defaulter",
      description: "Automatically selects a preferred Collection on the ViewCollection (Add / Update) page.",
      init: initCollectionDefaulter,
      isAsync: false
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

  // src/ui/theme.js
  var THEME_ATTR = "data-sctk-theme";
  var THEMES = ["auto", "light", "dark"];
  function resolveTheme(preference, prefersDark) {
    if (preference === "light" || preference === "dark") return preference;
    return prefersDark ? "dark" : "light";
  }
  function osPrefersDark() {
    return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
  }
  function applyTheme() {
    const resolved = resolveTheme(Config.global.theme, osPrefersDark());
    document.documentElement.setAttribute(THEME_ATTR, resolved);
    return resolved;
  }
  function initTheme() {
    const resolved = applyTheme();
    Log(`Theme resolved to '${resolved}' from preference '${Config.global.theme}'.`, "debug");
    if (typeof matchMedia !== "function") return;
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (Config.global.theme === "auto") applyTheme();
    });
  }

  // src/core/version.js
  var APP_VERSION = "0.1-beta";
  function getAppVersion() {
    return APP_VERSION;
  }

  // src/core/diagnostics.js
  var DiagnosticTests = {
    /**
     * Run lightweight self-tests on key runtime systems.
     *
     * @returns {Array<{ name: string, pass: boolean, detail: string }>}
     */
    run: () => {
      const results2 = [];
      try {
        const quoted = Utils.escape.csv("hello, world");
        const plain = Utils.escape.csv("plain");
        const pass = quoted === '"hello, world"' && plain === "plain";
        results2.push({
          name: "CSV Field Escaping",
          pass,
          detail: pass ? "RFC 4180 escaping operational" : `Unexpected result: ${quoted}`
        });
      } catch (err) {
        results2.push({ name: "CSV Field Escaping", pass: false, detail: err.message });
      }
      try {
        const yearFromUrl = Utils.extractYear("", "/Checklist.cfm/sid/123/2024");
        const yearFromText = Utils.extractYear("2024 Topps Chrome", "");
        const pass = yearFromUrl === "2024" && yearFromText === "2024";
        results2.push({
          name: "Year Extraction (Utils)",
          pass,
          detail: pass ? "Year parsing operational" : `Unexpected results: url=${yearFromUrl}, text=${yearFromText}`
        });
      } catch (err) {
        results2.push({ name: "Year Extraction (Utils)", pass: false, detail: err.message });
      }
      try {
        const pass = typeof Pacing.penaltyMs === "number" && typeof Pacing.lastLatencyMs === "number" && Array.isArray(Pacing.samples);
        results2.push({
          name: "Pacing State Initialization",
          pass,
          detail: pass ? `Penalty ${Pacing.penaltyMs}ms, Latency ${Pacing.lastLatencyMs}ms` : "Pacing state structure invalid"
        });
      } catch (err) {
        results2.push({ name: "Pacing State Initialization", pass: false, detail: err.message });
      }
      try {
        const pass = testUrlMatch(
          [{ pattern: "/checklist\\.cfm", exclude: false }],
          "https://www.tcdb.com/Checklist.cfm/sid/1/"
        );
        results2.push({
          name: "Route Pattern Matching",
          pass,
          detail: pass ? "Pattern resolution operational" : "URL pattern matching failed"
        });
      } catch (err) {
        results2.push({ name: "Route Pattern Matching", pass: false, detail: err.message });
      }
      try {
        const ver = getAppVersion();
        const pass = Boolean(ver && ver !== "unknown");
        results2.push({
          name: "Version Reporting",
          pass,
          detail: pass ? `SCToolkit v${ver}` : "Version string invalid"
        });
      } catch (err) {
        results2.push({ name: "Version Reporting", pass: false, detail: err.message });
      }
      try {
        const ts = formatLogTimestamp(/* @__PURE__ */ new Date(), "YYYYmmDDHHMMSS", "auto");
        const pass = Boolean(ts && /^\d{14}$/.test(ts));
        results2.push({
          name: "Log Timestamp Formatting",
          pass,
          detail: pass ? `Operational (${ts})` : `Unexpected timestamp output: ${ts}`
        });
      } catch (err) {
        results2.push({ name: "Log Timestamp Formatting", pass: false, detail: err.message });
      }
      return results2;
    }
  };

  // src/ui/settings.js
  var SettingsUI = {
    overlayId: "tk-settings-overlay",
    /** Debounced writer, rebuilt whenever the debounce interval itself changes. */
    _persist: () => {
    },
    /** Whether the modal's stylesheet has been added to the page yet. */
    _stylesInjected: false,
    init: () => {
      SettingsUI._rebuildPersist();
      const trigger = document.createElement("button");
      trigger.id = "tk-settings-trigger";
      trigger.type = "button";
      trigger.className = "tk-scroll-btn";
      trigger.innerHTML = `${icon("gear")}<span>SETTINGS</span>`;
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
          variant: "success"
        });
      }, Config.global.settingsSaveDebounceMs);
    },
    open: () => {
      if (document.getElementById(SettingsUI.overlayId)) return;
      if (!SettingsUI._stylesInjected) {
        injectStyle(SETTINGS_CSS);
        SettingsUI._stylesInjected = true;
      }
      const overlay = document.createElement("div");
      overlay.id = SettingsUI.overlayId;
      const panel = document.createElement("div");
      panel.id = "tk-settings-panel";
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-modal", "true");
      panel.setAttribute("aria-label", "SCToolkit Settings");
      panel.appendChild(SettingsUI._buildHeader());
      panel.appendChild(SettingsUI._buildTabbedBody());
      overlay.appendChild(panel);
      document.body.appendChild(overlay);
      SettingsUI._returnFocusTo = document.activeElement;
      SettingsUI._trapFocus(panel);
      panel.querySelector("button, input, select")?.focus();
    },
    /**
     * Keep Tab inside the dialog and close on Escape.
     *
     * Without this the keyboard walks straight out of a modal that is still
     * covering the page — the user is then tabbing through content they cannot
     * see or click.
     *
     * @param {HTMLElement} panel
     */
    _trapFocus: (panel) => {
      panel.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          SettingsUI.close();
          return;
        }
        if (e.key !== "Tab") return;
        const isVisible = (el) => typeof el.checkVisibility === "function" ? el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) : el.offsetWidth > 0 || el.offsetHeight > 0 || el.style.display !== "none";
        const focusable = Array.from(
          panel.querySelectorAll('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])')
        ).filter((el) => !el.disabled && isVisible(el));
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      });
    },
    close: () => {
      const overlay = document.getElementById(SettingsUI.overlayId);
      if (overlay) overlay.remove();
      SettingsUI._returnFocusTo?.focus?.();
      SettingsUI._returnFocusTo = null;
    },
    _buildHeader: () => {
      const header = document.createElement("div");
      header.id = "tk-settings-header";
      const title = document.createElement("h2");
      title.textContent = "SCToolkit Settings";
      const closeBtn = document.createElement("button");
      closeBtn.id = "tk-settings-close";
      closeBtn.type = "button";
      closeBtn.innerHTML = icon("x");
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
      const pinsTab = document.createElement("button");
      pinsTab.type = "button";
      pinsTab.className = "tk-settings-tab";
      pinsTab.textContent = "Pins";
      const routesTab = document.createElement("button");
      routesTab.type = "button";
      routesTab.className = "tk-settings-tab";
      routesTab.textContent = "Modules & Routes";
      const regexTab = document.createElement("button");
      regexTab.type = "button";
      regexTab.className = "tk-settings-tab";
      regexTab.textContent = "RegEx Tester";
      const routeTesterTab = document.createElement("button");
      routeTesterTab.type = "button";
      routeTesterTab.className = "tk-settings-tab";
      routeTesterTab.textContent = "Route Tester";
      const diagTab = document.createElement("button");
      diagTab.type = "button";
      diagTab.className = "tk-settings-tab";
      diagTab.textContent = "Diagnostics";
      const badgesTab = document.createElement("button");
      badgesTab.type = "button";
      badgesTab.className = "tk-settings-tab";
      badgesTab.textContent = "Badges";
      tabBar.append(globalTab, pinsTab, badgesTab, routesTab, regexTab, routeTesterTab, diagTab);
      const content = document.createElement("div");
      content.id = "tk-settings-tab-content";
      const panes = {
        global: SettingsUI._buildGlobalPane(),
        pins: SettingsUI._buildPinsPane(),
        badges: SettingsUI._buildBadgesPane(),
        routes: SettingsUI._buildModulesPane(),
        regex: SettingsUI._buildRegexPane(),
        routetester: SettingsUI._buildRouteTesterPane(),
        diagnostics: SettingsUI._buildDiagnosticsPane()
      };
      const tabs = {
        global: globalTab,
        pins: pinsTab,
        badges: badgesTab,
        routes: routesTab,
        regex: regexTab,
        routetester: routeTesterTab,
        diagnostics: diagTab
      };
      Object.values(panes).forEach((pane) => content.appendChild(pane));
      const activate = (name) => {
        Object.entries(tabs).forEach(([key, tab]) => tab.classList.toggle("active", key === name));
        Object.entries(panes).forEach(([key, pane]) => {
          pane.style.display = key === name ? "" : "none";
        });
        content.scrollTop = 0;
      };
      Object.entries(tabs).forEach(([name, tab]) => tab.addEventListener("click", () => activate(name)));
      activate("global");
      body.appendChild(tabBar);
      body.appendChild(content);
      return body;
    },
    /**
     * Pin Configuration tab.
     *
     * Lists every stored pin with a toggle (enabled/disabled), a drag handle for
     * reordering, Up/Down keyboard controls, and a remove button. Every mutation
     * writes immediately to storage and re-renders the toolbar.
     */
    _buildPinsPane: () => {
      const pane = document.createElement("div");
      pane.id = "tk-settings-pins";
      const title = document.createElement("div");
      title.className = "tk-settings-section-title";
      title.textContent = "Pin Configuration";
      pane.appendChild(title);
      const hint = document.createElement("div");
      hint.className = "tk-settings-hint";
      hint.style.marginBottom = "10px";
      hint.textContent = "Toggle pins on/off and drag rows (or use the ↑↓ buttons) to set their order. Disabled pins are hidden from the toolbar but remain saved. Changes apply immediately.";
      pane.appendChild(hint);
      const list = document.createElement("div");
      list.className = "tk-pin-config-list";
      pane.appendChild(list);
      let workingPins = Pins.all();
      const flush = () => {
        Pins.reorder(workingPins);
        Toolbar.renderPins();
      };
      const rebuild = () => {
        list.innerHTML = "";
        workingPins = Pins.all();
        if (workingPins.length === 0) {
          const empty = document.createElement("div");
          empty.className = "tk-pin-config-empty";
          empty.textContent = "No pins saved. Pin a set from any set page to get started.";
          list.appendChild(empty);
          return;
        }
        workingPins.forEach((pin, idx) => {
          const row = document.createElement("div");
          row.className = "tk-pin-config-row" + (pin.enabled === false ? " tk-pin-disabled" : "");
          row.draggable = true;
          row.dataset.pinId = pin.id;
          const handle = document.createElement("span");
          handle.className = "tk-pin-drag-handle";
          handle.title = "Drag to reorder";
          handle.innerHTML = "&#9776;";
          handle.setAttribute("aria-hidden", "true");
          row.appendChild(handle);
          const toggle = document.createElement("input");
          toggle.type = "checkbox";
          toggle.className = "tk-pin-config-toggle";
          toggle.checked = pin.enabled !== false;
          toggle.title = toggle.checked ? "Disable this pin" : "Enable this pin";
          toggle.setAttribute("aria-label", `Toggle ${pin.name}`);
          toggle.addEventListener("change", () => {
            Pins.toggle(pin.id);
            workingPins = Pins.all();
            Toolbar.renderPins();
            rebuild();
            Log(`Pin '${pin.name}' ${toggle.checked ? "enabled" : "disabled"}.`, "debug");
          });
          row.appendChild(toggle);
          const nameWrap = document.createElement("span");
          nameWrap.className = "tk-pin-config-name";
          const nameLink = document.createElement("a");
          nameLink.href = pin.url;
          nameLink.textContent = pin.name;
          nameLink.title = `Navigate to ${pin.name}`;
          nameWrap.appendChild(nameLink);
          row.appendChild(nameWrap);
          const yearLabel = document.createElement("span");
          yearLabel.className = "tk-pin-config-year";
          yearLabel.textContent = pin.year || "";
          row.appendChild(yearLabel);
          const actions = document.createElement("span");
          actions.className = "tk-pin-config-actions";
          const upBtn = document.createElement("button");
          upBtn.type = "button";
          upBtn.className = "tk-pin-reorder-btn";
          upBtn.title = "Move up";
          upBtn.setAttribute("aria-label", `Move ${pin.name} up`);
          upBtn.innerHTML = "&#8593;";
          upBtn.disabled = idx === 0;
          upBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (idx === 0) return;
            workingPins = Pins.all();
            [workingPins[idx - 1], workingPins[idx]] = [workingPins[idx], workingPins[idx - 1]];
            flush();
            rebuild();
          });
          const downBtn = document.createElement("button");
          downBtn.type = "button";
          downBtn.className = "tk-pin-reorder-btn";
          downBtn.title = "Move down";
          downBtn.setAttribute("aria-label", `Move ${pin.name} down`);
          downBtn.innerHTML = "&#8595;";
          downBtn.disabled = idx === workingPins.length - 1;
          downBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (idx === workingPins.length - 1) return;
            workingPins = Pins.all();
            [workingPins[idx], workingPins[idx + 1]] = [workingPins[idx + 1], workingPins[idx]];
            flush();
            rebuild();
          });
          const removeBtn = document.createElement("button");
          removeBtn.type = "button";
          removeBtn.className = "tk-pin-remove-btn";
          removeBtn.title = `Remove ${pin.name}`;
          removeBtn.setAttribute("aria-label", `Remove pin: ${pin.name}`);
          removeBtn.innerHTML = icon("x");
          removeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            Pins.remove(pin.id);
            workingPins = Pins.all();
            Toolbar.renderPins();
            rebuild();
            Log(`Pin removed from settings: ${pin.name}`, "debug");
          });
          actions.appendChild(upBtn);
          actions.appendChild(downBtn);
          actions.appendChild(removeBtn);
          row.appendChild(actions);
          row.addEventListener("dragstart", (e) => {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", String(idx));
            setTimeout(() => row.classList.add("tk-pin-row-dragging"), 0);
          });
          row.addEventListener("dragend", () => {
            row.classList.remove("tk-pin-row-dragging");
            list.querySelectorAll(".tk-pin-row-drag-over").forEach((r) => r.classList.remove("tk-pin-row-drag-over"));
          });
          row.addEventListener("dragover", (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            list.querySelectorAll(".tk-pin-row-drag-over").forEach((r) => r.classList.remove("tk-pin-row-drag-over"));
            row.classList.add("tk-pin-row-drag-over");
          });
          row.addEventListener("dragleave", () => {
            row.classList.remove("tk-pin-row-drag-over");
          });
          row.addEventListener("drop", (e) => {
            e.preventDefault();
            row.classList.remove("tk-pin-row-drag-over");
            const srcIdx = parseInt(e.dataTransfer.getData("text/plain"), 10);
            if (isNaN(srcIdx) || srcIdx === idx) return;
            workingPins = Pins.all();
            const [moved] = workingPins.splice(srcIdx, 1);
            workingPins.splice(idx, 0, moved);
            flush();
            rebuild();
          });
          list.appendChild(row);
        });
      };
      rebuild();
      return pane;
    },
    /**
     * Badge Configuration tab.
     *
     * Two groups — Toolbar Badges and Set Link Badges — each rendered as a
     * draggable, togglable list. Changes write to Config.global and live-update
     * the toolbar / injected badge groups immediately.
     */
    _buildBadgesPane: () => {
      const pane = document.createElement("div");
      pane.id = "tk-settings-badges";
      const title = document.createElement("div");
      title.className = "tk-settings-section-title";
      title.textContent = "Badge Configuration";
      pane.appendChild(title);
      const hint = document.createElement("div");
      hint.className = "tk-settings-hint";
      hint.style.marginBottom = "12px";
      hint.textContent = "Toggle individual action badges on/off and drag rows (or use the ↑↓ buttons) to set their order. Changes apply immediately to the toolbar and injected set-link badges.";
      pane.appendChild(hint);
      const buildSection = (sectionTitle, configKey, onApply) => {
        const section = document.createElement("div");
        section.style.marginBottom = "16px";
        const secTitle = document.createElement("div");
        secTitle.style.cssText = "font-family:var(--tk-font-mono);font-size:10px;font-weight:700;color:var(--tk-teal);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;";
        secTitle.textContent = sectionTitle;
        section.appendChild(secTitle);
        const list = document.createElement("div");
        list.className = "tk-pin-config-list";
        section.appendChild(list);
        const getEntries = () => Config.global[configKey] || [];
        const flush = () => {
          SettingsUI._persist();
          onApply();
        };
        const rebuild = () => {
          list.innerHTML = "";
          const entries = getEntries();
          entries.forEach((entry, idx) => {
            const badgeDef = BADGES[entry.key];
            if (!badgeDef) return;
            const row = document.createElement("div");
            row.className = "tk-pin-config-row" + (entry.enabled === false ? " tk-pin-disabled" : "");
            row.draggable = true;
            row.dataset.badgeKey = entry.key;
            const handle = document.createElement("span");
            handle.className = "tk-pin-drag-handle";
            handle.title = "Drag to reorder";
            handle.innerHTML = "&#9776;";
            handle.setAttribute("aria-hidden", "true");
            row.appendChild(handle);
            const toggle = document.createElement("input");
            toggle.type = "checkbox";
            toggle.className = "tk-pin-config-toggle";
            toggle.checked = entry.enabled !== false;
            toggle.title = toggle.checked ? "Disable this badge" : "Enable this badge";
            toggle.setAttribute("aria-label", `Toggle ${badgeDef.text || entry.key} badge`);
            toggle.addEventListener("change", () => {
              entry.enabled = toggle.checked;
              row.classList.toggle("tk-pin-disabled", !toggle.checked);
              Log(`Config change: ${configKey}[${entry.key}].enabled = ${toggle.checked}`, "info");
              flush();
            });
            row.appendChild(toggle);
            const nameWrap = document.createElement("span");
            nameWrap.className = "tk-pin-config-name";
            nameWrap.textContent = badgeDef.title || entry.key;
            row.appendChild(nameWrap);
            const keyChip = document.createElement("span");
            keyChip.className = "tk-pin-config-year";
            keyChip.textContent = badgeDef.text || entry.key;
            row.appendChild(keyChip);
            const actions = document.createElement("span");
            actions.className = "tk-pin-config-actions";
            const upBtn = document.createElement("button");
            upBtn.type = "button";
            upBtn.className = "tk-pin-reorder-btn";
            upBtn.title = "Move up";
            upBtn.setAttribute("aria-label", `Move ${entry.key} up`);
            upBtn.innerHTML = "&#8593;";
            upBtn.disabled = idx === 0;
            upBtn.addEventListener("click", (e) => {
              e.stopPropagation();
              if (idx === 0) return;
              const arr = getEntries();
              [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
              Config.global[configKey] = arr;
              Log(`Config change: ${configKey} reordered`, "info");
              flush();
              rebuild();
            });
            const downBtn = document.createElement("button");
            downBtn.type = "button";
            downBtn.className = "tk-pin-reorder-btn";
            downBtn.title = "Move down";
            downBtn.setAttribute("aria-label", `Move ${entry.key} down`);
            downBtn.innerHTML = "&#8595;";
            downBtn.disabled = idx === entries.length - 1;
            downBtn.addEventListener("click", (e) => {
              e.stopPropagation();
              if (idx === entries.length - 1) return;
              const arr = getEntries();
              [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
              Config.global[configKey] = arr;
              Log(`Config change: ${configKey} reordered`, "info");
              flush();
              rebuild();
            });
            actions.appendChild(upBtn);
            actions.appendChild(downBtn);
            row.appendChild(actions);
            row.addEventListener("dragstart", (e) => {
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", String(idx));
              setTimeout(() => row.classList.add("tk-pin-row-dragging"), 0);
            });
            row.addEventListener("dragend", () => {
              row.classList.remove("tk-pin-row-dragging");
              list.querySelectorAll(".tk-pin-row-drag-over").forEach((r) => r.classList.remove("tk-pin-row-drag-over"));
            });
            row.addEventListener("dragover", (e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              list.querySelectorAll(".tk-pin-row-drag-over").forEach((r) => r.classList.remove("tk-pin-row-drag-over"));
              row.classList.add("tk-pin-row-drag-over");
            });
            row.addEventListener("dragleave", () => {
              row.classList.remove("tk-pin-row-drag-over");
            });
            row.addEventListener("drop", (e) => {
              e.preventDefault();
              row.classList.remove("tk-pin-row-drag-over");
              const srcIdx = parseInt(e.dataTransfer.getData("text/plain"), 10);
              if (isNaN(srcIdx) || srcIdx === idx) return;
              const arr = getEntries();
              const [moved] = arr.splice(srcIdx, 1);
              arr.splice(idx, 0, moved);
              Config.global[configKey] = arr;
              Log(`Config change: ${configKey} reordered via drag`, "info");
              flush();
              rebuild();
            });
            list.appendChild(row);
          });
        };
        rebuild();
        return section;
      };
      pane.appendChild(buildSection(
        "Toolbar Badges",
        "toolbarBadges",
        () => Toolbar.renderCenterContext()
      ));
      pane.appendChild(buildSection(
        "Set Link Badges",
        "setLinkBadges",
        () => reinjectSetActions()
      ));
      return pane;
    },
    _buildModulesPane: () => {
      const pane = document.createElement("div");
      pane.id = "tk-settings-modules";
      const sectionTitle = document.createElement("div");
      sectionTitle.className = "tk-settings-section-title";
      sectionTitle.textContent = "Modules & Routes";
      pane.appendChild(sectionTitle);
      const sortedModules = [...ModuleRegistry].sort((a, b) => a.name.localeCompare(b.name));
      sortedModules.forEach((mod) => {
        const cfg = Config.modules[mod.id];
        if (!cfg) return;
        const row = document.createElement("div");
        row.className = "tk-settings-module-row tk-accordion-item";
        const header = document.createElement("div");
        header.className = "tk-accordion-header";
        const headerLeft = document.createElement("div");
        headerLeft.className = "tk-accordion-header-left";
        const label = document.createElement("label");
        label.className = "tk-module-label";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = !!cfg.enabled;
        checkbox.title = "Enable or disable this module on matching pages.";
        checkbox.addEventListener("click", (e) => {
          e.stopPropagation();
        });
        checkbox.addEventListener("change", () => {
          cfg.enabled = checkbox.checked;
          Log(`Config change: module '${mod.id}' enabled = ${cfg.enabled}`, "info");
          SettingsUI._persist();
        });
        const nameSpan = document.createElement("span");
        nameSpan.className = "tk-module-name";
        nameSpan.textContent = mod.name;
        label.appendChild(checkbox);
        label.appendChild(nameSpan);
        const desc = document.createElement("div");
        desc.className = "tk-settings-module-desc";
        desc.textContent = mod.description;
        headerLeft.appendChild(label);
        headerLeft.appendChild(desc);
        header.appendChild(headerLeft);
        const toggleBtn = document.createElement("button");
        toggleBtn.type = "button";
        toggleBtn.className = "tk-accordion-toggle-btn";
        toggleBtn.setAttribute("aria-expanded", "false");
        toggleBtn.setAttribute("aria-label", `Expand routes for ${mod.name}`);
        toggleBtn.title = "Expand route patterns";
        toggleBtn.innerHTML = icon("chevronDown");
        header.appendChild(toggleBtn);
        row.appendChild(header);
        const body = document.createElement("div");
        body.className = "tk-accordion-body";
        body.style.display = "none";
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
          body.appendChild(actionsWrap);
        }
        body.appendChild(SettingsUI._buildRouteEditor(mod, cfg));
        row.appendChild(body);
        const toggleAccordion = (e) => {
          if (e.target.tagName === "INPUT" || e.target.closest("label.tk-module-label")) {
            return;
          }
          const isOpen2 = body.style.display !== "none";
          body.style.display = isOpen2 ? "none" : "block";
          toggleBtn.setAttribute("aria-expanded", String(!isOpen2));
          row.classList.toggle("tk-accordion-open", !isOpen2);
        };
        header.addEventListener("click", toggleAccordion);
        pane.appendChild(row);
      });
      return pane;
    },
    _buildRouteEditor: (mod, cfg) => {
      const wrap = document.createElement("div");
      wrap.className = "tk-route-editor";
      const title = document.createElement("div");
      title.className = "tk-route-editor-title";
      title.textContent = "Route Patterns";
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
        removeBtn.innerHTML = icon("x");
        removeBtn.title = "Remove This Pattern";
        removeBtn.setAttribute("aria-label", "Remove This Pattern");
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
      addBtn.innerHTML = `${icon("plus")}<span>Add Pattern</span>`;
      addBtn.addEventListener("click", () => addRow("", false));
      wrap.appendChild(errorEl);
      wrap.appendChild(addBtn);
      return wrap;
    },
    _buildCollapsibleSection: (title, contentElements, description = "", defaultExpanded = false) => {
      const section = document.createElement("div");
      section.className = "tk-settings-collapsible-section";
      section.style.cssText = "margin-bottom:12px; border:1px solid var(--tk-border); border-radius:var(--tk-radius-md); overflow:hidden; background:var(--tk-bg-surface);";
      const header = document.createElement("button");
      header.type = "button";
      header.className = "tk-settings-section-header";
      header.style.cssText = "width:100%; display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:var(--tk-bg-subtle); border:none; color:var(--tk-teal); font-weight:700; font-size:12px; letter-spacing:0.5px; text-transform:uppercase; cursor:pointer; text-align:left; user-select:none; transition:background 0.15s ease;";
      const titleSpan = document.createElement("span");
      titleSpan.textContent = title;
      const toggleIconSpan = document.createElement("span");
      toggleIconSpan.className = "tk-section-toggle-icon";
      toggleIconSpan.style.cssText = "display:inline-flex; align-items:center; transition:transform 0.2s ease;";
      toggleIconSpan.innerHTML = icon("chevronDown");
      header.appendChild(titleSpan);
      header.appendChild(toggleIconSpan);
      const body = document.createElement("div");
      body.className = "tk-settings-section-body";
      body.style.cssText = "padding:12px 14px; border-top:1px solid var(--tk-border);";
      if (description) {
        const desc = document.createElement("div");
        desc.className = "tk-settings-hint";
        desc.style.marginBottom = "10px";
        desc.textContent = description;
        body.appendChild(desc);
      }
      if (Array.isArray(contentElements)) {
        contentElements.forEach((el) => {
          if (el) body.appendChild(el);
        });
      } else if (contentElements) {
        body.appendChild(contentElements);
      }
      let isExpanded = defaultExpanded;
      const updateState = () => {
        body.style.display = isExpanded ? "block" : "none";
        toggleIconSpan.style.transform = isExpanded ? "rotate(0deg)" : "rotate(-90deg)";
        header.setAttribute("aria-expanded", String(isExpanded));
      };
      header.addEventListener("click", () => {
        isExpanded = !isExpanded;
        updateState();
      });
      section._setExpanded = (expanded) => {
        isExpanded = expanded;
        updateState();
      };
      section._isExpanded = () => isExpanded;
      section._defaultExpanded = defaultExpanded;
      updateState();
      section.appendChild(header);
      section.appendChild(body);
      return section;
    },
    _buildGlobalPane: () => {
      const pane = document.createElement("div");
      pane.id = "tk-settings-global";
      const searchWrap = document.createElement("div");
      searchWrap.id = "tk-settings-search-wrap";
      searchWrap.style.cssText = "margin-bottom:12px; display:flex; align-items:center; gap:8px;";
      const searchInput = document.createElement("input");
      searchInput.type = "text";
      searchInput.id = "tk-settings-search-input";
      searchInput.placeholder = "Search global settings (e.g. pacing, retry, delay, theme, cache)...";
      searchInput.style.cssText = "flex:1; padding:6px 10px; border-radius:var(--tk-radius-sm); border:1px solid var(--tk-border-strong); background:var(--tk-bg-base); color:var(--tk-text); font-size:12px; outline:none;";
      const clearSearchBtn = document.createElement("button");
      clearSearchBtn.type = "button";
      clearSearchBtn.style.cssText = "background:none; border:none; color:var(--tk-text-muted); cursor:pointer; padding:4px; display:none; align-items:center; justify-content:center;";
      clearSearchBtn.innerHTML = icon("x");
      clearSearchBtn.title = "Clear search filter";
      searchWrap.append(searchInput, clearSearchBtn);
      pane.appendChild(searchWrap);
      const filterGlobalSettings = (query) => {
        const q = query.trim().toLowerCase();
        clearSearchBtn.style.display = q ? "inline-flex" : "none";
        const globalSections = pane.querySelectorAll(".tk-settings-collapsible-section");
        globalSections.forEach((section) => {
          if (!q) {
            section.style.display = "";
            if (typeof section._setExpanded === "function") {
              section._setExpanded(section._defaultExpanded ?? false);
            }
            const fields2 = section.querySelectorAll(".tk-settings-field");
            fields2.forEach((f) => {
              f.style.display = "";
            });
            return;
          }
          const sectionHeaderText = section.querySelector(".tk-settings-section-header")?.textContent?.toLowerCase() || "";
          const fields = section.querySelectorAll(".tk-settings-field");
          let matchedCount = 0;
          fields.forEach((field) => {
            const text = field.textContent.toLowerCase();
            const matches = sectionHeaderText.includes(q) || text.includes(q);
            field.style.display = matches ? "" : "none";
            if (matches) matchedCount++;
          });
          if (sectionHeaderText.includes(q) || matchedCount > 0) {
            section.style.display = "";
            if (typeof section._setExpanded === "function") {
              section._setExpanded(true);
            }
          } else {
            section.style.display = "none";
          }
        });
      };
      searchInput.addEventListener("input", () => filterGlobalSettings(searchInput.value));
      clearSearchBtn.addEventListener("click", () => {
        searchInput.value = "";
        filterGlobalSettings("");
        searchInput.focus();
      });
      GLOBAL_SECTIONS.forEach((section) => {
        const fields = section.fields.map((field) => SettingsUI._buildRangeField(field));
        pane.appendChild(
          SettingsUI._buildCollapsibleSection(section.title, fields, section.description, false)
        );
      });
      const themeField = document.createElement("div");
      themeField.className = "tk-settings-field";
      const themeLabel = document.createElement("label");
      themeLabel.textContent = "Theme";
      const themeSelect = document.createElement("select");
      themeSelect.title = "auto follows your operating system. The site itself has no theme to follow.";
      THEMES.forEach((value) => {
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = value.charAt(0).toUpperCase() + value.slice(1);
        if (Config.global.theme === value) opt.selected = true;
        themeSelect.appendChild(opt);
      });
      themeSelect.addEventListener("change", () => {
        Config.global.theme = themeSelect.value;
        applyTheme();
        Log(`Config change: global.theme = ${themeSelect.value}`, "info");
        SettingsUI._persist();
      });
      themeField.append(themeLabel, themeSelect);
      const logField = document.createElement("div");
      logField.className = "tk-settings-field";
      const logLabel = document.createElement("label");
      logLabel.textContent = "Console Log Level";
      const logSelect = document.createElement("select");
      logSelect.title = "debug: everything. info: normal operation (default). warn: only problems worth noticing. error: only failures.";
      ["debug", "info", "warn", "error"].forEach((lvl) => {
        const opt = document.createElement("option");
        opt.value = lvl;
        opt.textContent = lvl.charAt(0).toUpperCase() + lvl.slice(1);
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
      const tzField = document.createElement("div");
      tzField.className = "tk-settings-field";
      const tzLabel = document.createElement("label");
      tzLabel.textContent = "Log Timezone";
      const tzSelect = document.createElement("select");
      tzSelect.title = "Select timezone for console/diagnostic logging. Auto-detect uses your local browser timezone with fallback to US Central (America/Chicago).";
      [
        { value: "auto", label: "Auto-Detect (Client Local)" },
        { value: "America/Chicago", label: "US Central (America/Chicago)" },
        { value: "America/New_York", label: "US Eastern (America/New_York)" },
        { value: "America/Denver", label: "US Mountain (America/Denver)" },
        { value: "America/Los_Angeles", label: "US Pacific (America/Los_Angeles)" },
        { value: "UTC", label: "UTC" }
      ].forEach(({ value, label }) => {
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = label;
        if ((Config.global.timezone || "auto") === value) opt.selected = true;
        tzSelect.appendChild(opt);
      });
      tzSelect.addEventListener("change", () => {
        Config.global.timezone = tzSelect.value;
        RuntimeSettings.timezone = tzSelect.value;
        Log(`Config change: global.timezone = ${tzSelect.value}`, "info");
        SettingsUI._persist();
      });
      tzField.append(tzLabel, tzSelect);
      const tsFormatField = document.createElement("div");
      tsFormatField.className = "tk-settings-field";
      const tsFormatLabel = document.createElement("label");
      tsFormatLabel.textContent = "Log Timestamp Format";
      const tsFormatInput = document.createElement("input");
      tsFormatInput.type = "text";
      tsFormatInput.value = Config.global.timestampFormat || "HH:mm:ss.SSS TZ";
      tsFormatInput.style.cssText = "width:100%; padding:4px 6px; background:var(--tk-bg-base); color:var(--tk-text); border:1px solid var(--tk-border-strong); border-radius:var(--tk-radius-sm); font-family:var(--tk-font-mono); font-size:11px;";
      tsFormatInput.title = "Tokens: YYYY, YY, MM, DD, HH, hh, mm, ss, SSS, A, TZ";
      tsFormatInput.addEventListener("change", () => {
        const val = tsFormatInput.value.trim() || "HH:mm:ss.SSS TZ";
        Config.global.timestampFormat = val;
        RuntimeSettings.timestampFormat = val;
        Log(`Config change: global.timestampFormat = ${val}`, "info");
        SettingsUI._persist();
      });
      const tsFormatHint = document.createElement("div");
      tsFormatHint.className = "tk-settings-hint";
      tsFormatHint.textContent = "Tokens: YYYY, YY, MM, DD, HH, hh, mm, ss, SSS, A, TZ (e.g. HH:mm:ss.SSS TZ, YYYYmmDDHHMMSS, YYYY-MM-DD HH:mm:ss)";
      tsFormatField.append(tsFormatLabel, tsFormatInput, tsFormatHint);
      pane.appendChild(
        SettingsUI._buildCollapsibleSection(
          "Appearance & Diagnostic Logging",
          [themeField, logField, tzField, tsFormatField],
          "Control visual dark/light themes and console logger formatting.",
          false
        )
      );
      const templateField = document.createElement("div");
      templateField.className = "tk-settings-field";
      const templateLabel = document.createElement("label");
      templateLabel.textContent = "Template Format";
      const templateInput = document.createElement("input");
      templateInput.type = "text";
      templateInput.value = Config.global.cardFormatterTemplate || "{PlayerName} - {Year} {SetName} {Tags} {PR} #{CardNo}";
      templateInput.style.cssText = "width:100%; padding:4px 6px; background:var(--tk-bg-base); color:var(--tk-text); border:1px solid var(--tk-border-strong); border-radius:var(--tk-radius-sm); font-family:var(--tk-font-mono); font-size:11px;";
      templateInput.title = "Tokens: {PlayerName}, {Year}, {SetName}, {Tags}, {PR}, {CardNo}";
      templateInput.addEventListener("change", () => {
        Config.global.cardFormatterTemplate = templateInput.value.trim();
        Log(`Config change: global.cardFormatterTemplate = ${Config.global.cardFormatterTemplate}`, "info");
        SettingsUI._persist();
      });
      const templateHint = document.createElement("div");
      templateHint.className = "tk-settings-hint";
      templateHint.textContent = "Tokens: {PlayerName}, {Year}, {SetName}, {Tags}, {PR}, {CardNo}";
      templateField.append(templateLabel, templateInput, templateHint);
      const outputModeField = document.createElement("div");
      outputModeField.className = "tk-settings-field";
      const outputModeLabel = document.createElement("label");
      outputModeLabel.textContent = "Output Mode";
      const outputModeSelect = document.createElement("select");
      outputModeSelect.title = "popover: show floating copy button near text. clipboard: auto-copy to clipboard.";
      [
        { value: "popover", label: "Floating Popover" },
        { value: "clipboard", label: "Auto-Copy to Clipboard" }
      ].forEach(({ value, label }) => {
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = label;
        if (Config.global.cardFormatterOutputMode === value) opt.selected = true;
        outputModeSelect.appendChild(opt);
      });
      outputModeSelect.addEventListener("change", () => {
        Config.global.cardFormatterOutputMode = outputModeSelect.value;
        Log(`Config change: global.cardFormatterOutputMode = ${outputModeSelect.value}`, "info");
        SettingsUI._persist();
      });
      outputModeField.append(outputModeLabel, outputModeSelect);
      const showCopyField = document.createElement("div");
      showCopyField.className = "tk-settings-field";
      const showCopyLabel = document.createElement("label");
      showCopyLabel.style.display = "flex";
      showCopyLabel.style.alignItems = "center";
      showCopyLabel.style.gap = "6px";
      showCopyLabel.style.cursor = "pointer";
      const showCopyCheckbox = document.createElement("input");
      showCopyCheckbox.type = "checkbox";
      showCopyCheckbox.checked = Config.global.cardFormatterShowCopy !== false;
      const showBRefField = document.createElement("div");
      showBRefField.className = "tk-settings-field";
      const showBRefLabel = document.createElement("label");
      showBRefLabel.style.display = "flex";
      showBRefLabel.style.alignItems = "center";
      showBRefLabel.style.gap = "6px";
      showBRefLabel.style.cursor = "pointer";
      const showBRefCheckbox = document.createElement("input");
      showBRefCheckbox.type = "checkbox";
      showBRefCheckbox.checked = Config.global.cardFormatterShowBRef !== false;
      const showGoogleField = document.createElement("div");
      showGoogleField.className = "tk-settings-field";
      const showGoogleLabel = document.createElement("label");
      showGoogleLabel.style.display = "flex";
      showGoogleLabel.style.alignItems = "center";
      showGoogleLabel.style.gap = "6px";
      showGoogleLabel.style.cursor = "pointer";
      const showGoogleCheckbox = document.createElement("input");
      showGoogleCheckbox.type = "checkbox";
      showGoogleCheckbox.checked = Config.global.cardFormatterShowGoogle !== false;
      const updateOutputModeState = () => {
        const showCopy = showCopyCheckbox.checked;
        const showBRef = showBRefCheckbox.checked;
        const showGoogle = showGoogleCheckbox.checked;
        const hasSearch = showBRef || showGoogle;
        if (hasSearch) {
          outputModeSelect.value = "popover";
          outputModeSelect.disabled = true;
          outputModeSelect.title = "Floating Popover is required when Baseball Reference or Google search is enabled.";
          if (Config.global.cardFormatterOutputMode !== "popover") {
            Config.global.cardFormatterOutputMode = "popover";
            Log("Config change: global.cardFormatterOutputMode = popover (required by active search actions)", "info");
          }
        } else if (showCopy) {
          outputModeSelect.disabled = false;
          outputModeSelect.title = "popover: show floating copy button near text. clipboard: auto-copy to clipboard.";
        } else {
          outputModeSelect.value = "clipboard";
          outputModeSelect.disabled = true;
          outputModeSelect.title = "No actions selected.";
          if (Config.global.cardFormatterOutputMode !== "clipboard") {
            Config.global.cardFormatterOutputMode = "clipboard";
          }
        }
      };
      showCopyCheckbox.addEventListener("change", () => {
        Config.global.cardFormatterShowCopy = showCopyCheckbox.checked;
        Log(`Config change: global.cardFormatterShowCopy = ${showCopyCheckbox.checked}`, "info");
        updateOutputModeState();
        SettingsUI._persist();
      });
      showCopyLabel.append(showCopyCheckbox, document.createTextNode("Show Copy Button"));
      showCopyField.appendChild(showCopyLabel);
      showBRefCheckbox.addEventListener("change", () => {
        Config.global.cardFormatterShowBRef = showBRefCheckbox.checked;
        Log(`Config change: global.cardFormatterShowBRef = ${showBRefCheckbox.checked}`, "info");
        updateOutputModeState();
        SettingsUI._persist();
      });
      showBRefLabel.append(showBRefCheckbox, document.createTextNode("Show Baseball Reference Search"));
      showBRefField.appendChild(showBRefLabel);
      showGoogleCheckbox.addEventListener("change", () => {
        Config.global.cardFormatterShowGoogle = showGoogleCheckbox.checked;
        Log(`Config change: global.cardFormatterShowGoogle = ${showGoogleCheckbox.checked}`, "info");
        updateOutputModeState();
        SettingsUI._persist();
      });
      showGoogleLabel.append(showGoogleCheckbox, document.createTextNode("Show Google Search"));
      showGoogleField.appendChild(showGoogleLabel);
      updateOutputModeState();
      pane.appendChild(
        SettingsUI._buildCollapsibleSection(
          "Card Name Formatter Settings",
          [templateField, outputModeField, showCopyField, showBRefField, showGoogleField],
          "Configure custom copy templates, floating popover output modes, and search actions.",
          false
        )
      );
      const DISPLAY_MODES = [
        { value: "both", label: "Icon & Text" },
        { value: "icon", label: "Icon Only" },
        { value: "text", label: "Text Only" }
      ];
      const displayFieldsConfig = [
        {
          key: "toolbarButtonDisplay",
          label: "Toolbar Button Display",
          title: "Choose whether toolbar shortcut buttons show icons, text, or both.",
          onUpdate: () => Toolbar.renderCenterContext()
        },
        {
          key: "pinButtonDisplay",
          label: "Pinned Set Button Display",
          title: "Choose whether buttons in pinned set dropdowns show icons, text, or both.",
          onUpdate: () => Toolbar.renderPins()
        },
        {
          key: "setButtonDisplay",
          label: "Injected Set Button Display",
          title: "Choose whether buttons injected beside set links on pages show icons, text, or both.",
          onUpdate: () => reinjectSetActions()
        }
      ];
      const displayNodes = displayFieldsConfig.map(({ key, label: fieldLabelText, title: fieldTitleText, onUpdate }) => {
        const field = document.createElement("div");
        field.className = "tk-settings-field";
        const fieldLabel = document.createElement("label");
        fieldLabel.textContent = fieldLabelText;
        const select = document.createElement("select");
        select.title = fieldTitleText;
        DISPLAY_MODES.forEach(({ value, label: optLabel }) => {
          const opt = document.createElement("option");
          opt.value = value;
          opt.textContent = optLabel;
          if ((Config.global[key] || "both") === value) opt.selected = true;
          select.appendChild(opt);
        });
        select.addEventListener("change", () => {
          Config.global[key] = select.value;
          Log(`Config change: global.${key} = ${select.value}`, "info");
          if (onUpdate) onUpdate();
          SettingsUI._persist();
        });
        field.appendChild(fieldLabel);
        field.appendChild(select);
        return field;
      });
      const posField = document.createElement("div");
      posField.className = "tk-settings-field";
      const posLabel = document.createElement("label");
      posLabel.textContent = "Quantity Counter Position";
      const posSelect = document.createElement("select");
      posSelect.title = "Select position for Collection Quantity Counter widget.";
      [
        { value: "bottom-right", label: "Bottom-Right Corner (Overlay)" },
        { value: "bottom-left", label: "Bottom-Left Corner (Overlay)" },
        { value: "toolbar", label: "SCToolkit Toolbar" }
      ].forEach(({ value, label }) => {
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = label;
        if ((Config.global.quantityCounterPosition || "bottom-right") === value) opt.selected = true;
        posSelect.appendChild(opt);
      });
      posSelect.addEventListener("change", () => {
        Config.global.quantityCounterPosition = posSelect.value;
        Log(`Config change: global.quantityCounterPosition = ${posSelect.value}`, "info");
        SettingsUI._persist();
      });
      posField.append(posLabel, posSelect);
      pane.appendChild(
        SettingsUI._buildCollapsibleSection(
          "Button Display Settings",
          [...displayNodes, posField],
          "Choose whether buttons show icons, text, or both across toolbars and page set links.",
          false
        )
      );
      pane.appendChild(SettingsUI._buildXmlPanel());
      const help = document.createElement("div");
      help.id = "tk-settings-help";
      help.style.marginTop = "16px";
      help.innerHTML = `Module, action, route-pattern, and threshold changes apply on next page load. The log level change above applies immediately to this page’s console output.<br><br>Version: ${SettingsUI._version()}<br>Documentation and issue tracker: <a href="https://github.com/djntechnic/SCToolkit" target="_blank" rel="noopener noreferrer">github.com/djntechnic/SCToolkit</a>`;
      pane.appendChild(help);
      return pane;
    },
    _buildXmlPanel: () => {
      const btnGroup = document.createElement("div");
      btnGroup.style.display = "flex";
      btnGroup.style.gap = "8px";
      btnGroup.style.marginTop = "4px";
      const exportBtn = createBtn("tk-xml-export", "Export XML", () => {
        try {
          const xml = configToXml(Config);
          const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `sctoolkit-settings-v${Config.schemaVersion || 3}.xml`;
          a.click();
          URL.revokeObjectURL(url);
          showToast({ variant: "success", message: "Settings exported to XML." });
        } catch (err) {
          showToast({ variant: "error", message: `XML export failed: ${err.message}` });
        }
      });
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = ".xml,text/xml,application/xml";
      fileInput.style.display = "none";
      fileInput.addEventListener("change", async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          const xmlText = await file.text();
          const imported = xmlToConfig(xmlText);
          Config.schemaVersion = imported.schemaVersion;
          Config.global = imported.global;
          Config.modules = imported.modules;
          syncExportConfig();
          applyTheme();
          SettingsStore.save(Config);
          Log("Settings successfully imported from XML file.", "info");
          showToast({ message: "Settings imported from XML! Reloading page...", variant: "success" });
          setTimeout(() => window.location.reload(), 1e3);
        } catch (err) {
          showToast({ message: `Import failed: ${err.message}`, variant: "error" });
        }
        fileInput.value = "";
      });
      const importBtn = createBtn("tk-xml-import", "Import XML", () => {
        fileInput.value = "";
        fileInput.click();
      });
      btnGroup.appendChild(exportBtn);
      btnGroup.appendChild(importBtn);
      btnGroup.appendChild(fileInput);
      return SettingsUI._buildCollapsibleSection(
        "XML Import / Export Settings",
        [btnGroup],
        "Backup all SCToolkit settings (globals, module states, sub-actions, route rules) to XML or restore from file.",
        true
      );
    },
    /**
     * What the script currently thinks about this page.
     *
     * Contract-check results, active-module resolution, and the block timestamp
     * previously only ever reached the console — which meant that when a user
     * reported "the filter didn't appear", nobody could tell whether the module
     * had run at all.
     */
    _buildDiagnosticsPane: () => {
      const pane = document.createElement("div");
      pane.id = "tk-settings-diagnostics";
      const title = document.createElement("div");
      title.className = "tk-settings-section-title";
      title.textContent = "Diagnostics";
      pane.appendChild(title);
      const active = resolveModules().map((m) => m.name);
      const lastBlock = getValue(BLOCK_TS_KEY, 0);
      const routes = Object.keys(Routes).filter((key) => {
        try {
          return Routes[key]();
        } catch {
          return false;
        }
      });
      const themeFormatted = (Config.global.theme || "auto").charAt(0).toUpperCase() + (Config.global.theme || "auto").slice(1);
      const resolvedTheme = document.documentElement.getAttribute("data-sctk-theme") || "";
      const resolvedFormatted = resolvedTheme ? resolvedTheme.charAt(0).toUpperCase() + resolvedTheme.slice(1) : "";
      const rows = [
        ["Version", SettingsUI._version()],
        ["URL", window.location.pathname + window.location.search],
        ["Matched Routes", routes.length ? routes.join(", ") : "none"],
        ["Active Modules", active.length ? `${active.length}: ${active.join(", ")}` : "none on this page"],
        ["Last Block Detected", lastBlock ? new Date(lastBlock).toLocaleString() : "never"],
        ["Theme", `${themeFormatted}${resolvedFormatted ? ` (Resolved: ${resolvedFormatted})` : ""}`]
      ];
      const table = document.createElement("dl");
      table.className = "tk-diag-list";
      rows.forEach(([label, value]) => {
        const dt = document.createElement("dt");
        dt.textContent = label;
        const dd = document.createElement("dd");
        dd.textContent = value;
        table.append(dt, dd);
      });
      pane.appendChild(table);
      pane.appendChild(SettingsUI._buildDiagnosticsTestPanel());
      pane.appendChild(SettingsUI._buildContractPanel());
      pane.appendChild(SettingsUI._buildCachePanel());
      return pane;
    },
    /**
     * Render diagnostic self-test results for CSV escaping, Pacing state, and route matching.
     */
    _buildDiagnosticsTestPanel: () => {
      const field = document.createElement("div");
      field.className = "tk-settings-field";
      const label = document.createElement("label");
      label.textContent = "Diagnostic Self-Tests";
      field.appendChild(label);
      const testResults = DiagnosticTests.run();
      const list = document.createElement("ul");
      list.className = "tk-contract-list";
      testResults.forEach(({ name, pass, detail }) => {
        const item = document.createElement("li");
        item.className = pass ? "ok" : "bad";
        item.textContent = `${pass ? "PASS" : "FAIL"} · ${name} · ${detail}`;
        list.appendChild(item);
      });
      field.appendChild(list);
      return field;
    },
    /**
     * Every DOM assumption checked on this page, and whether it held.
     *
     * This is the answer to "the feature didn't appear". A failing row names the
     * selector that did not match, which turns a vague report into a
     * selector-drift issue someone can act on.
     */
    _buildContractPanel: () => {
      const field = document.createElement("div");
      field.className = "tk-settings-field";
      const label = document.createElement("label");
      label.textContent = "Page Contract Checks";
      field.appendChild(label);
      const checks = getContractResults();
      if (checks.length === 0) {
        const none = document.createElement("div");
        none.className = "tk-settings-hint";
        none.textContent = "No checks ran — no modules are active on this page.";
        field.appendChild(none);
        return field;
      }
      const list = document.createElement("ul");
      list.className = "tk-contract-list";
      checks.forEach(({ moduleId, label: text, ok }) => {
        const item = document.createElement("li");
        item.className = ok ? "ok" : "bad";
        item.textContent = `${ok ? "OK" : "MISSING"} · ${moduleId} · ${text}`;
        list.appendChild(item);
      });
      field.appendChild(list);
      const failed = checks.filter((c) => !c.ok).length;
      if (failed > 0) {
        const hint = document.createElement("div");
        hint.className = "tk-settings-hint";
        hint.textContent = `${failed} check(s) failed. If a feature is missing, this is why — please open a selector-drift issue and paste these lines.`;
        field.appendChild(hint);
      }
      return field;
    },
    /**
     * Cache occupancy plus a purge control.
     *
     * Surfacing the numbers matters: a cache that silently serves a stale export
     * is indistinguishable from a bug unless the user can see it exists and empty
     * it.
     */
    _buildCachePanel: () => {
      const field = document.createElement("div");
      field.className = "tk-settings-field";
      const label = document.createElement("label");
      label.textContent = "Cached Exports";
      const summary = document.createElement("div");
      summary.className = "tk-settings-hint";
      const refresh = () => {
        const { sets, rows } = stats(Config.global.exportCacheTtlHours);
        summary.textContent = sets === 0 ? "Nothing cached. Completed exports are stored here and reused within the lifetime above." : `${sets} set(s), ${rows} row(s) stored. Re-exporting any of them makes no requests.`;
      };
      refresh();
      const purge = createBtn("tk-cache-purge", "Clear Cache", () => {
        clear();
        refresh();
        showToast({ message: "Export cache cleared.", variant: "success" });
      });
      field.appendChild(label);
      field.appendChild(summary);
      field.appendChild(purge);
      return field;
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
    _buildRegexPane: () => {
      const pane = document.createElement("div");
      pane.id = "tk-settings-regex-tester";
      pane.className = "tk-tester-pane";
      const title = document.createElement("div");
      title.className = "tk-settings-section-title";
      title.textContent = "RegEx Expression Builder & Tester";
      pane.appendChild(title);
      const desc = document.createElement("div");
      desc.className = "tk-settings-hint";
      desc.textContent = "Build, test, and evaluate regular expressions in real-time with pattern presets, flag toggles, visual match highlighting, and capture group details.";
      pane.appendChild(desc);
      const patternRow = document.createElement("div");
      patternRow.className = "tk-tester-row";
      const patternInputWrap = document.createElement("div");
      patternInputWrap.className = "tk-tester-row-input";
      const patternLabel = document.createElement("label");
      patternLabel.style.display = "block";
      patternLabel.style.fontSize = "10.5px";
      patternLabel.style.fontWeight = "700";
      patternLabel.style.marginBottom = "3px";
      patternLabel.textContent = "RegEx Pattern";
      const patternInput = document.createElement("input");
      patternInput.type = "text";
      patternInput.className = "tk-tester-input";
      patternInput.placeholder = "e.g. /viewcollection.*\\.cfm or PageIndex=(\\d+)";
      patternInput.value = "/viewcollectionmode\\.cfm";
      patternInputWrap.append(patternLabel, patternInput);
      patternRow.appendChild(patternInputWrap);
      const flagsWrap = document.createElement("div");
      flagsWrap.className = "tk-regex-flags";
      const flagValues = { i: true, g: false, m: false, s: false, u: false };
      ["i", "g", "m", "s", "u"].forEach((flag) => {
        const label = document.createElement("label");
        label.className = "tk-regex-flag-label";
        label.title = `Flag ${flag}`;
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = flagValues[flag];
        cb.addEventListener("change", () => {
          flagValues[flag] = cb.checked;
          updateRegex();
        });
        label.append(cb, document.createTextNode(flag));
        flagsWrap.appendChild(label);
      });
      patternRow.appendChild(flagsWrap);
      pane.appendChild(patternRow);
      const presetsWrap = document.createElement("div");
      presetsWrap.className = "tk-preset-chips";
      const presets = [
        { name: "Checklist", pattern: "/checklist\\.cfm" },
        { name: "View Collection", pattern: "/viewcollectionmode\\.cfm" },
        { name: "For Sale / Trade", pattern: "/viewcollectionforsaletrade\\.cfm" },
        { name: "Wantlist", pattern: "/viewcollectionwantlist\\.cfm" },
        { name: "Add Multiples", pattern: "/collectionaddmultiples" },
        { name: "Inserts", pattern: "/inserts\\.cfm" },
        { name: "ViewSet", pattern: "/viewset\\.cfm" },
        { name: "SID Capture", pattern: "/sid/(\\d+)" }
      ];
      presets.forEach((p) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "tk-preset-chip";
        chip.textContent = p.name;
        chip.title = `Use pattern: ${p.pattern}`;
        chip.addEventListener("click", () => {
          patternInput.value = p.pattern;
          updateRegex();
        });
        presetsWrap.appendChild(chip);
      });
      pane.appendChild(presetsWrap);
      const subjectWrap = document.createElement("div");
      subjectWrap.className = "tk-settings-field";
      subjectWrap.style.marginBottom = "6px";
      const subjectLabel = document.createElement("label");
      subjectLabel.textContent = "Test Subject / URL";
      const subjectInput = document.createElement("textarea");
      subjectInput.className = "tk-tester-textarea";
      subjectInput.placeholder = "Type or paste test string/URL here...";
      subjectInput.value = "https://www.tcdb.com/ViewCollectionMode.cfm?Member=djncards&CollectionID=6";
      subjectWrap.append(subjectLabel, subjectInput);
      pane.appendChild(subjectWrap);
      const statusBar = document.createElement("div");
      statusBar.className = "tk-tester-status-bar";
      const statusText = document.createElement("span");
      statusText.textContent = "Status";
      const statusBadge = document.createElement("span");
      statusBadge.className = "tk-status-badge unmatched";
      statusBadge.textContent = "NO MATCH";
      statusBar.append(statusText, statusBadge);
      pane.appendChild(statusBar);
      const highlightTitle = document.createElement("div");
      highlightTitle.className = "tk-route-editor-title";
      highlightTitle.textContent = "Matched Output Highlight";
      pane.appendChild(highlightTitle);
      const highlightBox = document.createElement("div");
      highlightBox.className = "tk-regex-highlight-box";
      pane.appendChild(highlightBox);
      const groupsTitle = document.createElement("div");
      groupsTitle.className = "tk-route-editor-title";
      groupsTitle.style.marginTop = "6px";
      groupsTitle.textContent = "Capture Groups Breakdown";
      pane.appendChild(groupsTitle);
      const groupsContainer = document.createElement("div");
      groupsContainer.style.overflowX = "auto";
      pane.appendChild(groupsContainer);
      function updateRegex() {
        const patStr = patternInput.value.trim();
        const subjectStr = subjectInput.value;
        const flagsStr = Object.keys(flagValues).filter((f) => flagValues[f]).join("");
        highlightBox.innerHTML = "";
        groupsContainer.innerHTML = "";
        if (!patStr) {
          statusBadge.className = "tk-status-badge disabled";
          statusBadge.textContent = "NO PATTERN";
          highlightBox.textContent = subjectStr;
          return;
        }
        let re;
        try {
          re = new RegExp(patStr, flagsStr);
        } catch (err) {
          statusBadge.className = "tk-status-badge error";
          statusBadge.textContent = `SYNTAX ERROR: ${err.message}`;
          highlightBox.textContent = subjectStr;
          return;
        }
        const esc = (str) => String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
        const matches = [];
        if (re.global) {
          let m;
          while ((m = re.exec(subjectStr)) !== null) {
            matches.push(m);
            if (m.index === re.lastIndex) re.lastIndex++;
          }
        } else {
          const m = re.exec(subjectStr);
          if (m) matches.push(m);
        }
        if (matches.length === 0) {
          statusBadge.className = "tk-status-badge unmatched";
          statusBadge.textContent = "NO MATCH";
          highlightBox.textContent = subjectStr;
          return;
        }
        statusBadge.className = "tk-status-badge matched";
        statusBadge.textContent = `MATCHED (${matches.length} match${matches.length > 1 ? "es" : ""})`;
        let html = "";
        let lastIndex = 0;
        matches.forEach((m) => {
          const start = m.index;
          const end = start + m[0].length;
          html += esc(subjectStr.slice(lastIndex, start));
          html += `<mark class="tk-regex-match-hl">${esc(m[0])}</mark>`;
          lastIndex = end;
        });
        html += esc(subjectStr.slice(lastIndex));
        highlightBox.innerHTML = html;
        const tbl = document.createElement("table");
        tbl.className = "tk-regex-groups-table";
        tbl.innerHTML = `
        <thead>
          <tr>
            <th>Match #</th>
            <th>Group</th>
            <th>Value</th>
            <th>Range</th>
          </tr>
        </thead>
        <tbody></tbody>
      `;
        const tbody = tbl.querySelector("tbody");
        matches.forEach((m, mIdx) => {
          m.forEach((val, gIdx) => {
            const tr = document.createElement("tr");
            const groupName = gIdx === 0 ? "0 (Full)" : `$${gIdx}`;
            const start = gIdx === 0 ? m.index : "-";
            const end = gIdx === 0 ? m.index + m[0].length : "-";
            const rangeStr = start !== "-" ? `[${start}, ${end}]` : "-";
            tr.innerHTML = `
            <td>#${mIdx + 1}</td>
            <td><strong>${groupName}</strong></td>
            <td><code>${esc(val !== void 0 ? val : "")}</code></td>
            <td>${rangeStr}</td>
          `;
            tbody.appendChild(tr);
          });
        });
        groupsContainer.appendChild(tbl);
      }
      patternInput.addEventListener("input", updateRegex);
      subjectInput.addEventListener("input", updateRegex);
      updateRegex();
      return pane;
    },
    _buildRouteTesterPane: () => {
      const pane = document.createElement("div");
      pane.id = "tk-settings-route-tester";
      pane.className = "tk-tester-pane";
      const title = document.createElement("div");
      title.className = "tk-settings-section-title";
      title.textContent = "URL Route Match Tester";
      pane.appendChild(title);
      const desc = document.createElement("div");
      desc.className = "tk-settings-hint";
      desc.textContent = "Test any page URL against all module route matching rules to evaluate which modules will run on that page.";
      pane.appendChild(desc);
      const urlWrap = document.createElement("div");
      urlWrap.className = "tk-settings-field";
      urlWrap.style.marginBottom = "6px";
      const urlLabel = document.createElement("label");
      urlLabel.textContent = "Target Page URL";
      const urlRow = document.createElement("div");
      urlRow.className = "tk-tester-row";
      const urlInput = document.createElement("input");
      urlInput.type = "text";
      urlInput.className = "tk-tester-input tk-tester-row-input";
      urlInput.placeholder = "https://www.tcdb.com/ViewCollectionMode.cfm?Member=djncards";
      urlInput.value = typeof window !== "undefined" ? window.location.href : "https://www.tcdb.com/ViewCollectionMode.cfm?Member=djncards";
      const useCurrentBtn = document.createElement("button");
      useCurrentBtn.type = "button";
      useCurrentBtn.className = "tk-route-add-btn";
      useCurrentBtn.style.marginTop = "0";
      useCurrentBtn.textContent = "Current Page";
      useCurrentBtn.addEventListener("click", () => {
        if (typeof window !== "undefined") {
          urlInput.value = window.location.href;
          updateRouteTester();
        }
      });
      urlRow.append(urlInput, useCurrentBtn);
      urlWrap.append(urlLabel, urlRow);
      pane.appendChild(urlWrap);
      const samplesWrap = document.createElement("div");
      samplesWrap.className = "tk-preset-chips";
      const samples = [
        { name: "Checklist", url: "https://www.tcdb.com/Checklist.cfm/sid/11172" },
        { name: "View Collection", url: "https://www.tcdb.com/ViewCollectionMode.cfm?Member=djncards&CollectionID=6" },
        { name: "For Sale / Trade", url: "https://www.tcdb.com/ViewCollectionForSaleTrade.cfm?Member=djncards" },
        { name: "Add Multiples", url: "https://www.tcdb.com/CollectionAddMultiplesText.cfm?SetID=11172" },
        { name: "Inserts", url: "https://www.tcdb.com/Inserts.cfm/sid/11172" }
      ];
      samples.forEach((s) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "tk-preset-chip";
        chip.textContent = s.name;
        chip.addEventListener("click", () => {
          urlInput.value = s.url;
          updateRouteTester();
        });
        samplesWrap.appendChild(chip);
      });
      pane.appendChild(samplesWrap);
      const cardsContainer = document.createElement("div");
      cardsContainer.style.display = "flex";
      cardsContainer.style.flexDirection = "column";
      cardsContainer.style.gap = "8px";
      cardsContainer.style.marginTop = "8px";
      pane.appendChild(cardsContainer);
      function updateRouteTester() {
        const testUrl = urlInput.value.trim();
        cardsContainer.innerHTML = "";
        if (!testUrl) {
          const empty = document.createElement("div");
          empty.className = "tk-settings-hint";
          empty.textContent = "Enter a URL above to evaluate module matching.";
          cardsContainer.appendChild(empty);
          return;
        }
        ModuleRegistry.forEach((mod) => {
          const cfg = Config.modules[mod.id];
          if (!cfg) return;
          const card = document.createElement("div");
          card.className = "tk-route-card";
          const header = document.createElement("div");
          header.className = "tk-route-card-header";
          const titleEl = document.createElement("div");
          titleEl.className = "tk-route-card-title";
          titleEl.textContent = mod.name;
          let isMatch = false;
          let throwsError = false;
          try {
            isMatch = testUrlMatch(cfg.urlMatch, testUrl);
          } catch {
            throwsError = true;
          }
          const badge = document.createElement("span");
          if (isMatch && !throwsError) {
            badge.className = "tk-status-badge matched";
            badge.textContent = "MATCH";
          } else {
            badge.className = "tk-status-badge unmatched";
            badge.textContent = "NO MATCH";
          }
          header.append(titleEl, badge);
          card.appendChild(header);
          const rulesList = document.createElement("div");
          rulesList.className = "tk-route-rules-list";
          if (!cfg.urlMatch || cfg.urlMatch.length === 0) {
            const rItem = document.createElement("div");
            rItem.className = "tk-route-rule-item pass";
            rItem.textContent = "✓ No route rules defined — matches all URLs by default";
            rulesList.appendChild(rItem);
          } else {
            cfg.urlMatch.forEach((rule) => {
              let ruleMatches = false;
              try {
                ruleMatches = new RegExp(rule.pattern, "i").test(testUrl);
              } catch {
                ruleMatches = false;
              }
              const rItem = document.createElement("div");
              if (rule.exclude) {
                rItem.className = ruleMatches ? "tk-route-rule-item fail" : "tk-route-rule-item";
                rItem.textContent = ruleMatches ? `✗ Exclude match: "${rule.pattern}" (EXCLUDED)` : `— Exclude rule: "${rule.pattern}" (Passed)`;
              } else {
                rItem.className = ruleMatches ? "tk-route-rule-item pass" : "tk-route-rule-item";
                rItem.textContent = ruleMatches ? `✓ Include match: "${rule.pattern}" (MATCHED)` : `— Include rule: "${rule.pattern}" (Not matched)`;
              }
              rulesList.appendChild(rItem);
            });
          }
          card.appendChild(rulesList);
          cardsContainer.appendChild(card);
        });
      }
      urlInput.addEventListener("input", updateRouteTester);
      updateRouteTester();
      return pane;
    },
    _version: () => getAppVersion()
  };
  var GLOBAL_SECTIONS = [
    {
      title: "Network Pacing & Rate Limits",
      description: "Configure request spacing, random jitter, cross-tab serialization, and adaptive server strain thresholds.",
      fields: [
        {
          label: "Export Base Delay",
          key: "exportBaseDelayMs",
          min: 500,
          max: 5e3,
          step: 50,
          unit: "ms",
          hint: "Minimum wait between paginated fetch requests. Configures fundamental request pacing."
        },
        {
          label: "Export Jitter",
          key: "exportJitterMaxMs",
          min: 0,
          max: 2e3,
          step: 50,
          unit: "ms",
          hint: "Random amount added on top of base delay to randomize request cadence and avoid WAF fingerprinting."
        },
        {
          label: "Pagination Throttle Start Page",
          key: "paginationThrottleStartPage",
          min: 1,
          max: 50,
          step: 1,
          unit: " pages",
          hint: "Page threshold at which request pacing and throttling delays activate during auto-pagination."
        },
        {
          label: "Pacing Strain Penalty Step",
          key: "pacingPenaltyStepMs",
          min: 100,
          max: 2e3,
          step: 50,
          unit: "ms",
          hint: "Adaptive penalty step added to pacing delay whenever server strain (slow response or throttle) is detected."
        },
        {
          label: "Pacing Strain Penalty Ceiling",
          key: "pacingPenaltyCapMs",
          min: 1e3,
          max: 3e4,
          step: 500,
          unit: "ms",
          hint: "Upper ceiling on accumulated server strain penalty."
        },
        {
          label: "Pacing Slow Response Latency",
          key: "pacingSlowResponseMs",
          min: 1e3,
          max: 1e4,
          step: 250,
          unit: "ms",
          hint: "Response latency threshold above which a fetch is flagged as server strain."
        },
        {
          label: "Pacing Latency Sample Window",
          key: "pacingSampleWindow",
          min: 3,
          max: 50,
          step: 1,
          unit: " samples",
          hint: "Number of recent response latency samples used to compute rolling median latency."
        },
        {
          label: "Pacing Strain Relief Step",
          key: "pacingReliefStepMs",
          min: 10,
          max: 500,
          step: 10,
          unit: "ms",
          hint: "Amount subtracted from strain penalty per successful, unremarkable response."
        },
        {
          label: "Cross-Tab Throttle Wait Slice",
          key: "throttleMaxSliceMs",
          min: 50,
          max: 1e3,
          step: 25,
          unit: "ms",
          hint: "Slice interval before re-evaluating cross-tab request slot locks."
        },
        {
          label: "Hierarchy Export Min Delay",
          key: "exportHierarchyMinDelayMs",
          min: 1e3,
          max: 3e4,
          step: 500,
          unit: "ms",
          hint: "Minimum delay before fetching each parent set in hierarchy export."
        },
        {
          label: "Hierarchy Export Max Delay",
          key: "exportHierarchyMaxDelayMs",
          min: 1e3,
          max: 6e4,
          step: 500,
          unit: "ms",
          hint: "Maximum delay before fetching each parent set in hierarchy export."
        }
      ]
    },
    {
      title: "Retry & Safety Safeguards",
      description: "Manage retry backoffs, request timeouts, pagination limits, and anti-scraping cooldown protection.",
      fields: [
        {
          label: "Max Retries Per Page",
          key: "exportMaxRetries",
          min: 0,
          max: 8,
          step: 1,
          unit: "",
          hint: "Retry attempts for a single page on HTTP 429/503 before the export fails."
        },
        {
          label: "Retry Backoff — Base",
          key: "exportBackoffBaseMs",
          min: 250,
          max: 5e3,
          step: 250,
          unit: "ms",
          hint: "Starting wait before the first retry; doubles on each subsequent attempt up to the cap below."
        },
        {
          label: "Retry Backoff — Cap",
          key: "exportBackoffCapMs",
          min: 2e3,
          max: 6e4,
          step: 1e3,
          unit: "ms",
          hint: "Upper limit on the doubling backoff delay, regardless of retry count."
        },
        {
          label: "Pagination Safety Ceiling",
          key: "exportMaxPages",
          min: 20,
          max: 500,
          step: 10,
          unit: " pages",
          hint: "Hard stop on discovered page count — protects against runaway fetch loops on massive sets."
        },
        {
          label: "Request Timeout",
          key: "exportRequestTimeoutMs",
          min: 5e3,
          max: 12e4,
          step: 5e3,
          unit: "ms",
          hint: "Abandon a single request that never answers. Without this a hung request stalls the whole queue indefinitely."
        },
        {
          label: "Anti-Scraping Cooldown",
          key: "exportBlockCooldownMinutes",
          min: 0,
          max: 30,
          step: 1,
          unit: " min",
          hint: "After a detected block (captcha/verification page), refuse new exports for this long. 0 disables the cooldown."
        }
      ]
    },
    {
      title: "Local Storage & Caching",
      description: "Configure local browser cache retention, TTL, and storage limits for exported sets.",
      fields: [
        {
          label: "Export Cache Lifetime",
          key: "exportCacheTtlHours",
          min: 0,
          max: 168,
          step: 1,
          unit: " h",
          hint: "Re-exporting a set within this window reuses the stored result and makes no requests at all. 0 disables caching."
        },
        {
          label: "Export Cache Max Entries",
          key: "exportCacheMaxEntries",
          min: 5,
          max: 100,
          step: 5,
          unit: " sets",
          hint: "Maximum number of exported set results retained in local storage cache."
        },
        {
          label: "Export Cache Max Rows",
          key: "exportCacheMaxRows",
          min: 1e3,
          max: 1e5,
          step: 1e3,
          unit: " rows",
          hint: "Maximum rows allowed for a single set before cache storage skips saving it."
        }
      ]
    },
    {
      title: "UI & Performance Settings",
      description: "Customize UI toast notifications, page component delays, debounces, and batch rendering chunk sizes.",
      fields: [
        {
          label: "Toast Display Duration",
          key: "toastDurationMs",
          min: 1500,
          max: 1e4,
          step: 250,
          unit: "ms",
          hint: "How long status/confirmation toasts stay visible before fading out."
        },
        {
          label: "Toast Stack Limit",
          key: "toastStackLimit",
          min: 1,
          max: 10,
          step: 1,
          unit: " toasts",
          hint: "Maximum number of toast notifications allowed to stack on screen simultaneously."
        },
        {
          label: "Checklist Filter Debounce",
          key: "checklistFilterDebounceMs",
          min: 0,
          max: 500,
          step: 25,
          unit: "ms",
          hint: "Delay after typing stops before the real-time table filter re-scans rows."
        },
        {
          label: "Pagination Loader Delay",
          key: "paginationLoaderDelayMs",
          min: 300,
          max: 3e3,
          step: 100,
          unit: "ms",
          hint: "Fixed wait before the CSV export button is enabled on paginated pages."
        },
        {
          label: "Add Multiples Focus Deadline",
          key: "addMultiplesFocusDeadlineMs",
          min: 300,
          max: 5e3,
          step: 100,
          unit: "ms",
          hint: "Timeout deadline for auto-focusing quantity input fields on Add Multiples forms."
        },
        {
          label: "Set List Enhancer Chunk Size",
          key: "setListEnhancerChunkSize",
          min: 5,
          max: 100,
          step: 5,
          unit: " links",
          hint: "Batch rendering chunk size for injecting set list link badges."
        },
        {
          label: "Settings Save Debounce",
          key: "settingsSaveDebounceMs",
          min: 100,
          max: 2e3,
          step: 100,
          unit: "ms",
          hint: "How long to wait after the last settings change before writing to storage."
        },
        {
          label: "Card Formatter Popover Duration",
          key: "cardFormatterPopoverDurationMs",
          min: 1e3,
          max: 1e4,
          step: 500,
          unit: "ms",
          hint: "How long the floating copy popover stays visible before auto-dismissing."
        }
      ]
    }
  ];

  // src/ui/palette.js
  var OVERLAY_ID = "tk-palette-overlay";
  var MAX_RESULTS = 12;
  function fuzzyScore(query, text) {
    if (query === "") return 0;
    const haystack = text.toLowerCase();
    let score = 0;
    let cursor = 0;
    let previous = -2;
    for (const ch of query) {
      const found = haystack.indexOf(ch, cursor);
      if (found === -1) return -1;
      if (found === previous + 1) score += 3;
      if (found === 0 || /[\s\-_/]/.test(haystack[found - 1])) score += 2;
      score += 1;
      previous = found;
      cursor = found + 1;
    }
    if (haystack.includes(query)) {
      score += 5;
    }
    const finalScore = score - haystack.length / 500;
    return Math.max(0, finalScore);
  }
  function rankCommands(commands, query) {
    const q = query.trim().toLowerCase();
    if (q === "") return commands.slice(0, MAX_RESULTS);
    return commands.map((command) => ({ command, score: fuzzyScore(q, command.label) })).filter(({ score }) => score >= 0).sort((a, b) => b.score - a.score).slice(0, MAX_RESULTS).map(({ command }) => command);
  }
  function buildCommands({ href = window.location.href, pins = Pins.all() } = {}) {
    const commands = [];
    const currentSid = extractSid(href);
    if (currentSid) {
      SHORTCUT_KEYS.forEach((key) => {
        const badge = BADGES[key];
        commands.push({
          label: `This set: ${badge.title}`,
          hint: "current set",
          run: () => {
            window.location.href = badge.getUrl(currentSid);
          }
        });
      });
      commands.push({
        label: "This set: Export checklist to CSV",
        hint: "current set",
        run: () => {
          const fullUrl = Utils.toFullUrl(`/Checklist.cfm/sid/${currentSid}/`);
          Log(`[CLIENT] Command Palette CSV Export requested for current set ID ${currentSid} — ${fullUrl}`, "info", "client");
          exportSetCSV(currentSid, document.title || "Set");
        }
      });
    }
    pins.forEach((pin) => {
      commands.push({
        label: `Pinned: ${pin.name}`,
        hint: pin.year,
        run: () => {
          window.location.href = pin.url;
        }
      });
      commands.push({
        label: `Pinned: Export ${pin.name}`,
        hint: "CSV",
        run: () => {
          const fullUrl = Utils.toFullUrl(pin.url || `/Checklist.cfm/sid/${pin.id}/`);
          Log(`[CLIENT] Command Palette CSV Export requested for pinned set '${pin.name}' (ID ${pin.id}) — ${fullUrl}`, "info", "client");
          exportSetCSV(pin.id, pin.name);
        }
      });
    });
    return commands;
  }
  var isOpen = () => !!document.getElementById(OVERLAY_ID);
  function closePalette() {
    document.getElementById(OVERLAY_ID)?.remove();
  }
  function openPalette(deps = {}) {
    if (isOpen()) return;
    const commands = [
      ...buildCommands(deps),
      { label: "Open Settings", hint: "configuration", run: () => deps.openSettings?.() }
    ];
    const overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closePalette();
    });
    const panel = document.createElement("div");
    panel.id = "tk-palette-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", "SCToolkit command palette");
    const input = document.createElement("input");
    input.type = "text";
    input.id = "tk-palette-input";
    input.placeholder = "Search sets and actions...";
    input.setAttribute("aria-label", "Search sets and actions");
    input.autocomplete = "off";
    const list = document.createElement("div");
    list.id = "tk-palette-results";
    list.setAttribute("role", "listbox");
    let active = 0;
    let shown = [];
    const render = () => {
      shown = rankCommands(commands, input.value);
      list.innerHTML = "";
      active = Math.min(active, Math.max(shown.length - 1, 0));
      if (shown.length === 0) {
        const empty = document.createElement("div");
        empty.className = "tk-palette-empty";
        empty.textContent = "No matches.";
        list.appendChild(empty);
        return;
      }
      shown.forEach((command, i) => {
        const row = document.createElement("div");
        row.className = `tk-palette-item${i === active ? " active" : ""}`;
        row.setAttribute("role", "option");
        row.setAttribute("aria-selected", String(i === active));
        row.innerHTML = `<span class="tk-palette-label">${Utils.escape.html(command.label)}</span><span class="tk-palette-hint">${Utils.escape.html(command.hint)}</span>`;
        row.addEventListener("click", () => {
          closePalette();
          command.run();
        });
        list.appendChild(row);
      });
    };
    input.addEventListener("input", () => {
      active = 0;
      render();
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closePalette();
        return;
      }
      if (e.key === "Enter") {
        const command = shown[active];
        if (command) {
          closePalette();
          command.run();
        }
        return;
      }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      if (shown.length === 0) return;
      active = e.key === "ArrowDown" ? (active + 1) % shown.length : (active - 1 + shown.length) % shown.length;
      render();
      list.children[active]?.scrollIntoView({ block: "nearest" });
    });
    panel.append(input, list);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    render();
    input.focus();
  }
  function initPalette(deps = {}) {
    document.addEventListener("keydown", (e) => {
      if (e.key !== "k" && e.key !== "K") return;
      if (!e.ctrlKey && !e.metaKey) return;
      const el = document.activeElement;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (typing && el.id !== "tk-palette-input") return;
      e.preventDefault();
      if (isOpen()) closePalette();
      else openPalette(deps);
    });
  }

  // src/main.js
  async function boot() {
    initConfig();
    initTheme();
    Log("Starting core execution sequence");
    Toolbar.init();
    SettingsUI.init();
    initPalette({ openSettings: () => SettingsUI.open() });
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
• ${loadedModuleNames.join("\n• ")}`,
      loadedModuleNames
    );
    showToast({
      message: `<b>SCToolkit Active</b> <span class="tk-toast-hint">Ctrl+K</span><ul>${loadedModuleNames.map((m) => `<li>${Utils.escape.html(m)}</li>`).join("")}</ul>`,
      location: "bottom-right",
      variant: "warn"
    });
    Log(`Core execution sequence complete. ${loadedModuleNames.length} modules loaded: ${loadedModuleNames.join(", ")}`);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
