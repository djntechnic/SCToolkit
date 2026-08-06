/**
 * Async gate that defers enabling the raw-table export buttons on paginated
 * pages.
 *
 * Inspects `.pagination` DOM readiness via dynamic polling before resolving,
 * falling back to `paginationLoaderDelayMs` as a fallback ceiling.
 */

import { Config, EXPORT_CONFIG } from '../core/config.js';
import { Log } from '../core/log.js';
import { Routes } from '../core/routes.js';
import { Utils } from '../core/utils.js';
import { fetchPageWithRetry, jitteredDelay } from '../net/fetcher.js';
import { Pacing } from '../net/pacing.js';
import { setStatus } from '../ui/status.js';

/**
 * Intercept pagination and filter forms using POST and convert submission to GET navigation.
 * Also updates form methods to 'get' to prevent browser "Confirm Form Resubmission" prompts on refresh.
 *
 * @param {Document|HTMLElement} [root=document]
 */
export function normalizePaginationForms(root = document) {
  if (typeof root.querySelectorAll !== 'function') return;

  const forms = root.querySelectorAll('form');
  forms.forEach((form) => {
    const hasPaginationInput = form.querySelector(
      'input[name*="PageIndex" i], select[name*="Filter" i], input[name="Submit"][validate="submitonce" i]'
    );
    if (!hasPaginationInput) return;

    // Remove legacy inline onsubmit validation that forces POST behavior
    form.removeAttribute('onsubmit');
    form.onsubmit = null;

    // Convert query parameters in form's action attribute into hidden input fields
    // so standard HTML GET submission won't strip route parameters like Member, CollectionID, etc.
    const rawAction = form.getAttribute('action') || '';
    if (rawAction) {
      try {
        const baseOrigin = typeof window !== 'undefined' ? window.location.href : 'http://localhost';
        const actionUrl = new URL(rawAction, baseOrigin);

        actionUrl.searchParams.forEach((val, key) => {
          const existing = form.querySelector(`[name="${key}"]`);
          if (!existing && form.ownerDocument) {
            const hidden = form.ownerDocument.createElement('input');
            hidden.type = 'hidden';
            hidden.name = key;
            hidden.value = val;
            form.appendChild(hidden);
          }
        });

        actionUrl.search = '';
        form.setAttribute('action', actionUrl.toString());
      } catch {
        // Ignore URL parsing errors
      }
    }

    form.setAttribute('method', 'get');

    if (form.dataset?.sctkNormalized) return;
    if (form.dataset) form.dataset.sctkNormalized = 'true';

    form.addEventListener('submit', (e) => {
      try {
        const actionAttr = form.getAttribute('action') || (typeof window !== 'undefined' ? window.location.href : '');
        if (!actionAttr) return;

        const baseOrigin = typeof window !== 'undefined' ? window.location.href : 'http://localhost';
        const targetUrl = new URL(actionAttr, baseOrigin);
        const inputs = form.querySelectorAll('input[name], select[name], textarea[name]');
        inputs.forEach((el) => {
          if (el.disabled) return;
          if ((el.type === 'checkbox' || el.type === 'radio') && !el.checked) return;
          if (el.type === 'submit' || el.type === 'button') return;
          const val = el.value;
          if (val !== undefined && val !== null) {
            targetUrl.searchParams.set(el.name, String(val).trim());
          }
        });

        e.preventDefault();
        if (typeof window !== 'undefined') {
          window.location.href = targetUrl.toString();
        }
      } catch {
        // Fallback to standard submit
      }
    });
  });
}

