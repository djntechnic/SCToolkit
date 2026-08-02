/**
 * Multi-page checklist export.
 *
 * Flow: cooldown gate -> cache lookup -> fetch page 1 -> learn the page count
 * -> fetch the rest with paced, throttled requests -> parse each page to plain
 * objects -> emit CSV.
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

import { setStatus } from '../ui/status.js';
import { showProgressToast, showToast } from '../ui/toast.js';
import * as cache from './cache.js';
import { detectBlock } from './blockDetect.js';
import { AbortedError, BlockedError, fetchPageWithRetry, jitteredDelay } from './fetcher.js';
import { Pacing } from './pacing.js';
import { ExportQueue } from './queue.js';

/**
 * Cancellation handle for the run in progress.
 *
 * One at a time, because the queue is serialized — so a single module-level
 * controller is sufficient and there is never an ambiguous "which run does
 * Cancel mean?".
 */
export const CurrentRun = {
  /** @type {AbortController|null} */
  controller: null,
  /** @type {(() => void)|null} set by the toolbar to show/hide its Cancel button */
  onStart: null,
  /** @type {(() => void)|null} */
  onEnd: null
};

/** Abort the export in progress, if any. */
export function cancelCurrentExport() {
  if (!CurrentRun.controller) return false;
  Log('Export cancelled by user.', 'info');
  CurrentRun.controller.abort();
  return true;
}

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
 * Record that we were blocked, starting the cooldown.
 *
 * @param {string} detail
 */
function recordBlock(detail) {
  setValue(BLOCK_TS_KEY, Date.now());
  Log(`Anti-scraping block detected (${detail}). Cooldown started.`, 'warn', 'server');
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
 * Emit the CSV for a parsed result.
 *
 * @param {{identity: object, rows: Array<object>}} result
 * @param {string} fallbackLabel
 * @returns {string} the filename written
 */
function downloadResult({ identity, rows }, fallbackLabel) {
  // The suffix describes what was fetched, not where the button was clicked.
  // This runner always fetches /Checklist.cfm, so the export is always a
  // checklist.
  const filename = buildExportFilename({
    year: identity.year,
    baseSet: identity.baseSet,
    setName: identity.setName,
    fallbackLabel,
    kind: 'checklist'
  });

  CSV.download(CSV.toCSV(toChecklistTable(identity, rows)), filename);
  return filename;
}

/**
 * Fetch and parse every page of a checklist.
 *
 * @param {string} setId
 * @param {AbortSignal} signal
 * @returns {Promise<{identity: object, rows: Array<object>, totalPages: number}>}
 */
async function fetchAllPages(setId, signal, progress) {
  let pageIndex = 1;
  let totalPages = 1;
  let identity = { year: '', baseSet: '', setName: '' };
  const rows = [];

  do {
    if (signal.aborted) throw new AbortedError('Export cancelled.', true);
    if (pageIndex > 1) await jitteredDelay();

    const label = `Page ${pageIndex}${totalPages > 1 ? ' of ' + totalPages : ''}${Pacing.describe()}`;
    setStatus(`Fetching ${label}...`);
    progress?.update(label);

    const fetchUrl = `/Checklist.cfm/sid/${setId}/?PageIndex=${pageIndex}`;
    Log(`HTTP GET Request -> ${fetchUrl}`, 'info', 'server');

    const response = await fetchPageWithRetry(fetchUrl, pageIndex, { onStatus: setStatus, signal });
    const html = await response.text();

    const blockMarker = detectBlock(html);
    if (blockMarker) {
      throw new BlockedError(`Challenge page received instead of content (matched '${blockMarker}').`);
    }

    const doc = new DOMParser().parseFromString(html, 'text/html');
    const parsed = parseChecklistDocument(doc);

    if (pageIndex === 1) {
      identity = { year: parsed.year, baseSet: parsed.baseSet, setName: parsed.setName };
      const discoveredPages = parsed.totalPages;

      // If discovered pages exceed safety ceiling, cap to maxPages and warn user via toast instead of throwing a fatal error
      if (discoveredPages > EXPORT_CONFIG.maxPages) {
        totalPages = EXPORT_CONFIG.maxPages;
        Log(
          `Discovered page count (${discoveredPages}) exceeds safety ceiling (${EXPORT_CONFIG.maxPages}). Capping fetch to ${EXPORT_CONFIG.maxPages} pages.`,
          'warn'
        );
        showToast({
          message:
            `Set has <b>${discoveredPages}</b> pages, exceeding max limit (${EXPORT_CONFIG.maxPages}). ` +
            `Exporting first ${EXPORT_CONFIG.maxPages} pages only.`,
          variant: 'warn'
        });
      } else {
        totalPages = discoveredPages;
        Log(`Discovered ${totalPages} total page(s) for set ID ${setId}`, 'info');
      }
    }

    rows.push(...parsed.rows);
    Log(`Page ${pageIndex}/${totalPages} parsed successfully. ${parsed.rows.length} rows retrieved.`, 'info');

    pageIndex++;
  } while (pageIndex <= totalPages);

  return { identity, rows, totalPages };
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
      variant: 'error'
    });
    return;
  }

  const ttlHours = Config.global.exportCacheTtlHours;
  const cached = cache.read(setId, ttlHours);
  if (cached) {
    const filename = downloadResult(cached, setName);
    Log(`Export served from cache: ${filename} (${cached.rows.length} rows, zero requests).`, 'info');
    setStatus('Export Complete (cached)');
    showToast({
      message: `Exported <b>${cached.rows.length}</b> cards from cache — no requests made.`,
      variant: 'success'
    });
    return;
  }

  const controller = new AbortController();
  CurrentRun.controller = controller;
  CurrentRun.onStart?.();

  Log(`Starting checklist fetch for set ID ${setId} (${setName})`, 'info');
  setStatus(`Fetching ${setName}...`);

  // A progress toast that updates in place, with the cancel affordance next to
  // the thing it cancels rather than across the toolbar.
  const progress = showProgressToast({
    title: `Exporting ${setName}`,
    onCancel: () => cancelCurrentExport()
  });

  try {
    const result = await fetchAllPages(setId, controller.signal, progress);
    if (result.rows.length === 0) throw new Error('No valid checklist rows identified within tables.');

    let label = result.identity.baseSet;
    if (result.identity.setName) label += ` - ${result.identity.setName}`;
    Log(
      `Export complete for: ${label} (${result.rows.length} cards across ${result.totalPages} page(s), ` +
      `median latency ${Math.round(Pacing.medianLatencyMs())}ms)`,
      'info'
    );

    cache.write(setId, result, ttlHours);
    downloadResult(result, setName);

    setStatus('Export Complete');
    progress.finish(`${result.rows.length} cards exported.`, 'success');
  } catch (error) {
    if (error instanceof BlockedError) {
      recordBlock(error.message);
      progress.finish('Stopped — the site returned a challenge.', 'error');
      setStatus('Export blocked');
    } else if (error instanceof AbortedError) {
      Log(`Export stopped: ${error.message}`, error.byUser ? 'info' : 'warn');
      progress.finish(error.byUser ? 'Cancelled.' : 'Timed out.', error.byUser ? 'muted' : 'error');
      setStatus(error.byUser ? 'Export cancelled' : 'Export timed out');
    } else {
      Log(`CSV Export Failed: ${error.message}`, 'error');
      progress.finish(`Failed: ${error.message}`, 'error');
      setStatus('Export Failed');
    }
  } finally {
    CurrentRun.controller = null;
    CurrentRun.onEnd?.();
  }
}
