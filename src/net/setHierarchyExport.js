import { EXPORT_CONFIG } from '../core/config.js';
import { Log } from '../core/log.js';
import { Utils } from '../core/utils.js';
import { CSV } from '../data/csv.js';
import { setStatus } from '../ui/status.js';
import { showProgressToast, showToast } from '../ui/toast.js';
import { AbortedError, BlockedError, fetchPageWithRetry, interruptibleSleep } from './fetcher.js';
import { cooldownRemainingMinutes, CurrentRun, recordBlock } from './setExport.js';
import { parseViewAllSets, parseChildSets } from '../data/setHierarchyParser.js';
import { ExportQueue } from './queue.js';
import { detectBlock } from './blockDetect.js';

/**
 * Queue a set hierarchy export.
 *
 * @param {string} url
 */
export function exportSetHierarchyCSV(url) {
  Log(`[CLIENT] Set Hierarchy CSV Export queued for URL: ${url}`, 'debug', 'client');
  ExportQueue.enqueue('Set Hierarchy Export', () => runExportSetHierarchyCSV(url));
}

/**
 * Perform the set hierarchy export run.
 *
 * @param {string} url
 */
export async function runExportSetHierarchyCSV(url) {
  const remainingMin = cooldownRemainingMinutes();
  if (remainingMin > 0) {
    Log(`Export refused: anti-scraping cooldown active (${remainingMin} min remaining).`, 'warn', 'client');
    setStatus('Export blocked (cooldown)');
    showToast({
      message: `Export paused — an anti-scraping block was detected recently. Try again in ~${remainingMin} min.`,
      variant: 'error'
    });
    return;
  }

  const sportMatch = url.match(/\/sp\/([^/]+)/i);
  const yearMatch = url.match(/\/year\/([^/]+)/i);
  if (!sportMatch || !yearMatch) {
    Log(`Failed to parse Sport and Year from URL: ${url}`, 'error', 'client');
    setStatus('Export Failed');
    showToast({ message: 'Failed to parse Sport and Year from current URL.', variant: 'error' });
    return;
  }

  const rawSport = decodeURIComponent(sportMatch[1]);
  const sport = rawSport.charAt(0).toUpperCase() + rawSport.slice(1);
  const year = decodeURIComponent(yearMatch[1]);

  setStatus('Parsing parent sets...');
  const parentSets = parseViewAllSets(document, year);
  if (parentSets.length === 0) {
    setStatus('No parent sets found');
    showToast({ message: 'No parent sets matching hierarchy requirements found on this page.', variant: 'warn' });
    return;
  }

  Log(`[CLIENT] Extracted ${parentSets.length} parent set(s) from current page`, 'info', 'client');

  const controller = new AbortController();
  CurrentRun.controller = controller;
  CurrentRun.onStart?.();

  const progress = showProgressToast({
    title: 'Exporting Set Hierarchy',
    onCancel: () => {
      controller.abort();
    }
  });

  const csvRows = [
    ['Sport', 'Year', 'Set Category', 'Set ID', 'Set Name', 'Child Set Category', 'Child Set ID', 'Child Set Name', 'Child Set Notes', 'Full Set Name', 'Full Set Name (Trunc)']
  ];

  let isPartial = false;
  let networkRequestsMade = 0;

  try {
    for (let i = 0; i < parentSets.length; i++) {
      if (controller.signal.aborted) {
        throw new AbortedError('Export cancelled.', true);
      }

      const parent = parentSets[i];
      const parentLabel = `Parent ${i + 1}/${parentSets.length}: ${parent.setName}`;
      setStatus(`Processing ${parent.setName}...`);
      progress.update(parentLabel);

      const parentLogMsg = `Processing Parent Set [${i + 1}/${parentSets.length}]: ${parent.setName} (ID: ${parent.setId})`;
      Log(parentLogMsg, 'info');

      if (!parent.hasHideDiv) {
        // Output parent base row and skip child request and sleep entirely
        const fullName = buildFullSetName(year, parent.setName, '');
        const fullNameTrunc = buildFullSetNameTrunc(year, parent.setName, '');
        csvRows.push([sport, year, parent.category, parent.setId, parent.setName, '', '', '', '', fullName, fullNameTrunc]);
        continue;
      }

      // Randomised sleep session between parent sets (if we made previous network requests)
      if (networkRequestsMade > 0) {
        const min = EXPORT_CONFIG.hierarchyMinDelayMs ?? 10000;
        const max = Math.max(min, EXPORT_CONFIG.hierarchyMaxDelayMs ?? 15000);
        let sleepMs = 0;

        if (parentSets.length > 50) {
          if (networkRequestsMade % 15 === 0) {
            const longPauseMinMs = 300000; // 5 minutes
            const longPauseMaxMs = 420000; // 7 minutes
            sleepMs = longPauseMinMs + Math.random() * (longPauseMaxMs - longPauseMinMs);
            const longPauseMinText = Math.round(sleepMs / 1000 / 60);
            const logMsg = `Pacing safeguard: Triggering a long pause of ${longPauseMinText} minutes to prevent rate-limiting...`;
            Log(logMsg, 'warn');
            setStatus(`Pausing for ${longPauseMinText} min...`);
            progress.update(`Pause (${longPauseMinText}m)`);
          } else {
            // Scale delay over time: increase by 2% per request made
            const scale = 1 + (networkRequestsMade * 0.02);
            const scaledMin = min * scale;
            const scaledMax = max * scale;
            sleepMs = scaledMin + Math.random() * (scaledMax - scaledMin);
            Log(`[CLIENT] Scaled pacing: Sleeping ${Math.round(sleepMs / 1000)} seconds (scale: ${scale.toFixed(2)}x)...`, 'debug', 'client');
          }
        } else {
          sleepMs = min + Math.random() * (max - min);
          Log(`[CLIENT] Sleeping ${Math.round(sleepMs / 1000)} seconds before next parent set request...`, 'debug', 'client');
        }

        await interruptibleSleep(sleepMs, controller.signal);
      }

      networkRequestsMade++;
      const fetchUrl = `/Inserts.cfm/sid/${parent.setId}/`;
      const fullFetchUrl = Utils.toFullUrl(fetchUrl);
      Log(`HTTP GET Request -> ${fullFetchUrl}`, 'info', 'server');

      try {
        const response = await fetchPageWithRetry(fetchUrl, i + 1, { onStatus: setStatus, signal: controller.signal });
        const html = await response.text();

        Log(
          `[CLIENT] HTTP ${response.status} response received for ${fullFetchUrl} (${Math.round(html.length / 1024)} KB)`,
          'debug',
          'client'
        );

        const blockMarker = detectBlock(html);
        if (blockMarker) {
          throw new BlockedError(`Challenge page received instead of content (matched '${blockMarker}').`);
        }

        const doc = new DOMParser().parseFromString(html, 'text/html');
        const childSets = parseChildSets(doc);

        const countLogMsg = `Found ${childSets.length} child sets on Inserts.cfm for Set ID ${parent.setId}`;
        Log(countLogMsg, 'info');

        // Generate parent base row
        const fullNameBase = buildFullSetName(year, parent.setName, '');
        const fullNameTruncBase = buildFullSetNameTrunc(year, parent.setName, '');
        csvRows.push([sport, year, parent.category, parent.setId, parent.setName, '', '', '', '', fullNameBase, fullNameTruncBase]);

        // Generate child rows
        childSets.forEach((child, j) => {
          const childLogMsg = `Processing Child Set [${j + 1}/${childSets.length}]: ${child.childSetName} (ID: ${child.childSetId})`;
          Log(childLogMsg, 'debug', 'client');

          const fullNameChild = buildFullSetName(year, parent.setName, child.childSetName);
          const fullNameTruncChild = buildFullSetNameTrunc(year, parent.setName, child.childSetName);
          csvRows.push([sport, year, parent.category, parent.setId, parent.setName, child.childCategory, child.childSetId, child.childSetName, child.childSetNotes || '', fullNameChild, fullNameTruncChild]);
        });
      } catch (err) {
        if (err instanceof AbortedError) {
          if (csvRows.length > 1) {
            isPartial = true;
            break;
          }
        }
        throw err;
      }
    }

    const filename = `${year}_${sport}_SetHierarchy.csv`;
    CSV.download(CSV.toCSV(csvRows), filename);
    setStatus('Export Complete');
    progress.finish(`${parentSets.length} sets exported successfully.`, 'success');
  } catch (error) {
    if (isPartial || error instanceof AbortedError || controller.signal.aborted) {
      const filename = `${year}_${sport}_SetHierarchy.csv`;
      CSV.download(CSV.toCSV(csvRows), filename);
      setStatus('Export cancelled (partial delivered)');
      progress.finish(`Cancelled — ${csvRows.length - 1} records downloaded.`, 'warning');
    } else if (error instanceof BlockedError) {
      const parentId = parentSets[networkRequestsMade - 1]?.setId || '';
      const lastUrl = `/Inserts.cfm/sid/${parentId}/`;
      recordBlock(error.message, lastUrl);
      if (csvRows.length > 1) {
        const filename = `${year}_${sport}_SetHierarchy.csv`;
        CSV.download(CSV.toCSV(csvRows), filename);
        setStatus('Export blocked (partial delivered)');
        progress.finish(`Blocked — ${csvRows.length - 1} records downloaded.`, 'error');
      } else {
        progress.finish('Stopped — the site returned a challenge.', 'error');
        setStatus('Export blocked');
      }
    } else {
      Log(`Set Hierarchy Export Failed: ${error.message}`, 'error', 'client');
      progress.finish(`Failed: ${error.message}`, 'error');
      setStatus('Export Failed');
    }
  } finally {
    CurrentRun.controller = null;
    CurrentRun.onEnd?.();
  }
}

