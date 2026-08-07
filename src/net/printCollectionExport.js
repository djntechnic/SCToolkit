/**
 * Multi-part Print Collection PDF export and page assessment.
 *
 * Flow:
 *   1. User clicks "Calculate Page Count" -> assessPrintCollectionPageCount()
 *      Probes Part=1, Part=2... until an empty page or MAX_PARTS (20) is hit.
 *      Discovers total page count and caches parsed rows.
 *   2. Button reveals/enables "Export All Parts (1 - N)".
 *   3. User clicks "Export All Parts" -> exportPrintCollectionCSV()
 *      Enqueues task into ExportQueue, compiles accumulated rows, and triggers download.
 */

import { EXPORT_CONFIG } from '../core/config.js';
import { Log } from '../core/log.js';
import { Utils } from '../core/utils.js';
import { CSV } from '../data/csv.js';
import { buildPrintCollectionFilename } from '../data/filename.js';
import {
  buildPrintCollectionUrlFromDoc,
  checkIncludePrice,
  getSportFromDoc,
  parsePrintCollectionDocument
} from '../data/printCollectionParser.js';
import { setStatus } from '../ui/status.js';
import { showProgressToast, showToast } from '../ui/toast.js';
import { detectBlock } from './blockDetect.js';
import { AbortedError, BlockedError, fetchPageWithRetry, jitteredDelay } from './fetcher.js';

import { ExportQueue } from './queue.js';
import { cooldownRemainingMinutes } from './setExport.js';

/** In-memory cache for the most recent assessment run. */
let assessmentCache = null;

export const CurrentPrintRun = {
  /** @type {AbortController|null} */
  controller: null
};

/** Clear the assessment cache when navigating or resetting. */
export function clearPrintAssessmentCache() {
  assessmentCache = null;
}

/** Get currently cached assessment data, if any. */
export function getPrintAssessmentCache() {
  return assessmentCache;
}

/**
 * Conduct page count assessment by probing Part=1, Part=2... until an empty page is returned.
 *
 * @param {Document} [doc=document]
 * @param {object} [callbacks]
 * @param {(statusText: string) => void} [callbacks.onProgress]
 * @returns {Promise<{totalPages: number, totalCards: number, totalQuantity: number, rows: Array<Array<string|number>>}|null>}
 */
export async function assessPrintCollectionPageCount(doc = document, callbacks = {}, signal = null) {
  const remainingMin = cooldownRemainingMinutes();
  if (remainingMin > 0) {
    setStatus('Export blocked (cooldown)');
    showToast({
      message: `Assessment paused — an anti-scraping block was detected recently. Try again in ~${remainingMin} min.`,
      variant: 'error'
    });
    return null;
  }

  const includePrice = checkIncludePrice(doc);
  const sport = getSportFromDoc(doc);
  const initialUrlStr = buildPrintCollectionUrlFromDoc(doc, 1);
  const baseUrl = new URL(initialUrlStr, typeof window !== 'undefined' && window.location ? window.location.href : 'https://www.tcdb.com');

  let part = 1;
  let hasData = true;
  const maxParts = EXPORT_CONFIG.maxPages || 20;

  const aggregatedRows = [];
  let totalCards = 0;
  let totalQuantity = 0;

  setStatus('Calculating page count...');
  Log('[CLIENT] Starting Print Collection page count assessment...', 'info', 'client');

  while (hasData) {
    if (part > maxParts) {
      Log(`[CLIENT] Assessment safeguard: hit max limit of ${maxParts} parts.`, 'warn', 'client');
      break;
    }

    if (signal?.aborted) throw new AbortedError('Export cancelled.', true);
    if (part > 1) {
      callbacks.onProgress?.(`Waiting anti-scraping delay...`);
      await jitteredDelay();
    }

    baseUrl.searchParams.set('Part', part);
    const fetchUrl = baseUrl.pathname + baseUrl.search;
    const fullFetchUrl = Utils.toFullUrl(fetchUrl);

    callbacks.onProgress?.(`Probing Part ${part}...`);
    setStatus(`Assessing Part ${part}...`);
    Log(`Assessment fetching Part ${part}: ${Utils.formatLogUrl(fullFetchUrl)}`, 'info', 'server');

    try {
      let pageDoc = doc;
      if (part > 1 || !doc.querySelector('.yourcol-item')) {
        const response = await fetchPageWithRetry(fetchUrl, part, { onStatus: setStatus, signal });
        const html = await response.text();

        const blockMarker = detectBlock(html);
        if (blockMarker) {
          throw new BlockedError(`Challenge page received instead of content (matched '${blockMarker}').`);
        }

        pageDoc = new DOMParser().parseFromString(html, 'text/html');
      }

      const parsed = parsePrintCollectionDocument(pageDoc, {
        includeHeader: part === 1,
        includePrice,
        sport
      });

      if (parsed.count === 0) {
        Log(`[CLIENT] Page Part ${part} contains 0 items. Stopping assessment.`, 'info', 'client');
        hasData = false;
      } else {
        const dataRows = part === 1 ? parsed.rows : parsed.rows;
        aggregatedRows.push(...dataRows);
        totalCards += parsed.count;
        totalQuantity += parsed.quantity;
        part++;
      }
    } catch (err) {
      if (err instanceof AbortedError && aggregatedRows.length > 0) {
        assessmentCache = {
          totalPages: part - 1,
          totalCards,
          totalQuantity,
          rows: aggregatedRows,
          includePrice,
          sport,
          isPartial: true
        };
        return assessmentCache;
      }
      Log(`[CLIENT] Assessment halted at Part ${part}: ${err.message}`, 'error', 'client');
      if (part === 1) throw err;
      break;
    }
  }

  const totalPages = part - 1;
  assessmentCache = {
    totalPages,
    totalCards,
    totalQuantity,
    rows: aggregatedRows,
    includePrice,
    sport
  };

  Log(
    `[CLIENT] Page count assessment complete: ${totalPages} page(s), ${totalCards.toLocaleString()} card(s), ${totalQuantity.toLocaleString()} total qty.`,
    'info',
    'client'
  );
  setStatus(`Calculated ${totalPages} Page(s) (${totalCards.toLocaleString()} Cards)`);

  return assessmentCache;
}

