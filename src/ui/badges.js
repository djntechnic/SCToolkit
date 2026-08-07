/**
 * The compact set-action badges: shortcut links plus the two action badges.
 */

import { icon } from './icons.js';

/**
 * Badge definitions. A definition with `getUrl` renders as an anchor; one
 * without renders as a keyboard-operable `role="button"` span.
 */
export const BADGES = {
  CHECKLIST: {
    icon: 'list',
    text: 'CHK',
    cssClass: 'tk-badge-link-c',
    title: 'View Set Checklist',
    getUrl: (sid) => `/Checklist.cfm/sid/${sid}`
  },
  INSERTS: {
    icon: 'bolt',
    text: 'INS',
    cssClass: 'tk-badge-link-i',
    title: 'View Insert Sets',
    getUrl: (sid, parentSid) => `/Inserts.cfm/sid/${parentSid || sid}/#InsertSets`
  },
  PARALLELS: {
    icon: 'gem',
    text: 'PAR',
    cssClass: 'tk-badge-link-p',
    title: 'View Parallel Sets',
    getUrl: (sid, parentSid) => `/Inserts.cfm/sid/${parentSid || sid}/#ParallelSets`
  },
  FOR_SALE: {
    icon: 'tag',
    text: 'FS',
    cssClass: 'tk-badge-link-fs',
    title: 'Add For Sale / For Trade Items',
    getUrl: (sid) => `/ViewCollectionForSaleTrade.cfm/sid/${sid}`
  },
  MULTI: {
    icon: 'layers',
    text: 'MULTI',
    cssClass: 'tk-badge-link-fsm',
    title: 'Add For Sale / For Trade Items',
    getUrl: (sid) => `/CollectionAddMultiplesText.cfm/sid/${sid}`
  },
  WANTLIST: {
    icon: 'star',
    text: 'WANT',
    cssClass: 'tk-badge-link-w',
    title: 'View Collection Wantlist',
    getUrl: (sid) => `/ViewCollectionWantlist.cfm/sid/${sid}`
  },
  CSV: {
    icon: 'download',
    text: 'CSV',
    cssClass: 'tk-badge-action',
    title: 'Export Set Checklist to CSV'
  },
  PIN: {
    icon: 'pin',
    text: 'PIN',
    cssClass: 'tk-badge-action',
    title: 'Pin this set to the Global Toolbar'
  },
  REMOVE_PIN: {
    icon: 'x',
    text: '',
    cssClass: 'tk-pin-remove',
    title: 'Remove Pin'
  },
  HIERARCHY: {
    icon: 'downloadHierarchy',
    text: 'HIERARCHY',
    cssClass: 'tk-badge-action-h',
    title: 'Export Set Hierarchy'
  }
};

/** The six navigation shortcuts, without the actions. */
export const SHORTCUT_KEYS = ['CHECKLIST', 'INSERTS', 'PARALLELS', 'FOR_SALE', 'MULTI', 'WANTLIST'];

/** Toolbar order: navigation shortcuts, then the export action. */
export const TOOLBAR_BADGES = ['CHECKLIST', 'INSERTS', 'PARALLELS', 'FOR_SALE', 'MULTI', 'WANTLIST', 'CSV', 'HIERARCHY'];

/** Set-link order: checklist leads, followed by actions and set shortcuts. */
export const SET_LINK_BADGES = ['CHECKLIST', 'PIN', 'CSV', 'HIERARCHY', 'INSERTS', 'PARALLELS', 'FOR_SALE', 'MULTI', 'WANTLIST'];

/**
 * @param {keyof BADGES} badgeKey
 * @param {string|null} [sid]
 * @param {((e: Event) => void)|null} [onClickOverride] forces a button rather
 *   than a link, even for a definition that has a URL
 * @param {'both'|'icon'|'text'} [displayMode='both']
 * @returns {HTMLElement|null} `null` for an unknown badge key
 */
export function createBadge(badgeKey, sid = null, onClickOverride = null, displayMode = 'both', parentSid = null) {
  const config = BADGES[badgeKey];
  if (!config) return null;

  const showIcon = displayMode === 'both' || displayMode === 'icon';
  const showText = (displayMode === 'both' || displayMode === 'text') && !!config.text;

  // Fallback: if displayMode is 'text' but config has no text (e.g. REMOVE_PIN), show icon so element is not empty
  const actualShowIcon = showIcon || (!showText && !config.text);

  const iconSvg = actualShowIcon ? icon(config.icon) : '';
  const textSpan = showText ? `<span class="tk-badge-label">${config.text}</span>` : '';
  const inner = `${iconSvg}${textSpan}`;

  if (config.getUrl && !onClickOverride) {
    const link = document.createElement('a');
    link.href = config.getUrl(sid, parentSid);
    link.innerHTML = inner;
    link.className = `sctk-badge ${config.cssClass}`;
    link.title = config.title;
    return link;
  }

  const btn = document.createElement('span');
  btn.innerHTML = inner;
  btn.className = `sctk-badge ${config.cssClass}`;
  btn.title = config.title;
  btn.tabIndex = 0;
  btn.setAttribute('role', 'button');
  btn.setAttribute('aria-label', config.title);
  if (onClickOverride) {
    btn.addEventListener('click', onClickOverride);
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClickOverride(e);
      }
    });
  }
  return btn;
}

/**
 * Render a group of badges into a container.
 *
 * Replaces three hand-rolled blocks that each appended the same badges in
 * slightly different order with slightly different handler wiring. The order is
 * still per-caller — the toolbar and a set link legitimately lead with
 * different things — but the wiring is not.
 *
 * `PIN` and `CSV` are the only action badges; they render as buttons when a
 * handler is supplied and are skipped entirely when one is not, so a caller
 * cannot accidentally emit a dead action badge.
 *
 * @param {HTMLElement} container
 * @param {string} sid
 * @param {object} [options]
 * @param {string[]} [options.include] ordered badge keys
 * @param {((e: Event) => void)|null} [options.onExport] handler for `CSV`
 * @param {((e: Event) => void)|null} [options.onPin] handler for `PIN`
 * @param {'both'|'icon'|'text'} [options.displayMode] icon/text combination mode
 * @param {string|null} [options.parentSid] optional parent set ID for sub-sets
 * @returns {HTMLElement} the container, for chaining
 */
export function renderBadgeSet(container, sid, {
  include = TOOLBAR_BADGES,
  onExport = null,
  onExportHierarchy = null,
  onPin = null,
  displayMode = 'both',
  parentSid = null
} = {}) {
  const handlers = { CSV: onExport, PIN: onPin, HIERARCHY: onExportHierarchy };

  include.forEach((key) => {
    const isAction = key in handlers;
    if (isAction && !handlers[key]) return;

    const badge = createBadge(key, sid, isAction ? handlers[key] : null, displayMode, parentSid);
    if (badge) container.appendChild(badge);
  });

  return container;
}
