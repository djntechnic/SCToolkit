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
import { assertContract, debounce } from '../ui/dom.js';

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

/** Rows carrying one of these are data rows; anything else is chrome. */
const DATA_ROW_SELECTOR = 'a[href*="ViewCard.cfm"], input, select';

/** Applied to filtered-out rows. Defined in `ui/styles.js`. */
const HIDDEN_CLASS = 'tk-hidden';

/**
 * Build the searchable index of data rows, once.
 *
 * This is the whole performance story for the filter. v2.42.0 re-ran
 * `querySelectorAll('table tr')`, then a per-row `querySelector`, then read
 * `row.innerText` — a layout-forcing property — on *every* debounce tick. On a
 * thousand-row checklist that is a thousand forced reflows per keystroke.
 *
 * Reading `textContent` instead of `innerText` is safe here because the rows
 * are visible when the index is built; nothing about the search text depends
 * on rendering.
 *
 * @param {HTMLElement} mainContent
 * @returns {Array<{el: HTMLElement, haystack: string}>}
 */
export function buildRowIndex(mainContent) {
  const index = [];
  mainContent.querySelectorAll('table tr').forEach((el) => {
    if (!el.querySelector(DATA_ROW_SELECTOR)) return;
    index.push({ el, haystack: el.textContent.replace(/\s+/g, ' ').toLowerCase() });
  });
  return index;
}

/**
 * Show rows matching `term`, hide the rest.
 *
 * Toggling one class writes nothing when a row's state is unchanged, so a
 * keystroke that narrows the results only touches the rows that just left the
 * result set. No layout is read at any point.
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
 * Find the narrowest container that holds a listing table.
 *
 * @param {Document|HTMLElement} [root]
 * @returns {HTMLElement|null}
 */
export function findFilterScope(root = document) {
  for (const selector of FILTER_SCOPES) {
    const el = root.querySelector(selector);
    if (el && el.querySelector('table')) return el;
  }
  return null;
}

/**
 * Insert the filter box above the first content table and wire it up.
 *
 * @param {HTMLElement} mainContent
 */
function installFilter(mainContent) {
  const targetTable = mainContent.querySelector('table');
  if (!targetTable) return;

  const index = buildRowIndex(mainContent);
  Log(`Checklist filter indexed ${index.length} data row(s).`, 'debug');

  const filterWrap = document.createElement('div');
  filterWrap.id = 'tk-checklist-filter-wrap';
  filterWrap.innerHTML = `
    <strong>Filter Items:</strong>
    <input type="text" id="tk-checklist-filter" placeholder="Filter by Player, Card #, Tag, Team..."
           title="Type to filter active table rows in real time" aria-label="Filter table rows">
    <span id="tk-filter-count" aria-live="polite"></span>
  `;
  targetTable.before(filterWrap);

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
      { selector: FILTER_SCOPES.join(', '), label: 'a listing container holding a table' }
    ]);
    return;
  }

  installFilter(scope);
}
