/**
 * Adaptive pacing.
 *
 * Fixed delays are polite until the site is having a bad day, at which point
 * they are exactly as impolite as before. This adds a session-scoped penalty on
 * top of the configured base delay: it grows when the site signals strain, and
 * decays only after sustained success.
 *
 * Additive-increase / multiplicative-decrease, in the direction that matters —
 * the penalty rises fast and falls slowly, so a struggling server gets relief
 * immediately and has to actually recover before pressure returns.
 *
 * The penalty is per-session and per-tab. It is never persisted: a stale
 * penalty from yesterday would be guesswork, and the cross-tab throttle already
 * covers the shared case.
 */

/** Added on the first strain signal, and again on each subsequent one. */
export const PENALTY_STEP_MS = 500;

/** Ceiling on the accumulated penalty. */
export const PENALTY_CAP_MS = 8000;

/** Removed per successful, unremarkable response. */
export const RELIEF_STEP_MS = 100;

/** Latency samples kept for the rolling median. */
export const SAMPLE_WINDOW = 10;

/**
 * A response slower than this is treated as strain. Chosen well above a normal
 * page load so ordinary variance does not ratchet the penalty upward.
 */
export const SLOW_RESPONSE_MS = 4000;

/**
 * Median of a list of numbers. Even-length lists take the mean of the middle
 * pair.
 *
 * @param {number[]} values
 * @returns {number} 0 for an empty list
 */
export function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * The penalty after one observation.
 *
 * @param {number} current current penalty in ms
 * @param {'throttled'|'slow'|'ok'} signal
 * @returns {number} the new penalty, clamped to [0, PENALTY_CAP_MS]
 */
export function nextPenalty(current, signal) {
  if (signal === 'throttled' || signal === 'slow') {
    return Math.min(current + PENALTY_STEP_MS, PENALTY_CAP_MS);
  }
  return Math.max(current - RELIEF_STEP_MS, 0);
}

/**
 * Session pacing state.
 *
 * `reset()` exists for tests and for the start of a fresh export run; a penalty
 * earned an hour ago should not silently govern a new one.
 */
export const Pacing = {
  penaltyMs: 0,
  /** Latency of the most recent response in ms. */
  lastLatencyMs: 0,
  /** @type {number[]} */
  samples: [],

  reset() {
    // Reset accumulated penalty, last response latency, and sample history
    Pacing.penaltyMs = 0;
    Pacing.lastLatencyMs = 0;
    Pacing.samples = [];
  },

  /**
   * Record a completed response.
   *
   * @param {number} latencyMs
   * @param {boolean} [throttled] true when the response was an HTTP 429/503
   */
  record(latencyMs, throttled = false) {
    // Store latest response latency state
    Pacing.lastLatencyMs = latencyMs;
    Pacing.samples.push(latencyMs);
    if (Pacing.samples.length > SAMPLE_WINDOW) Pacing.samples.shift();

    const signal = throttled
      ? 'throttled'
      : (median(Pacing.samples) > SLOW_RESPONSE_MS ? 'slow' : 'ok');

    Pacing.penaltyMs = nextPenalty(Pacing.penaltyMs, signal);
    return signal;
  },

  /** Raise the penalty without a latency sample, for a signal that is not a response. */
  penalize() {
    Pacing.penaltyMs = nextPenalty(Pacing.penaltyMs, 'throttled');
  },

  /** @returns {number} rolling median latency in ms */
  medianLatencyMs: () => median(Pacing.samples),

  /**
   * Human-readable pacing state for the status readout, so a slowdown is
   * visible rather than mysterious.
   *
   * @returns {string} empty when pacing is nominal
   */
  describe: () => (Pacing.penaltyMs > 0 ? ` (pacing +${Pacing.penaltyMs}ms)` : '')
};
