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
 * Enumerate the inputs that participate in Enter-to-Tab, in document order.
 *
 * The `value === '0'` clause is deliberate: quantity fields pre-filled with
 * zero are sometimes laid out with no measurable box, and skipping them would
 * make the whole feature useless on exactly the page it exists for.
 *
 * @returns {HTMLInputElement[]}
 */
export function getValidInputs() {
  return Array.from(document.querySelectorAll('input')).filter((el) => {
    const t = el.type ? el.type.toLowerCase() : 'text';
    const isTextField = (t === 'text' || t === 'number');
    const rect = el.getBoundingClientRect();
    const isVisible = (rect.width > 0 && rect.height > 0) || el.value === '0';
    return isTextField && isVisible && !el.readOnly && !el.disabled;
  });
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

  InputIndex.getValidInputs = getValidInputs;
}
