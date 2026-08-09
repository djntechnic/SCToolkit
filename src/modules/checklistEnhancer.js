/**
 * Real-time table filter for listing pages.
 *
 * Where this runs is decided entirely by the module's `urlMatch` rules in
 * Settings. v2.42.0 also re-checked `Routes` here, which meant editing those
 * rules had no effect — the registry would admit the page and the module would
 * then refuse it. The route check is gone; the registry is the only gate.
 */

import { Config } from '../core/config.js';
import { Log } from '../core/log.js';
import { assertContract, recordContract } from '../core/contracts.js';
import { debounce } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { Routes } from '../core/routes.js';
import { SELECTOR_REGISTRY } from '../core/selectors.js';

/**
 * Return context-specific placeholder message based on page type.
 *
 * @returns {string}
 */
export function getFilterPlaceholder() {
  if (Routes.isViewAll()) {
    return 'Filter sets by name, year, or category...';
  }
  if (Routes.isChecklist() || Routes.isViewSet()) {
    return 'Filter cards by #, player, team, note, or serial #...';
  }
  if (Routes.isCollection() || Routes.isForSaleTrade() || Routes.isWantlist()) {
    return 'Filter collection by player, set, card #, or status...';
  }
  if (Routes.isPlayerPage() || Routes.isPlayerCollection()) {
    return 'Filter cards by set, year, card #, or attribute...';
  }
  return 'Filter items by name, number, or keyword...';
}

/**
 * Containers that hold a listing table, most specific first.
 *
 * Only checklist and set-index pages have `#main-content-area`. The for-sale,
 * wantlist, add-multiples, and collection views wrap their table in `#content`
 * instead — so requiring the first selector meant the filter silently never
 * appeared on three of the four routes its own config lists. Confirmed against
 * real captures in `test/fixtures/real/`.
 */
export const FILTER_SCOPES = SELECTOR_REGISTRY.checklist.scopes;

/** Rows and list items carrying one of these are data items; anything else is chrome. */
const DATA_ROW_SELECTOR = SELECTOR_REGISTRY.checklist.dataRows;

/** Elements that represent rows or list items in listing containers. */
const ITEM_ELEMENT_SELECTOR = SELECTOR_REGISTRY.checklist.itemElements;

/** Applied to filtered-out rows. Defined in `ui/styles.js`. */
const HIDDEN_CLASS = 'tk-hidden';

/** Selectors for navigation, dropdown pickers, or sidebar chrome that must never receive filter bars or indexed rows. */
const SIDEBAR_CHROME_SELECTOR = SELECTOR_REGISTRY.checklist.chrome;

/**
 * Build the searchable index of data rows and list items, once.
 *
 * @param {HTMLElement} mainContent
 * @returns {Array<{el: HTMLElement, haystack: string}>}
 */
export function buildRowIndex(mainContent) {
  const index = [];
  const elements = mainContent.querySelectorAll(ITEM_ELEMENT_SELECTOR);

  elements.forEach((el) => {
    if (el.closest(SIDEBAR_CHROME_SELECTOR)) return;
    if (el.tagName === 'TR' && el.querySelector('th')) return;
    if (!el.querySelector(DATA_ROW_SELECTOR)) return;
    index.push({ el, haystack: el.textContent.replace(/\s+/g, ' ').toLowerCase() });
  });

  return index;
}

/**
 * Show rows matching `term`, hide the rest.
 *
 * @param {Array<{el: HTMLElement, haystack: string}>} index
 * @param {string} term already lowercased and trimmed
 * @returns {number} rows still visible
 */
export function applyFilter(index, term) {
  let visible = 0;
  const updates = [];
  const rawTerm = (term || '').trim().toLowerCase();
  const conditions = rawTerm ? rawTerm.split(/[,;|\s]+/).filter(Boolean) : [];

  index.forEach(({ el, haystack }) => {
    const match =
      conditions.length === 0 ||
      conditions.some((cond) => haystack.includes(cond));
    updates.push({ el, match });
    if (match) visible++;
  });

  const updateVisibility = () => {
    updates.forEach(({ el, match }) => {
      el.classList.toggle(HIDDEN_CLASS, !match);
    });
  };

  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(updateVisibility);
  } else {
    updateVisibility();
  }

  return visible;
}

