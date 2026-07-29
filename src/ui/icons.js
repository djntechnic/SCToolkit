/**
 * Stroke-based SVG icon set, `currentColor`.
 *
 * Icons are injected once as a `<symbol>` sprite and referenced by `<use>`.
 * v2.42.0 returned a complete SVG string per call, so a set-listing page with
 * 200 links parsed ~1,400 full icon markups through `innerHTML` — the gear
 * alone is close to a kilobyte of path data. A `<use>` reference is a dozen
 * bytes and the geometry is parsed once for the whole page.
 *
 * Every string here is a static literal with no page-derived content, which is
 * what makes assigning them via `innerHTML` safe. Do not extend this object
 * with anything built from user or page input.
 */

/**
 * @type {Record<string, {size: number, strokeWidth: number, body: string}>}
 */
export const ICONS = {
  bolt: {
    size: 12, strokeWidth: 1.5,
    body: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>'
  },
  gem: {
    size: 12, strokeWidth: 1.5,
    body: '<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M11 3 8 9l3 12"/><path d="M13 3l3 6-3 12"/><path d="M2 9h20"/>'
  },
  tag: {
    size: 12, strokeWidth: 1.5,
    body: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>'
  },
  layers: {
    size: 12, strokeWidth: 1.5,
    body: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>'
  },
  star: {
    size: 12, strokeWidth: 1.5,
    body: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'
  },
  download: {
    size: 12, strokeWidth: 1.5,
    body: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'
  },
  pin: {
    size: 12, strokeWidth: 1.5,
    body: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>'
  },
  x: {
    size: 11, strokeWidth: 2,
    body: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'
  },
  chevronUp: {
    size: 12, strokeWidth: 2,
    body: '<polyline points="18 15 12 9 6 15"/>'
  },
  plus: {
    size: 11, strokeWidth: 2,
    body: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'
  },
  gear: {
    size: 12, strokeWidth: 1.5,
    body: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>'
  }
};

/** DOM id of the injected sprite, so a second injection can be skipped. */
export const SPRITE_ID = 'sctk-icon-sprite';

/** @param {string} name @returns {string} the symbol's element id */
export const symbolId = (name) => `tk-i-${name}`;

/**
 * The sprite markup: one hidden `<svg>` holding every icon as a `<symbol>`.
 *
 * Presentation attributes sit on the `<symbol>` because stroke, fill, and the
 * stroke-* properties all inherit — a `<use>` reference therefore needs to
 * carry nothing but the size.
 *
 * @returns {string}
 */
export function buildSprite() {
  const symbols = Object.entries(ICONS).map(([name, { strokeWidth, body }]) =>
    `<symbol id="${symbolId(name)}" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
    `stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${body}</symbol>`
  ).join('');

  return `<svg id="${SPRITE_ID}" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden">${symbols}</svg>`;
}

/**
 * Add the sprite to the page. Safe to call more than once.
 *
 * Must run before any icon is rendered; the bootstrap does it first thing.
 */
export function installIconSprite() {
  if (document.getElementById(SPRITE_ID)) return;
  const holder = document.createElement('div');
  holder.innerHTML = buildSprite();
  document.body.prepend(holder.firstChild);
}

/**
 * Markup for one icon, as a `<use>` reference into the sprite.
 *
 * @param {keyof ICONS} name
 * @returns {string} empty string for an unknown name, so a typo degrades to a
 *   missing icon rather than broken markup
 */
export function icon(name) {
  const def = ICONS[name];
  if (!def) return '';
  return `<svg class="tk-icon" width="${def.size}" height="${def.size}" aria-hidden="true"><use href="#${symbolId(name)}"/></svg>`;
}
