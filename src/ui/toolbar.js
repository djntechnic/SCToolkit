/**
 * The fixed toolbar: wordmark, action buttons, pinned-set dropdowns, page
 * context, and status readout.
 */

import { Routes } from '../core/routes.js';
import { extractSid } from '../core/sid.js';
import { Log } from '../core/log.js';
import { Pins, deriveSetYear } from '../core/storage.js';
import { exportSetCSV } from '../net/setExport.js';
import { TOOLBAR_BADGES, createBadge, renderBadgeSet } from './badges.js';
import { createBtn, injectStyle } from './dom.js';
import { Icons } from './icons.js';
import { TOOLBAR_CSS } from './styles.js';

/**
 * Append the shortcut links plus a CSV action for a set.
 *
 * @param {HTMLElement} container
 * @param {string} sid
 * @param {string} [label] name used in the export's log and filename fallback
 */
export function appendShortcutBadges(container, sid, label = 'Set') {
  renderBadgeSet(container, sid, {
    include: TOOLBAR_BADGES,
    onExport: (e) => {
      e.preventDefault();
      exportSetCSV(sid, label);
    }
  });
}

/**
 * Strip site boilerplate off `document.title` to get a usable page label.
 *
 * @returns {string}
 */
function cleanDocTitle() {
  let t = document.title || '';
  t = t.replace(/\s*\|\s*Trading Card Database.*/i, '');
  t = t.replace(/\s*(Baseball|Basketball|Football|Hockey|Gaming|Boxing|Cricket|Golf|MMA|Multi-Sport|Non-Sport|Racing|Soccer|Tennis|Wrestling)?\s*(Checklist|Inserts and Related Sets|Overview|Cards)?$/i, '');
  t = t.replace(/\s*-\s*(Cards|Checklist|Overview|For Sale\/Trade|Wantlist)$/i, '');
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

    const bar = document.createElement('div');
    bar.id = 'sctk-toolbar';
    bar.innerHTML = `
      <div class="tk-wordmark"><span class="tk-wordmark-title">SC</span><span class="tk-wordmark-sub">Toolkit</span></div>
      <div id="tk-actions" class="toolbar-group"></div>
      <div id="tk-pinned" class="toolbar-group"></div>
      <div id="tk-center-context"></div>
      <div id="tk-status">Initializing...</div>
    `;
    document.body.prepend(bar);

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.tk-dropdown')) {
        document.querySelectorAll('.tk-dropdown.tk-show').forEach((d) => d.classList.remove('tk-show'));
      }
    });

    Toolbar.renderPins();
    Toolbar.renderCenterContext();
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
      const year = /^\d{4}$/.test(pin.year) ? pin.year : deriveSetYear(pin.name, pin.url);
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
      dropBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const isShowing = dropDiv.classList.contains('tk-show');
        document.querySelectorAll('.tk-dropdown.tk-show').forEach((d) => d.classList.remove('tk-show'));
        if (!isShowing) dropDiv.classList.add('tk-show');
      });
      dropDiv.appendChild(dropBtn);

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
        appendShortcutBadges(actionsDiv, pin.id, pin.name);

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
    scrollTopBtn.innerHTML = `${Icons.chevronUp()}<span>Top</span>`;
    scrollTopBtn.title = 'Scroll to top of page';
    scrollTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    container.appendChild(scrollTopBtn);

    if (Routes.isCardPage()) {
      const titleNode = document.querySelector('#setname-content h1') || document.querySelector('#main-content-area h1');
      const subTitleNode = document.querySelector('#setname-content h3') || document.querySelector('#main-content-area h3');
      const playerNode = document.querySelector('#main-content-area h2');

      const yearSet = titleNode ? titleNode.innerText.replace(/\s*-\s*Cards$/i, '').trim() : '';
      const cardNo = subTitleNode ? subTitleNode.innerText.trim() : '';
      const player = playerNode ? playerNode.innerText.trim() : '';

      const cardSummary = `${player ? player + ' - ' : ''}${yearSet}${cardNo ? ' ' + cardNo : ''}`.trim();
      appendContextLabel(container, cardSummary || cleanDocTitle() || 'Card View');

      if (currentSid) appendShortcutBadges(container, currentSid, cardSummary || 'Set');
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

      appendContextLabel(container, setName || 'Set View');
      appendShortcutBadges(container, currentSid, setName || 'Set');
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
