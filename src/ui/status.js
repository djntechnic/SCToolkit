/**
 * The toolbar's right-hand status readout.
 *
 * Split out from the toolbar itself so that long-running work — the export
 * runner in particular — can report progress without importing the toolbar and
 * creating a cycle back through the badges that started it.
 */

/**
 * @param {string} text
 * @param {string} [tooltipText]
 */
export function setStatus(text, tooltipText = '') {
  const status = document.getElementById('tk-status');
  if (!status) return;
  status.textContent = text;
  if (tooltipText) status.title = tooltipText;
}

/** @param {string} id */
export function enableAction(id) {
  const btn = document.getElementById(id);
  if (btn) btn.disabled = false;
}
