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
    maxPages: 200,
    requestTimeoutMs: 3e4
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
          { pattern: "/viewcollectionforsaletrade\\.cfm", exclude: false },
          { pattern: "/viewcollectionwantlist\\.cfm", exclude: false },
          { pattern: "/collectionaddmultiples", exclude: false }
        ],
        actions: {
          realtimeFilter: true
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
      exportRequestTimeoutMs: EXPORT_CONFIG.requestTimeoutMs,
      exportBlockCooldownMinutes: 5,
      exportCacheTtlHours: 24,
      toastDurationMs: 4e3,
      checklistFilterDebounceMs: 150,
      paginationLoaderDelayMs: 1e3,
      settingsSaveDebounceMs: 400,
      theme: "auto",
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
        Log(`Migrating stored config from schema v${version} to v${current}.`, "info");
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
          Log(`Stored config references unknown module '${id}' — dropped.`, "warn");
          return;
        }
        const storedActions = stored.modules[id].actions || {};
        const actions = { ...defaults.actions };
        Object.keys(actions).forEach((key) => {
          if (key in storedActions) actions[key] = storedActions[key];
        });
        merged.modules[id] = { ...defaults, ...stored.modules[id], actions };
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
    EXPORT_CONFIG.requestTimeoutMs = Config.global.exportRequestTimeoutMs;
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

  // src/modules/inputOptimization.js
  var InputIndex = {
    /** @type {() => HTMLInputElement[]} */
    getValidInputs: () => []
  };
  function isEligibleInput(el) {
    const type = el.type ? el.type.toLowerCase() : "text";
    if (type !== "text" && type !== "number") return false;
    if (el.readOnly || el.disabled) return false;
    return el.offsetParent !== null || el.value === "0";
  }
  var cache = { inputs: null };
  function invalidateInputCache() {
    cache.inputs = null;
  }
  function getValidInputs() {
    if (cache.inputs === null) {
      cache.inputs = Array.from(document.querySelectorAll("input")).filter(isEligibleInput);
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
    const observer = new MutationObserver(invalidateInputCache);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", invalidateInputCache, { passive: true });
    InputIndex.getValidInputs = getValidInputs;
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
  function escapeHtml(str) {
    if (str === null || str === void 0) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  // src/modules/checklistEnhancer.js
  var FILTER_SCOPES = ["#main-content-area", "#content"];
  var DATA_ROW_SELECTOR = 'a[href*="ViewCard.cfm"], input, select';
  var HIDDEN_CLASS = "tk-hidden";
  function buildRowIndex(mainContent) {
    const index = [];
    mainContent.querySelectorAll("table tr").forEach((el) => {
      if (!el.querySelector(DATA_ROW_SELECTOR)) return;
      index.push({ el, haystack: el.textContent.replace(/\s+/g, " ").toLowerCase() });
    });
    return index;
  }
  function applyFilter(index, term) {
    let visible = 0;
    index.forEach(({ el, haystack }) => {
      const match = term === "" || haystack.includes(term);
      el.classList.toggle(HIDDEN_CLASS, !match);
      if (match) visible++;
    });
    return visible;
  }
  function findFilterScope(root = document) {
    for (const selector of FILTER_SCOPES) {
      const el = root.querySelector(selector);
      if (el && el.querySelector("table")) return el;
    }
    return null;
  }
  function installFilter(mainContent) {
    const targetTable = mainContent.querySelector("table");
    if (!targetTable) return;
    const index = buildRowIndex(mainContent);
    Log(`Checklist filter indexed ${index.length} data row(s).`, "debug");
    recordContract("checklistEnhancer", `indexed ${index.length} data row(s)`, index.length > 0);
    const filterWrap = document.createElement("div");
    filterWrap.id = "tk-checklist-filter-wrap";
    filterWrap.innerHTML = `
    <strong>Filter Items:</strong>
    <input type="text" id="tk-checklist-filter" placeholder="Filter by Player, Card #, Tag, Team..."
           title="Type to filter active table rows in real time" aria-label="Filter table rows">
    <span id="tk-filter-count" aria-live="polite"></span>
  `;
    targetTable.before(filterWrap);
    const countEl = filterWrap.querySelector("#tk-filter-count");
    const input = filterWrap.querySelector("#tk-checklist-filter");
    const run = debounce((term) => {
      const visible = applyFilter(index, term);
      countEl.textContent = term === "" ? "" : `${visible} of ${index.length}`;
    }, Config.global.checklistFilterDebounceMs);
    input.addEventListener("input", (e) => run(e.target.value.toLowerCase().trim()));
  }
  function initChecklistEnhancer() {
    if (!Config.modules.checklistEnhancer.actions.realtimeFilter) return;
    if (document.getElementById("tk-checklist-filter-wrap")) return;
    const scope = findFilterScope();
    if (!scope) {
      assertContract("checklistEnhancer", [
        { selector: FILTER_SCOPES.join(", "), label: "a listing container holding a table" }
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
  var VARIATION_CARD_NO = /\d+[a-z]$/i;
  var norm = (node) => node ? node.textContent.replace(/\s+/g, " ").trim() : "";
  function parseSubjectCell(rawSubject, captionDesc = "", caption = {}) {
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
      const attached = tagParts.some((t) => DESCRIBABLE_TAG.test(t));
      tagParts = tagParts.map((tag) => DESCRIBABLE_TAG.test(tag) ? `${tag} (${captionDesc})` : tag);
      const isVariation = caption.prefixed || attached || caption.variantCardNo;
      if (isVariation && !tagParts.some((t) => t.includes(captionDesc))) {
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
    const cardNo = cardNoLink.textContent.trim();
    let rawSubject = "";
    let captionDesc = "";
    let prefixed = false;
    if (subjectTd) {
      const figcaptionEl = subjectTd.querySelector("figcaption, .figure-caption");
      if (figcaptionEl) {
        const raw = norm(figcaptionEl);
        prefixed = CAPTION_PREFIX.test(raw);
        captionDesc = raw.replace(CAPTION_PREFIX, "").trim();
      }
      const cloneTd = subjectTd.cloneNode(true);
      cloneTd.querySelectorAll("figcaption, .figure-caption").forEach((el) => el.remove());
      rawSubject = norm(cloneTd);
    }
    const { subject, tags, printRun } = parseSubjectCell(rawSubject, captionDesc, {
      prefixed,
      variantCardNo: VARIATION_CARD_NO.test(cardNo)
    });
    return {
      cardNo,
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
    while (container.children.length >= STACK_LIMIT) container.firstChild.remove();
    const toast = document.createElement("div");
    toast.className = "tk-toast-message";
    toast.style.borderLeftColor = accent ?? TOAST_VARIANTS[variant] ?? TOAST_VARIANTS.info;
    toast.innerHTML = message;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add("tk-toast-show"), 10);
    if (duration !== Infinity) scheduleDismiss(toast, container, duration);
    return toast;
  }
  function scheduleDismiss(toast, container, delay) {
    setTimeout(() => {
      toast.classList.remove("tk-toast-show");
      setTimeout(() => {
        toast.remove();
        if (container.childNodes.length === 0) container.remove();
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
    const live = Object.entries(entries).filter(([, entry]) => entry && typeof entry.ts === "number" && now - entry.ts < ttlMs2).sort(([, a], [, b]) => b.ts - a.ts).slice(0, MAX_ENTRIES);
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
    if (payload.rows.length > MAX_ROWS) {
      Log(`Export of ${payload.rows.length} rows exceeds the cache limit (${MAX_ROWS}) — not cached.`, "debug");
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
    if (signal === "throttled" || signal === "slow") {
      return Math.min(current + PENALTY_STEP_MS, PENALTY_CAP_MS);
    }
    return Math.max(current - RELIEF_STEP_MS, 0);
  }
  var Pacing = {
    penaltyMs: 0,
    /** @type {number[]} */
    samples: [],
    reset() {
      Pacing.penaltyMs = 0;
      Pacing.samples = [];
    },
    /**
     * Record a completed response.
     *
     * @param {number} latencyMs
     * @param {boolean} [throttled] true when the response was an HTTP 429/503
     */
    record(latencyMs, throttled = false) {
      Pacing.samples.push(latencyMs);
      if (Pacing.samples.length > SAMPLE_WINDOW) Pacing.samples.shift();
      const signal = throttled ? "throttled" : median(Pacing.samples) > SLOW_RESPONSE_MS ? "slow" : "ok";
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
      write: write2 = (ts) => setValue(LAST_REQUEST_KEY, ts)
    } = deps;
    let waited = 0;
    for (; ; ) {
      const current = now();
      const wait = computeSlotWait(read2(), intervalMs, current);
      if (wait === 0) {
        write2(current);
        return waited;
      }
      const slice = Math.min(wait, MAX_SLICE_MS);
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
          `Request timed out after ${Math.round(EXPORT_CONFIG.requestTimeoutMs / 1e3)}s.`,
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
    let attempt = 0;
    for (; ; ) {
      attempt++;
      if (signal?.aborted) throw new AbortedError("Export cancelled.", true);
      await waitForSlot(EXPORT_CONFIG.baseDelayMs + Pacing.penaltyMs);
      let response;
      try {
        response = await timedFetch(fetchUrl, signal);
      } catch (error) {
        if (error instanceof AbortedError) throw error;
        if (attempt > EXPORT_CONFIG.maxRetries) {
          throw new Error(
            `Network error fetching page ${pageIndex} after ${attempt - 1} retries: ${error.message}`
          );
        }
        const backoff = computeBackoff(attempt, EXPORT_CONFIG.backoffBaseMs, EXPORT_CONFIG.backoffCapMs);
        Log(`Network error on page ${pageIndex} (attempt ${attempt}). Retrying in ${backoff}ms.`, "warn", "server");
        await interruptibleSleep(backoff, signal);
        continue;
      }
      if (isBlockedStatus(response.status)) {
        Pacing.penalize();
        throw new BlockedError(`Server refused the request (HTTP ${response.status}).`);
      }
      if (THROTTLE_STATUSES.includes(response.status)) {
        Pacing.record(Pacing.lastLatencyMs ?? 0, true);
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
        await interruptibleSleep(backoff, signal);
        continue;
      }
      if (!response.ok) {
        throw new Error(`Server returned status HTTP ${response.status} on page ${pageIndex}`);
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
        Log(`Export queued behind ${position - 1} pending job(s): ${label}`, "info");
        showToast({
          message: `Queued: <b>${escapeHtml(label)}</b> (position ${position})`,
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
  function recordBlock(detail) {
    setValue(BLOCK_TS_KEY, Date.now());
    Log(`Anti-scraping block detected (${detail}). Cooldown started.`, "warn", "server");
  }
  function exportSetCSV(setId, setName) {
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
    let identity = { year: "", baseSet: "", setName: "" };
    const rows = [];
    do {
      if (signal.aborted) throw new AbortedError("Export cancelled.", true);
      if (pageIndex > 1) await jitteredDelay();
      const label = `Page ${pageIndex}${totalPages > 1 ? " of " + totalPages : ""}${Pacing.describe()}`;
      setStatus(`Fetching ${label}...`);
      progress?.update(label);
      const fetchUrl = `/Checklist.cfm/sid/${setId}/?PageIndex=${pageIndex}`;
      Log(`HTTP GET Request -> ${fetchUrl}`, "info", "server");
      const response = await fetchPageWithRetry(fetchUrl, pageIndex, { onStatus: setStatus, signal });
      const html = await response.text();
      const blockMarker = detectBlock(html);
      if (blockMarker) {
        throw new BlockedError(`Challenge page received instead of content (matched '${blockMarker}').`);
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
        Log(`Discovered ${totalPages} total page(s) for set ID ${setId}`, "info");
      }
      rows.push(...parsed.rows);
      Log(`Page ${pageIndex}/${totalPages} parsed successfully. ${parsed.rows.length} rows retrieved.`, "info");
      pageIndex++;
    } while (pageIndex <= totalPages);
    return { identity, rows, totalPages };
  }
  async function runExportSetCSV(setId, setName) {
    const remainingMin = cooldownRemainingMinutes();
    if (remainingMin > 0) {
      Log(`Export refused: anti-scraping cooldown active (${remainingMin} min remaining).`, "warn");
      setStatus("Export blocked (cooldown)");
      showToast({
        message: `Export paused — an anti-scraping block was detected recently. Try again in ~${remainingMin} min, or adjust the cooldown in Settings.`,
        variant: "error"
      });
      return;
    }
    const ttlHours = Config.global.exportCacheTtlHours;
    const cached = read(setId, ttlHours);
    if (cached) {
      const filename = downloadResult(cached, setName);
      Log(`Export served from cache: ${filename} (${cached.rows.length} rows, zero requests).`, "info");
      setStatus("Export Complete (cached)");
      showToast({
        message: `Exported <b>${cached.rows.length}</b> cards from cache — no requests made.`,
        variant: "success"
      });
      return;
    }
    const controller = new AbortController();
    CurrentRun.controller = controller;
    CurrentRun.onStart?.();
    Log(`Starting checklist fetch for set ID ${setId} (${setName})`, "info");
    setStatus(`Fetching ${setName}...`);
    const progress = showProgressToast({
      title: `Exporting ${setName}`,
      onCancel: () => cancelCurrentExport()
    });
    try {
      const result = await fetchAllPages(setId, controller.signal, progress);
      if (result.rows.length === 0) throw new Error("No valid checklist rows identified within tables.");
      let label = result.identity.baseSet;
      if (result.identity.setName) label += ` - ${result.identity.setName}`;
      Log(
        `Export complete for: ${label} (${result.rows.length} cards across ${result.totalPages} page(s), median latency ${Math.round(Pacing.medianLatencyMs())}ms)`,
        "info"
      );
      write(setId, result, ttlHours);
      downloadResult(result, setName);
      setStatus("Export Complete");
      progress.finish(`${result.rows.length} cards exported.`, "success");
    } catch (error) {
      if (error instanceof BlockedError) {
        recordBlock(error.message);
        progress.finish("Stopped — the site returned a challenge.", "error");
        setStatus("Export blocked");
      } else if (error instanceof AbortedError) {
        Log(`Export stopped: ${error.message}`, error.byUser ? "info" : "warn");
        progress.finish(error.byUser ? "Cancelled." : "Timed out.", error.byUser ? "muted" : "error");
        setStatus(error.byUser ? "Export cancelled" : "Export timed out");
      } else {
        Log(`CSV Export Failed: ${error.message}`, "error");
        progress.finish(`Failed: ${error.message}`, "error");
        setStatus("Export Failed");
      }
    } finally {
      CurrentRun.controller = null;
      CurrentRun.onEnd?.();
    }
  }

  // src/ui/icons.js
  var ICONS = {
    bolt: {
      size: 12,
      strokeWidth: 1.5,
      body: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>'
    },
    gem: {
      size: 12,
      strokeWidth: 1.5,
      body: '<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M11 3 8 9l3 12"/><path d="M13 3l3 6-3 12"/><path d="M2 9h20"/>'
    },
    tag: {
      size: 12,
      strokeWidth: 1.5,
      body: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>'
    },
    layers: {
      size: 12,
      strokeWidth: 1.5,
      body: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>'
    },
    star: {
      size: 12,
      strokeWidth: 1.5,
      body: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'
    },
    download: {
      size: 12,
      strokeWidth: 1.5,
      body: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'
    },
    pin: {
      size: 12,
      strokeWidth: 1.5,
      body: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>'
    },
    x: {
      size: 11,
      strokeWidth: 2,
      body: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'
    },
    chevronUp: {
      size: 12,
      strokeWidth: 2,
      body: '<polyline points="18 15 12 9 6 15"/>'
    },
    plus: {
      size: 11,
      strokeWidth: 2,
      body: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'
    },
    gear: {
      size: 12,
      strokeWidth: 1.5,
      body: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>'
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
    if (document.getElementById(SPRITE_ID)) return;
    const holder = document.createElement("div");
    holder.innerHTML = buildSprite();
    document.body.prepend(holder.firstChild);
  }
  function icon(name) {
    const def = ICONS[name];
    if (!def) return "";
    return `<svg class="tk-icon" width="${def.size}" height="${def.size}" aria-hidden="true"><use href="#${symbolId(name)}"/></svg>`;
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
  var SHORTCUT_KEYS = ["INSERTS", "PARALLELS", "FOR_SALE", "MULTI", "WANTLIST"];
  var TOOLBAR_BADGES = ["INSERTS", "PARALLELS", "FOR_SALE", "MULTI", "WANTLIST", "CSV"];
  var SET_LINK_BADGES = ["PIN", "CSV", "INSERTS", "PARALLELS", "FOR_SALE", "MULTI", "WANTLIST"];
  function createBadge(badgeKey, sid = null, onClickOverride = null) {
    const config = BADGES[badgeKey];
    if (!config) return null;
    const iconSvg = icon(config.icon);
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
  function renderBadgeSet(container, sid, {
    include = TOOLBAR_BADGES,
    onExport = null,
    onPin = null
  } = {}) {
    const handlers = { CSV: onExport, PIN: onPin };
    include.forEach((key) => {
      const isAction = key in handlers;
      if (isAction && !handlers[key]) return;
      const badge = createBadge(key, sid, isAction ? handlers[key] : null);
      if (badge) container.appendChild(badge);
    });
    return container;
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

  // src/ui/styles.js
  var TOOLBAR_CSS = `
/* ---- Design tokens ----
   Kept on :root rather than a scoping class because the toolbar, toasts,
   settings modal, and filter bar mount in four different places in the page.
   The --tk- prefix is specific enough that collision with the site's own
   variables is not a real risk. Dark values override by attribute below. */
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

/* Icons are <use> references into the injected sprite. */
.tk-icon { flex-shrink: 0; display: inline-block; vertical-align: middle; }

/* Filter hiding. A class rather than an inline style so the filter never has
   to read or restore a row's own display value. */
.tk-hidden { display: none !important; }

/* Dark palette. Only the values change; every rule below is theme-agnostic. */
:root[data-sctk-theme="dark"] {
    --tk-bg-base: #16181b;
    --tk-bg-elevated: #1f2225;
    --tk-bg-hover: #2a2e33;
    --tk-border: #33383d;
    --tk-border-strong: #464c53;
    --tk-text: #e6e8ea;
    --tk-text-muted: #9aa2ab;
    --tk-accent: #f0a437;
    --tk-teal: #2dd4bf;
    --tk-blue: #60a5fa;
    --tk-violet: #a78bfa;
    --tk-magenta: #f472b6;
    --tk-green: #4ade80;
    --tk-red: #f87171;
    --tk-shadow-elevated: 0 4px 16px rgba(0,0,0,0.55);
}

/* Solid-fill badges need dark text against the brighter dark-mode accents. */
:root[data-sctk-theme="dark"] .tk-badge-link-fs,
:root[data-sctk-theme="dark"] .tk-badge-link-w { color: #16181b; }
:root[data-sctk-theme="dark"] .sctk-btn:hover:not(:disabled),
:root[data-sctk-theme="dark"] #tk-center-context .tk-scroll-btn:hover { color: #ffffff; }

#sctk-toolbar { position: fixed; top: 0; left: 0; width: 100%; z-index: 99999; background: var(--tk-bg-base); color: var(--tk-text); display: flex; align-items: center; min-height: 34px; padding: 2px 8px; font-family: var(--tk-font-ui); font-size: 11px; border-bottom: 1px solid var(--tk-border); box-shadow: 0 2px 8px rgba(0,0,0,0.06); box-sizing: border-box; flex-wrap: nowrap; }

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
.tk-dropdown-content { display: none; position: absolute; left: 0; top: 100%; margin-top: 2px; background-color: var(--tk-bg-elevated); min-width: 320px; box-shadow: var(--tk-shadow-elevated); z-index: 100000; border-radius: var(--tk-radius-md); border: 1px solid var(--tk-border-strong); max-height: 450px; overflow-y: auto; text-align: left; }
/* Click-only. Hover-open cannot be dismissed on a touch device and fires by
   accident on the way to something else on desktop. */
.tk-dropdown.tk-show .tk-dropdown-content { display: block; }

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

/* Overflow menu — the toolbar no longer wraps, so anything that does not fit
   moves in here rather than pushing page content down. */
#tk-overflow { flex-shrink: 0; }
#tk-overflow[hidden] { display: none; }
#tk-overflow .tk-dropdown-content { right: 0; left: auto; min-width: 220px; padding: 4px; }
#tk-overflow .tk-dropdown-content .sctk-btn { width: 100%; justify-content: flex-start; margin: 2px 0; }

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
#tk-filter-count { font-family: var(--tk-font-mono); font-size: 10px; color: var(--tk-text-muted); white-space: nowrap; }
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
.tk-toast-hint { font-family: var(--tk-font-mono); font-size: 9px; color: var(--tk-text-muted); border: 1px solid var(--tk-border-strong); border-radius: 3px; padding: 0 3px; }
.tk-toast-detail { color: var(--tk-text-muted); margin-top: 3px; font-variant-numeric: tabular-nums; }
.tk-toast-cancel { margin-top: 6px; background: transparent; border: 1px solid var(--tk-border-strong); color: var(--tk-text); border-radius: var(--tk-radius-sm); padding: 2px 8px; font-family: var(--tk-font-ui); font-size: 10.5px; font-weight: 600; cursor: pointer; }
.tk-toast-cancel:hover:not(:disabled) { background: var(--tk-red); border-color: var(--tk-red); color: #fff; }
.tk-toast-cancel:disabled { opacity: 0.6; cursor: default; }
.tk-toast-cancel:focus-visible { outline: 2px solid var(--tk-accent); outline-offset: 1px; }
.tk-toast-message ul, .tk-toast-message ol { text-align: left; margin: 3px 0 0 0; padding-left: 16px; }
.tk-toast-message li { text-align: left; margin-bottom: 2px; }

/* Height is measured and written to this variable by a ResizeObserver. The
   old fixed 38px was wrong the moment the toolbar wrapped to a second row, and
   the toolbar covered the top of the page. */
body { padding-top: var(--tk-toolbar-height, 38px) !important; }
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
.tk-contract-list { list-style: none; margin: 4px 0 0 0; padding: 0; font-family: var(--tk-font-mono); font-size: 10px; line-height: 1.5; }
.tk-contract-list li.ok { color: var(--tk-text-muted); }
.tk-contract-list li.bad { color: var(--tk-red); font-weight: 700; }
.tk-diag-list { display: grid; grid-template-columns: max-content 1fr; gap: 4px 12px; margin: 0 0 12px 0; font-size: 11px; }
.tk-diag-list dt { font-family: var(--tk-font-mono); font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--tk-text-muted); }
.tk-diag-list dd { margin: 0; word-break: break-word; }
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
  function appendShortcutBadges(container, sid, label = "Set") {
    renderBadgeSet(container, sid, {
      include: TOOLBAR_BADGES,
      onExport: (e) => {
        e.preventDefault();
        exportSetCSV(sid, label);
      }
    });
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
      installIconSprite();
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
      };
      CurrentRun.onEnd = () => {
        btn.hidden = true;
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
      scrollTopBtn.innerHTML = `${icon("chevronUp")}<span>Top</span>`;
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
  var LATE_RENDER_TIMEOUT_MS = 3e3;
  var CHUNK_SIZE = 25;
  var SET_LINK_SELECTOR = [
    'a[href*="ViewSet" i]',
    'a[href*="CollectionSummary" i]',
    'a[href*="Checklist" i]',
    'a[href*="sid=" i]',
    'a[href*="/sid/" i]'
  ].join(", ");
  var onIdle = typeof requestIdleCallback === "function" ? (fn) => requestIdleCallback(fn, { timeout: 500 }) : (fn) => setTimeout(fn, 16);
  function findSetLinks(root = document) {
    return Array.from(root.querySelectorAll(SET_LINK_SELECTOR)).filter((link) => link.textContent.trim().length > 0 && !link.querySelector("img, i, svg"));
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
    container.style.display = "inline-flex";
    container.style.alignItems = "center";
    const expandable = isExpandableParent(link);
    const include = SET_LINK_BADGES.filter(
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
        showToast({ message: `Pinned: <b>${escapeHtml(setName)}</b>` });
      },
      onExport: (e) => {
        e.preventDefault();
        exportSetCSV(setId, setName);
      }
    });
    return container;
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
    const step = () => {
      const slice = links.slice(cursor, cursor + CHUNK_SIZE);
      cursor += CHUNK_SIZE;
      total += injectSetActions(slice);
      if (cursor < links.length) {
        onIdle(step);
      } else {
        onDone(total);
      }
    };
    step();
  }
  function waitForLateLinks() {
    let settled = false;
    const finish = (links) => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      clearTimeout(timer);
      if (links.length === 0) {
        assertContract("setListEnhancer", [
          { selector: SET_LINK_SELECTOR, label: "set links (pin/export badge anchors)" }
        ]);
        return;
      }
      injectInChunks(links, (n) => {
        Log(`Set List Enhancer: badges injected for ${n} late-rendered link(s).`, "debug");
      });
    };
    const observer = new MutationObserver(() => {
      const links = findSetLinks();
      if (links.length > 0) finish(links);
    });
    const timer = setTimeout(() => finish(findSetLinks()), LATE_RENDER_TIMEOUT_MS);
    observer.observe(document.body, { childList: true, subtree: true });
  }
  function initSetListEnhancer() {
    const setLinks = findSetLinks();
    if (setLinks.length === 0) {
      waitForLateLinks();
      return;
    }
    injectInChunks(setLinks, (n) => {
      Log(`Set List Enhancer: badges injected for ${n} of ${setLinks.length} link(s).`, "debug");
      recordContract("setListEnhancer", `badges on ${n} of ${setLinks.length} link(s)`, n > 0);
    });
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
  function focusFirstQuantityField() {
    const target = (() => {
      const inputs = InputIndex.getValidInputs();
      return inputs.find((el) => el.value === "0") || inputs[0] || null;
    })();
    if (!target) return;
    let cancelled = false;
    const deadline = Date.now() + FOCUS_DEADLINE_MS;
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
      if (Date.now() < deadline) {
        requestAnimationFrame(assert);
      } else {
        stop();
      }
    };
    assert();
  }
  function initAddMultiplesEnhancer() {
    const changed = applySaleTypeDefaults();
    if (changed > 0) Log(`Add Multiples: defaulted ${changed} sale-type select(s).`, "debug");
    recordContract(
      "addMultiplesEnhancer",
      `${changed} sale-type select(s) defaulted`,
      document.querySelectorAll("select").length > 0
    );
    focusFirstQuantityField();
  }

  // src/modules/csvExportEngine.js
  var PRINT_ITEM_SELECTOR = ".yourcol-item";
  function collectRows(root = document) {
    const tableRows = Array.from(root.querySelectorAll("table tr")).map(
      (row) => Array.from(row.querySelectorAll("td, th")).map((c) => c.textContent.trim())
    ).filter((cells) => cells.length > 0);
    if (tableRows.length > 0) return tableRows;
    const items = Array.from(root.querySelectorAll(PRINT_ITEM_SELECTOR)).map((item) => [item.textContent.replace(/\s+/g, " ").trim()]).filter(([text]) => text.length > 0);
    return items.length > 0 ? [["Item"], ...items] : [];
  }
  function generateCSV(type) {
    setStatus(`Exporting ${type}...`);
    const csvRows = collectRows();
    if (csvRows.length === 0) {
      setStatus("Nothing to export");
      showToast({ message: "Nothing to export — no rows found on this page.", variant: "error" });
      Log(`Export aborted: no rows found for ${type}.`, "warn");
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
  }
  function initCsvExportEngine() {
    recordContract("csvExportEngine", `${collectRows().length} exportable row(s)`, collectRows().length > 0);
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
      id: "checklistEnhancer",
      name: "Checklist Enhancer",
      description: "Real-time table filter bar on listing pages.",
      init: initChecklistEnhancer,
      isAsync: false,
      actionLabels: {
        realtimeFilter: "Real-time table filter bar"
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
      trigger.innerHTML = icon("gear");
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
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) SettingsUI.close();
      });
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
        const focusable = Array.from(
          panel.querySelectorAll('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])')
        ).filter((el) => !el.disabled && el.offsetParent !== null);
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
      const routesTab = document.createElement("button");
      routesTab.type = "button";
      routesTab.className = "tk-settings-tab";
      routesTab.textContent = "Modules & Routes";
      const diagTab = document.createElement("button");
      diagTab.type = "button";
      diagTab.className = "tk-settings-tab";
      diagTab.textContent = "Diagnostics";
      tabBar.append(globalTab, routesTab, diagTab);
      const content = document.createElement("div");
      content.id = "tk-settings-tab-content";
      const panes = {
        global: SettingsUI._buildGlobalPane(),
        routes: SettingsUI._buildModulesPane(),
        diagnostics: SettingsUI._buildDiagnosticsPane()
      };
      const tabs = { global: globalTab, routes: routesTab, diagnostics: diagTab };
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
        removeBtn.innerHTML = icon("x");
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
      addBtn.innerHTML = `${icon("plus")}<span>Add pattern</span>`;
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
      const themeField = document.createElement("div");
      themeField.className = "tk-settings-field";
      const themeLabel = document.createElement("label");
      themeLabel.textContent = "Theme";
      const themeSelect = document.createElement("select");
      themeSelect.title = "auto follows your operating system. The site itself has no theme to follow.";
      THEMES.forEach((value) => {
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = value;
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
      pane.appendChild(themeField);
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
      const rows = [
        ["Version", SettingsUI._version()],
        ["URL", window.location.pathname + window.location.search],
        ["Matched routes", routes.length ? routes.join(", ") : "none"],
        ["Active modules", active.length ? `${active.length}: ${active.join(", ")}` : "none on this page"],
        ["Last block detected", lastBlock ? new Date(lastBlock).toLocaleString() : "never"],
        ["Theme", `${Config.global.theme} (resolved: ${document.documentElement.getAttribute("data-sctk-theme")})`]
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
      pane.appendChild(SettingsUI._buildContractPanel());
      pane.appendChild(SettingsUI._buildCachePanel());
      return pane;
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
      label.textContent = "Page contract checks";
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
      label.textContent = "Cached exports";
      const summary = document.createElement("div");
      summary.className = "tk-settings-hint";
      const refresh = () => {
        const { sets, rows } = stats(Config.global.exportCacheTtlHours);
        summary.textContent = sets === 0 ? "Nothing cached. Completed exports are stored here and reused within the lifetime above." : `${sets} set(s), ${rows} row(s) stored. Re-exporting any of them makes no requests.`;
      };
      refresh();
      const purge = createBtn("tk-cache-purge", "Clear cache", () => {
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
      label: "Request timeout",
      key: "exportRequestTimeoutMs",
      min: 5e3,
      max: 12e4,
      step: 5e3,
      unit: "ms",
      hint: "Abandon a single request that never answers. Without this a hung request stalls the whole export queue indefinitely."
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
      label: "Export cache lifetime",
      key: "exportCacheTtlHours",
      min: 0,
      max: 168,
      step: 1,
      unit: " h",
      hint: "Re-exporting a set within this window reuses the stored result and makes no requests at all. 0 disables caching."
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
    return score - haystack.length / 200;
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
        run: () => exportSetCSV(currentSid, document.title || "Set")
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
        run: () => exportSetCSV(pin.id, pin.name)
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
        row.innerHTML = `<span class="tk-palette-label">${escapeHtml(command.label)}</span><span class="tk-palette-hint">${escapeHtml(command.hint)}</span>`;
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
• ${loadedModuleNames.join("\n• ")}`
    );
    showToast({
      message: `<b>SCToolkit Active</b> <span class="tk-toast-hint">Ctrl+K</span><ul>${loadedModuleNames.map((m) => `<li>${escapeHtml(m)}</li>`).join("")}</ul>`,
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
