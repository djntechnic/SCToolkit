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
  list: {
    size: 12,
    strokeWidth: 2,
    body: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
  },
  bolt: {
    size: 12,
    strokeWidth: 2,
    body: '<path d="M15.914 4a1.5 1.5 0 0 0-2.474-1.561l-9 9A1.5 1.5 0 0 0 5.5 14h4.002a.5.5 0 0 1 .471.666L8.086 20a1.5 1.5 0 0 0 2.475 1.56l9-9A1.5 1.5 0 0 0 18.5 10h-3.997a.5.5 0 0 1-.472-.667z"/>',
  },
  gem: {
    size: 12,
    strokeWidth: 2,
    body: '<path d="M10.5 3 8 9l4 13 4-13-2.5-6"/><path d="M17 3a2 2 0 0 1 1.6.8l3 4a2 2 0 0 1 .013 2.382l-7.99 10.986a2 2 0 0 1-3.247 0l-7.99-10.986A2 2 0 0 1 2.4 7.8l2.998-3.997A2 2 0 0 1 7 3z"/><path d="M2 9h20"/>',
  },
  tag: {
    size: 12,
    strokeWidth: 2,
    body: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
  },
  layers: {
    size: 12,
    strokeWidth: 2,
    body: '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/>',
  },
  star: {
    size: 12,
    strokeWidth: 2,
    body: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
  },
  download: {
    size: 12,
    strokeWidth: 2,
    body: '<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>',
  },
  pin: {
    size: 12,
    strokeWidth: 2,
    body: '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
  },
  x: {
    size: 11,
    strokeWidth: 2,
    body: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  },
  chevronUp: {
    size: 12,
    strokeWidth: 2,
    body: '<path d="m18 15-6-6-6 6"/>',
  },
  chevronDown: {
    size: 12,
    strokeWidth: 2,
    body: '<path d="m6 9 6 6 6-6"/>',
  },
  plus: {
    size: 11,
    strokeWidth: 2,
    body: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  },
  gear: {
    size: 12,
    strokeWidth: 2,
    body: '<path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/>',
  },
  copy: {
    size: 12,
    strokeWidth: 2,
    body: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  },
  bref: {
    size: 12,
    strokeWidth: 2,
    body: '<circle cx="12" cy="12" r="9"/><path d="M8.5 3.5a10.5 10.5 0 0 0 0 17"/><path d="M15.5 3.5a10.5 10.5 0 0 1 0 17"/><path d="M7 7h3M6 10.5h3.5M6 13.5h3.5M7 17h3"/><path d="M14 7h3M14.5 10.5H18M14.5 13.5H18M14 17h3"/>',
  },
  google: {
    size: 12,
    strokeWidth: 2,
    body: '<path d="M12 12h8.5A8.5 8.5 0 1 1 17.8 6.2"/><path d="m21 21-4.3-4.3"/>',
  },
  check: {
    size: 12,
    strokeWidth: 2,
    body: '<path d="M20 6 9 17l-5-5"/>',
  },
  downloadHierarchy: {
    size: 12,
    strokeWidth: 2,
    body: '<path d="M12 12V3"/><path d="m8 8 4 4 4-4"/><path d="M4 16h16"/><path d="M4 16v4"/><path d="M12 16v4"/><path d="M20 16v4"/>',
  },
};

/** DOM id of the injected sprite, so a second injection can be skipped. */
export const SPRITE_ID = "sctk-icon-sprite";

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
  const symbols = Object.entries(ICONS)
    .map(
      ([name, { strokeWidth, body }]) =>
        `<symbol id="${symbolId(name)}" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
        `stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${body}</symbol>`,
    )
    .join("");

  return `<svg id="${SPRITE_ID}" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden">${symbols}</svg>`;
}

/**
 * Add the sprite to the page. Safe to call more than once.
 *
 * Must run before any icon is rendered; the bootstrap does it first thing.
 */
export function installIconSprite() {
  const existing = document.getElementById(SPRITE_ID);
  if (existing) existing.remove();
  const holder = document.createElement("div");
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
  if (!def) return "";
  return `<svg class="tk-icon" width="${def.size}" height="${def.size}" aria-hidden="true"><use href="#${symbolId(name)}"/></svg>`;
}
