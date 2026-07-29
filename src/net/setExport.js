/**
 * Multi-page checklist export.
 *
 * Flow: cooldown gate -> fetch page 1 -> learn the page count -> fetch the rest
 * with jittered pacing -> parse each page to plain objects -> emit CSV.
 *
 * Pages are parsed to plain row objects as they arrive and the parsed
 * `Document` is dropped immediately, so a 200-page run holds one document at a
 * time rather than 200 live DOM trees.
 */

import { Config, EXPORT_CONFIG } from '../core/config.js';
import { Log } from '../core/log.js';
import { BLOCK_TS_KEY, getValue, setValue } from '../core/storage.js';
import { CSV } from '../data/csv.js';
import { buildExportFilename } from '../data/filename.js';
import { parseChecklistDocument, toChecklistTable } from '../data/checklistParser.js';
import { escapeHtml } from '../ui/dom.js';
import { setStatus } from '../ui/status.js';
import { showToast } from '../ui/toast.js';
import { detectBlock } from './blockDetect.js';
import { fetchPageWithRetry, jitteredDelay } from './fetcher.js';
import { ExportQueue } from './queue.js';

/**
 * Report how long the anti-scraping cooldown still has to run.
 *
 * @param {number} [now] epoch ms, injectable for tests
 * @returns {number} whole minutes remaining, 0 when exports are permitted
 */
export function cooldownRemainingMinutes(now = Date.now()) {
  const cooldownMs = (Config.global.exportBlockCooldownMinutes || 0) * 60000;
  if (cooldownMs <= 0) return 0;
  const lastBlockTs = getValue(BLOCK_TS_KEY, 0);
  if (!lastBlockTs) return 0;
  const elapsed = now - lastBlockTs;
  if (elapsed >= cooldownMs) return 0;
  return Math.ceil((cooldownMs - elapsed) / 60000);
}

/**
 * Queue a checklist export. Returns as soon as the job is queued; progress is
 * reported through the status readout and toasts.
 *
 * @param {string} setId
 * @param {string} setName label for logs, toasts, and year fallback
 */
export function exportSetCSV(setId, setName) {
  ExportQueue.enqueue(setName || `Set ${setId}`, () => runExportSetCSV(setId, setName));
}

/**
 * @param {string} setId
 * @param {string} setName
 * @returns {Promise<void>}
 */
export async function runExportSetCSV(setId, setName) {
  const remainingMin = cooldownRemainingMinutes();
  if (remainingMin > 0) {
    Log(`Export refused: anti-scraping cooldown active (${remainingMin} min remaining).`, 'warn');
    setStatus('Export blocked (cooldown)');
    showToast({
      message:
        `Export paused — an anti-scraping block was detected recently. ` +
        `Try again in ~${remainingMin} min, or adjust the cooldown in Settings.`,
      accent: 'var(--tk-red)'
    });
    return;
  }

  Log(`Starting checklist fetch for set ID ${setId} (${setName})`, 'info');
  setStatus(`Fetching ${setName}...`);

  try {
    let pageIndex = 1;
    let totalPages = 1;
    let identity = { year: '', baseSet: '', setName: '' };
    const allRows = [];

    do {
      if (pageIndex > 1) await jitteredDelay();

      setStatus(`Fetching Page ${pageIndex}${totalPages > 1 ? '/' + totalPages : ''}...`);
      const fetchUrl = `/Checklist.cfm/sid/${setId}/?PageIndex=${pageIndex}`;
      Log(`HTTP GET Request -> ${fetchUrl}`, 'info', 'server');

      const response = await fetchPageWithRetry(fetchUrl, pageIndex, setStatus);
      const html = await response.text();

      const blockMarker = detectBlock(html);
      if (blockMarker) {
        setValue(BLOCK_TS_KEY, Date.now());
        throw new Error(
          `Anti-scraping protection triggered by server (matched '${blockMarker}'). Fetch aborted.`
        );
      }

      const doc = new DOMParser().parseFromString(html, 'text/html');
      const parsed = parseChecklistDocument(doc);

      if (pageIndex === 1) {
        identity = { year: parsed.year, baseSet: parsed.baseSet, setName: parsed.setName };
        totalPages = parsed.totalPages;

        if (totalPages > EXPORT_CONFIG.maxPages) {
          throw new Error(
            `Discovered page count (${totalPages}) exceeds safety ceiling ` +
            `(${EXPORT_CONFIG.maxPages}). Likely a pagination-parsing regression — export aborted before fetching.`
          );
        }

        Log(`Discovered ${totalPages} total page(s) for set ID ${setId}`, 'info');
      }

      allRows.push(...parsed.rows);
      Log(`Page ${pageIndex}/${totalPages} parsed successfully. ${parsed.rows.length} rows retrieved.`, 'info');

      pageIndex++;
    } while (pageIndex <= totalPages);

    if (allRows.length === 0) throw new Error('No valid checklist rows identified within tables.');

    let setLogLabel = identity.baseSet;
    if (identity.setName) setLogLabel += ` - ${identity.setName}`;
    Log(`Export complete for: ${setLogLabel} (${allRows.length} cards across ${totalPages} page(s))`, 'info');

    // The suffix describes what was fetched, not where the button was clicked.
    // This runner always fetches /Checklist.cfm, so the export is always a
    // checklist — v2.42.0 read the *current page's* route here, which labelled
    // a full checklist `_Wantlist` whenever you happened to start it from a
    // wantlist page.
    const filename = buildExportFilename({
      year: identity.year,
      baseSet: identity.baseSet,
      setName: identity.setName,
      fallbackLabel: setName,
      kind: 'checklist'
    });

    CSV.download(CSV.toCSV(toChecklistTable(identity, allRows)), filename);
    setStatus('Export Complete');
    showToast({ message: `Exported <b>${allRows.length}</b> cards for ${escapeHtml(setLogLabel)}` });
  } catch (error) {
    Log(`CSV Export Failed: ${error.message}`, 'error');
    setStatus('Export Failed');
    showToast({ message: `Export Failed: ${escapeHtml(error.message)}`, accent: 'var(--tk-red)' });
  }
}
