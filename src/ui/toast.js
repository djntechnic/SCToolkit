/**
 * Transient notifications, stacked per screen corner.
 */

import { Config } from '../core/config.js';

/**
 * Show a toast.
 *
 * `message` is inserted as HTML so callers can bold a set name or list active
 * modules. Any page- or user-derived text must be run through
 * `escapeHtml()` by the caller first.
 *
 * @param {object} [options]
 * @param {string} [options.message] HTML content
 * @param {'bottom-right'|'bottom-left'|'top-right'|'top-left'} [options.location]
 * @param {number} [options.duration] ms before dismissal
 * @param {string} [options.accent] CSS colour for the left border
 */
export function showToast({
  message = '',
  location = 'bottom-right',
  duration = Config.global.toastDurationMs,
  accent = 'var(--tk-teal)'
} = {}) {
  const containerId = `tk-toast-container-${location}`;
  let container = document.getElementById(containerId);

  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    container.className = `tk-toast-container tk-toast-${location}`;
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'tk-toast-message';
  toast.style.borderLeftColor = accent;
  toast.innerHTML = message;

  container.appendChild(toast);

  setTimeout(() => toast.classList.add('tk-toast-show'), 10);

  setTimeout(() => {
    toast.classList.remove('tk-toast-show');
    setTimeout(() => {
      toast.remove();
      if (container.childNodes.length === 0) container.remove();
    }, 300);
  }, duration);
}
