/**
 * Configuration schema, persistence, migration, and route-pattern matching.
 *
 * `Config` is a live singleton: the settings UI mutates it in place and the
 * running page sees the change immediately, while `SettingsStore.save()`
 * persists it. It is seeded with defaults at import time and re-seeded from
 * storage by `initConfig()`, so importing this module has no side effects
 * beyond object construction — which is what lets the tests load it.
 */

import { Log, RuntimeSettings } from './log.js';
import { getValue, setValue } from './storage.js';

/**
 * Runtime export thresholds. Kept as a separate flat object because the fetch
 * loop reads it on every iteration; `syncExportConfig()` is the only writer.
 */
export const EXPORT_CONFIG = {
  baseDelayMs: 500,
  jitterMaxMs: 700,
  maxRetries: 3,
  backoffBaseMs: 1000,
  backoffCapMs: 15000,
  maxPages: 200,
  requestTimeoutMs: 30000
};

export const DEFAULT_CONFIG = {
  schemaVersion: 3,
  modules: {
    inputOptimization: { enabled: true, urlMatch: [], actions: {} },
    checklistEnhancer: {
      enabled: true,
      // These patterns are the only gate on where the filter appears. The
      // module does not re-check the route; editing this list in Settings is
      // what moves the feature.
      urlMatch: [
        { pattern: '/checklist\\.cfm', exclude: false },
        { pattern: '/viewcollectionforsaletrade\\.cfm', exclude: false },
        { pattern: '/viewcollectionwantlist\\.cfm', exclude: false },
        { pattern: '/collectionaddmultiples', exclude: false }
      ],
      actions: {
        realtimeFilter: true
      }
    },
    setListEnhancer: {
      enabled: true,
      urlMatch: [
        { pattern: '/viewall\\.cfm', exclude: false },
        { pattern: '/inserts\\.cfm', exclude: false }
      ],
      actions: {}
    },
    addMultiplesEnhancer: {
      enabled: true,
      urlMatch: [{ pattern: '/collectionaddmultiples', exclude: false }],
      actions: {}
    },
    csvExportEngine: {
      enabled: true,
      urlMatch: [
        { pattern: '/collection', exclude: false },
        { pattern: '(?=.*/person)(?=.*collection)', exclude: false },
        { pattern: '/print\\.cfm', exclude: false },
        { pattern: 'addmultiples', exclude: true }
      ],
      actions: {}
    },
    paginationLoader: {
      enabled: true,
      urlMatch: [{ pattern: 'addmultiples', exclude: true }],
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
    toastDurationMs: 4000,
    checklistFilterDebounceMs: 150,
    paginationLoaderDelayMs: 1000,
    settingsSaveDebounceMs: 400,
    logLevel: 'info'
  }
};

export const SettingsStore = {
  STORAGE_KEY: 'tk_config_v1',

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
      Log(`Migrating stored config from schema v${version} to v${current}.`, 'info');
      return SettingsStore.mergeWithDefaults(stored);
    }

    Log(
      `Stored config schema v${version} has no migration path to v${current}. Resetting to defaults.`,
      'warn'
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
        Log(`Stored config references unknown module '${id}' — dropped.`, 'warn');
        return;
      }

      const storedActions = stored.modules[id].actions || {};
      const actions = { ...defaults.actions };
      Object.keys(actions).forEach((key) => {
        if (key in storedActions) actions[key] = storedActions[key];
      });

      merged.modules[id] = { ...defaults, ...stored.modules[id], actions };
    });

    merged.global = { ...merged.global, ...(stored.global || {}) };
    return merged;
  },

  save: (config) => {
    setValue(SettingsStore.STORAGE_KEY, config);
  }
};

/** Live configuration singleton. Mutated in place; never reassigned. */
export const Config = SettingsStore.cloneDefaults();

/**
 * Copy the export thresholds out of `Config.global` into `EXPORT_CONFIG`.
 *
 * v2.42.0 duplicated this `Object.assign` verbatim in two places (startup and
 * the settings slider handler); they are the same call now, so the two cannot
 * drift.
 */
export function syncExportConfig() {
  EXPORT_CONFIG.baseDelayMs = Config.global.exportBaseDelayMs;
  EXPORT_CONFIG.jitterMaxMs = Config.global.exportJitterMaxMs;
  EXPORT_CONFIG.maxRetries = Config.global.exportMaxRetries;
  EXPORT_CONFIG.backoffBaseMs = Config.global.exportBackoffBaseMs;
  EXPORT_CONFIG.backoffCapMs = Config.global.exportBackoffCapMs;
  EXPORT_CONFIG.maxPages = Config.global.exportMaxPages;
  EXPORT_CONFIG.requestTimeoutMs = Config.global.exportRequestTimeoutMs;
}

/**
 * Load persisted settings over the defaults and apply the derived runtime
 * state. Called once, from the bootstrap.
 */
export function initConfig() {
  const loaded = SettingsStore.load();
  Config.schemaVersion = loaded.schemaVersion;
  Config.modules = loaded.modules;
  Config.global = loaded.global;
  RuntimeSettings.logLevel = Config.global.logLevel || 'info';
  syncExportConfig();
}

/**
 * Decide whether a URL is in scope for a set of route rules.
 *
 * Semantics: with no rules at all, everything matches. Otherwise a URL must
 * match at least one include rule (or there must be none) and must match no
 * exclude rule. An unparseable pattern never matches — it cannot accidentally
 * widen scope, and it cannot silently exclude everything either.
 *
 * @param {Array<{pattern: string, exclude?: boolean}>} rules
 * @param {string} url
 * @returns {boolean}
 */
export function testUrlMatch(rules, url) {
  if (!rules || rules.length === 0) return true;

  const safeTest = (pattern) => {
    try {
      return new RegExp(pattern, 'i').test(url);
    } catch (error) {
      Log(`Invalid urlMatch pattern '${pattern}': ${error.message}`, 'warn');
      return false;
    }
  };

  const includeRules = rules.filter((r) => !r.exclude);
  const excludeRules = rules.filter((r) => r.exclude);
  const included = includeRules.length === 0 ? true : includeRules.some((r) => safeTest(r.pattern));
  const excluded = excludeRules.some((r) => safeTest(r.pattern));
  return included && !excluded;
}