export function initPaginationLoader(root = document) {
  if (!Routes.hasPagination(root)) return Promise.resolve();
  setStatus('Loading Pagination...');

  normalizePaginationForms(root);

  const delayMs = Config.global.paginationLoaderDelayMs || 1000;
  const pollIntervalMs = 50;

  return new Promise((resolve) => {
    const startTime = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      if (root.querySelector('.pagination') || elapsed >= delayMs) {
        clearInterval(timer);
        
        const getMainTable = (context) => {
          const tables = Array.from(context.querySelectorAll('table'));
          if (!tables.length) return null;
          return tables.reduce((largest, current) => current.rows.length > largest.rows.length ? current : largest);
        };

        const targetTable = getMainTable(root);
        if (!targetTable) {
          Log('[PaginationLoader] No target table found. Resolving immediately.', 'debug', 'client');
          return resolve();
        }
        
        const targetBody = targetTable.querySelector('tbody') || targetTable;

        let maxPage = 1;
        const currentUrl = new URL(window.location.href);
        const currentPageIndex = parseInt(currentUrl.searchParams.get('PageIndex') || currentUrl.searchParams.get('page')) || 1;

        root.querySelectorAll('a[href*="PageIndex=" i], a[href*="page=" i]').forEach(link => {
          try {
            const url = new URL(link.getAttribute('href'), window.location.href);
            const page = parseInt(url.searchParams.get('PageIndex') || url.searchParams.get('page'));
            if (page && page > maxPage) maxPage = page;
          } catch (e) {
            // Ignore parse errors
          }
        });

        Log(`[PaginationLoader] Detected currentPage: ${currentPageIndex}, maxPage: ${maxPage}`, 'info', 'client');

        if (maxPage <= currentPageIndex) {
          Log('[PaginationLoader] No subsequent pages to load.', 'info', 'client');
          return resolve();
        }

        const targetMaxPage = Math.min(maxPage, EXPORT_CONFIG.maxPages || 200);
        if (targetMaxPage < maxPage) {
          Log(
            `[PaginationLoader] Discovered maxPage (${maxPage}) exceeds safety ceiling (${targetMaxPage}). Capping auto-fetch to ${targetMaxPage}.`,
            'warn',
            'client'
          );
        }

        const urlsToFetch = [];
        for (let i = currentPageIndex + 1; i <= targetMaxPage; i++) {
          const nextUrl = new URL(window.location.href);
          nextUrl.searchParams.set('PageIndex', i);
          urlsToFetch.push({ pageIndex: i, href: nextUrl.href });
        }

        // Remove pagination elements so they don't appear in the middle/end of the auto-loaded list
        root.querySelectorAll('ul.pagination, .pagination, [class*="pagination"]').forEach(el => el.remove());
        root.querySelectorAll('form').forEach(form => {
          if (form.querySelector('input[name*="PageIndex" i]')) form.remove();
        });

        const throttleThreshold = Config.global.paginationThrottleStartPage ?? 6;
        (async () => {
          for (let i = 0; i < urlsToFetch.length; i++) {
            const item = urlsToFetch[i];
            const pageNum = item.pageIndex;
            const nextUrl = item.href;
            const shortUrl = Utils.formatLogUrl(nextUrl);
            const throttleThreshold = Math.max(1, Config.global.paginationThrottleStartPage || 6);
            const shouldThrottle = pageNum >= throttleThreshold;
            if (shouldThrottle) {
              const pacedMs = Math.round(EXPORT_CONFIG.baseDelayMs + (Pacing.penaltyMs || 0) + Math.random() * EXPORT_CONFIG.jitterMaxMs);
              Log(`[PaginationLoader] Page ${pageNum}/${targetMaxPage} reached threshold (${throttleThreshold}+). Applying pacing delay (~${pacedMs}ms)...`, 'debug', 'client');
              await jitteredDelay();
            }

            Log(`HTTP GET Request -> ${shortUrl}`, 'info', 'server');
            setStatus(`Loading Page ${pageNum} of ${targetMaxPage}...`);

            try {
              const response = await fetchPageWithRetry(nextUrl, pageNum, { onStatus: setStatus });
              const html = await response.text();

              Log(`HTTP ${response.status} response received for ${shortUrl} (${Math.round(html.length / 1024)} KB)`, 'debug', 'client');

              const parser = new DOMParser();
              const doc = parser.parseFromString(html, 'text/html');
              const incomingTable = getMainTable(doc);

              if (incomingTable) {
                const incomingRows = incomingTable.querySelectorAll('tr');
                let rowsAdded = 0;
                incomingRows.forEach(row => {
                  const rowText = row.textContent.trim();
                  // Exclude header rows, structural links, empty formatting rows, and redundant "Quantity" headers
                  if (
                    !row.querySelector('th') &&
                    !row.querySelector('.pagination') &&
                    rowText.length > 0 &&
                    rowText !== 'Quantity'
                  ) {
                    targetBody.appendChild(row.cloneNode(true));
                    rowsAdded++;
                  }
                });
                Log(`[PaginationLoader] Appended ${rowsAdded} rows from page ${pageNum}/${targetMaxPage}`, 'info', 'client');
              } else {
                Log(`[PaginationLoader] No main table found on page ${pageNum}/${targetMaxPage}`, 'warn', 'client');
              }
            } catch (err) {
              Log(`Network error fetching page ${pageNum} (${shortUrl}): ${err.message}`, 'error', 'server');
            }
          }

          Log('[PaginationLoader] All pages loaded successfully.', 'info', 'client');
          resolve();
        })();
      }
    }, pollIntervalMs);
  });
}