/**
 * Find the narrowest container that holds a listing table or list.
 *
 * @param {Document|HTMLElement} [root]
 * @returns {HTMLElement|null}
 */
export function findFilterScope(root = document) {
  for (const selector of FILTER_SCOPES) {
    const el = root.querySelector(selector);
    if (el && (el.querySelector('table') || el.querySelector('ul, ol'))) return el;
  }
  return null;
}

/**
 * Find the target element inside mainContent to position the filter bar.
 *
 * On ViewAll/ViewAllC set listing pages, placing the filter before `div.more`
 * positions it inside the header card box below the year title and above category links.
 * On other listing routes, it positions before the first content table or list outside nav or sidebar chrome.
 *
 * @param {HTMLElement} mainContent
 * @returns {HTMLElement|null}
 */
export function findFilterTarget(mainContent) {
  const moreDiv = mainContent.querySelector('div.more');
  if (moreDiv && !moreDiv.closest(SIDEBAR_CHROME_SELECTOR)) return moreDiv;

  const targets = mainContent.querySelectorAll('table, ul, ol');
  for (const el of targets) {
    if (el.closest(SIDEBAR_CHROME_SELECTOR)) continue;
    return el;
  }

  return null;
}

/**
 * Insert the filter box above the first content table or list and wire it up.
 *
 * @param {HTMLElement} mainContent
 */
function installFilter(mainContent) {
  const targetElement = findFilterTarget(mainContent);
  if (!targetElement) return;

  const index = buildRowIndex(mainContent);
  Log(`Checklist filter indexed ${index.length} data item(s).`, 'info');
  recordContract('checklistEnhancer', `indexed ${index.length} data item(s)`, index.length > 0);

  const placeholderText = getFilterPlaceholder();

  const filterWrap = document.createElement('div');
  filterWrap.id = 'tk-checklist-filter-wrap';
  filterWrap.innerHTML = `
    <strong>Filter Items:</strong>
    <div id="tk-checklist-filter-container">
      <input type="text" id="tk-checklist-filter" placeholder="${placeholderText}"
             title="Type to filter active listing items in real time" aria-label="Filter items">
      <button type="button" id="tk-checklist-filter-clear" title="Clear filter" aria-label="Clear filter" style="display: none;">
        ${icon('x')}
      </button>
    </div>
    <span id="tk-filter-count" aria-live="polite"></span>
  `;
  targetElement.before(filterWrap);

  const countEl = filterWrap.querySelector('#tk-filter-count');
  const input = filterWrap.querySelector('#tk-checklist-filter');
  const clearBtn = filterWrap.querySelector('#tk-checklist-filter-clear');

  const updateClearVisibility = () => {
    if (clearBtn) {
      clearBtn.style.display = input.value.trim() !== '' ? 'inline-flex' : 'none';
    }
  };

  const run = debounce((term) => {
    const visible = applyFilter(index, term);
    countEl.textContent = term === '' ? '' : `${visible} of ${index.length}`;
  }, Config.global.checklistFilterDebounceMs);

  const performFilter = () => {
    const val = input.value.toLowerCase().trim();
    updateClearVisibility();
    run(val);
  };

  input.addEventListener('input', performFilter);

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && input.value !== '') {
      e.stopPropagation();
      input.value = '';
      performFilter();
    }
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      input.value = '';
      input.focus();
      performFilter();
    });
  }
}

export function initChecklistEnhancer() {
  if (!Config.modules.checklistEnhancer.actions.realtimeFilter) return;
  if (document.getElementById('tk-checklist-filter-wrap')) return;

  const scope = findFilterScope();
  if (!scope) {
    assertContract('checklistEnhancer', [
      { selector: FILTER_SCOPES.join(', '), label: 'a listing container holding a table or list' }
    ]);
    return;
  }

  installFilter(scope);
}
