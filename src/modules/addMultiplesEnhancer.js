/**
 * Add Multiples page: default every sale-type dropdown to For Sale/Trade and
 * put the cursor in the first quantity field, so the page is ready to type into
 * on arrival.
 */

import { Config } from '../core/config.js';
import { recordContract } from '../core/contracts.js';
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
 * Auto-scroll the element so it is vertically centered if it is currently outside
 * the middle 80% vertically of the screen.
 *
 * @param {HTMLElement} el
 * @returns {boolean} whether auto-scroll was triggered
 */
export function autoScrollIfOutsideMiddle80(el) {
  if (!el || typeof el.getBoundingClientRect !== 'function') return false;

  const viewportHeight = (typeof window !== 'undefined' && window.innerHeight)
    || (typeof document !== 'undefined' && document.documentElement ? document.documentElement.clientHeight : 0);
  if (!viewportHeight) return false;

  const rect = el.getBoundingClientRect();
  const topThreshold = viewportHeight * 0.1;
  const bottomThreshold = viewportHeight * 0.9;

  if (rect.top < topThreshold || rect.bottom > bottomThreshold) {
    if (typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'center', inline: 'nearest' });
    }
    return true;
  }

  return false;
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
  const focusDeadlineMs = Config.global?.addMultiplesFocusDeadlineMs ?? FOCUS_DEADLINE_MS;
  const deadline = Date.now() + focusDeadlineMs;

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
    autoScrollIfOutsideMiddle80(target);

    if (Date.now() < deadline) {
      const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function' ? window.requestAnimationFrame : null);
      if (raf) raf(assert);
    } else {
      stop();
    }
  };

  assert();
}

export function initAddMultiplesEnhancer() {
  if (typeof document !== 'undefined') {
    document.addEventListener('focusin', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) {
        autoScrollIfOutsideMiddle80(e.target);
      }
    });
  }

  const changed = applySaleTypeDefaults();
  if (changed > 0) Log(`Add Multiples: defaulted ${changed} sale-type select(s).`, 'debug');

  // Finding no sale-type option at all means the form changed shape.
  recordContract(
    'addMultiplesEnhancer',
    `${changed} sale-type select(s) defaulted`,
    document.querySelectorAll('select').length > 0
  );

  focusFirstQuantityField();
}


