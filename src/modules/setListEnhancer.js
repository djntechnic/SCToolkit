/**
 * Injects pin / CSV / shortcut badges beside every set link on set-listing
 * pages.
 */

import { Log } from '../core/log.js';
import { extractSid } from '../core/sid.js';
import { Pins, deriveSetYear } from '../core/storage.js';
import { exportSetCSV } from '../net/setExport.js';
import { createBadge } from '../ui/badges.js';
import { escapeHtml } from '../ui/dom.js';
import { showToast } from '../ui/toast.js';
import { Toolbar } from '../ui/toolbar.js';

/** How long to wait for lazily rendered set links before giving up. */
const LATE_RENDER_DELAY_MS = 500;

const SET_LINK_SELECTOR = [
  'a[href*="ViewSet" i]',
  'a[href*="CollectionSummary" i]',
  'a[href*="Checklist" i]',
  'a[href*="sid=" i]',
  'a[href*="/sid/" i]'
].join(', ');

/**
 * Set links on the page, excluding image-only links (thumbnails, expand
 * carets) which would get a badge group pinned to an invisible anchor.
 *
 * @returns {HTMLAnchorElement[]}
 */
function findSetLinks() {
  return Array.from(document.querySelectorAll(SET_LINK_SELECTOR))
    .filter((link) => link.textContent.trim().length > 0 && !link.querySelector('img, i, svg'));
}

/**
 * Decide whether a link heads a group of sub-sets, which is the case where
 * Inserts/Parallels shortcuts are worth showing.
 *
 * @param {HTMLAnchorElement} link
 * @returns {boolean}
 */
function isExpandableParent(link) {
  const parentLi = link.closest('li');
  if (!parentLi) return false;
  if (parentLi.querySelector('ul') !== null) return true;

  let prev = link.previousElementSibling;
  while (prev) {
    const isToggleImage = prev.tagName === 'IMG'
      && (prev.src.includes('plus') || prev.src.includes('minus') || prev.hasAttribute('onclick'));
    const isCaret = prev.tagName === 'I' && prev.className.includes('caret');
    if (isToggleImage || isCaret || prev.hasAttribute('onclick')) return true;
    prev = prev.previousElementSibling;
  }
  return false;
}

/**
 * @param {HTMLAnchorElement[]} setLinks
 */
export function injectSetActions(setLinks) {
  const currentPageSid = extractSid(window.location.href);

  setLinks.forEach((link) => {
    if (link.dataset.tkInjected) return;

    const setId = extractSid(link.href);
    // No SID means no working shortcut URL. v2.42.0 substituted a random
    // string here, which produced badges linking to pages that cannot exist.
    if (!setId) return;

    link.dataset.tkInjected = 'true';
    if (currentPageSid && setId === currentPageSid) return;

    const setName = link.textContent.trim();

    const container = document.createElement('span');
    container.style.display = 'inline-flex';
    container.style.alignItems = 'center';

    container.appendChild(createBadge('PIN', setId, (e) => {
      e.preventDefault();
      const added = Pins.add({
        id: setId,
        name: setName,
        url: link.href,
        year: deriveSetYear(setName, link.href)
      });
      if (!added) return;
      Toolbar.renderPins();
      showToast({ message: `Pinned: <b>${escapeHtml(setName)}</b>` });
    }));

    container.appendChild(createBadge('CSV', setId, (e) => {
      e.preventDefault();
      exportSetCSV(setId, setName);
    }));

    if (isExpandableParent(link)) {
      container.appendChild(createBadge('INSERTS', setId));
      container.appendChild(createBadge('PARALLELS', setId));
    }

    container.appendChild(createBadge('FOR_SALE', setId));
    container.appendChild(createBadge('MULTI', setId));
    container.appendChild(createBadge('WANTLIST', setId));

    link.after(container);
  });
}

export function initSetListEnhancer() {
  const setLinks = findSetLinks();

  if (setLinks.length === 0) {
    // Some listings render their links after page load. Replacing this timeout
    // with a MutationObserver is Phase 3 work.
    setTimeout(() => injectSetActions(findSetLinks()), LATE_RENDER_DELAY_MS);
    return;
  }

  injectSetActions(setLinks);
  Log(`Set List Enhancer: badges injected for ${setLinks.length} link(s).`, 'debug');
}
