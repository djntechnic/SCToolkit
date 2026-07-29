/**
 * Theme resolution.
 *
 * The plan called for a third source between the user's setting and the OS —
 * the site's own theme. The real captures in `test/fixtures/real/` carry no
 * theme signal at all: no `data-bs-theme`, no theme class, no toggle. The site
 * has one appearance. So there is nothing to detect and that branch is not
 * implemented; resolution is the user's explicit choice, else the OS.
 */

import { Config } from '../core/config.js';
import { Log } from '../core/log.js';

/** Attribute set on `<html>`; every dark override keys off it. */
export const THEME_ATTR = 'data-sctk-theme';

export const THEMES = ['auto', 'light', 'dark'];

/**
 * Resolve a stored preference to a concrete theme.
 *
 * @param {string} preference one of THEMES
 * @param {boolean} prefersDark what the OS reports
 * @returns {'light'|'dark'}
 */
export function resolveTheme(preference, prefersDark) {
  if (preference === 'light' || preference === 'dark') return preference;
  return prefersDark ? 'dark' : 'light';
}

/** @returns {boolean} */
function osPrefersDark() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Apply the current preference to the document. */
export function applyTheme() {
  const resolved = resolveTheme(Config.global.theme, osPrefersDark());
  document.documentElement.setAttribute(THEME_ATTR, resolved);
  return resolved;
}

/**
 * Apply the theme and keep it in step with the OS while the page is open.
 *
 * Only meaningful on the `auto` preference, but the listener is harmless
 * otherwise and avoids having to re-register when the setting changes.
 */
export function initTheme() {
  const resolved = applyTheme();
  Log(`Theme resolved to '${resolved}' from preference '${Config.global.theme}'.`, 'debug');

  if (typeof matchMedia !== 'function') return;
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (Config.global.theme === 'auto') applyTheme();
  });
}
