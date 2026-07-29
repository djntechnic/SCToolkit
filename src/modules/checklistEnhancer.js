/**
 * Real-time table filter for checklist-family pages, plus a disabled-by-default
 * inline-action-cell experiment.
 */

import { Config } from '../core/config.js';
import { Log } from '../core/log.js';
import { Routes } from '../core/routes.js';
import { assertContract, debounce } from '../ui/dom.js';

/** Selectors the inline-action experiment expects. None exist on the site. */
const INLINE_ACTION_CONTRACT = [
  { selector: '.action-wantlist-selector', label: '.action-wantlist-selector (wantlist action to relocate)' },
  { selector: '.top-bar-selector', label: '.top-bar-selector (relocation target)' },
  { selector: 'tr.checklist-row', label: 'tr.checklist-row (inline action cell rows)' }
];

const INLINE_ACTIONS = ['+1 FS', '+1 W', 'FS', 'FT', 'W', 'I', 'P'];

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
  const actionCfg = Config.modules.checklistEnhancer.actions;
  const mainContent = document.getElementById('main-content-area');

  const onFilterableRoute = Routes.isChecklist() || Routes.isForSaleTrade()
    || Routes.isWantlist() || Routes.isAddMultiples();

  if (actionCfg.realtimeFilter && mainContent && onFilterableRoute
      && !document.getElementById('tk-checklist-filter-wrap')) {
    installFilter(mainContent);
  }

  if (!actionCfg.inlineActionCells) return;

  assertContract('checklistEnhancer', INLINE_ACTION_CONTRACT);

  const wantlistAction = document.querySelector('.action-wantlist-selector');
  const topBar = document.querySelector('.top-bar-selector');
  if (wantlistAction && topBar) topBar.prepend(wantlistAction);

  document.querySelectorAll('tr.checklist-row').forEach((row, index) => {
    const actionCell = row.querySelector('.action-cell-selector') || row.insertCell();
    INLINE_ACTIONS.forEach((action) => {
      const span = document.createElement('span');
      span.className = 'tk-inline-action';
      span.textContent = `[${action}]`;
      span.title = `Perform ${action} action`;
      span.addEventListener('click', () => Log(`Triggered [${action}] on row index ${index}`));
      actionCell.appendChild(span);
    });
  });
}
