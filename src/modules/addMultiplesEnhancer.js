/**
 * Add Multiples page: default every sale-type dropdown to For Sale/Trade and
 * put the cursor in the first quantity field, so the page is ready to type into
 * on arrival.
 */

import { Log } from '../core/log.js';
import { InputIndex } from './inputOptimization.js';

/** How long to keep re-asserting focus if the page keeps taking it away. */
export const FOCUS_DEADLINE_MS = 1200;

/** Events that mean the user has taken over. */
const USER_INTENT_EVENTS = ['keydown', 'pointerdown', 'wheel'];

/**
 * Set every select that offers a For Sale/Trade option to it.
 *
 * @returns {number} how many were changed
 */
export function applySaleTypeDefaults(root = document) {
  let changed = 0;
  root.querySelectorAll('select').forEach((select) => {
    const fsOpt = Array.from(select.options).find((opt) => opt.text.includes('For Sale/Trade'));
    if (!fsOpt || select.value === fsOpt.value) return;
    select.value = fsOpt.value;
    changed++;
  });
  return changed;
}

/**
 * Focus the first quantity field, and keep it focused against the page's own
 * scripts — but stop the instant the user does anything.
 *
 * v2.42.0 ran `setInterval(forceFocus, 250)` five times unconditionally. If you
 * started typing in a different field within 1.25s of load, it stole your
 * cursor mid-word, up to four more times. This version re-asserts only while
 * focus has actually been lost, and any keypress, click, or scroll cancels it
 * outright.
 */
function focusFirstQuantityField() {
  const target = (() => {
    const inputs = InputIndex.getValidInputs();
    return inputs.find((el) => el.value === '0') || inputs[0] || null;
  })();

  if (!target) return;

  let cancelled = false;
  const deadline = Date.now() + FOCUS_DEADLINE_MS;

  const stop = () => {
    if (cancelled) return;
    cancelled = true;
    USER_INTENT_EVENTS.forEach((type) => document.removeEventListener(type, stop, true));
  };

  // Capture phase, so the user's intent is seen before the page can act on it.
  USER_INTENT_EVENTS.forEach((type) => document.addEventListener(type, stop, true));

  const assert = () => {
    if (cancelled) return;

    if (document.activeElement !== target) {
      target.focus({ preventScroll: true });
      target.select();
    }

    if (Date.now() < deadline) {
      requestAnimationFrame(assert);
    } else {
      stop();
    }
  };

  assert();
}

export function initAddMultiplesEnhancer() {
  const changed = applySaleTypeDefaults();
  if (changed > 0) Log(`Add Multiples: defaulted ${changed} sale-type select(s).`, 'debug');
  focusFirstQuantityField();
}
