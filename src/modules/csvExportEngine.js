/**
 * Raw-table CSV export for Collection, Player Collection, and Print pages.
 *
 * This is a straight dump of whatever table is on screen — no parsing, no
 * network requests. The structured, multi-page checklist export lives in
 * `net/setExport.js`.
 */

import { parseCollectionBrowseDocument } from '../data/collectionBrowseParser.js';
import { parsePrintCollectionDocument } from '../data/printCollectionParser.js';
import { recordContract } from '../core/contracts.js';
import { Log } from '../core/log.js';
import { Routes } from '../core/routes.js';
import { CSV } from '../data/csv.js';
import { underscoreSegment } from '../data/filename.js';
import { assessPrintCollectionPageCount, exportPrintCollectionCSV } from '../net/printCollectionExport.js';
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
 * @param {Document|HTMLElement} [root=document]
 * @returns {Array<Array<string>>}
 */
export function collectRows(root = document) {
  let href = '';
  if (root.defaultView && root.defaultView.location) {
    href = root.defaultView.location.href || '';
  } else if (typeof window !== 'undefined' && window.location) {
    href = window.location.href || '';
  }
  const docTitle = root.title || '';
  const titleData = docTitle.split('|')[0].trim();
  const isCollBrowse =
    href.toLowerCase().includes('collectionbrowse.cfm') ||
    href.toLowerCase().includes('collectionbrowsep.cfm') ||
    /^Collection\s+-\s+/i.test(titleData);

  if (isCollBrowse) {
    const parsed = parseCollectionBrowseDocument(root);
    return parsed.rows;
  }

  const collectionRows = Array.from(root.querySelectorAll('tr.collection_row'));

  if (collectionRows.length > 0) {
    const rows = [['Qty', 'Status', 'Card Description', 'Notes']];

    collectionRows.forEach((tr) => {
      let qty = '1';
      const badge = tr.querySelector('.badge, span.badge');
      if (badge) {
        const text = badge.textContent.trim();
        if (text) qty = text;
      }

      let status = '';
      const statusIcon = tr.querySelector('i[title], img[title]');
      if (statusIcon) {
        status = statusIcon.getAttribute('title') || '';
      }

      let cardText = '';
      const cardLink = tr.querySelector('a[href*="ViewCard.cfm"], a[href*="CollectionEdit.cfm"]');
      if (cardLink) {
        cardText = cardLink.textContent.trim();
      }

      const cells = Array.from(tr.children);
      const notes = [];
      cells.forEach((td, idx) => {
        if (td.querySelector('.dropdown-menu, .btn-group, button')) return;
        if (idx === 0) return;
        const text = td.textContent.replace(/\s+/g, ' ').trim();
        if (text && text !== cardText && !text.includes(cardText)) {
          notes.push(text);
        }
      });

      rows.push([qty, status, cardText, notes.join(' ')]);
    });

    return rows;
  }

  const rawTables = Array.from(
    root.querySelectorAll('#main-content-area table tr, #content table tr, table tr')
  ).filter((tr) => {
    if (
      tr.closest('#sctk-toolbar') ||
      tr.closest('#topnav') ||
      tr.closest('#cse-search-box') ||
      tr.closest('.col-md-3') ||
      tr.closest('.col-md-4') ||
      tr.closest('#offcanvas') ||
      tr.closest('.sidebar') ||
      tr.closest('.dropdown-menu')
    ) {
      return false;
    }
    return tr.querySelector('a[href*="ViewCard.cfm"], a[href*="CollectionEdit.cfm"], a[href*="Checklist.cfm"]') !== null;
  });

  if (rawTables.length > 0) {
    const tableRows = rawTables.map((tr) => {
      const cloned = tr.cloneNode(true);
      cloned.querySelectorAll('.dropdown-menu, .btn-group, button, select, form, script, style').forEach((el) => el.remove());
      const cells = Array.from(cloned.querySelectorAll('td, th'))
        .map((c) => c.textContent.replace(/\s+/g, ' ').trim())
        .filter((text) => text.length > 0);
      return cells;
    }).filter((cells) => cells.length > 0);

    if (tableRows.length > 0) return tableRows;
  }

  if (root.querySelector(PRINT_ITEM_SELECTOR)) {
    const parsed = parsePrintCollectionDocument(root);
    return parsed.rows;
  }

  return [];
}

