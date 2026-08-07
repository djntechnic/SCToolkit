/**
 * Injects pin / CSV / shortcut badges beside every set link on set-listing
 * pages.
 *
 * Long listings are the performance case here: a few hundred links, each
 * wanting five to seven badges. Badges are built into a `DocumentFragment` and
 * attached in one operation per link, and links are processed in idle-time
 * chunks so a large page stays responsive while they appear.
 */

import { Config } from '../core/config.js';
import { Log } from '../core/log.js';
import { extractSid } from '../core/sid.js';
import { Pins, deriveSetYear } from '../core/storage.js';
import { exportSetCSV } from '../net/setExport.js';
import { SET_LINK_BADGES, renderBadgeSet } from '../ui/badges.js';
import { assertContract, recordContract } from '../core/contracts.js';
import { showToast } from '../ui/toast.js';
import { Toolbar } from '../ui/toolbar.js';
import { SELECTOR_REGISTRY } from '../core/selectors.js';
import { Utils } from '../core/utils.js';
import { exportSingleParentSetHierarchy, resolveSportFromDocument, resolveYearFromDocument } from '../net/setHierarchyExport.js';

/** Links processed per idle slice. */
export const CHUNK_SIZE = Config.global?.setListEnhancerChunkSize ?? 25;

export const SET_LINK_SELECTOR = SELECTOR_REGISTRY.setLinks.join(', ');

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
  return Array.from(root.querySelectorAll(SET_LINK_SELECTOR)).filter((link) => {
    if (link.closest('#sctk-toolbar')) return false;
    if (!extractSid(link.href)) return false;

    const text = link.textContent.trim();
    if (text.length === 0) return false;

    // Exclude links that consist purely of expand/collapse carets or symbols (e.g. ▶, ▼, +)
    if (/^[\u25B6\u25C0\u25BC\u25B2►◄▼▲\s+-]+$/.test(text)) return false;

    return true;
  });
}

/**
 * Set links that have not yet been enhanced with badge groups.
 *
 * @param {Document|HTMLElement} [root]
 * @returns {HTMLAnchorElement[]}
 */
export function findUninjectedSetLinks(root = document) {
  return findSetLinks(root).filter((link) => !link.dataset.tkInjected);
}

/**
 * Decide whether a link heads a group of sub-sets, which is the case where
 * Inserts/Parallels shortcuts are worth showing.
 *
 * @param {HTMLAnchorElement} link
 * @returns {boolean}
 */
export function isExpandableParent(link) {
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
  container.className = 'tk-injected-badge-group';
  container.style.display = 'inline-flex';
  container.style.alignItems = 'center';
  container.style.marginLeft = '8px';

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
      showToast({ message: `Pinned: <b>${Utils.escape.html(setName)}</b>` });
    },
    onExport: (e) => {
      e.preventDefault();
      const fullUrl = Utils.toFullUrl(link.getAttribute('href') || `/Checklist.cfm/sid/${setId}/`);
      Log(`[CLIENT] Set list badge CSV Export requested for set ID ${setId} (${setName}) — ${fullUrl}`, 'info', 'client');
      exportSetCSV(setId, setName);
    },
    onExportHierarchy: (e) => {
      e.preventDefault();
      const parentLi = link.closest('li');
      let category = 'Major Releases';
      if (parentLi) {
        let prev = parentLi.previousElementSibling;
        while (prev) {
          if (prev.tagName === 'H3' && prev.classList.contains('site')) {
            category = prev.textContent.trim().replace(/\s*\(\d+\)$/, '');
            break;
          }
          prev = prev.previousElementSibling;
        }
      }
      const nextEl = parentLi ? parentLi.nextElementSibling : null;
      const hasHideDiv = !!(nextEl && nextEl.tagName === 'DIV' && nextEl.id.startsWith('hideDiv'));

      const sport = resolveSportFromDocument();
      const year = resolveYearFromDocument(setName);

      exportSingleParentSetHierarchy(setId, setName, { sport, year, category, hasHideDiv });
    },
    displayMode: Config.global?.setButtonDisplay || 'both'
  });

  return container;
}

