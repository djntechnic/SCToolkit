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

/**
 * Containers that hold a listing table, most specific first.
 *
 * Only checklist and set-index pages have `#main-content-area`. The for-sale,
 * wantlist, add-multiples, and collection views wrap their table in `#content`
 * instead — so requiring the first selector meant the filter silently never
 * appeared on three of the four routes its own config lists. Confirmed against
 * real captures in `test/fixtures/real/`.
 */
export const FILTER_SCOPES = ['#main-content-area', '#content'];

/** Rows and list items carrying one of these are data items; anything else is chrome. */
const DATA_ROW_SELECTOR = 'a[href*="ViewCard.cfm"], a[href*="Checklist.cfm"], a[href*="ViewSet.cfm"], a[href*="/sid/"], a[href*="ViewAll.cfm"], a[href*="Person.cfm"], a[href*="Team.cfm"], input, select';

/** Elements that represent rows or list items in listing containers. */
const ITEM_ELEMENT_SELECTOR = 'table tr, ul > li, ol > li';

/** Applied to filtered-out rows. Defined in `ui/styles.js`. */
const HIDDEN_CLASS = 'tk-hidden';

/** Selectors for navigation, dropdown pickers, or sidebar chrome that must never receive filter bars or indexed rows. */
const SIDEBAR_CHROME_SELECTOR = '.col-md-3, .col-md-4, nav, .breadcrumb, .navbar, #topnav, #sctk-toolbar, .menu-linksV, .list-unstyled, .set-wrapper, .set-dropdown, #setDropdown, #setList, .offcanvas';

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
  index.forEach(({ el, haystack }) => {
    const match = term === '' || haystack.includes(term);
    el.classList.toggle(HIDDEN_CLASS, !match);
    if (match) visible++;
  });
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

  const filterWrap = document.createElement('div');
  filterWrap.id = 'tk-checklist-filter-wrap';
  filterWrap.innerHTML = `
    <strong>Filter Items:</strong>
    <input type="text" id="tk-checklist-filter" placeholder="Filter by Player, Card #, Set Name, Tag, Team..."
           title="Type to filter active listing items in real time" aria-label="Filter items">
    <span id="tk-filter-count" aria-live="polite"></span>
  `;
  targetElement.before(filterWrap);

  const countEl = filterWrap.querySelector('#tk-filter-count');
  const input = filterWrap.querySelector('#tk-checklist-filter');

  const run = debounce((term) => {
    const visible = applyFilter(index, term);
    countEl.textContent = term === '' ? '' : `${visible} of ${index.length}`;
  }, Config.global.checklistFilterDebounceMs);

  input.addEventListener('input', (e) => run(e.target.value.toLowerCase().trim()));
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
