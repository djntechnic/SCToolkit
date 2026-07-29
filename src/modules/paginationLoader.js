/**
 * Async gate that defers enabling the raw-table export buttons on paginated
 * pages.
 *
 * This is a fixed timer, not a completion signal — there is no event that
 * marks "pagination has settled". It is a timing guess, made configurable so
 * that at least it is an honest one.
 */

import { Config } from '../core/config.js';
import { Routes } from '../core/routes.js';
import { setStatus } from '../ui/status.js';

/** @returns {Promise<void>} */
export function initPaginationLoader() {
  if (!Routes.hasPagination()) return Promise.resolve();
  setStatus('Loading Pagination...');
  return new Promise((resolve) => {
    setTimeout(resolve, Config.global.paginationLoaderDelayMs);
  });
}