/**
 * Formats the full set name.
 *
 * @param {string} year
 * @param {string} setName
 * @param {string} childSetName
 * @returns {string}
 */
export function buildFullSetName(year, setName, childSetName) {
  if (childSetName) {
    return `${year} ${setName} - ${childSetName}`;
  }
  return `${year} ${setName}`;
}

/**
 * Formats the truncated full set name following exact character rules.
 *
 * @param {string} year
 * @param {string} setName
 * @param {string} childSetName
 * @returns {string}
 */
export function buildFullSetNameTrunc(year, setName, childSetName) {
  const pName = setName || '';
  const cName = childSetName || '';

  if (pName.length >= 31) {
    const truncatedParent = pName.slice(0, 32).trimEnd();
    return `${year} ${truncatedParent}`;
  }

  if (cName) {
    const combined = `${pName} - ${cName}`;
    if (combined.length >= 30) {
      const truncatedCombined = combined.slice(0, 30).trimEnd();
      return `${year} ${truncatedCombined}`;
    }
    return `${year} ${combined}`;
  }

  return `${year} ${pName}`;
}

/**
 * Resolves the sport name from the current document.
 *
 * @returns {string}
 */
export function resolveSportFromDocument() {
  const sportBreadcrumb = document.querySelector('ol.breadcrumb li a[href*="/sp/"]');
  if (sportBreadcrumb) {
    const match = sportBreadcrumb.getAttribute('href').match(/\/sp\/([^/]+)/i);
    if (match) return decodeURIComponent(match[1]);
    return sportBreadcrumb.textContent.trim();
  }
  const match = document.URL.match(/\/sp\/([^/]+)/i);
  if (match) return decodeURIComponent(match[1]);
  return 'Misc';
}

