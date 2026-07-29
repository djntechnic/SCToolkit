/**
 * Small DOM helpers shared across the UI layer.
 */

import { Log } from '../core/log.js';

/**
 * Append a `<style>` element to the document head.
 *
 * A raw element rather than `GM_addStyle`: the grant is one fewer permission to
 * request, and the behaviour is identical.
 *
 * @param {string} css
 * @returns {HTMLStyleElement}
 */
export function injectStyle(css) {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  return style;
}

/**
 * Create a toolbar button.
 *
 * v2.42.0 took a fifth `icon` argument that no caller ever passed, so every
 * button rendered an empty icon slot. It is gone; a button that needs an icon
 * can have one added deliberately.
 *
 * @param {string} id
 * @param {string} text
 * @param {(e: Event) => void} onClick
 * @param {boolean} [disabled]
 * @returns {HTMLButtonElement}
 */
export function createBtn(id, text, onClick, disabled = false) {
  const btn = document.createElement('button');
  btn.id = id;
  btn.type = 'button';
  btn.className = 'sctk-btn';
  btn.textContent = text;
  btn.disabled = disabled;
  btn.addEventListener('click', onClick);
  return btn;
}

/**
 * Trailing-edge debounce.
 *
 * @param {Function} fn
 * @param {number} waitMs
 * @returns {(...args: any[]) => void}
 */
export function debounce(fn, waitMs) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), waitMs);
  };
}

/**
 * Escape a string for interpolation into `innerHTML`.
 *
 * @param {*} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Verify that the selectors a module depends on actually exist, and warn when
 * they do not.
 *
 * This is the early-warning system for the project's main failure mode: the
 * site changes its markup and a feature stops working without erroring. A
 * failed check is informational — the module still runs and simply no-ops.
 *
 * @param {string} moduleId
 * @param {Array<{selector: string, context?: ParentNode, label?: string}>} checks
 * @returns {boolean} true when every selector resolved
 */
export function assertContract(moduleId, checks) {
  const failures = [];
  checks.forEach(({ selector, context = document, label }) => {
    let found;
    try {
      found = context.querySelector(selector);
    } catch {
      found = null;
    }
    if (!found) failures.push(label || selector);
  });

  if (failures.length > 0) {
    Log(
      `[Contract Check] Module '${moduleId}' — expected selector(s) not found: ${failures.join('; ')}. ` +
      'Site markup may have changed; affected functionality may silently no-op.',
      'warn'
    );
    return false;
  }
  return true;
}
