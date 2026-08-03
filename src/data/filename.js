/**
 * Export filename construction.
 *
 * v2.42.0 sanitized name segments three different ways in three places. All
 * three are preserved here verbatim, as separate named functions, so the
 * inconsistency is visible rather than buried — see `docs/REMOVED.md` for the
 * note on unifying them.
 */

/**
 * Collapse each run of non-alphanumerics to a single underscore, then trim
 * leading and trailing underscores. Used for the base set name.
 *
 * @param {string} str
 * @returns {string}
 */
export function sanitizeSegment(str) {
  return String(str || '').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
}

/**
 * Strip every non-alphanumeric character outright, producing a single run-on
 * token. Used for the sub-set name, where `2023 Chrome Refractors` becomes
 * `2023ChromeRefractors`.
 *
 * @param {string} str
 * @returns {string}
 */
export function compactSegment(str) {
  return String(str || '').replace(/[^a-z0-9]/gi, '');
}

/**
 * Replace each non-alphanumeric character with its own underscore, so runs are
 * *not* collapsed. Used for player names in the raw-table export.
 *
 * @param {string} str
 * @returns {string}
 */
export function underscoreSegment(str) {
  return String(str || '').replace(/[^a-z0-9]/gi, '_');
}

/** Filename suffixes by the kind of listing that was exported. */
export const EXPORT_KIND_SUFFIX = {
  checklist: '_Checklist',
  forSale: '_ForSale',
  wantlist: '_Wantlist',
  addMultiples: '_AddMultiples'
};

import { Utils } from '../core/utils.js';

/**
 * Build the download filename for a set export.
 *
 * When the fetched page yields no year, the year is recovered from a leading
 * four-digit run in the caller-supplied label (a pinned set's stored name, for
 * instance). If that also fails the year segment is omitted entirely rather
 * than emitting a stray leading underscore.
 *
 * @param {object} parts
 * @param {string} [parts.year] four-digit year parsed from the fetched page
 * @param {string} [parts.baseSet] parsed base set name
 * @param {string} [parts.setName] parsed sub-set name
 * @param {string} [parts.fallbackLabel] label to mine for a year if `year` is empty
 * @param {keyof EXPORT_KIND_SUFFIX} [parts.kind]
 * @returns {string} filename including the `.csv` extension
 */
export function buildExportFilename({
  year = '',
  baseSet = '',
  setName = '',
  fallbackLabel = '',
  kind = 'checklist'
} = {}) {
  const cleanYear = year || Utils.extractYear(fallbackLabel) || '';
  const cleanBaseSet = sanitizeSegment(baseSet);
  const cleanSubSet = setName ? `_${compactSegment(setName)}` : '';
  const suffix = EXPORT_KIND_SUFFIX[kind] ?? EXPORT_KIND_SUFFIX.checklist;

  return cleanYear
    ? `${cleanYear}_${cleanBaseSet}${cleanSubSet}${suffix}.csv`
    : `${cleanBaseSet}${cleanSubSet}${suffix}.csv`;
}