/**
 * Resolves the year from the current document or set name.
 *
 * @param {string} setName
 * @returns {string}
 */
export function resolveYearFromDocument(setName) {
  const match = document.URL.match(/\/year\/([^/]+)/i);
  if (match) return decodeURIComponent(match[1]);
  const docTitle = document.title || '';
  const yearMatch = docTitle.match(/\b(18|19|20)\d{2}\b/) || setName.match(/\b(18|19|20)\d{2}\b/);
  if (yearMatch) return yearMatch[0];
  return 'Misc';
}

/**
 * Strips the year prefix from a set name.
 *
 * @param {string} setName
 * @param {string} year
 * @returns {string}
 */
export function stripYearPrefix(setName, year) {
  if (!setName || !year) return setName;
  const yearRegex = new RegExp(`^${year}\\s+`);
  return setName.replace(yearRegex, '').trim();
}

/**
 * Queue a single parent set hierarchy export.
 *
 * @param {string} setId
 * @param {string} setName
 * @param {object} [options]
 */
export function exportSingleParentSetHierarchy(setId, setName, options = {}) {
  const sport = options.sport || resolveSportFromDocument();
  const year = options.year || resolveYearFromDocument(setName);
  const cleanSetName = stripYearPrefix(setName, year);
  const category = options.category || 'Major Releases';
  const hasHideDiv = options.hasHideDiv !== undefined ? options.hasHideDiv : true;

  Log(`[CLIENT] Single Set Hierarchy CSV Export queued for Set ID: ${setId} (${cleanSetName})`, 'debug', 'client');
  ExportQueue.enqueue(`Set Hierarchy Export: ${cleanSetName}`, () =>
    runExportSingleParentSetHierarchy(setId, cleanSetName, { sport, year, category, hasHideDiv })
  );
}

/**
 * Performs a single parent set hierarchy export run.
 *
 * @param {string} setId
 * @param {string} setName
 * @param {object} params
 */
