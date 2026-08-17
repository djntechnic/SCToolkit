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
import { initCardNameFormatter } from '../modules/cardNameFormatter.js';
import { initCollectionQuantityCounter } from '../modules/collectionQuantityCounter.js';
import { initSetHierarchyExport } from '../modules/setHierarchyExport.js';
import { initCollectionDefaulter } from '../modules/collectionDefaulter.js';
import { initSetDropdownSearchEnhancer } from '../modules/setDropdownSearchEnhancer.js';
import { initQuickAddGridEnhancer } from '../modules/quickAddGridEnhancer.js';

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
      realtimeFilter: 'Real-Time Table Filter Bar'
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
    id: 'setDropdownSearchEnhancer',
    name: 'Set Dropdown Search Enhancer',
    description: 'Enhances the set selection dropdown search (#setSearch) on collection pages with substring and OR condition matching.',
    init: initSetDropdownSearchEnhancer,
    isAsync: false,
    actionLabels: {
      substringSearch: 'Substring & OR Condition Matching'
    }
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
  },
  {
    id: 'cardNameFormatter',
    name: 'Player Quick Links',
    description: 'Dynamically extracts card metadata and adds quick copy/search links (Baseball Reference, Google) via floating popover, inline buttons, or direct copy.',
    init: initCardNameFormatter,
    isAsync: false
  },
  {
    id: 'collectionQuantityCounter',
    name: 'Collection Quantity Counter',
    description: 'Counts distinct cards with Qty >= 1, total cards, and total item quantity on For Sale/Trade and Wantlist pages.',
    init: initCollectionQuantityCounter,
    isAsync: false
  },
  {
    id: 'setHierarchyExport',
    name: 'Set Hierarchy Export',
    description: 'Extract set hierarchies from ViewAll pages and output a CSV.',
    init: initSetHierarchyExport,
    isAsync: false
  },
  {
    id: 'collectionDefaulter',
    name: 'Collection Defaulter',
    description: 'Automatically selects a preferred Collection on the ViewCollection (Add / Update) page.',
    init: initCollectionDefaulter,
    isAsync: false
  },
  {
    id: 'quickAddGridEnhancer',
    name: 'Quick Add Grid Enhancer',
    description: 'Injects styled inline quantity inputs and quick-add buttons across Collection, Wantlist, and For Sale/Trade views.',
    init: initQuickAddGridEnhancer,
    isAsync: false
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
