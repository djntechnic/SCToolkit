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
import { Utils } from '../core/utils.js';
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
/**
 * Record that we were blocked, starting the cooldown.
 *
 * @param {string} detail
 * @param {string} [targetUrl]
 */
function recordBlock(detail, targetUrl = '') {
  setValue(BLOCK_TS_KEY, Date.now());
  const fullUrl = targetUrl ? Utils.toFullUrl(targetUrl) : '';
  const urlLabel = fullUrl ? ` for ${fullUrl}` : '';
  Log(`Anti-scraping block detected${urlLabel} (${detail}). Cooldown started.`, 'warn', 'server');
}

/**
 * Queue a checklist export. Returns as soon as the job is queued; progress is
 * reported through the status readout and toasts.
 *
 * @param {string} setId
 * @param {string} setName label for logs, toasts, and year fallback
 */
export function exportSetCSV(setId, setName) {
  const fullUrl = Utils.toFullUrl(`/Checklist.cfm/sid/${setId}/`);
  Log(`[CLIENT] Checklist CSV Export queued for set ID ${setId} (${setName}) — ${fullUrl}`, 'debug', 'client');
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
 * @param {object} [progress]
 * @returns {Promise<{identity: object, rows: Array<object>, totalPages: number, totalDiscoveredPages: number}>}
 */
async function fetchAllPages(setId, signal, progress) {
  let pageIndex = 1;
  let totalPages = 1;
  let totalDiscoveredPages = 1;
  let identity = { year: '', baseSet: '', setName: '' };
  const rows = [];

  do {
    if (signal.aborted) throw new AbortedError('Export cancelled.', true);
    if (pageIndex > 1) await jitteredDelay();

    const fetchUrl = `/Checklist.cfm/sid/${setId}/?PageIndex=${pageIndex}`;
    const fullFetchUrl = Utils.toFullUrl(fetchUrl);
    fetchAllPages.lastRequestedUrl = fullFetchUrl;

    const label = `Page ${pageIndex}${totalPages > 1 ? ' of ' + totalPages : ''}${Pacing.describe()}`;
    setStatus(`Fetching ${label}...`);
    progress?.update(label);

    Log(`HTTP GET Request -> ${fullFetchUrl}`, 'info', 'server');

    const response = await fetchPageWithRetry(fetchUrl, pageIndex, { onStatus: setStatus, signal });
    const html = await response.text();

    Log(
      `[CLIENT] HTTP ${response.status} response received for ${fullFetchUrl} (${Math.round(html.length / 1024)} KB, latency ${Pacing.lastLatencyMs || 0}ms)`,
      'debug',
      'client'
    );

    const blockMarker = detectBlock(html);
    if (blockMarker) {
      throw new BlockedError(`Challenge page received instead of content (matched '${blockMarker}').`);
    }

    const doc = new DOMParser().parseFromString(html, 'text/html');
    const parsed = parseChecklistDocument(doc);

    if (pageIndex === 1) {
      identity = { year: parsed.year, baseSet: parsed.baseSet, setName: parsed.setName };
      totalDiscoveredPages = parsed.totalPages;

      // If discovered pages exceed safety ceiling, cap to maxPages and warn user via toast instead of throwing a fatal error
      if (totalDiscoveredPages > EXPORT_CONFIG.maxPages) {
        totalPages = EXPORT_CONFIG.maxPages;
        const cappedStatus = `Export capped at ${EXPORT_CONFIG.maxPages} pages (Set has ${totalDiscoveredPages})`;
        setStatus(cappedStatus);
        Log(
          `[CLIENT] Discovered page count (${totalDiscoveredPages}) for ${fullFetchUrl} exceeds safety ceiling (${EXPORT_CONFIG.maxPages}). Capping fetch to ${EXPORT_CONFIG.maxPages} pages.`,
          'warn',
          'client'
        );
        showToast({
          message:
            `Set has <b>${totalDiscoveredPages}</b> pages, exceeding max limit (${EXPORT_CONFIG.maxPages}). ` +
            `Exporting first ${EXPORT_CONFIG.maxPages} pages only.`,
          variant: 'warn'
        });
      } else {
        totalPages = totalDiscoveredPages;
        Log(`[CLIENT] Discovered ${totalPages} total page(s) for set ID ${setId} (${fullFetchUrl})`, 'info', 'client');
      }
    }

    rows.push(...parsed.rows);
    Log(`[CLIENT] Page ${pageIndex}/${totalPages} parsed successfully for ${fullFetchUrl}. ${parsed.rows.length} rows retrieved (Total accumulated: ${rows.length}).`, 'info', 'client');

    pageIndex++;
  } while (pageIndex <= totalPages);

  return { identity, rows, totalPages, totalDiscoveredPages };
}

/**
 * @param {string} setId
 * @param {string} setName
 * @returns {Promise<void>}
 */
export async function runExportSetCSV(setId, setName) {
  const fullTargetUrl = Utils.toFullUrl(`/Checklist.cfm/sid/${setId}/`);

  Log(`[CLIENT] Step 1/4: Checking anti-scraping cooldown status for ${fullTargetUrl}...`, 'debug', 'client');
  const remainingMin = cooldownRemainingMinutes();
  if (remainingMin > 0) {
    Log(`Export refused: anti-scraping cooldown active (${remainingMin} min remaining) for ${fullTargetUrl}.`, 'warn', 'client');
    setStatus('Export blocked (cooldown)');
    showToast({
      message:
        `Export paused — an anti-scraping block was detected recently. ` +
        `Try again in ~${remainingMin} min, or adjust the cooldown in Settings.`,
      variant: 'error'
    });
    return;
  }
  Log(`[CLIENT] Cooldown check passed for ${fullTargetUrl}.`, 'debug', 'client');

  Log(`[CLIENT] Step 2/4: Checking export cache for ${fullTargetUrl}...`, 'debug', 'client');
  const ttlHours = Config.global.exportCacheTtlHours;
  const cached = cache.read(setId, ttlHours);
  if (cached) {
    const filename = downloadResult(cached, setName);
    Log(`Export served from cache for ${fullTargetUrl}: ${filename} (${cached.rows.length} rows, 0 network requests).`, 'info', 'client');
    setStatus('Export Complete (cached)');
    showToast({
      message: `Exported <b>${cached.rows.length}</b> cards from cache — no requests made.`,
      variant: 'success'
    });
    return;
  }
  Log(`[CLIENT] Cache miss for ${fullTargetUrl}. Initializing network fetch...`, 'debug', 'client');

  Log(`[CLIENT] Step 3/4: Starting checklist fetch for set ID ${setId} (${setName}) at ${fullTargetUrl}...`, 'info', 'client');
  const controller = new AbortController();
  CurrentRun.controller = controller;
  CurrentRun.onStart?.();

  setStatus(`Fetching ${setName}...`);

  // A progress toast that updates in place, with the cancel affordance next to
  // the thing it cancels rather than across the toolbar.
  const progress = showProgressToast({
    title: `Exporting ${setName}`,
    onCancel: () => cancelCurrentExport()
  });

  try {
    const result = await fetchAllPages(setId, controller.signal, progress);
    if (result.rows.length === 0) throw new Error(`No valid checklist rows identified within tables at ${fullTargetUrl}.`);

    let label = result.identity.baseSet;
    if (result.identity.setName) label += ` - ${result.identity.setName}`;
    Log(
      `[CLIENT] Step 4/4: Export complete for ${fullTargetUrl}: ${label} (${result.rows.length} cards across ${result.totalPages} page(s), ` +
      `median latency ${Math.round(Pacing.medianLatencyMs())}ms)`,
      'info',
      'client'
    );

    cache.write(setId, result, ttlHours);
    const filename = downloadResult(result, setName);
    Log(`[CLIENT] CSV file generated and download triggered: ${filename} (${result.rows.length} rows).`, 'info', 'client');

    if (result.totalDiscoveredPages > EXPORT_CONFIG.maxPages) {
      const cappedStatus = `Export capped at ${EXPORT_CONFIG.maxPages} pages (Set has ${result.totalDiscoveredPages})`;
      setStatus(cappedStatus);
      progress.finish(`${result.rows.length} cards exported (capped at ${EXPORT_CONFIG.maxPages} pages).`, 'warning');
    } else {
      setStatus('Export Complete');
      progress.finish(`${result.rows.length} cards exported.`, 'success');
    }
  } catch (error) {
    if (error instanceof BlockedError) {
      const lastUrl = fetchAllPages.lastRequestedUrl || fullTargetUrl;
      recordBlock(error.message, lastUrl);
      progress.finish('Stopped — the site returned a challenge.', 'error');
      setStatus('Export blocked');
    } else if (error instanceof AbortedError) {
      Log(`Export stopped for ${fullTargetUrl}: ${error.message}`, error.byUser ? 'info' : 'warn', 'client');
      progress.finish(error.byUser ? 'Cancelled.' : 'Timed out.', error.byUser ? 'muted' : 'error');
      setStatus(error.byUser ? 'Export cancelled' : 'Export timed out');
    } else {
      Log(`CSV Export Failed for ${fullTargetUrl}: ${error.message}`, 'error', 'client');
      progress.finish(`Failed: ${error.message}`, 'error');
      setStatus('Export Failed');
    }
  } finally {
    CurrentRun.controller = null;
    CurrentRun.onEnd?.();
  }
}
