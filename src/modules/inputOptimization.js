/**
 * Enter-to-Tab: pressing Enter in a text or number input advances to the next
 * one, so bulk data entry never needs the mouse or the Tab key.
 */

/** Shared with the Add Multiples module, which focuses the first empty field. */
export const InputIndex = {
  /** @type {() => HTMLInputElement[]} */
  getValidInputs: () => []
};

/**
 * Whether an input participates in Enter-to-Tab.
 *
 * Visibility is tested with `offsetParent`, which is null for a `display:none`
 * element and its descendants. v2.42.0 called `getBoundingClientRect()` on
 * every input on the page on every Enter keypress — a full layout flush per
 * keystroke, on exactly the pages that have hundreds of inputs.
 *
 * The `value === '0'` clause is deliberate: quantity fields pre-filled with
 * zero are sometimes laid out with no measurable box, and skipping them would
 * make the whole feature useless on the page it exists for.
 *
 * @param {HTMLInputElement} el
 * @returns {boolean}
 */
export function isEligibleInput(el) {
  const type = el.type ? el.type.toLowerCase() : 'text';
  if (type !== 'text' && type !== 'number') return false;
  if (el.readOnly || el.disabled) return false;
  return el.offsetParent !== null || el.value === '0';
}

/**
 * Cached list of eligible inputs, in document order.
 *
 * Invalidated rather than rebuilt when the DOM changes: marking a flag is O(1)
 * per mutation batch, and the rebuild only happens if the user actually
 * presses Enter afterwards. A page that mutates constantly therefore costs
 * nothing until the feature is used.
 */
const cache = { inputs: null };

/** Discard the cached list; the next lookup rebuilds it. */
export function invalidateInputCache() {
  cache.inputs = null;
}

/** @returns {HTMLInputElement[]} */
export function getValidInputs() {
  if (cache.inputs === null) {
    cache.inputs = Array.from(document.querySelectorAll('input')).filter(isEligibleInput);
  }
  return cache.inputs;
}

export function initInputOptimization() {
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.code !== 'NumpadEnter') return;

    const active = document.activeElement;
    // The filter box is a text input too, but Enter there should do nothing
    // rather than jump focus into the table.
    if (!active || active.tagName !== 'INPUT' || active.id === 'tk-checklist-filter') return;

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

  // Rows added, removed, or toggled hidden all change the list. Watching the
  // document is broad, but the handler is a single assignment.
  const observer = new MutationObserver(invalidateInputCache);
  observer.observe(document.body, { childList: true, subtree: true });

  // A resize can change what is laid out, and therefore what `offsetParent`
  // reports.
  window.addEventListener('resize', invalidateInputCache, { passive: true });

  InputIndex.getValidInputs = getValidInputs;
}
