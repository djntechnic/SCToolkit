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
      Log(`[CLIENT] Export job queued behind ${position - 1} pending job(s): '${label}' (Queue position: #${position})`, 'info', 'client');
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
    const remaining = ExportQueue.queue.length;
    Log(`[CLIENT] Export job starting: '${label}' (${remaining} job(s) remaining in queue)`, 'info', 'client');
    try {
      await task();
    } catch (error) {
      Log(`[CLIENT] Export job threw uncaught error for '${label}': ${error.message}`, 'error', 'client');
    }
    ExportQueue.processNext();
  }
};
