/**
 * Async gate that defers enabling the raw-table export buttons on paginated
 * pages.
 *
 * Inspects `.pagination` DOM readiness via dynamic polling before resolving,
 * falling back to `paginationLoaderDelayMs` as a fallback ceiling.
 */

import { Config } from '../core/config.js';
import { Routes } from '../core/routes.js';
import { setStatus } from '../ui/status.js';

/**
 * @param {Document|HTMLElement} [root]
 * @returns {Promise<void>}
 */
export function initPaginationLoader(root = document) {
  if (!Routes.hasPagination(root)) return Promise.resolve();
  setStatus('Loading Pagination...');

  const delayMs = Config.global.paginationLoaderDelayMs || 1000;
  const pollIntervalMs = 50;

  return new Promise((resolve) => {
    // If .pagination is already ready in the DOM, resolve immediately
    if (root.querySelector('.pagination')) {
      resolve();
      return;
    }

    const startTime = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      if (root.querySelector('.pagination') || elapsed >= delayMs) {
        clearInterval(timer);
        resolve();
      }
    }, pollIntervalMs);
  });
}
