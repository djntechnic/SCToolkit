/**
 * Raw-table CSV export for Collection, Player Collection, and Print pages.
 *
 * This is a straight dump of whatever table is on screen — no parsing, no
 * network requests. The structured, multi-page checklist export lives in
 * `net/setExport.js`.
 */

import { recordContract } from '../core/contracts.js';
import { Log } from '../core/log.js';
import { Routes } from '../core/routes.js';
import { CSV } from '../data/csv.js';
import { underscoreSegment } from '../data/filename.js';
import { setStatus } from '../ui/status.js';
import { showToast } from '../ui/toast.js';
import { Toolbar } from '../ui/toolbar.js';

/**
 * Items on the print view, which is a div grid rather than a table.
 *
 * The print page renders one `.yourcol-item` per card with the whole
 * description in a single span. A table-only dump produced a CSV containing
 * nothing at all here — a download that looked like it worked and was empty.
 * Confirmed against `test/fixtures/real/print-collection.html`.
 */
export const PRINT_ITEM_SELECTOR = '.yourcol-item';

/**
 * Collect the page's rows, whichever shape it uses.
 *
 * @param {Document|HTMLElement} [root]
 * @returns {Array<Array<string>>}
 */
export function collectRows(root = document) {
  const tableRows = Array.from(root.querySelectorAll('table tr')).map((row) =>
    Array.from(row.querySelectorAll('td, th')).map((c) => c.textContent.trim())
  ).filter((cells) => cells.length > 0);

  if (tableRows.length > 0) return tableRows;

  const items = Array.from(root.querySelectorAll(PRINT_ITEM_SELECTOR))
    .map((item) => [item.textContent.replace(/\s+/g, ' ').trim()])
    .filter(([text]) => text.length > 0);

  return items.length > 0 ? [['Item'], ...items] : [];
}

/**
 * @param {string} type label used in the status text and default filename
 */
function generateCSV(type) {
  setStatus(`Exporting ${type}...`);

  const csvRows = collectRows();
  if (csvRows.length === 0) {
    setStatus('Nothing to export');
    showToast({ message: 'Nothing to export — no rows found on this page.', variant: 'error' });
    Log(`Export aborted: no rows found for ${type}.`, 'warn');
    return;
  }

  let filename = `SCToolkit_${type}_Export_${new Date().toISOString().slice(0, 10)}.csv`;

  if (Routes.isPlayerCollection()) {
    const playerHeader = document.querySelector('#main-content-area h1') || document.querySelector('h1');
    const rawPlayerName = (playerHeader ? playerHeader.innerText.trim() : 'Player')
      .replace(/\s*Collection$/i, '')
      .trim();

    const href = window.location.href.toLowerCase();
    let subType = 'Collection';
    if (href.includes('wantlist')) subType = 'Wantlist';
    else if (href.includes('forsale')) subType = 'ForSale';

    filename = `${underscoreSegment(rawPlayerName)}_${subType}.csv`;
  }

  CSV.download(CSV.toCSV(csvRows), filename);
  setStatus('Export Complete');
  showToast({ message: `Exported ${type} CSV successfully.` });
}

export function initCsvExportEngine() {
  // The export button is added before the user clicks it, so whether the page
  // actually has anything to export is worth knowing up front.
  recordContract('csvExportEngine', `${collectRows().length} exportable row(s)`, collectRows().length > 0);

  // Disabled at creation; the bootstrap enables them once the pagination gate
  // resolves, so a partially loaded table cannot be exported.
  if (Routes.isCollection()) {
    Toolbar.addAction('btn-csv-coll', 'Export Collection', () => generateCSV('Collection'), true);
  } else if (Routes.isPlayerCollection()) {
    Toolbar.addAction('btn-csv-player', 'Export Player Collection', () => generateCSV('Player_Collection'), true);
  } else if (Routes.isPrintPDF()) {
    Toolbar.addAction('btn-csv-pdf', 'Export Print View', () => generateCSV('Print_View'), true);
  }
}

/** Button ids the bootstrap enables once async module init settles. */
export const EXPORT_BUTTON_IDS = ['btn-csv-coll', 'btn-csv-player', 'btn-csv-pdf'];