export async function runExportSingleParentSetHierarchy(setId, setName, { sport, year, category, hasHideDiv }) {
  const remainingMin = cooldownRemainingMinutes();
  if (remainingMin > 0) {
    Log(`Export refused: anti-scraping cooldown active (${remainingMin} min remaining).`, 'warn', 'client');
    setStatus('Export blocked (cooldown)');
    showToast({
      message: `Export paused — an anti-scraping block was detected recently. Try again in ~${remainingMin} min.`,
      variant: 'error'
    });
    return;
  }

  const controller = new AbortController();
  CurrentRun.controller = controller;
  CurrentRun.onStart?.();

  const progress = showProgressToast({
    title: 'Exporting Set Hierarchy',
    onCancel: () => {
      controller.abort();
    }
  });

  const csvRows = [
    ['Sport', 'Year', 'Set Category', 'Set ID', 'Set Name', 'Child Set Category', 'Child Set ID', 'Child Set Name', 'Child Set Notes', 'Full Set Name', 'Full Set Name (Trunc)']
  ];

  try {
    setStatus(`Processing ${setName}...`);
    progress.update(`Exporting ${setName}`);

    if (hasHideDiv === false) {
      const fullName = buildFullSetName(year, setName, '');
      const fullNameTrunc = buildFullSetNameTrunc(year, setName, '');
      csvRows.push([sport, year, category, setId, setName, '', '', '', '', fullName, fullNameTrunc]);
    } else {
      const fetchUrl = `/Inserts.cfm/sid/${setId}/`;
      const fullFetchUrl = Utils.toFullUrl(fetchUrl);
      Log(`HTTP GET Request -> ${fullFetchUrl}`, 'info', 'server');

      const response = await fetchPageWithRetry(fetchUrl, 1, { onStatus: setStatus, signal: controller.signal });
      const html = await response.text();

      const blockMarker = detectBlock(html);
      if (blockMarker) {
        throw new BlockedError(`Challenge page received instead of content (matched '${blockMarker}').`);
      }

      const doc = new DOMParser().parseFromString(html, 'text/html');
      const childSets = parseChildSets(doc);

      Log(`Found ${childSets.length} child sets on Inserts.cfm for Set ID ${setId}`, 'info');

      // Parent base row
      const fullNameBase = buildFullSetName(year, setName, '');
      const fullNameTruncBase = buildFullSetNameTrunc(year, setName, '');
      csvRows.push([sport, year, category, setId, setName, '', '', '', '', fullNameBase, fullNameTruncBase]);

      // Child rows
      childSets.forEach((child) => {
        const fullNameChild = buildFullSetName(year, setName, child.childSetName);
        const fullNameTruncChild = buildFullSetNameTrunc(year, setName, child.childSetName);
        csvRows.push([sport, year, category, setId, setName, child.childCategory, child.childSetId, child.childSetName, child.childSetNotes || '', fullNameChild, fullNameTruncChild]);
      });
    }

    const setNameNoSpaces = setName.replace(/\s+/g, '');
    const filename = `${year}_${sport}_${setNameNoSpaces}_SetHierarchy.csv`;
    CSV.download(CSV.toCSV(csvRows), filename);
    setStatus('Export Complete');
    progress.finish(`Exported ${setName} successfully.`, 'success');

  } catch (error) {
    if (error instanceof AbortedError || controller.signal.aborted) {
      const setNameNoSpaces = setName.replace(/\s+/g, '');
      const filename = `${year}_${sport}_${setNameNoSpaces}_SetHierarchy.csv`;
      CSV.download(CSV.toCSV(csvRows), filename);
      setStatus('Export cancelled (partial delivered)');
      progress.finish('Cancelled — partial downloaded.', 'warning');
    } else if (error instanceof BlockedError) {
      const lastUrl = `/Inserts.cfm/sid/${setId}/`;
      recordBlock(error.message, lastUrl);
      if (csvRows.length > 1) {
        const setNameNoSpaces = setName.replace(/\s+/g, '');
        const filename = `${year}_${sport}_${setNameNoSpaces}_SetHierarchy.csv`;
        CSV.download(CSV.toCSV(csvRows), filename);
        setStatus('Export blocked (partial delivered)');
        progress.finish('Blocked — partial downloaded.', 'error');
      } else {
        progress.finish('Stopped — the site returned a challenge.', 'error');
        setStatus('Export blocked');
      }
    } else {
      Log(`Set Hierarchy Export Failed: ${error.message}`, 'error', 'client');
      progress.finish(`Failed: ${error.message}`, 'error');
      setStatus('Export Failed');
    }
  } finally {
    CurrentRun.controller = null;
    CurrentRun.onEnd?.();
  }
}
