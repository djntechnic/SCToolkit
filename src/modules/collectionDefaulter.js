/**
 * Collection Defaulter
 *
 * On ViewCollection pages (Add / Update), the #CFForm_1 select lets the user
 * pick which personal collection a set is being managed under. When you land on
 * a set that was last viewed under the wrong collection, or navigate to it
 * fresh, the site picks whatever it stored server-side rather than your
 * preferred one.
 *
 * This module reads a configurable CollectionID from settings and, if the live
 * select does not already match it, programmatically sets the value and
 * dispatches a `change` event — which triggers the page's own `onchange` handler
 * (`submit(); return true`) so the redirect happens transparently.
 */

import { Config } from '../core/config.js';
import { assertContract } from '../core/contracts.js';
import { Log } from '../core/log.js';

/** CSS selector for the collection picker. */
export const COLLECTION_SELECT_SELECTOR = '#CFForm_1 > select';

/**
 * The configured default CollectionID as a string, or null if not set /
 * disabled.
 *
 * @returns {string|null}
 */
export function getDefaultCollectionId() {
  const id = Config.global?.defaultCollectionId;
  if (!id && id !== 0) return null;
  return String(id);
}

/**
 * Apply the default collection to the given select element.
 *
 * Returns `true` if the value was changed (and a `change` event dispatched),
 * `false` if the element was already on the target value or if no valid target
 * value is configured.
 *
 * @param {HTMLSelectElement} select
 * @param {string|null} [targetId]
 * @returns {boolean}
 */
export function applyCollectionDefault(select, targetId = getDefaultCollectionId()) {
  if (!select || !targetId) return false;

  // Verify the option actually exists in this select, so we never navigate to
  // a collection that does not belong to the current user.
  const optionExists = Array.from(select.options).some((o) => o.value === targetId);
  if (!optionExists) {
    Log(
      `Collection Defaulter: option value="${targetId}" not found in #CFForm_1 select — skipping.`,
      'warn'
    );
    return false;
  }

  if (select.value === targetId) {
    Log(`Collection Defaulter: already on collection ${targetId} — no change needed.`, 'debug');
    return false;
  }

  Log(`Collection Defaulter: switching collection from "${select.value}" → "${targetId}".`, 'debug');
  select.value = targetId;

  // The page's own onchange handler calls submit(), so dispatching 'change'
  // is equivalent to what a manual user selection would do.
  select.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

export function initCollectionDefaulter() {
  const ok = assertContract('collectionDefaulter', [
    { selector: COLLECTION_SELECT_SELECTOR, label: '#CFForm_1 > select (collection picker)' }
  ]);

  if (!ok) return;

  const select = document.querySelector(COLLECTION_SELECT_SELECTOR);
  const changed = applyCollectionDefault(select);

  if (changed) {
    Log('Collection Defaulter: collection redirect triggered.', 'info');
  }
}
