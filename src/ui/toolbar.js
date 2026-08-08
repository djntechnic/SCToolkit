/**
 * The fixed toolbar: wordmark, action buttons, pinned-set dropdowns, page
 * context, and status readout.
 */

import { Config } from '../core/config.js';
import { Routes } from '../core/routes.js';
import { extractSid, extractParentSid } from '../core/sid.js';
import { Log } from '../core/log.js';
import { Pins, SET_YEAR_REGEX } from '../core/storage.js';
import { Utils } from '../core/utils.js';
import { CurrentRun, cancelCurrentExport, exportSetCSV } from '../net/setExport.js';
import { exportSingleParentSetHierarchy } from '../net/setHierarchyExport.js';
import { TOOLBAR_BADGES, createBadge, renderBadgeSet } from './badges.js';
import { createBtn, injectStyle } from './dom.js';
import { icon, installIconSprite } from './icons.js';
import { TOOLBAR_CSS } from './styles.js';
import { initDropdown, initDropdownDismissal } from './dropdown.js';

/**
 * Append the shortcut links plus a CSV action for a set.
 *
 * @param {HTMLElement} container
 * @param {string} sid
 * @param {string} [label] name used in the export's log and filename fallback
 * @param {'both'|'icon'|'text'} [displayMode] display mode for icons and text
 * @param {string|null} [parentSid] optional parent set ID for sub-sets
 */
export function appendShortcutBadges(
  container,
  sid,
  label = 'Set',
  displayMode = Config.global?.toolbarButtonDisplay || 'both',
  parentSid = null
) {
  renderBadgeSet(container, sid, {
    include: TOOLBAR_BADGES,
    onExport: (e) => {
      e.preventDefault();
      const fullUrl = Utils.toFullUrl(`/Checklist.cfm/sid/${sid}/`);
      Log(`[CLIENT] Toolbar CSV Export button clicked for set ID ${sid} (${label}) — ${fullUrl}`, 'info', 'client');
      exportSetCSV(sid, label);
    },
    onExportHierarchy: (e) => {
      e.preventDefault();
      Log(`[CLIENT] Toolbar Hierarchy CSV Export button clicked for set ID ${sid} (${label})`, 'info', 'client');
      exportSingleParentSetHierarchy(sid, label);
    },
    displayMode,
    parentSid
  });
}

/**
 * Smart page title parser.
 * Dynamically cleans site boilerplate, collection prefixes, and generic page
 * qualifiers off document.title to produce an accurate title label for the Toolbar.
 *
 * @param {string} [rawTitle] defaults to `document.title`
 * @returns {string}
 */
