/**
 * Paced, retrying page fetches.
 *
 * The pacing here is not a performance tuning knob — it is the mechanism by
 * which this script stays a well-behaved client. The floors are documented in
 * `docs/POLITE-USE.md`.
 */

import { EXPORT_CONFIG } from '../core/config.js';
import { Log } from '../core/log.js';

/** HTTP statuses that mean "slow down", as opposed to "something is wrong". */
export const THROTTLE_STATUSES = [429, 503];

/** @param {number} ms */
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wait a base interval plus a random margin, so request timing is not a fixed,
 * fingerprintable cadence.
 *
 * @param {number} [baseMs]
 * @param {number} [jitterMaxMs]
 */
export function jitteredDelay(baseMs = EXPORT_CONFIG.baseDelayMs, jitterMaxMs = EXPORT_CONFIG.jitterMaxMs) {
  return sleep(baseMs + Math.random() * jitterMaxMs);
}

/**
 * Exponential backoff for the nth attempt, capped.
 *
 * @param {number} attempt 1-based
 * @param {number} baseMs
 * @param {number} capMs
 * @returns {number} milliseconds
 */
export function computeBackoff(attempt, baseMs, capMs) {
  return Math.min(baseMs * Math.pow(2, attempt - 1), capMs);
}

/**
 * Interpret a `Retry-After` header.
 *
 * The header comes in two forms and servers use both: delta-seconds
 * (`Retry-After: 120`) and an HTTP-date (`Retry-After: Wed, 21 Oct 2015
 * 07:28:00 GMT`). A date already in the past yields 0, which the caller treats
 * as "no usable value" and falls back to computed backoff.
 *
 * @param {string|null} header
 * @param {number} [now] epoch ms, injectable for tests
 * @returns {number} milliseconds to wait, 0 when the header is absent or unusable
 */
export function parseRetryAfter(header, now = Date.now()) {
  if (!header) return 0;
  const asSeconds = Number(header);
  if (!Number.isNaN(asSeconds)) {
    return asSeconds > 0 ? asSeconds * 1000 : 0;
  }
  const asDate = new Date(header).getTime();
  if (Number.isNaN(asDate)) return 0;
  return Math.max(0, asDate - now);
}

/**
 * Fetch one page, retrying transient network failures and honouring throttle
 * responses. Non-throttle HTTP errors are not retried — a 404 will not become a
 * 200 by asking again.
 *
 * @param {string} fetchUrl
 * @param {number} pageIndex used only for log and error text
 * @param {(text: string) => void} [onStatus] surface a human-readable wait notice
 * @returns {Promise<Response>}
 * @throws {Error} when retries are exhausted or the response is a hard failure
 */
export async function fetchPageWithRetry(fetchUrl, pageIndex, onStatus = () => {}) {
  let attempt = 0;

  for (;;) {
    attempt++;
    let response;

    try {
      response = await fetch(fetchUrl);
    } catch (networkError) {
      if (attempt > EXPORT_CONFIG.maxRetries) {
        throw new Error(
          `Network error fetching page ${pageIndex} after ${attempt - 1} retries: ${networkError.message}`
        );
      }
      const backoff = computeBackoff(attempt, EXPORT_CONFIG.backoffBaseMs, EXPORT_CONFIG.backoffCapMs);
      Log(`Network error on page ${pageIndex} (attempt ${attempt}). Retrying in ${backoff}ms.`, 'warn', 'server');
      await sleep(backoff);
      continue;
    }

    if (THROTTLE_STATUSES.includes(response.status)) {
      if (attempt > EXPORT_CONFIG.maxRetries) {
        throw new Error(
          `Server rate limit persisted on page ${pageIndex} after ${attempt - 1} retries (HTTP ${response.status}).`
        );
      }
      let backoff = parseRetryAfter(response.headers.get('Retry-After'));
      if (backoff <= 0) {
        backoff = computeBackoff(attempt, EXPORT_CONFIG.backoffBaseMs, EXPORT_CONFIG.backoffCapMs);
      }
      Log(`HTTP ${response.status} on page ${pageIndex} (attempt ${attempt}). Backing off ${backoff}ms.`, 'warn', 'server');
      onStatus(`Throttled — retrying in ${Math.round(backoff / 1000)}s...`);
      await sleep(backoff);
      continue;
    }

    if (!response.ok) {
      throw new Error(`Server returned status HTTP ${response.status} on page ${pageIndex}`);
    }

    return response;
  }
}