/**
 * Re-render all injected badge groups on the current page to apply updated settings.
 */
export function reinjectSetActions() {
  document.querySelectorAll('.tk-injected-badge-group').forEach((el) => el.remove());
  document.querySelectorAll('[data-tk-injected]').forEach((el) => {
    delete el.dataset.tkInjected;
  });
  const links = findSetLinks();
  injectSetActions(links);
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
  const chunkSize = Config.global?.setListEnhancerChunkSize ?? CHUNK_SIZE;

  const step = () => {
    const slice = links.slice(cursor, cursor + chunkSize);
    cursor += chunkSize;
    total += injectSetActions(slice);

    if (cursor < links.length) {
      onIdle(step);
    } else {
      onDone(total);
    }
  };

  step();
}

/** Module-level observer reference store to track active observers for teardown. */
export const ActiveObservers = new Set();

/**
 * Disconnect and clear all active setListEnhancer observers.
 */
export function disconnectSetListEnhancer() {
  ActiveObservers.forEach((obs) => {
    try {
      obs.disconnect();
    } catch {
      // Ignore disconnect errors
    }
  });
  ActiveObservers.clear();
}

/**
 * Watch for set links that render dynamically or arrive via late DOM updates.
 *
 * @param {object} [options]
 * @param {number} [options.timeoutMs] optional timeout to auto-disconnect
 * @returns {MutationObserver|null}
 */
export function observeSetLinks(options = {}) {
  // Ensure previous observers are cleaned up before binding a new one.
  disconnectSetListEnhancer();

  if (typeof MutationObserver !== 'function' || typeof document === 'undefined') return null;

  const target = document.getElementById('main-content-area') || document.body;
  if (!target) return null;

  let debounceTimer = null;

  const observer = new MutationObserver((mutations) => {
    // Ignore mutations where all added nodes are badge group elements added by this module
    const isSelfMutation = mutations.every((m) => (
      Array.from(m.addedNodes).every((node) => (
        node.nodeType === 1 && (
          node.classList?.contains('tk-injected-badge-group') ||
          node.querySelector?.('.tk-injected-badge-group') !== null
        )
      ))
    ));
    if (isSelfMutation) return;

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      try {
        const pending = findUninjectedSetLinks();
        if (pending.length > 0) {
          injectInChunks(pending, (n) => {
            if (n > 0) {
              Log(`Set List Enhancer: Enhanced ${n} late-rendered / dynamic set link(s).`, 'info');
            }
          });
        }
      } catch (err) {
        Log(`Set List Enhancer observer error: ${err.message}`, 'warn');
      }
    }, 150);
  });

  try {
    observer.observe(target, { childList: true, subtree: true });
    ActiveObservers.add(observer);

    if (options.timeoutMs > 0) {
      setTimeout(() => {
        if (debounceTimer) clearTimeout(debounceTimer);
        try {
          observer.disconnect();
        } finally {
          ActiveObservers.delete(observer);
        }
      }, options.timeoutMs);
    }
  } catch (err) {
    Log(`Set List Enhancer: Failed to observe target element: ${err.message}`, 'warn');
    observer.disconnect();
    return null;
  }

  return observer;
}

export function initSetListEnhancer() {
  // Clean up any lingering observers from previous initializations or page navigations.
  disconnectSetListEnhancer();

  const setLinks = findSetLinks();

  if (setLinks.length === 0) {
    Log('Set List Enhancer: Waiting for set links to render...', 'info');
    assertContract('setListEnhancer', [
      { selector: SET_LINK_SELECTOR, label: 'set links (pin/export badge anchors)', optional: true }
    ]);
  } else {
    const pending = findUninjectedSetLinks();
    injectInChunks(pending, () => {
      const injectedCount = setLinks.filter((link) => link.dataset.tkInjected).length;
      Log(`Set List Enhancer: Enhanced ${injectedCount} of ${setLinks.length} set link(s).`, 'info');
      recordContract('setListEnhancer', `badges on ${injectedCount} of ${setLinks.length} set link(s)`, injectedCount > 0);
    });
  }

  // Always observe DOM mutations to handle dynamic expansions, accordion toggles, or late renders.
  observeSetLinks();
}
