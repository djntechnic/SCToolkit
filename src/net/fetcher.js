/**
 * Paced, retrying page fetches.
 *
 * The pacing here is not a performance tuning knob — it is the mechanism by
 * which this script stays a well-behaved client. The floors are documented in
 * `docs/POLITE-USE.md`.
 *
 * Every request passes through, in order: the cross-tab slot gate, the
 * per-request timeout, block-status detection, throttle handling, and the
 * pacing recorder. There is no path to `fetch` that skips them.
 */

import { EXPORT_CONFIG } from '../core/config.js';
import { Log } from '../core/log.js';
import { Utils } from '../core/utils.js';
import { isBlockedStatus } from './blockDetect.js';
import { Pacing } from './pacing.js';
import { waitForSlot } from './throttle.js';

/** HTTP statuses that mean "slow down", as opposed to "something is wrong". */
export const THROTTLE_STATUSES = [429, 503];

/** Thrown when a run is cancelled or a request times out. */
export class AbortedError extends Error {
  /** @param {string} message @param {boolean} byUser */
  constructor(message, byUser) {
    super(message);
    this.name = 'AbortedError';
    this.byUser = byUser;
  }
}

/** Thrown when the server hands back a challenge or denial instead of content. */
export class BlockedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BlockedError';
  }
}

/** @param {number} ms */
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The delay between requests: configured base, plus any pacing penalty earned
 * this session, plus jitter so the timing is not a fixed, fingerprintable
 * interval.
 *
 * @returns {number} milliseconds
 */
export function currentDelayMs() {
  return EXPORT_CONFIG.baseDelayMs + Pacing.penaltyMs + Math.random() * EXPORT_CONFIG.jitterMaxMs;
}

/** Wait the current inter-request delay. */
export function jitteredDelay() {
  return sleep(currentDelayMs());
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
 * Sleep, but wake immediately if the run is cancelled.
 *
 * A 15-second backoff that ignores the cancel button is a cancel button that
 * does not work.
 *
 * @param {number} ms
 * @param {AbortSignal} [signal]
 */
export function interruptibleSleep(ms, signal) {
  if (!signal) return sleep(ms);
  if (signal.aborted) return Promise.resolve();

  return new Promise((resolve) => {
    const timer = setTimeout(finish, ms);
    function finish() {
      clearTimeout(timer);
      signal.removeEventListener('abort', finish);
      resolve();
    }
    signal.addEventListener('abort', finish, { once: true });
  });
}

/**
 * Issue one request with a timeout, honouring an external cancel signal.
 *
 * @param {string} url
 * @param {AbortSignal} [runSignal] cancels the whole export
 * @returns {Promise<Response>}
 */
async function timedFetch(url, runSignal) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort('timeout'), EXPORT_CONFIG.requestTimeoutMs);
  const forward = () => controller.abort('cancelled');

  if (runSignal) {
    if (runSignal.aborted) throw new AbortedError('Export cancelled.', true);
    runSignal.addEventListener('abort', forward, { once: true });
  }

  const startedAt = Date.now();
  try {
    return await fetch(url, { signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') {
      // A hung request used to stall the queue forever; it now fails cleanly.
      throw runSignal?.aborted
        ? new AbortedError('Export cancelled.', true)
        : new AbortedError(
          `Request timed out after ${Math.round(EXPORT_CONFIG.requestTimeoutMs / 1000)}s for ${Utils.toFullUrl(url)}.`, false
        );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    runSignal?.removeEventListener('abort', forward);
    Pacing.lastLatencyMs = Date.now() - startedAt;
  }
}

/**
 * Fetch one page, retrying transient network failures and honouring throttle
 * responses. Non-throttle HTTP errors are not retried — a 404 will not become a
 * 200 by asking again — and a block is never retried at all.
 *
 * @param {string} fetchUrl
 * @param {number} pageIndex used only for log and error text
 * @param {object} [options]
 * @param {(text: string) => void} [options.onStatus] surface a human-readable wait notice
 * @param {AbortSignal} [options.signal] cancels the run
 * @returns {Promise<Response>}
 * @throws {AbortedError|BlockedError|Error}
 */
export async function fetchPageWithRetry(fetchUrl, pageIndex, { onStatus = () => {}, signal } = {}) {
  const fullUrl = Utils.toFullUrl(fetchUrl);
  let attempt = 0;

  for (;;) {
    attempt++;
    if (signal?.aborted) throw new AbortedError('Export cancelled.', true);

    const slotWaitMs = EXPORT_CONFIG.baseDelayMs + Pacing.penaltyMs;
    Log(`Reserving request slot for ${Utils.formatLogUrl(fullUrl)} (base delay ${EXPORT_CONFIG.baseDelayMs}ms, pacing penalty ${Pacing.penaltyMs}ms)...`, 'debug', 'client');
    await waitForSlot(slotWaitMs);

    let response;
    try {
      response = await timedFetch(fullUrl, signal);
    } catch (error) {
      if (error instanceof AbortedError) throw error;

      if (attempt > EXPORT_CONFIG.maxRetries) {
        throw new Error(
          `Network error fetching page ${pageIndex} (${fullUrl}) after ${attempt - 1} retries: ${error.message}`
        );
      }
      const backoff = computeBackoff(attempt, EXPORT_CONFIG.backoffBaseMs, EXPORT_CONFIG.backoffCapMs);
      Log(`Network error on page ${pageIndex} (${fullUrl}) (attempt ${attempt}): ${error.message}. Retrying in ${backoff}ms.`, 'warn', 'server');
      await interruptibleSleep(backoff, signal);
      continue;
    }

    if (isBlockedStatus(response.status)) {
      Pacing.penalize();
      throw new BlockedError(`Server refused the request for ${fullUrl} (HTTP ${response.status}).`);
    }

    if (THROTTLE_STATUSES.includes(response.status)) {
      Pacing.record(Pacing.lastLatencyMs ?? 0, true);

      if (attempt > EXPORT_CONFIG.maxRetries) {
        throw new Error(
          `Server rate limit persisted on page ${pageIndex} (${fullUrl}) after ${attempt - 1} retries (HTTP ${response.status}).`
        );
      }
      let backoff = parseRetryAfter(response.headers.get('Retry-After'));
      if (backoff <= 0) {
        backoff = computeBackoff(attempt, EXPORT_CONFIG.backoffBaseMs, EXPORT_CONFIG.backoffCapMs);
      }
      Log(`HTTP ${response.status} rate limit on page ${pageIndex} (${fullUrl}) (attempt ${attempt}). Backing off ${backoff}ms.`, 'warn', 'server');
      onStatus(`Throttled — retrying in ${Math.round(backoff / 1000)}s...`);
      await interruptibleSleep(backoff, signal);
      continue;
    }

    if (!response.ok) {
      throw new Error(`Server returned status HTTP ${response.status} on page ${pageIndex} for ${fullUrl}`);
    }

    Pacing.record(Pacing.lastLatencyMs ?? 0, false);
    return response;
  }
}