/**
 * Queue a full Print Collection CSV export.
 *
 * @param {Document} [doc=document]
 */
export function exportPrintCollectionCSV(doc = document) {
  const sport = getSportFromDoc(doc);
  const label = `Print Collection (${sport})`;
  Log(`[CLIENT] Enqueuing Print Collection CSV Export for ${label}`, 'info', 'client');
  ExportQueue.enqueue(label, () => runExportPrintCollectionCSV(doc));
}

/**
 * Async execution task for ExportQueue.
 *
 * @param {Document} [doc=document]
 * @returns {Promise<void>}
 */
export async function runExportPrintCollectionCSV(doc = document) {
  const remainingMin = cooldownRemainingMinutes();
  if (remainingMin > 0) {
    setStatus('Export blocked (cooldown)');
    showToast({
      message: `Export paused — anti-scraping cooldown active (~${remainingMin} min left).`,
      variant: 'error'
    });
    return;
  }

  const controller = new AbortController();
  CurrentPrintRun.controller = controller;

  const progress = showProgressToast({
    title: 'Exporting Print Collection',
    onCancel: () => {
      controller.abort();
      Log('[CLIENT] Print Collection Export cancelled by user.', 'info', 'client');
    }
  });

  try {
    let data = assessmentCache;
    if (!data || !data.rows || data.rows.length === 0) {
      progress.update('Calculating page count...');
      data = await assessPrintCollectionPageCount(doc, {
        onProgress: (msg) => progress.update(msg)
      }, controller.signal);
    }

    if (!data || !data.rows || data.rows.length === 0) {
      throw new Error('No printable card data found across pages.');
    }

    if (data.isPartial || controller.signal.aborted) {
      const filename = buildPrintCollectionFilename({
        includePrice: data.includePrice
      });
      const csvContent = CSV.toCSV(data.rows);
      CSV.download(csvContent, filename);
      setStatus('Export cancelled (partial delivered)');
      progress.finish(`Cancelled — ${data.totalCards.toLocaleString()} cards downloaded.`, 'warning');
      return;
    }

    progress.update(`Compiling ${data.totalCards.toLocaleString()} cards...`);

    const filename = buildPrintCollectionFilename({
      includePrice: data.includePrice
    });

    const csvContent = CSV.toCSV(data.rows);
    CSV.download(csvContent, filename);

    setStatus('Export Complete');
    progress.finish(`Exported ${data.totalCards.toLocaleString()} cards (${data.totalQuantity.toLocaleString()} total qty) to ${filename}`, 'success');
    Log(`[CLIENT] Exported Print Collection CSV successfully: ${filename}`, 'info', 'client');
  } catch (error) {
    if (error instanceof BlockedError) {
      progress.finish('Stopped — anti-scraping challenge page received.', 'error');
      setStatus('Export blocked');
    } else if (error instanceof AbortedError || controller.signal.aborted) {
      progress.finish('Cancelled.', 'muted');
      setStatus('Export cancelled');
    } else {
      progress.finish(`Export failed: ${error.message}`, 'error');
      setStatus('Export Failed');
      Log(`[CLIENT] Print Collection CSV Export failed: ${error.message}`, 'error', 'client');
    }
  } finally {
    CurrentPrintRun.controller = null;
  }
}
