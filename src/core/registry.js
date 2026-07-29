/**
 * Module registry and resolution.
 *
 * The registry is the single authority on whether a module runs on a page. A
 * module's `init` may still decide *what* to do based on page content, but it
 * must not re-check the URL — doing so makes the user-editable route rules in
 * settings a lie, because editing them would have no effect.
 */

import { Config, testUrlMatch } from './config.js';
import { Log } from './log.js';
import { initInputOptimization } from '../modules/inputOptimization.js';
import { initChecklistEnhancer } from '../modules/checklistEnhancer.js';
import { initSetListEnhancer } from '../modules/setListEnhancer.js';
import { initAddMultiplesEnhancer } from '../modules/addMultiplesEnhancer.js';
import { initCsvExportEngine } from '../modules/csvExportEngine.js';
import { initPaginationLoader } from '../modules/paginationLoader.js';

/**
 * @typedef {object} ModuleDefinition
 * @property {string} id key into `Config.modules`
 * @property {string} name human-readable, shown in settings and the status tooltip
 * @property {string} description shown in settings
 * @property {() => void|Promise<void>} init
 * @property {boolean} isAsync whether the bootstrap should await `init`
 * @property {Record<string, string>} [actionLabels] sub-feature toggles
 */

/** @type {ModuleDefinition[]} */
export const ModuleRegistry = [
  {
    id: 'inputOptimization',
    name: 'Input Optimization',
    description: 'Enter-to-Tab across visible number/text inputs, for keyboard-only bulk entry.',
    init: initInputOptimization,
    isAsync: false
  },
  {
    id: 'checklistEnhancer',
    name: 'Checklist Enhancer',
    description: 'Real-time table filter bar on listing pages.',
    init: initChecklistEnhancer,
    isAsync: false,
    actionLabels: {
      realtimeFilter: 'Real-time table filter bar'
    }
  },
  {
    id: 'setListEnhancer',
    name: 'Set List Enhancer',
    description: 'Injects pin/CSV/shortcut badges next to set links on set-listing pages.',
    init: initSetListEnhancer,
    isAsync: false
  },
  {
    id: 'addMultiplesEnhancer',
    name: 'Add Multiples Enhancer',
    description: 'Defaults sale-type dropdown and focuses the first zero-qty input for bulk entry.',
    init: initAddMultiplesEnhancer,
    isAsync: false
  },
  {
    id: 'csvExportEngine',
    name: 'CSV Export Engine',
    description: 'Adds a raw-table-dump CSV export button on Collection/Player Collection/Print pages.',
    init: initCsvExportEngine,
    isAsync: false
  },
  {
    id: 'paginationLoader',
    name: 'Pagination Loader',
    description: 'Async gate that defers CSV-export-button enablement until pagination is ready. '
      + 'Route pattern only excludes Add Multiples — the real gate is a DOM check for a pagination '
      + 'element, done inside the module itself, because it is not expressible as a URL pattern.',
    init: initPaginationLoader,
    isAsync: true
  }
];

/**
 * The modules that should run on the given URL: enabled in config, and matching
 * their route rules.
 *
 * @param {string} [url]
 * @returns {ModuleDefinition[]}
 */
export function resolveModules(url = window.location.href) {
  return ModuleRegistry.filter((mod) => {
    const cfg = Config.modules[mod.id];
    if (!cfg || !cfg.enabled) return false;
    try {
      return testUrlMatch(cfg.urlMatch, url);
    } catch (error) {
      Log(`urlMatch resolution threw for module '${mod.id}': ${error.message}`, 'error');
      return false;
    }
  });
}