export function cleanDocTitle(rawTitle) {
  let t = (rawTitle !== undefined ? rawTitle : (typeof document !== 'undefined' ? document.title : '')) || '';

  // 1. Strip site branding / suffix (e.g. "| Trading Card Database", "- Trading Card Database", "| TCDB", "- TCDB")
  t = t.replace(/\s*([|-])\s*(Trading Card Database|TCDB).*/i, '');

  // 2. Strip collection navigation prefix at start (e.g. "Collection - ", "Collection For Sale/Trade - ", "Collection Wantlist - ", "SuperDan's Collection - ")
  t = t.replace(/^(Collection(\s+[^-\n]+)?|.*?'s\s+Collection)\s*-\s*/i, '');

  // 3. Strip page context / qualifier suffix preceded by " - " (e.g. " - Inserts and Related Sets", " - For Sale/Trade", " - Wantlist", " - Add Multiples")
  t = t.replace(
    /\s*-\s*(Inserts and Related Sets|Inserts & Related Sets|Inserts|Checklist|Overview|Cards|For Sale\/Trade|For Sale|Trade|Wantlist|Add Multiples(\s+Text)?|Add\/Edit|Member Ratings|Ratings|User Comments|Comments|Price Guide|Trivia|Gallery|Errors\s*\/\s*Variations|Packaging|Documentation)\s*$/i,
    ''
  );

  // 4. Strip any leftover trailing dashes, pipes, colons, or slashes
  t = t.replace(/\s*[-|:/]\s*$/g, '');

  return t.trim();
}

/** @param {HTMLElement} container @param {string} text */
function appendContextLabel(container, text) {
  const label = document.createElement('span');
  label.className = 'context-label';
  label.textContent = text;
  label.title = text;
  container.appendChild(label);
  return label;
}

export const Toolbar = {
  init: () => {
    injectStyle(TOOLBAR_CSS);
    // Must precede any icon: every icon on the page is a <use> reference into
    // this sprite.
    installIconSprite();

    const bar = document.createElement('div');
    bar.id = 'sctk-toolbar';
    bar.innerHTML = `
      <div class="tk-wordmark"><span class="tk-wordmark-title">SC</span><span class="tk-wordmark-sub">Toolkit</span></div>
      <div id="tk-actions" class="toolbar-group"></div>
      <div id="tk-pinned" class="toolbar-group"></div>
      <div id="tk-center-context"></div>
      <div id="tk-status-wrap" class="tk-dropdown">
        <button id="tk-status" type="button" class="tk-status-btn" aria-haspopup="true" aria-expanded="false">Initializing...</button>
        <div id="tk-status-dropdown" class="tk-dropdown-content" style="right: 0; left: auto; padding: 8px 12px; min-width: 220px; text-align: left;">
          <div id="tk-status-popover-title" style="font-weight: 700; font-family: var(--tk-font-mono); font-size: 11px; color: var(--tk-accent); border-bottom: 1px solid var(--tk-border); padding-bottom: 4px; margin-bottom: 6px;">
            Active Modules
          </div>
          <ul id="tk-status-popover-list" style="margin: 0; padding-left: 16px; font-family: var(--tk-font-mono); font-size: 10.5px; color: var(--tk-text); line-height: 1.5;">
          </ul>
        </div>
      </div>
    `;
    document.body.prepend(bar);

    const wrap = bar.querySelector('#tk-status-wrap');
    const statusBtn = bar.querySelector('#tk-status');
    if (wrap && statusBtn) {
      initDropdown(wrap, statusBtn);
    }

    initDropdownDismissal();
    Toolbar.observeHeight(bar);

    Toolbar.renderPins();
    Toolbar.renderCenterContext();
    Toolbar.installCancelControl();
  },

  /**
   * Wire a Cancel button that appears only while an export is running.
   *
   * A 200-page run is three minutes or more of requests. Until now the only way
   * to stop one was to close the tab, which is not a control — it is a
   * workaround for the absence of one.
   */
  installCancelControl: () => {
    const container = document.getElementById('tk-actions');
    if (!container) return;

    const btn = createBtn('tk-cancel-export', 'Cancel Export', () => {
      if (cancelCurrentExport()) btn.disabled = true;
    });
    btn.hidden = true;
    btn.classList.add('sctk-btn-danger');
    container.appendChild(btn);

    CurrentRun.onStart = () => {
      btn.hidden = false;
      btn.disabled = false;
      const hierarchyBtn = document.getElementById('btn-export-hierarchy');
      if (hierarchyBtn) hierarchyBtn.hidden = true;
    };
    CurrentRun.onEnd = () => {
      btn.hidden = true;
      const hierarchyBtn = document.getElementById('btn-export-hierarchy');
      if (hierarchyBtn) hierarchyBtn.hidden = false;
    };
  },

  /**
   * Publish the toolbar's real height so the page can be offset by exactly it.
   *
   * The old rule was a fixed `body { padding-top: 38px }`. The toolbar was
   * `flex-wrap: wrap`, so the moment it wrapped to a second row it covered the
   * top of the page — the compensation and the thing it compensated for were
   * free to disagree. The toolbar no longer wraps, and the offset is measured
   * rather than assumed.
   *
   * @param {HTMLElement} bar
   */
  observeHeight: (bar) => {
    const publish = () => {
      const height = Math.ceil(bar.getBoundingClientRect().height);
      if (height > 0) document.documentElement.style.setProperty('--tk-toolbar-height', `${height}px`);
    };

    publish();
    if (typeof ResizeObserver === 'function') new ResizeObserver(publish).observe(bar);
    else window.addEventListener('resize', publish, { passive: true });
  },

  /**
   * @param {string} id
   * @param {string} text
   * @param {(e: Event) => void} onClick
   * @param {boolean} [disabled]
   */
  addAction: (id, text, onClick, disabled = false) => {
    const container = document.getElementById('tk-actions');
    if (container) container.appendChild(createBtn(id, text, onClick, disabled));
  },

  /** Rebuild the pinned-set dropdowns, grouped by year, newest first. */
  renderPins: () => {
    const container = document.getElementById('tk-pinned');
    if (!container) return;
    container.innerHTML = '';

    const pins = Pins.all();
    if (pins.length === 0) return;

    const grouped = pins.reduce((acc, pin) => {
      const year = SET_YEAR_REGEX.test(pin.year) ? pin.year : (Utils.extractYear(pin.name, pin.url) || 'Misc');
      (acc[year] ||= []).push(pin);
      return acc;
    }, {});

    Object.keys(grouped).sort((a, b) => b.localeCompare(a)).forEach((year) => {
      const dropDiv = document.createElement('div');
      dropDiv.className = 'tk-dropdown';

      const dropBtn = document.createElement('button');
      dropBtn.type = 'button';
      dropBtn.className = 'tk-dropbtn';
      dropBtn.textContent = `${year} ▾`;
      dropBtn.title = `View pinned sets for ${year}`;
      dropDiv.appendChild(dropBtn);
      initDropdown(dropDiv, dropBtn);

      const dropContent = document.createElement('div');
      dropContent.className = 'tk-dropdown-content';

      grouped[year].forEach((pin) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'tk-pin-item';

        const headerDiv = document.createElement('div');
        headerDiv.className = 'tk-pin-header';

        const itemLink = document.createElement('a');
        itemLink.className = 'tk-pin-title';
        itemLink.href = pin.url;
        itemLink.textContent = pin.name;
        itemLink.title = `Navigate to ${pin.name}`;

        const removeBtn = createBadge('REMOVE_PIN', null, (e) => {
          e.preventDefault();
          e.stopPropagation();
          Pins.remove(pin.id);
          Toolbar.renderPins();
          Log(`Removed Pin: ${pin.name}`);
        });

        headerDiv.appendChild(itemLink);
        headerDiv.appendChild(removeBtn);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'tk-pin-actions';
        appendShortcutBadges(actionsDiv, pin.id, pin.name, Config.global?.pinButtonDisplay || 'both');

        itemDiv.appendChild(headerDiv);
        itemDiv.appendChild(actionsDiv);
        dropContent.appendChild(itemDiv);
      });

      dropDiv.appendChild(dropContent);
      container.appendChild(dropDiv);
    });
  },

  /** Fill the centre of the toolbar with a label describing the current page. */
  renderCenterContext: () => {
    const container = document.getElementById('tk-center-context');
    if (!container) return;
    container.innerHTML = '';

    const currentSid = extractSid(window.location.href);

    const scrollTopBtn = document.createElement('button');
    scrollTopBtn.type = 'button';
    scrollTopBtn.className = 'tk-scroll-btn';
    scrollTopBtn.innerHTML = `${icon('chevronUp')}<span>Top</span>`;
    scrollTopBtn.title = 'Scroll to top of page';
    scrollTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    container.appendChild(scrollTopBtn);

    const scrollBottomBtn = document.createElement('button');
    scrollBottomBtn.type = 'button';
    scrollBottomBtn.className = 'tk-scroll-btn';
    scrollBottomBtn.innerHTML = `${icon('chevronDown')}<span>Bottom</span>`;
    scrollBottomBtn.title = 'Scroll to bottom of page';
    scrollBottomBtn.addEventListener('click', () => {
      const footer = document.querySelector('#bottomnav, footer, #footer, .footer');
      if (footer) {
        footer.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }
    });
    container.appendChild(scrollBottomBtn);

    if (Routes.isCardPage()) {
      const titleNode = document.querySelector('#setname-content h1') || document.querySelector('#main-content-area h1');
      const subTitleNode = document.querySelector('#setname-content h3') || document.querySelector('#main-content-area h3');
      const playerNode = document.querySelector('#main-content-area h2');

      const yearSet = titleNode ? titleNode.innerText.replace(/\s*-\s*Cards$/i, '').trim() : '';
      const cardNo = subTitleNode ? subTitleNode.innerText.trim() : '';
      const player = playerNode ? playerNode.innerText.trim() : '';

      const cardSummary = `${player ? player + ' - ' : ''}${yearSet}${cardNo ? ' ' + cardNo : ''}`.trim();
      appendContextLabel(container, cardSummary || cleanDocTitle() || 'Card View');

      if (currentSid) {
        const parentSid = extractParentSid(document, currentSid);
        if (parentSid) {
          Log(`Determined parent set ID ${parentSid} for set ID ${currentSid}`, 'debug');
        } else {
          Log(`No parent set ID found for set ID ${currentSid}`, 'debug');
        }
        appendShortcutBadges(container, currentSid, cardSummary || 'Set', Config.global?.toolbarButtonDisplay || 'both', parentSid);
      }
      return;
    }

    if (currentSid && Routes.isSetPage()) {
      let setName = cleanDocTitle();

      if (!setName) {
        const setHeader = document.querySelector('#setname-content h1')
          || document.querySelector('#main-content-area h2')
          || document.querySelector('#main-content-area h1');
        const subHeader = document.querySelector('#setname-content h3') || document.querySelector('#main-content-area h3');

        if (setHeader && !setHeader.innerText.toLowerCase().includes('set links')) {
          setName = setHeader.innerText.replace(/\s*-\s*Cards$/i, '').trim();
        }
        if (subHeader && !setName.includes(subHeader.innerText.trim())) {
          setName += (setName ? ' - ' : '') + subHeader.innerText.trim();
        }
      }

      const parentSid = extractParentSid(document, currentSid);
      if (parentSid) {
        Log(`Determined parent set ID ${parentSid} for set ID ${currentSid}`, 'debug');
      } else {
        Log(`No parent set ID found for set ID ${currentSid}`, 'debug');
      }
      appendContextLabel(container, setName || 'Set View');
      appendShortcutBadges(container, currentSid, setName || 'Set', Config.global?.toolbarButtonDisplay || 'both', parentSid);
      return;
    }

    if (Routes.isPlayerPage()) {
      const playerHeader = document.querySelector('#main-content-area h1') || document.querySelector('h1');
      appendContextLabel(container, playerHeader ? playerHeader.innerText.trim() : 'Player Profile');
      return;
    }

    appendContextLabel(container, cleanDocTitle() || 'SCToolkit Active');
  }
};
