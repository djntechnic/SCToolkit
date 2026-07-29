/**
 * Injects pin / CSV / shortcut badges beside every set link on set-listing
 * pages.
 *
 * Long listings are the performance case here: a few hundred links, each
 * wanting five to seven badges. Badges are built into a `DocumentFragment` and
 * attached in one operation per link, and links are processed in idle-time
 * chunks so a large page stays responsive while they appear.
 */

import { Log } from '../core/log.js';
import { extractSid } from '../core/sid.js';
import { Pins, deriveSetYear } from '../core/storage.js';
import { exportSetCSV } from '../net/setExport.js';
import { SET_LINK_BADGES, renderBadgeSet } from '../ui/badges.js';
import { assertContract, recordContract } from '../core/contracts.js';
import { escapeHtml } from '../ui/dom.js';
import { showToast } from '../ui/toast.js';
import { Toolbar } from '../ui/toolbar.js';

/** How long to wait for lazily rendered set links before giving up. */
const LATE_RENDER_TIMEOUT_MS = 3000;

/** Links processed per idle slice. */
const CHUNK_SIZE = 25;

export const SET_LINK_SELECTOR = [
  'a[href*="ViewSet" i]',
  'a[href*="CollectionSummary" i]',
  'a[href*="Checklist" i]',
  'a[href*="sid=" i]',
  'a[href*="/sid/" i]'
].join(', ');

/** `requestIdleCallback` where available, a timeout everywhere else. */
const onIdle = typeof requestIdleCallback === 'function'
  ? (fn) => requestIdleCallback(fn, { timeout: 500 })
  : (fn) => setTimeout(fn, 16);

/**
 * Set links on the page, excluding image-only links (thumbnails, expand
 * carets) which would get a badge group pinned to an invisible anchor.
 *
 * @returns {HTMLAnchorElement[]}
 */
export function findSetLinks(root = document) {
  return Array.from(root.querySelectorAll(SET_LINK_SELECTOR))
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
 * Build the badge group for one link, without touching the live document.
 *
 * @param {HTMLAnchorElement} link
 * @param {string} setId
 * @param {string|null} currentPageSid
 * @returns {HTMLElement|null} `null` if this link should get no badges
 */
function buildBadgeGroup(link, setId, currentPageSid) {
  if (currentPageSid && setId === currentPageSid) return null;

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

  return container;
}

/**
 * Attach badges to one batch of links.
 *
 * @param {HTMLAnchorElement[]} links
 * @returns {number} how many were given badges
 */
export function injectSetActions(links) {
  const currentPageSid = extractSid(window.location.href);
  let injected = 0;

  links.forEach((link) => {
    if (link.dataset.tkInjected) return;

    const setId = extractSid(link.href);
    // No SID means no working shortcut URL. v2.42.0 substituted a random
    // string here, which produced badges linking to pages that cannot exist.
    if (!setId) return;

    link.dataset.tkInjected = 'true';

    const group = buildBadgeGroup(link, setId, currentPageSid);
    if (!group) return;

    // One fragment, one insertion — rather than up to seven appendChild calls
    // against the live tree per link.
    const fragment = document.createDocumentFragment();
    fragment.appendChild(group);
    link.after(fragment);
    injected++;
  });

  return injected;
}

/**
 * Work through a list of links in idle-time slices.
 *
 * The first chunk runs synchronously so badges appear immediately on the part
 * of the page the user is already looking at; the rest fill in behind.
 *
 * @param {HTMLAnchorElement[]} links
 * @param {(total: number) => void} [onDone]
 */
function injectInChunks(links, onDone = () => {}) {
  let cursor = 0;
  let total = 0;

  const step = () => {
    const slice = links.slice(cursor, cursor + CHUNK_SIZE);
    cursor += CHUNK_SIZE;
    total += injectSetActions(slice);

    if (cursor < links.length) {
      onIdle(step);
    } else {
      onDone(total);
    }
  };

  step();
}

/**
 * Watch for set links that render after page load, and inject once they exist.
 *
 * v2.42.0 used a flat `setTimeout(500)` — too early on a slow page, and
 * pointlessly late on a fast one. The observer fires as soon as the links are
 * actually there, and disconnects on the first hit so it does not keep
 * inspecting mutations for the life of the page.
 */
function waitForLateLinks() {
  let settled = false;

  const finish = (links) => {
    if (settled) return;
    settled = true;
    observer.disconnect();
    clearTimeout(timer);

    if (links.length === 0) {
      // Either this page genuinely has no set links, or the selectors no
      // longer match the site's markup. Say so; the failure is otherwise
      // completely silent.
      assertContract('setListEnhancer', [
        { selector: SET_LINK_SELECTOR, label: 'set links (pin/export badge anchors)' }
      ]);
      return;
    }

    injectInChunks(links, (n) => {
      Log(`Set List Enhancer: badges injected for ${n} late-rendered link(s).`, 'debug');
    });
  };

  const observer = new MutationObserver(() => {
    const links = findSetLinks();
    if (links.length > 0) finish(links);
  });

  const timer = setTimeout(() => finish(findSetLinks()), LATE_RENDER_TIMEOUT_MS);
  observer.observe(document.body, { childList: true, subtree: true });
}

export function initSetListEnhancer() {
  const setLinks = findSetLinks();

  if (setLinks.length === 0) {
    waitForLateLinks();
    return;
  }

  injectInChunks(setLinks, (n) => {
    Log(`Set List Enhancer: badges injected for ${n} of ${setLinks.length} link(s).`, 'debug');
    // Links found but none carrying a set id means the URL shape changed.
    recordContract('setListEnhancer', `badges on ${n} of ${setLinks.length} link(s)`, n > 0);
  });
}
