/**
 * The compact set-action badges: shortcut links plus the two action badges.
 */

import { icon } from './icons.js';
import { Config } from '../core/config.js';
import { Utils } from '../core/utils.js';
import { resolveSportFromDocument, resolveYearFromDocument } from '../net/setHierarchyExport.js';

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
  YEAR: {
    icon: 'calendar',
    text: 'YEAR',
    cssClass: 'tk-badge-link-y',
    title: 'View All Sets for Year in Collection',
    getUrl: (sid, parentSid, doc = typeof document !== 'undefined' ? document : null) => {
      const sport = resolveSportFromDocument(doc);
      const year = resolveYearFromDocument('', doc);
      return `/ViewAllC.cfm/sp/${encodeURIComponent(sport)}/year/${encodeURIComponent(year)}`;
    }
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

/** The seven navigation shortcuts, without the actions. */
export const SHORTCUT_KEYS = ['CHECKLIST', 'YEAR', 'INSERTS', 'PARALLELS', 'FOR_SALE', 'MULTI', 'WANTLIST'];

/** Toolbar order: navigation shortcuts, then the export action. */
export const TOOLBAR_BADGES = ['CHECKLIST', 'PIN', 'YEAR', 'INSERTS', 'PARALLELS', 'FOR_SALE', 'MULTI', 'WANTLIST', 'CSV', 'HIERARCHY'];

/** Set-link order: checklist leads, followed by actions and set shortcuts. */
export const SET_LINK_BADGES = ['CHECKLIST', 'PIN', 'CSV', 'HIERARCHY', 'YEAR', 'INSERTS', 'PARALLELS', 'FOR_SALE', 'MULTI', 'WANTLIST'];

/**
 * Ordered, enabled badge keys/objects for the toolbar, driven by Config.
 *
 * @returns {Array<string|object>}
 */
export function getToolbarBadges() {
  const cfg = Config.global?.toolbarBadges;
  if (!Array.isArray(cfg) || cfg.length === 0) return TOOLBAR_BADGES;
  return cfg.filter((b) => b.enabled !== false);
}

/**
 * Ordered, enabled badge keys/objects for injected set-link badge groups, driven by Config.
 *
 * @returns {Array<string|object>}
 */
export function getSetLinkBadges() {
  const cfg = Config.global?.setLinkBadges;
  if (!Array.isArray(cfg) || cfg.length === 0) return SET_LINK_BADGES;
  return cfg.filter((b) => b.enabled !== false);
}

/**
 * @param {keyof BADGES} badgeKey
 * @param {string|null} [sid]
 * @param {((e: Event) => void)|null} [onClickOverride] forces a button rather
 *   than a link, even for a definition that has a URL
 * @param {'both'|'icon'|'text'} [displayMode='both']
 * @param {string|null} [parentSid] optional parent set ID for sub-sets
 * @param {object} [overrides={}] optional custom text, tooltip/title, and target mode
 * @returns {HTMLElement|null} `null` for an unknown badge key
 */
export function createBadge(badgeKey, sid = null, onClickOverride = null, displayMode = 'both', parentSid = null, overrides = {}) {
  const config = BADGES[badgeKey];
  if (!config) return null;

  const textLabel = (overrides.text !== undefined && overrides.text !== null && overrides.text !== '') ? overrides.text : config.text;
  const badgeTitle = overrides.tooltip || overrides.title || config.title;
  const targetMode = overrides.target || 'inline';

  const showIcon = displayMode === 'both' || displayMode === 'icon';
  const showText = (displayMode === 'both' || displayMode === 'text') && !!textLabel;

  // Fallback: if displayMode is 'text' but config has no text (e.g. REMOVE_PIN), show icon so element is not empty
  const actualShowIcon = showIcon || (!showText && !textLabel);

  const iconSvg = actualShowIcon ? icon(config.icon) : '';
  const textSpan = showText ? `<span class="tk-badge-label">${Utils.escape.html(textLabel)}</span>` : '';
  const inner = `${iconSvg}${textSpan}`;

  if (config.getUrl && !onClickOverride) {
    const link = document.createElement('a');
    link.href = config.getUrl(sid, parentSid);
    link.innerHTML = inner;
    link.className = `sctk-badge ${config.cssClass}`;
    link.title = badgeTitle;

    if (targetMode === 'background') {
      link.target = '_blank';
      link.addEventListener('click', (e) => {
        e.preventDefault();
        Utils.openInTab(link.href, true);
      });
    }

    return link;
  }

  const btn = document.createElement('span');
  btn.innerHTML = inner;
  btn.className = `sctk-badge ${config.cssClass}`;
  btn.title = badgeTitle;
  btn.tabIndex = 0;
  btn.setAttribute('role', 'button');
  btn.setAttribute('aria-label', badgeTitle);
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
 * @param {HTMLElement} container
 * @param {string} sid
 * @param {object} [options]
 * @param {Array<string|object>} [options.include] ordered badge keys or objects
 * @param {((e: Event) => void)|null} [options.onExport] handler for `CSV`
 * @param {((e: Event) => void)|null} [options.onExportHierarchy] handler for `HIERARCHY`
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

  include.forEach((item) => {
    const key = typeof item === 'string' ? item : item?.key;
    if (!key) return;
    if (typeof item === 'object' && item.enabled === false) return;

    const isAction = key in handlers;
    if (isAction && !handlers[key]) return;

    const overrides = typeof item === 'object' ? item : {};
    const badge = createBadge(key, sid, isAction ? handlers[key] : null, displayMode, parentSid, overrides);
    if (badge) container.appendChild(badge);
  });

  return container;
}