/**
 * @param {string} type label used in the status text and default filename
 */
function generateCSV(type) {
  setStatus(`Exporting ${type}...`);
  Log(`[CLIENT] Exporting ${type} CSV...`, 'info', 'client');

  if (Routes.isCollectionBrowse() || Routes.isCollectionBrowseP() || Routes.isCollectionBrowseT()) {
    const parsed = parseCollectionBrowseDocument();
    if (parsed.rows.length <= 1) {
      setStatus('Nothing to export');
      showToast({ message: 'Nothing to export — no rows found on this page.', variant: 'error' });
      Log(`[CLIENT] Export aborted: no rows found for ${type}.`, 'warn', 'client');
      return;
    }

    CSV.download(CSV.toCSV(parsed.rows), parsed.filename);
    setStatus('Export Complete');
    showToast({ message: `Exported ${type} CSV successfully.` });
    Log(`[CLIENT] Exported ${type} CSV successfully: ${parsed.filename} (${parsed.rows.length - 1} data rows).`, 'info', 'client');
    return;
  }

  const csvRows = collectRows();
  if (csvRows.length === 0) {
    setStatus('Nothing to export');
    showToast({ message: 'Nothing to export — no rows found on this page.', variant: 'error' });
    Log(`[CLIENT] Export aborted: no rows found for ${type}.`, 'warn', 'client');
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
  Log(`[CLIENT] Exported ${type} CSV successfully: ${filename} (${csvRows.length - 1} data rows).`, 'info', 'client');
}

export function initCsvExportEngine() {
  // The export button is added before the user clicks it, so whether the page
  // actually has anything to export is worth knowing up front.
  recordContract('csvExportEngine', `${collectRows().length} exportable row(s)`, collectRows().length > 0);

  // Disabled at creation; the bootstrap enables them once the pagination gate
  // resolves, so a partially loaded table cannot be exported.
  if (Routes.isPrintPDF()) {
    Toolbar.addAction('btn-calc-pages', 'Calculate Page Count', async () => {
      const btnCalc = document.querySelector('#btn-calc-pages');
      if (btnCalc) {
        btnCalc.disabled = true;
        btnCalc.textContent = 'Calculating...';
      }

      const assessment = await assessPrintCollectionPageCount(document);
      if (assessment && assessment.totalPages > 0) {
        if (btnCalc) btnCalc.remove();

        Toolbar.addAction('btn-csv-pdf-all', `Export All Parts (1 - ${assessment.totalPages})`, () => {
          exportPrintCollectionCSV(document);
        }, false);
      } else if (btnCalc) {
        btnCalc.disabled = false;
        btnCalc.textContent = 'Calculate Page Count';
      }
    }, false);

    const btnCalc = document.querySelector('#btn-calc-pages');
    if (btnCalc) {
      btnCalc.title = 'Calculate total pages prior to exporting';
    }
  } else if (Routes.isCollection()) {
    Toolbar.addAction('btn-csv-coll', 'Export Collection', () => generateCSV('Collection'), true);
  } else if (Routes.isPlayerCollection()) {
    Toolbar.addAction('btn-csv-player', 'Export Player Collection', () => generateCSV('Player_Collection'), true);
  }
}

/** Button ids the bootstrap enables once async module init settles. */
export const EXPORT_BUTTON_IDS = ['btn-csv-coll', 'btn-csv-player', 'btn-calc-pages', 'btn-csv-pdf-all'];

