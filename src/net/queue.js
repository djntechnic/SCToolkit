/**
 * Serialized export queue.
 *
 * Exports run strictly one at a time. Two concurrent exports would double the
 * effective request rate against the site, which is precisely what the pacing
 * in `fetcher.js` exists to prevent — so concurrency is not a setting.
 */

import { Log } from '../core/log.js';
import { showToast } from '../ui/toast.js';
import { Utils } from '../core/utils.js';

export const ExportQueue = {
  queue: [],
  active: false,

  /**
   * @param {string} label human-readable job name, shown in toasts
   * @param {() => Promise<void>} task
   */
  enqueue: (label, task) => {
    ExportQueue.queue.push({ label, task });
    const position = ExportQueue.queue.length;

    if (ExportQueue.active) {
      // Local bookkeeping only — no request has been made yet, so this is a
      // client-side line.
      Log(`Export queued behind ${position - 1} pending job(s): ${label}`, 'info');
      showToast({
        message: `Queued: <b>${Utils.escape.html(label)}</b> (position ${position})`,
        variant: 'muted'
      });
      return;
    }

    ExportQueue.processNext();
  },

  processNext: async () => {
    if (ExportQueue.queue.length === 0) {
      ExportQueue.active = false;
      return;
    }
    ExportQueue.active = true;
    const { label, task } = ExportQueue.queue.shift();
    Log(`Export job starting: ${label}`, 'info');
    try {
      await task();
    } catch (error) {
      Log(`Export job threw uncaught error: ${error.message}`, 'error');
    }
    ExportQueue.processNext();
  }
};
