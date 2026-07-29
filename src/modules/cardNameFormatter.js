/**
 * Normalizes ` - ` to a plain space inside card name nodes.
 *
 * NOTE: `.card-name-selector` is a placeholder class that does not exist in the
 * site's markup, so this module currently matches nothing and no-ops. The
 * contract check exists to say so out loud rather than let it fail silently.
 * Deleting it, or pointing it at a real selector, is Phase 2 work — see
 * `docs/REMOVED.md`.
 */

import { assertContract } from '../ui/dom.js';

const CARD_NAME_SELECTOR = '.card-name-selector';

export function initCardNameFormatter() {
  assertContract('cardNameFormatter', [
    { selector: CARD_NAME_SELECTOR, label: `${CARD_NAME_SELECTOR} (card name nodes)` }
  ]);

  document.querySelectorAll(CARD_NAME_SELECTOR).forEach((node) => {
    node.textContent = node.textContent.replace(/(\w+)\s-\s(\w+)/g, '$1 $2').trim();
  });
}
