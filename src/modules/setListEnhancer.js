/**
 * Injects pin / CSV / shortcut badges beside every set link on set-listing
 * pages.
 */

import { Log } from '../core/log.js';
import { extractSid } from '../core/sid.js';
import { Pins, deriveSetYear } from '../core/storage.js';
import { exportSetCSV } from '../net/setExport.js';
import { SET_LINK_BADGES, renderBadgeSet } from '../ui/badges.js';
import { assertContract, escapeHtml } from '../ui/dom.js';
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

    // Inserts and Parallels only mean something for a link that heads a group
    // of sub-sets; on a leaf set they would point at empty pages.
    const expandable = isExpandableParent(link);
    const include = SET_LINK_BADGES.filter(
      (key) => expandable || (key !== 'INSERTS' && key !== 'PARALLELS')
    );

    renderBadgeSet(container, setId, {
      include,
      onPin: (e) => {
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
      },
      onExport: (e) => {
        e.preventDefault();
        exportSetCSV(setId, setName);
      }
    });

    link.after(container);
  });
}

export function initSetListEnhancer() {
  const setLinks = findSetLinks();

  if (setLinks.length === 0) {
    // Some listings render their links after page load. Replacing this timeout
    // with a MutationObserver is Phase 3 work.
    setTimeout(() => {
      const late = findSetLinks();
      // Still nothing after the grace period: either this page genuinely has no
      // set links, or the selectors no longer match the site's markup. Say so,
      // because the failure is otherwise completely silent.
      if (late.length === 0) {
        assertContract('setListEnhancer', [
          { selector: SET_LINK_SELECTOR, label: 'set links (pin/export badge anchors)' }
        ]);
        return;
      }
      injectSetActions(late);
      Log(`Set List Enhancer: badges injected for ${late.length} late-rendered link(s).`, 'debug');
    }, LATE_RENDER_DELAY_MS);
    return;
  }

  injectSetActions(setLinks);
  Log(`Set List Enhancer: badges injected for ${setLinks.length} link(s).`, 'debug');
}
