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
  maxPages: 200
};

export const DEFAULT_CONFIG = {
  schemaVersion: 2,
  modules: {
    inputOptimization: { enabled: true, urlMatch: [], actions: {} },
    cardNameFormatter: {
      enabled: true,
      urlMatch: [
        { pattern: '/checklist\\.cfm', exclude: false },
        { pattern: '/viewcollectionforsaletrade\\.cfm', exclude: false },
        { pattern: '/viewcollectionwantlist\\.cfm', exclude: false },
        { pattern: '/collectionaddmultiples', exclude: false }
      ],
      actions: {}
    },
    checklistEnhancer: {
      enabled: true,
      urlMatch: [
        { pattern: '/checklist\\.cfm', exclude: false },
        { pattern: '/viewcollectionforsaletrade\\.cfm', exclude: false },
        { pattern: '/viewcollectionwantlist\\.cfm', exclude: false },
        { pattern: '/collectionaddmultiples', exclude: false }
      ],
      actions: {
        realtimeFilter: true,
        inlineActionCells: false
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
    exportBlockCooldownMinutes: 5,
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
      Log('Migrating stored config from schema v1 to v2 (additive fields only).', 'info');
      return SettingsStore.mergeWithDefaults(stored);
    }
    Log(
      `Stored config schema v${stored.schemaVersion} has no migration path to v${DEFAULT_CONFIG.schemaVersion}. Resetting to defaults.`,
      'warn'
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
          actions: { ...merged.modules[id].actions, ...(stored.modules[id].actions || {}) }
        };
      } else {
        Log(`Stored config references unknown module '${id}' — dropped.`, 'warn');
      }
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
