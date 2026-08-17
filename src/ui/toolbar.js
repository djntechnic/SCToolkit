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
import { createBadge, renderBadgeSet, getToolbarBadges } from './badges.js';
import { createBtn, injectStyle } from './dom.js';
import { icon, installIconSprite } from './icons.js';
import { TOOLBAR_CSS } from './styles.js';
import { initDropdown, initDropdownDismissal } from './dropdown.js';
import { showToast } from './toast.js';

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
    include: getToolbarBadges(),
    onPin: (e) => {
      e.preventDefault();
      const pageUrl = window.location.href;
      const added = Pins.add({
        id: sid,
        name: label,
        url: pageUrl,
        year: Utils.extractYear(label, pageUrl)
      });
      if (!added) return;
      Toolbar.renderPins();
      showToast({ message: `Pinned: <b>${Utils.escape.html(label)}</b>` });
    },
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

  // 2. Strip page context / collection / section prefixes at start
  t = t.replace(
    /^(Collection(\s+[^-\n]+)?|.*?'s\s+Collection|Rookies|Errors(\s*\/\s*Variations)?|Gallery|Packaging|Trivia|Comments|Member\s+Ratings|Ratings|Price\s+Guide|Pricing|Overview|Hall\s+of\s+(?:Famers|Teams|Fame)|Teams|Coaches|Umpires|External\s+Links|Contributors|Sell\s+Sheets(\s*\/\s*Ads)?|Videos|Glossary|Card\s+Rankings)\s*-\s*/i,
    ''
  );

  // 3. Strip page context / qualifier suffix
  t = t.replace(
    /\s*(?:-\s*|\b(?:Baseball|Basketball|Football|Hockey|Soccer|Racing|Golf|Boxing|MMA|Wrestling|Bowling|Tennis|Track\s+(?:&|and)\s+Field|Multi-Sport|Non-Sport|Gaming|College)\s+)?(Inserts and Related Sets|Inserts & Related Sets|Inserts|Checklist|Overview|Cards|For Sale\/Trade|For Sale|Trade|Wantlist|Add Multiples(\s+Text)?|Add\/Edit|Member Ratings|Ratings|User Comments|Comments|Price Guide|Pricing|Trivia|Gallery|Errors\s*\/\s*Variations|Packaging|Documentation|Teams|External Links|Contributors|Sell Sheets(\s*\/\s*Ads)?|Videos|Glossary|Card Rankings|Forum)\s*$/i,
    ''
  );

  // 4. Strip sport/category designation (e.g. "Baseball", "Basketball") when trailing or preceding a set separator (" - ") unless followed by "Sets" (e.g. "2022 Baseball Sets")
  t = t.replace(
    /\s+\b(Baseball|Basketball|Football|Hockey|Soccer|Racing|Golf|Boxing|MMA|Wrestling|Bowling|Tennis|Track\s+(?:&|and)\s+Field|Multi-Sport|Non-Sport|Gaming|College)\b(?=\s*-|\s*$)(?!\s+Sets\b)/i,
    ''
  );

  // 5. Strip any leftover trailing dashes, pipes, colons, or slashes
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

    const pins = Pins.all().filter((p) => p.enabled !== false);
    if (pins.length === 0) return;

    const grouped = pins.reduce((acc, pin) => {
      const year = SET_YEAR_REGEX.test(pin.year) ? pin.year : (Utils.extractYear(pin.name, pin.url) || 'Misc');
      (acc[year] ||= []).push(pin);
      return acc;
    }, {});

    const sortedYears = Object.keys(grouped).sort((a, b) => {
      if (a === 'Misc') return 1;
      if (b === 'Misc') return -1;
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      return a.localeCompare(b);
    });

    sortedYears.forEach((year) => {
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

    const displayMode = Config.global?.toolbarButtonDisplay || 'both';

    const rawHotlinks = Config.global?.hotlinks || [];
    const hotlinks = Array.isArray(rawHotlinks) ? [...rawHotlinks] : [];
    hotlinks
      .filter((hl) => hl.enabled !== false)
      .sort((a, b) => Number(a.placement || 0) - Number(b.placement || 0))
      .forEach((hl) => {
        const isViewAllC = hl.action === 'viewAllC' || hl.id === 'year' || (hl.url && hl.url.includes('ViewAllC.cfm'));
        const isAction = hl.action || hl.url === '#top' || hl.url === '#bottom' || isViewAllC;
        const targetMode = hl.target || 'inline';
        const el = document.createElement(isAction ? 'button' : 'a');
        el.className = 'tk-scroll-btn tk-hotlink-btn';
        el.title = hl.tooltip || hl.text || '';

        if (isAction) {
          el.type = 'button';
          el.addEventListener('click', (e) => {
            e.preventDefault();
            if (hl.action === 'scrollToTop' || hl.url === '#top') {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            } else if (hl.action === 'scrollToBottom' || hl.url === '#bottom') {
              const footer = document.querySelector('#bottomnav, footer, #footer, .footer');
              if (footer) {
                footer.scrollIntoView({ behavior: 'smooth', block: 'start' });
              } else {
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
              }
            } else if (isViewAllC) {
              const sport = resolveSportFromDocument(document);
              const year = resolveYearFromDocument('', document);
              const targetUrl = `/ViewAllC.cfm/sp/${encodeURIComponent(sport)}/year/${encodeURIComponent(year)}`;
              if (targetMode === 'background') {
                Utils.openInTab(targetUrl, true);
              } else {
                window.location.href = Utils.toFullUrl(targetUrl);
              }
            } else if (hl.url) {
              if (targetMode === 'background') {
                Utils.openInTab(hl.url, true);
              } else {
                window.location.href = Utils.toFullUrl(hl.url);
              }
            }
          });
        } else {
          el.href = Utils.toFullUrl(hl.url);
          if (targetMode === 'background') {
            el.target = '_blank';
            el.addEventListener('click', (e) => {
              e.preventDefault();
              Utils.openInTab(hl.url, true);
            });
          }
        }

        const iconName = hl.icon || (hl.id === 'top' ? 'chevronUp' : hl.id === 'bottom' ? 'chevronDown' : hl.id === 'search' ? 'search' : hl.id === 'year' ? 'calendar' : null);
        const hasIcon = Boolean(iconName);
        const hasText = Boolean(hl.text && hl.text.trim());

        let renderIcon = false;
        let renderText = false;

        if (displayMode === 'both') {
          renderIcon = hasIcon;
          renderText = hasText;
        } else if (displayMode === 'icon') {
          renderIcon = hasIcon;
          renderText = !hasIcon && hasText;
        } else if (displayMode === 'text') {
          renderText = hasText;
          renderIcon = !hasText && hasIcon;
        }

        if (!renderIcon && !renderText) {
          renderIcon = hasIcon;
          renderText = hasText;
        }

        const iconHtml = renderIcon ? icon(iconName) : '';
        const textHtml = renderText ? `<span>${Utils.escape.html(hl.text || '')}</span>` : '';
        el.innerHTML = `${iconHtml}${textHtml}`;
        container.appendChild(el);
      });

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

      const genericLabels = [
        'change log', 'forum', 'change log prices', 'recently added',
        'inaccuracy reports', 'sctoolkit active', 'set view'
      ];

      if (!setName || genericLabels.includes(setName.toLowerCase())) {
        const setHeader = document.querySelector('#setname-content h1')
          || document.querySelector('#main-content-area h2')
          || document.querySelector('#main-content-area h1')
          || document.querySelector('h1.site');
        const subHeader = document.querySelector('#setname-content h3') || document.querySelector('#main-content-area h3');

        if (setHeader && !setHeader.innerText.toLowerCase().includes('set links') && !setHeader.innerText.toLowerCase().includes('change log')) {
          setName = setHeader.innerText.replace(/\s*-\s*Cards$/i, '').trim();
        }

        if (!setName || genericLabels.includes(setName.toLowerCase())) {
          const viewSetLink = document.querySelector(`a[href*="ViewSet.cfm/sid/${currentSid}"], a[href*="ViewSet.cfm?sid=${currentSid}"], a[href*="/sid/${currentSid}/"]`);
          if (viewSetLink) {
            const titleAttr = viewSetLink.getAttribute('title');
            if (titleAttr && titleAttr.toLowerCase().startsWith('navigate to ')) {
              setName = titleAttr.replace(/^navigate to /i, '').trim();
            } else {
              const linkText = viewSetLink.innerText.trim();
              if (linkText && !genericLabels.includes(linkText.toLowerCase()) && linkText !== 'View') {
                setName = cleanDocTitle(linkText);
              }
            }
          }
        }

        if (subHeader && setName && !setName.includes(subHeader.innerText.trim())) {
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
