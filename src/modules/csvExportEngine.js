/**
 * Raw-table CSV export for Collection, Player Collection, and Print pages.
 *
 * This is a straight dump of whatever table is on screen — no parsing, no
 * network requests. The structured, multi-page checklist export lives in
 * `net/setExport.js`.
 */

import { Routes } from '../core/routes.js';
import { CSV } from '../data/csv.js';
import { underscoreSegment } from '../data/filename.js';
import { setStatus } from '../ui/status.js';
import { showToast } from '../ui/toast.js';
import { Toolbar } from '../ui/toolbar.js';

/**
 * @param {string} type label used in the status text and default filename
 */
function generateCSV(type) {
  setStatus(`Exporting ${type}...`);

  const csvRows = Array.from(document.querySelectorAll('table tr')).map((row) =>
    Array.from(row.querySelectorAll('td, th')).map((c) => c.innerText.trim())
  );

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
