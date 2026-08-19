/**
 * Thin wrappers over the userscript-manager storage API.
 *
 * Everything that persists goes through here so that (a) the `GM_*` globals are
 * referenced in exactly one place, and (b) modules stay importable under
 * `node --test`, where those globals do not exist.
 */

import { Log } from './log.js';
import { Utils } from './utils.js';

/**
 * @param {string} key
 * @param {*} fallback returned when the key is absent or storage is unavailable
 * @returns {*}
 */
export function getValue(key, fallback) {
  if (typeof GM_getValue !== 'function') return fallback;
  try {
    return GM_getValue(key, fallback);
  } catch (error) {
    Log(`Storage read failed for '${key}': ${error.message}`, 'warn');
    return fallback;
  }
}

/**
 * @param {string} key
 * @param {*} value
 */
export function setValue(key, value) {
  if (typeof GM_setValue !== 'function') return;
  try {
    GM_setValue(key, value);
  } catch (error) {
    Log(`Storage write failed for '${key}': ${error.message}`, 'warn');
  }
}

/** Timestamp (ms) of the last detected anti-scraping block. */
export const BLOCK_TS_KEY = 'tk_last_block_ts';

/** Persisted list of pinned sets: `{ id, name, url, year }`. */
export const PINNED_SETS_KEY = 'tk_pinned_sets';

/**
 * Pinned-set accessors. Four call sites in v2.42.0 read and wrote
 * `tk_pinned_sets` directly; they all route through here now.
 */
export const Pins = {
  /**
   * All stored pins in their persisted order.
   *
   * The `enabled` field is optional — pins created before this field was added
   * have no `enabled` key, which is treated the same as `enabled: true`.
   *
   * @returns {Array<{id: string, name: string, url: string, year: string, enabled?: boolean}>}
   */
  all: () => getValue(PINNED_SETS_KEY, []),

  /**
   * Sort an array of pins (or the persisted list) by Year (newest first),
   * then by Set Name (alphabetical A-Z).
   *
   * @param {Array<{id: string, name: string, url: string, year: string, enabled?: boolean}>} [pins]
   * @returns {Array<{id: string, name: string, url: string, year: string, enabled?: boolean}>}
   */
  sort: (pins) => {
    const list = pins || Pins.all();
    list.sort((a, b) => {
      const yearA = (a.year && SET_YEAR_REGEX.test(a.year)) ? a.year : (Utils.extractYear(a.name, a.url) || 'Misc');
      const yearB = (b.year && SET_YEAR_REGEX.test(b.year)) ? b.year : (Utils.extractYear(b.name, b.url) || 'Misc');

      if (yearA !== yearB) {
        if (yearA === 'Misc') return 1;
        if (yearB === 'Misc') return -1;
        const numA = parseInt(yearA, 10);
        const numB = parseInt(yearB, 10);
        if (!isNaN(numA) && !isNaN(numB)) {
          return numA - numB;
        }
        return yearA.localeCompare(yearB);
      }

      const nameA = (a.name || '').trim();
      const nameB = (b.name || '').trim();
      return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
    });
    return list;
  },

  /** @param {{id: string, name: string, url: string, year: string}} pin */
  add: (pin) => {
    const pins = Pins.all();
    if (pins.find((p) => p.id === pin.id)) return false;
    pins.push(pin);
    Pins.sort(pins);
    setValue(PINNED_SETS_KEY, pins);
    return true;
  },

  /** @param {string} id */
  remove: (id) => {
    setValue(PINNED_SETS_KEY, Pins.all().filter((p) => p.id !== id));
  }
};

/** Four-digit year regex pattern matching years at the start of a string. */
export const SET_YEAR_REGEX = /^(\d{4})/;

/**
 * Extract a four-digit set year from a text string or title.
 *
 * @param {string} str
 * @returns {string|null} four-digit year string, or null if no year is found
 */
export function extractSetYear(str) {
  return Utils.extractYear(str);
}

/**
 * Derive the display year for a pinned set.
 *
 * v2.42.0 had two divergent implementations of this: the pin-creation path
 * looked at the href first, the pin-rendering path only ever looked at the
 * name. Both are folded in here, href first, so a pin's group cannot change
 * between being created and being rendered.
 *
 * @param {string} name set title, e.g. `2023 Topps Chrome`
 * @param {string} [href] set URL, which may carry the year after the SID
 * @returns {string} a four-digit year, or `'Misc'`
 */
export function deriveSetYear(name, href = '') {
  return Utils.extractYear(name, href) || 'Misc';
}
