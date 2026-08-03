/**
 * Cross-tab request throttling.
 *
 * The export queue serializes requests *within* a tab. Two tabs exporting at
 * once were two independent queues, so opening a second tab doubled the request
 * rate against the site — the single largest gap between what
 * `docs/POLITE-USE.md` promised and what the code did.
 *
 * Userscript storage is shared across every tab of the same script, so a single
 * "when did anyone last make a request" timestamp is enough to interleave them.
 */

import { getValue, setValue } from '../core/storage.js';

/** Shared across all tabs: epoch ms of the last request any tab issued. */
export const LAST_REQUEST_KEY = 'tk_last_request_ts';

/**
 * Longest single sleep before re-reading the shared timestamp.
 *
 * Sleeping the whole remaining interval in one go would miss another tab
 * claiming the slot while we wait, so the wait is sliced and re-evaluated.
 */
const MAX_SLICE_MS = 250;

/**
 * How long to wait before a request may be issued.
 *
 * A clock that has gone backwards — a system time change, or a timestamp
 * written by a tab on a differently-set machine — yields a full interval rather
 * than a nonsensical wait of hours.
 *
 * @param {number} lastTs epoch ms of the last request, 0 if none
 * @param {number} intervalMs minimum spacing between requests
 * @param {number} now epoch ms
 * @returns {number} milliseconds to wait, 0 when a request may go now
 */
export function computeSlotWait(lastTs, intervalMs, now) {
  if (!lastTs || lastTs > now) return lastTs > now ? intervalMs : 0;
  const elapsed = now - lastTs;
  return elapsed >= intervalMs ? 0 : intervalMs - elapsed;
}

/**
 * Block until this tab may issue a request, then claim the slot.
 *
 * The slot is claimed by writing the timestamp *before* returning, which is
 * what stops two tabs that woke together from both firing. The claim is not
 * atomic — userscript storage offers no compare-and-swap — so a collision is
 * possible in the window between read and write. It is microseconds wide
 * against an interval of hundreds of milliseconds, and the failure mode is one
 * pair of requests closer together than intended, not a thundering herd.
 *
 * @param {number} intervalMs
 * @param {object} [deps] injectable for tests
 * @returns {Promise<number>} total milliseconds waited
 */
export async function waitForSlot(intervalMs, deps = {}) {
  const {
    now = () => Date.now(),
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    read = () => getValue(LAST_REQUEST_KEY, 0),
    write = (ts) => setValue(LAST_REQUEST_KEY, ts),
    jitter = deps.jitter ?? (deps.now || deps.sleep ? () => 0 : () => Math.floor(20 + Math.random() * 60))
  } = deps;

  let waited = 0;

  for (;;) {
    const current = now();
    const wait = computeSlotWait(read(), intervalMs, current);

    if (wait === 0) {
      const offset = jitter();
      if (offset > 0) {
        await sleep(offset);
        waited += offset;
        const recheckNow = now();
        if (computeSlotWait(read(), intervalMs, recheckNow) > 0) {
          continue;
        }
      }
      const claimTs = now();
      write(claimTs);
      return waited;
    }

    const slice = Math.min(wait, MAX_SLICE_MS);
    await sleep(slice);
    waited += slice;
  }
}
