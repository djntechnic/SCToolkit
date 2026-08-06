/**
 * Enter-to-Tab: pressing Enter in a text or number input advances to the next
 * one, so bulk data entry never needs the mouse or the Tab key.
 */

import { recordContract } from '../core/contracts.js';
import { debounce } from '../ui/dom.js';

/** Shared with the Add Multiples module, which focuses the first empty field. */
export const InputIndex = {
  /** @type {() => HTMLInputElement[]} */
  getValidInputs: () => []
};

/** Scoped selector targeting text and number inputs. */
const INPUT_SELECTOR = "input[type='text' i], input[type='number' i], input:not([type])";

/**
 * Whether an input participates in Enter-to-Tab.
 *
 * Attribute checks (readOnly, disabled, hidden, type) are evaluated prior to
 * reading `offsetParent` to avoid triggering unnecessary layout calculations.
 *
 * The `value === '0'` clause is deliberate: quantity fields pre-filled with
 * zero are sometimes laid out with no measurable box, and skipping them would
 * make the whole feature useless on the page it exists for.
 *
 * @param {HTMLInputElement} el
 * @returns {boolean}
 */
export function isEligibleInput(el) {
  if (!el) return false;
  const type = el.type ? el.type.toLowerCase() : 'text';
  if (type !== 'text' && type !== 'number') return false;
  if (el.readOnly || el.disabled || el.hidden || el.getAttribute('hidden') !== null) return false;
  if (el.name && el.name.toLowerCase() === 'pageindex') return false;
  if (el.id && el.id.toLowerCase() === 'pageindex') return false;
  return el.offsetParent !== null || el.value === '0';
}

/**
 * Cached list of eligible inputs, in document order.
 */
const cache = { inputs: null };

/** Discard the cached list; the next lookup rebuilds it. */
export function invalidateInputCache() {
  cache.inputs = null;
}

/**
 * Rebuild and return the list of valid inputs.
 *
 * Queries inside `#main-content-area` (falling back to `document.body` if unmounted).
 *
 * @returns {HTMLInputElement[]}
 */
export function getValidInputs() {
  if (cache.inputs === null) {
    const root = (typeof document !== 'undefined' && document.getElementById('main-content-area'))
      || (typeof document !== 'undefined' ? document.body : null);
    cache.inputs = root
      ? Array.from(root.querySelectorAll(INPUT_SELECTOR)).filter(isEligibleInput)
      : [];
  }
  return cache.inputs;
}

export function initInputOptimization() {
  // Not a failure on most pages — most pages have no data-entry fields — so
  // this is recorded rather than warned about.
  recordContract(
    'inputOptimization',
    `${getValidInputs().length} eligible input(s)`,
    true
  );

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.code !== 'NumpadEnter') return;

    const active = document.activeElement;
    // The filter box and pagination PageIndex are text inputs too, but Enter there should do nothing
    // rather than jump focus into the table or prevent form submission.
    if (!active || active.tagName !== 'INPUT' || active.id === 'tk-checklist-filter' || active.name?.toLowerCase() === 'pageindex' || active.id?.toLowerCase() === 'pageindex') return;

    const inputs = getValidInputs();
    const index = inputs.indexOf(active);
    if (index === -1) return;

    e.preventDefault();
    if (index < inputs.length - 1) {
      const nextInput = inputs[index + 1];
      nextInput.focus({ preventScroll: true });
      setTimeout(() => nextInput.select(), 20);
    }
  });

  // Scope observer to #main-content-area to ignore toolbar/toast DOM mutations.
  // Invalidation is debounced to avoid thrashing during rapid DOM updates.
  const target = (typeof document !== 'undefined' && document.getElementById('main-content-area'))
    || (typeof document !== 'undefined' ? document.body : null);

  if (target && typeof MutationObserver === 'function') {
    const debouncedInvalidate = debounce(invalidateInputCache, 200);
    const observer = new MutationObserver(debouncedInvalidate);
    observer.observe(target, { childList: true, subtree: true });
  }

  // A resize can change what is laid out, and therefore what `offsetParent` reports.
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', invalidateInputCache, { passive: true });
  }

  InputIndex.getValidInputs = getValidInputs;
}
