/**
 * Add Multiples page: default every sale-type dropdown to For Sale/Trade and
 * put the cursor in the first quantity field, so the page is ready to type into
 * on arrival.
 */

import { InputIndex } from './inputOptimization.js';

/** How many times to re-assert focus, and how far apart. */
const FOCUS_RETRIES = 5;
const FOCUS_INTERVAL_MS = 250;

export function initAddMultiplesEnhancer() {
  document.querySelectorAll('select').forEach((select) => {
    const fsOpt = Array.from(select.options).find((opt) => opt.text.includes('For Sale/Trade'));
    if (fsOpt) select.value = fsOpt.value;
  });

  const forceFocus = () => {
    const inputs = InputIndex.getValidInputs();
    const firstQtyBox = inputs.find((el) => el.value === '0') || inputs[0];
    if (!firstQtyBox) return;
    firstQtyBox.focus({ preventScroll: true });
    setTimeout(() => firstQtyBox.select(), 50);
  };

  // The page's own scripts move focus after load, and there is no event that
  // reliably marks the end of that. Re-asserting on a short interval is a
  // timing guess; making it stop competing with the user is Phase 3 work.
  forceFocus();
  let attempts = 0;
  const timer = setInterval(() => {
    forceFocus();
    if (++attempts >= FOCUS_RETRIES) clearInterval(timer);
  }, FOCUS_INTERVAL_MS);
}
