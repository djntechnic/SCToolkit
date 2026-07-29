/**
 * Real-time table filter for listing pages.
 *
 * Where this runs is decided entirely by the module's `urlMatch` rules in
 * Settings. v2.42.0 also re-checked `Routes` here, which meant editing those
 * rules had no effect — the registry would admit the page and the module would
 * then refuse it. The route check is gone; the registry is the only gate.
 */

import { Config } from '../core/config.js';
import { assertContract, debounce } from '../ui/dom.js';

/**
 * Insert the filter box above the first content table and wire it up.
 *
 * Only rows that look like data rows participate: a row with no card link, no
 * input, and no select is a header or spacer, and hiding those would leave the
 * table looking broken while filtering.
 *
 * @param {HTMLElement} mainContent
 */
function installFilter(mainContent) {
  const targetTable = mainContent.querySelector('table');
  if (!targetTable) return;

  const filterWrap = document.createElement('div');
  filterWrap.id = 'tk-checklist-filter-wrap';
  filterWrap.innerHTML = `
    <strong>Filter Items:</strong>
    <input type="text" id="tk-checklist-filter" placeholder="Filter by Player, Card #, Tag, Team..."
           title="Type to filter active table rows in real time" aria-label="Filter table rows">
  `;
  targetTable.before(filterWrap);

  const input = filterWrap.querySelector('#tk-checklist-filter');
  const applyFilter = debounce((term) => {
    mainContent.querySelectorAll('table tr').forEach((row) => {
      if (!row.querySelector('a[href*="ViewCard.cfm"], input, select')) return;
      row.style.display = row.innerText.toLowerCase().includes(term) ? '' : 'none';
    });
  }, Config.global.checklistFilterDebounceMs);

  input.addEventListener('input', (e) => applyFilter(e.target.value.toLowerCase().trim()));
}

export function initChecklistEnhancer() {
  if (!Config.modules.checklistEnhancer.actions.realtimeFilter) return;
  if (document.getElementById('tk-checklist-filter-wrap')) return;

  const mainContent = document.getElementById('main-content-area');
  if (!mainContent) {
    assertContract('checklistEnhancer', [
      { selector: '#main-content-area', label: '#main-content-area (filter mount point)' }
    ]);
    return;
  }

  installFilter(mainContent);
}
