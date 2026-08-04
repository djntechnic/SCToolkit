/**
 * Transient notifications, stacked per screen corner.
 *
 * Variants are named rather than passed as a raw colour. v2.42.0 took an
 * `accent` CSS value at every call site, so the meaning of a toast lived in
 * whichever `var(--tk-red)` the caller happened to type.
 */

import { Config } from '../core/config.js';

/** Named variants; the value is the token used for the left border. */
export const TOAST_VARIANTS = {
  info: 'var(--tk-teal)',
  success: 'var(--tk-green)',
  warn: 'var(--tk-accent)',
  error: 'var(--tk-red)',
  progress: 'var(--tk-blue)',
  muted: 'var(--tk-text-muted)'
};

/** Most toasts visible at once per corner; older ones are dropped. */
export const STACK_LIMIT = 4;

/**
 * @param {string} location
 * @returns {HTMLElement}
 */
export function containerFor(location) {
  const id = `tk-toast-container-${location}`;
  let container = document.getElementById(id);
  if (!container) {
    container = document.createElement('div');
    container.id = id;
    container.className = `tk-toast-container tk-toast-${location}`;
    // Announced politely: a toast is informational and must not interrupt a
    // screen reader mid-sentence.
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('role', 'status');
    document.body.appendChild(container);
  }
  return container;
}

/**
 * Show a toast.
 *
 * `message` is inserted as HTML so callers can bold a set name or list active
 * modules. Any page- or user-derived text must be run through `escapeHtml()`
 * by the caller first.
 *
 * @param {object} [options]
 * @param {string} [options.message] HTML content
 * @param {keyof TOAST_VARIANTS} [options.variant]
 * @param {'bottom-right'|'bottom-left'|'top-right'|'top-left'} [options.location]
 * @param {number} [options.duration] ms before dismissal
 * @param {string} [options.accent] explicit colour, overriding the variant
 * @returns {HTMLElement} the toast element
 */
export function showToast({
  message = '',
  variant = 'info',
  location = 'bottom-right',
  duration = Config.global.toastDurationMs,
  accent
} = {}) {
  const container = containerFor(location);

  // Limit only active toast messages, preserving persistent corner widgets
  const toasts = Array.from(container.querySelectorAll('.tk-toast-message'));
  while (toasts.length >= STACK_LIMIT) {
    const oldest = toasts.shift();
    oldest.remove();
  }

  const toast = document.createElement('div');
  toast.className = 'tk-toast-message';
  toast.style.borderLeftColor = accent ?? TOAST_VARIANTS[variant] ?? TOAST_VARIANTS.info;
  toast.innerHTML = message;

  // Insert before persistent corner widget if present, so toasts stack above the card
  const widget = container.querySelector('.sctk-qty-counter');
  if (widget) {
    container.insertBefore(toast, widget);
  } else {
    container.appendChild(toast);
  }

  setTimeout(() => toast.classList.add('tk-toast-show'), 10);

  if (duration !== Infinity) scheduleDismiss(toast, container, duration);
  return toast;
}

/** @param {HTMLElement} toast @param {HTMLElement} container @param {number} delay */
function scheduleDismiss(toast, container, delay) {
  setTimeout(() => {
    toast.classList.remove('tk-toast-show');
    setTimeout(() => {
      toast.remove();
      if (container.children.length === 0) container.remove();
    }, 300);
  }, delay);
}

/**
 * A toast that stays put and updates in place, for work with a known end.
 *
 * A multi-page export used to churn the one-line status readout and emit
 * nothing else, so there was no visible record that anything was happening —
 * or any way to stop it from where you were looking.
 *
 * @param {object} [options]
 * @param {string} [options.title]
 * @param {(() => void)|null} [options.onCancel] renders a Cancel affordance
 * @returns {{update: (message: string) => void, finish: (message: string, variant?: string) => void}}
 */
export function showProgressToast({ title = 'Working', onCancel = null } = {}) {
  const toast = showToast({ variant: 'progress', duration: Infinity, message: '' });

  const heading = document.createElement('b');
  heading.textContent = title;
  const detail = document.createElement('div');
  detail.className = 'tk-toast-detail';

  toast.append(heading, detail);

  if (onCancel) {
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'tk-toast-cancel';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', () => {
      cancel.disabled = true;
      onCancel();
    });
    toast.appendChild(cancel);
  }

  return {
    update: (message) => { detail.textContent = message; },
    finish: (message, variant = 'success') => {
      detail.textContent = message;
      toast.querySelector('.tk-toast-cancel')?.remove();
      toast.style.borderLeftColor = TOAST_VARIANTS[variant] ?? TOAST_VARIANTS.info;
      scheduleDismiss(toast, toast.parentElement, Config.global.toastDurationMs);
    }
  };
}
