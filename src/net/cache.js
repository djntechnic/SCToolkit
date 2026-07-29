/**
 * Parsed-export cache.
 *
 * Re-exporting a set used to refetch every page of it. Since a checklist
 * changes rarely and an export is often repeated within minutes — a wrong
 * filter, a spreadsheet mishap, a second look — caching parsed results is the
 * single largest reduction in total traffic available.
 *
 * Only the *parsed* result is stored: identity, page count, and plain row
 * objects. Raw HTML is never persisted.
 */

import { Log } from '../core/log.js';
import { getValue, setValue } from '../core/storage.js';

export const CACHE_KEY = 'tk_export_cache_v1';

/** Most sets retained. Oldest are evicted first. */
export const MAX_ENTRIES = 20;

/**
 * Largest result that will be cached.
 *
 * Userscript storage is not a database. A runaway set would otherwise write
 * megabytes on every export, and the cost of refetching a set this large is
 * better than the cost of storing every such set forever.
 */
export const MAX_ROWS = 20000;

/** @returns {Record<string, {ts: number, payload: object}>} */
function readAll() {
  const raw = getValue(CACHE_KEY, {});
  return (raw && typeof raw === 'object') ? raw : {};
}

/**
 * Drop entries older than the TTL, then evict oldest until within MAX_ENTRIES.
 *
 * @param {Record<string, {ts: number}>} entries
 * @param {number} ttlMs
 * @param {number} now
 * @returns {Record<string, {ts: number}>} a new object; the input is untouched
 */
export function prune(entries, ttlMs, now) {
  const live = Object.entries(entries)
    .filter(([, entry]) => entry && typeof entry.ts === 'number' && now - entry.ts < ttlMs)
    .sort(([, a], [, b]) => b.ts - a.ts)
    .slice(0, MAX_ENTRIES);

  return Object.fromEntries(live);
}

/** @param {number} ttlHours @returns {number} */
const ttlMs = (ttlHours) => ttlHours * 3600000;

/**
 * Look up a cached export.
 *
 * @param {string} sid
 * @param {number} ttlHours 0 disables the cache entirely
 * @param {number} [now]
 * @returns {{identity: object, rows: Array<object>, totalPages: number}|null}
 */
export function read(sid, ttlHours, now = Date.now()) {
  if (ttlHours <= 0) return null;

  const entry = readAll()[sid];
  if (!entry || typeof entry.ts !== 'number') return null;
  if (now - entry.ts >= ttlMs(ttlHours)) return null;

  return entry.payload;
}

/**
 * Store an export result, pruning the cache in the same write.
 *
 * @param {string} sid
 * @param {{identity: object, rows: Array<object>, totalPages: number}} payload
 * @param {number} ttlHours
 * @param {number} [now]
 * @returns {boolean} whether it was stored
 */
export function write(sid, payload, ttlHours, now = Date.now()) {
  if (ttlHours <= 0) return false;

  if (payload.rows.length > MAX_ROWS) {
    Log(`Export of ${payload.rows.length} rows exceeds the cache limit (${MAX_ROWS}) — not cached.`, 'debug');
    return false;
  }

  const entries = prune(readAll(), ttlMs(ttlHours), now);
  entries[sid] = { ts: now, payload };
  setValue(CACHE_KEY, prune(entries, ttlMs(ttlHours), now));
  return true;
}

/**
 * Describe cache occupancy, for the settings pane.
 *
 * @param {number} ttlHours
 * @param {number} [now]
 * @returns {{sets: number, rows: number}}
 */
export function stats(ttlHours, now = Date.now()) {
  const entries = ttlHours > 0 ? prune(readAll(), ttlMs(ttlHours), now) : {};
  const values = Object.values(entries);
  return {
    sets: values.length,
    rows: values.reduce((total, e) => total + (e.payload?.rows?.length ?? 0), 0)
  };
}

/** Empty the cache. */
export function clear() {
  setValue(CACHE_KEY, {});
  Log('Export cache cleared.', 'info');
}
