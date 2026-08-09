/**
 * Set Dropdown Search Enhancer.
 *
 * Overrides native TCDB set dropdown search input (#setSearch) on collection pages
 * to support substring matching and OR conditions (comma, semicolon, pipe, space)
 * instead of strict startsWith matching.
 */

import { Config } from '../core/config.js';
import { Log } from '../core/log.js';
import { recordContract, assertContract } from '../core/contracts.js';
import { SELECTOR_REGISTRY } from '../core/selectors.js';

/**
 * Enhances native TCDB set dropdown search input (#setSearch) to support substring matching
 * and OR conditions (comma, semicolon, pipe, space) instead of strict startsWith matching.
 *
 * @param {Document|HTMLElement} [doc]
 * @returns {boolean} true if enhanced or already enhanced, false if elements not found
 */
export function enhanceSetDropdownSearch(doc = document) {
  if (Config.modules.setDropdownSearchEnhancer?.actions?.substringSearch === false) return false;

  const searchInput = doc.querySelector(SELECTOR_REGISTRY.setDropdown.search);
  const setList = doc.querySelector(SELECTOR_REGISTRY.setDropdown.list);
  if (!searchInput || !setList) return false;

  if (searchInput.dataset.tkEnhanced) return true;
  searchInput.dataset.tkEnhanced = 'true';

  searchInput.addEventListener(
    'input',
    (e) => {
      e.stopImmediatePropagation();
      const term = searchInput.value.trim().toLowerCase();
      const conditions = term ? term.split(/[,;|\s]+/).filter(Boolean) : [];

      const listItems = setList.querySelectorAll('li');
      listItems.forEach((li) => {
        const link = li.querySelector('a');
        if (!link) return;
        const text = link.textContent.trim().toLowerCase();
        const match =
          conditions.length === 0 ||
          conditions.some((cond) => text.includes(cond));
        li.classList.toggle('hidden', !match);
      });
    },
    true // capture phase to intercept native TCDB startsWith listener
  );

  Log('Set Dropdown Search Enhancer: Enhanced set dropdown search with substring and OR matching.', 'info');
  recordContract('setDropdownSearchEnhancer', 'enhanced set dropdown search', true);
  return true;
}

export function initSetDropdownSearchEnhancer() {
  if (!Config.modules.setDropdownSearchEnhancer?.enabled) return;

  const success = enhanceSetDropdownSearch();
  if (!success) {
    assertContract('setDropdownSearchEnhancer', [
      { selector: SELECTOR_REGISTRY.setDropdown.search, label: 'set dropdown search input (#setSearch)', optional: true }
    ]);
  }
}
