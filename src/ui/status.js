/**
 * The toolbar's right-hand status readout.
 *
 * Split out from the toolbar itself so that long-running work — the export
 * runner in particular — can report progress without importing the toolbar and
 * creating a cycle back through the badges that started it.
 */

import { Utils } from '../core/utils.js';

/**
 * @param {string} text
 * @param {string} [tooltipText]
 * @param {string[]} [modulesList]
 */
export function setStatus(text, tooltipText = '', modulesList = []) {
  const status = document.getElementById('tk-status');
  if (!status) return;

  status.textContent = text;
  if (tooltipText) status.title = tooltipText;

  const titleEl = document.getElementById('tk-status-popover-title');
  const listEl = document.getElementById('tk-status-popover-list');

  if (titleEl && listEl) {
    const list = Array.isArray(modulesList) && modulesList.length > 0
      ? modulesList
      : [];

    if (list.length > 0) {
      titleEl.textContent = `Active Modules (${list.length})`;
      listEl.innerHTML = list.map((m) => `<li>${Utils.escape.html(m)}</li>`).join('');
    } else {
      titleEl.textContent = 'Status Details';
      listEl.innerHTML = `<li>${Utils.escape.html(text)}</li>`;
    }
  }
}

/** @param {string} id */
export function enableAction(id) {
  const btn = document.getElementById(id);
  if (btn) btn.disabled = false;
}
