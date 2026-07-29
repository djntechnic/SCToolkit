/**
 * The compact set-action badges: shortcut links plus the two action badges.
 */

import { Icons } from './icons.js';

/**
 * Badge definitions. A definition with `getUrl` renders as an anchor; one
 * without renders as a keyboard-operable `role="button"` span.
 */
export const BADGES = {
  INSERTS: {
    icon: 'bolt',
    text: 'INS',
    cssClass: 'tk-badge-link-i',
    title: 'View Insert Sets',
    getUrl: (sid) => `/Inserts.cfm/sid/${sid}/#InsertSets`
  },
  PARALLELS: {
    icon: 'gem',
    text: 'PAR',
    cssClass: 'tk-badge-link-p',
    title: 'View Parallel Sets',
    getUrl: (sid) => `/Inserts.cfm/sid/${sid}/#ParallelSets`
  },
  FOR_SALE: {
    icon: 'tag',
    text: 'FS',
    cssClass: 'tk-badge-link-fs',
    title: 'View For Sale / For Trade Items',
    getUrl: (sid) => `/ViewCollectionForSaleTrade.cfm/sid/${sid}`
  },
  MULTI: {
    icon: 'layers',
    text: 'MULTI',
    cssClass: 'tk-badge-link-fsm',
    title: 'Add Multiples to For Sale / For Trade',
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
  }
};

/** Shortcut badges, in the order they are rendered everywhere they appear. */
export const SHORTCUT_ORDER = ['INSERTS', 'PARALLELS', 'FOR_SALE', 'MULTI', 'WANTLIST'];

/**
 * @param {keyof BADGES} badgeKey
 * @param {string|null} [sid]
 * @param {((e: Event) => void)|null} [onClickOverride] forces a button rather
 *   than a link, even for a definition that has a URL
 * @returns {HTMLElement|null} `null` for an unknown badge key
 */
export function createBadge(badgeKey, sid = null, onClickOverride = null) {
  const config = BADGES[badgeKey];
  if (!config) return null;

  const iconSvg = config.icon && Icons[config.icon] ? Icons[config.icon]() : '';
  const inner = `${iconSvg}${config.text ? `<span class="tk-badge-label">${config.text}</span>` : ''}`;

  if (config.getUrl && !onClickOverride) {
    const link = document.createElement('a');
    link.href = config.getUrl(sid);
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
