/**
 * Add Multiples page: default every sale-type dropdown to For Sale/Trade and
 * put the cursor in the first quantity field, so the page is ready to type into
 * on arrival. Track dirty input state, warn on page exit, provide a 3-second pause
 * countdown before submit with cancellation, display enhanced success message post-reload
 * with a Details modal showing added cards (Card No, Player, Qty), track PageIndex and
 * seamlessly auto-advance to next page.
 */

import { Config } from '../core/config.js';
import { recordContract } from '../core/contracts.js';
import { Log } from '../core/log.js';
import { InputIndex } from './inputOptimization.js';

/** How long to keep re-asserting focus if the page keeps taking it away. */
export const FOCUS_DEADLINE_MS = 1200;

/** Key used in sessionStorage to persist add batch info across page reload. */
export const STORAGE_BATCH_KEY = 'sctoolkit_add_multiples_batch';

/** Events that mean the user has taken over. */
const USER_INTENT_EVENTS = ['keydown', 'pointerdown', 'wheel'];

let isSubmitting = false;
let currentDirtyState = { isDirty: false, distinctRows: 0, totalQuantity: 0 };
let activePauseInterval = null;

function getStorage(root = document, win = null) {
  const targetWin = win || (root && root.defaultView) || (typeof window !== 'undefined' ? window : null);
  return targetWin && targetWin.sessionStorage ? targetWin.sessionStorage : (typeof globalThis !== 'undefined' && globalThis.sessionStorage ? globalThis.sessionStorage : null);
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Set every select that offers a For Sale/Trade option to it.
 *
 * @returns {number} how many were changed
 */
export function applySaleTypeDefaults(root = document) {
  let changed = 0;
  root.querySelectorAll('select').forEach((select) => {
    const fsOpt = Array.from(select.options).find((opt) => opt.text.includes('For Sale/Trade'));
    if (!fsOpt || select.value === fsOpt.value) return;
    select.value = fsOpt.value;
    changed++;
  });
  return changed;
}

/**
 * Auto-scroll the element so it is vertically centered if it is currently outside
 * the middle 80% vertically of the screen.
 *
 * @param {HTMLElement} el
 * @returns {boolean} whether auto-scroll was triggered
 */
export function autoScrollIfOutsideMiddle80(el) {
  if (!el || typeof el.getBoundingClientRect !== 'function') return false;

  const viewportHeight = (typeof window !== 'undefined' && window.innerHeight)
    || (typeof document !== 'undefined' && document.documentElement ? document.documentElement.clientHeight : 0);
  if (!viewportHeight) return false;

  const rect = el.getBoundingClientRect();
  const topThreshold = viewportHeight * 0.1;
  const bottomThreshold = viewportHeight * 0.9;

  if (rect.top < topThreshold || rect.bottom > bottomThreshold) {
    if (typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'center', inline: 'nearest' });
    }
    return true;
  }

  return false;
}

/**
 * Extract current PageIndex from URL parameter or hidden input.
 * Default is 1.
 *
 * @param {string} [url]
 * @param {Document|HTMLElement} [root=document]
 * @returns {number}
 */
export function getPageIndex(url = (typeof window !== 'undefined' ? window.location.href : ''), root = document) {
  if (url) {
    const match = /[?&]PageIndex=(\d+)/i.exec(url);
    if (match && match[1]) {
      const idx = parseInt(match[1], 10);
      if (!isNaN(idx) && idx > 0) return idx;
    }
  }

  if (root && typeof root.querySelector === 'function') {
    const input = root.querySelector('input[name="PageIndex"]');
    if (input && input.value) {
      const idx = parseInt(input.value.trim(), 10);
      if (!isNaN(idx) && idx > 0) return idx;
    }
  }

  return 1;
}

/**
 * Find URL for next page if it exists in the pagination navigation.
 *
 * @param {number} currentPageIndex
 * @param {Document|HTMLElement} [root=document]
 * @param {string} [baseUrl]
 * @returns {string|null}
 */
export function getNextPageUrl(currentPageIndex, root = document, baseUrl = (typeof window !== 'undefined' ? window.location.href : '')) {
  if (!root || typeof root.querySelectorAll !== 'function') return null;

  const links = Array.from(root.querySelectorAll('.pagination .page-item a.page-link'));
  const targetPageIndex = currentPageIndex + 1;

  for (const link of links) {
    const href = link.getAttribute('href');
    if (!href) continue;

    const pageMatch = /[?&]PageIndex=(\d+)/i.exec(href);
    if (pageMatch && pageMatch[1]) {
      const idx = parseInt(pageMatch[1], 10);
      if (idx === targetPageIndex) {
        return resolveUrl(href, baseUrl);
      }
    }
  }

  return null;
}

function resolveUrl(relativeOrAbsolute, base) {
  try {
    if (typeof URL !== 'undefined' && base) {
      return new URL(relativeOrAbsolute, base).href;
    }
  } catch {
    // ignore URL parsing error
  }
  return relativeOrAbsolute;
}

/**
 * Get all Quantity inputs that have a non-zero / non-null value.
 *
 * @param {Document|HTMLElement} [root=document]
 * @returns {HTMLInputElement[]}
 */
export function getDirtyQuantityInputs(root = document) {
  if (!root || typeof root.querySelectorAll !== 'function') return [];
  const inputs = Array.from(root.querySelectorAll('input[name^="Quantity_"]'));
  return inputs.filter((el) => {
    const val = (el.value || '').trim();
    if (val === '' || val === '0') return false;
    const num = parseInt(val, 10);
    return !isNaN(num) && num > 0;
  });
}

/**
 * Extract Card No, Player, and Qty details for all dirty quantity inputs.
 *
 * @param {Document|HTMLElement} [root=document]
 * @returns {Array<{name: string, cardNo: string, player: string, qty: number}>}
 */
export function getDirtyCardDetails(root = document) {
  const dirtyInputs = getDirtyQuantityInputs(root);
  return dirtyInputs.map((input) => {
    const qty = parseInt((input.value || '').trim(), 10) || 0;
    const tr = input.closest ? input.closest('tr') : null;
    let cardNo = '';
    let player = '';

    if (tr && tr.querySelectorAll) {
      const cells = Array.from(tr.querySelectorAll('td'));
      const qtyTdIndex = cells.findIndex((td) => td.contains(input));

      if (qtyTdIndex !== -1) {
        if (cells[qtyTdIndex + 1]) {
          cardNo = (cells[qtyTdIndex + 1].textContent || '').trim();
        }
        if (cells[qtyTdIndex + 2]) {
          const playerLink = cells[qtyTdIndex + 2].querySelector('a');
          player = playerLink ? (playerLink.textContent || '').trim() : (cells[qtyTdIndex + 2].textContent || '').trim();
        }
      }
    }

    return {
      name: input.name,
      cardNo: cardNo || 'N/A',
      player: player || 'Unknown',
      qty
    };
  });
}

/**
 * Calculate current dirty state summary.
 *
 * @param {Document|HTMLElement} [root=document]
 * @returns {{isDirty: boolean, distinctRows: number, totalQuantity: number}}
 */
export function getDirtyState(root = document) {
  const dirtyInputs = getDirtyQuantityInputs(root);
  let totalQty = 0;
  dirtyInputs.forEach((input) => {
    const qty = parseInt((input.value || '').trim(), 10);
    if (!isNaN(qty) && qty > 0) totalQty += qty;
  });

  return {
    isDirty: dirtyInputs.length > 0,
    distinctRows: dirtyInputs.length,
    totalQuantity: totalQty
  };
}

/**
 * Setup dirty state tracking on quantity inputs.
 *
 * @param {Document|HTMLElement} [root=document]
 */
export function setupDirtyTracking(root = document) {
  if (!root || typeof root.addEventListener !== 'function') return;

  const updateState = () => {
    const nextState = getDirtyState(root);
    if (
      nextState.isDirty !== currentDirtyState.isDirty ||
      nextState.distinctRows !== currentDirtyState.distinctRows ||
      nextState.totalQuantity !== currentDirtyState.totalQuantity
    ) {
      currentDirtyState = nextState;
      Log(
        `Add Multiples: Dirty state updated (isDirty: ${nextState.isDirty}, distinctRows: ${nextState.distinctRows}, totalQty: ${nextState.totalQuantity}).`,
        'debug'
      );
    }
  };

  root.addEventListener('input', (e) => {
    if (e.target && e.target.name && e.target.name.startsWith('Quantity_')) {
      updateState();
    }
  });

  root.addEventListener('change', (e) => {
    if (e.target && e.target.name && e.target.name.startsWith('Quantity_')) {
      updateState();
    }
  });

  updateState();
}

/**
 * Setup beforeunload listener to warn user if leaving screen while dirty.
 *
 * @param {Window} [win=window]
 * @param {Document|HTMLElement} [root=document]
 */
export function setupBeforeUnloadWarning(win = (typeof window !== 'undefined' ? window : null), root = document) {
  const targetWin = win || (root && root.defaultView) || (typeof window !== 'undefined' ? window : null);
  if (!targetWin || targetWin._sctoolkit_beforeunload_attached) return;
  targetWin._sctoolkit_beforeunload_attached = true;

  targetWin.addEventListener('beforeunload', (e) => {
    const dirty = getDirtyState(root);
    if (dirty.isDirty && !isSubmitting) {
      Log('Add Multiples: User attempted to leave page with unsaved changes.', 'warn');
      const msg = 'You have unsaved quantity changes. Are you sure you want to leave?';
      e.preventDefault();
      e.returnValue = msg;
      return msg;
    }
  });
}

/**
 * Intercept form submit to execute a configurable pause countdown with card stats and a Cancel button.
 *
 * @param {Document|HTMLElement} [root=document]
 */
export function setupSubmitHandler(root = document) {
  if (!root || typeof root.querySelector !== 'function') return;

  const form = root.querySelector('form#add') || root.querySelector('form[name="add"]') || root.querySelector('form[action*="CollectionAddMultiples"]');
  if (!form) {
    Log('Add Multiples: Add form element not found on page.', 'warn');
    return;
  }

  form.addEventListener('submit', (e) => {
    if (isSubmitting) return;

    const dirtyState = getDirtyState(root);
    if (!dirtyState.isDirty || dirtyState.distinctRows === 0) {
      Log('Add Multiples: Submitting form with no quantity changes.', 'info');
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const pauseMs = Config.global?.addMultiplesPauseDurationMs ?? 3000;
    if (pauseMs <= 0) {
      executeFormSubmit(form, dirtyState, root);
      return;
    }

    startPauseCountdown(form, dirtyState, pauseMs, root);
  });
}

function startPauseCountdown(form, dirtyState, pauseMs, root) {
  if (activePauseInterval) {
    clearInterval(activePauseInterval);
    activePauseInterval = null;
  }

  let remainingMs = pauseMs;
  let remainingSec = Math.ceil(remainingMs / 1000);

  const warningAlert = form.querySelector('.alert.alert-warning') || form.querySelector('.alert-warning') || root.querySelector('#add .alert-warning');

  let originalHtml = '';
  if (warningAlert) {
    originalHtml = warningAlert.innerHTML;
  }

  const renderContent = (sec) => `
    <i class="fa-solid fa-circle-info me-2"></i>
    Adding <strong>${dirtyState.distinctRows}</strong> distinct card(s) (Total Quantity: <strong>${dirtyState.totalQuantity}</strong>).
    Processing in <span id="sctoolkit-pause-timer" class="fw-bold">${sec}</span>s...
    <button type="button" id="sctoolkit-cancel-add-btn" class="btn btn-sm btn-outline-danger ms-3">Cancel</button>
  `;

  if (warningAlert) {
    warningAlert.innerHTML = renderContent(remainingSec);
    autoScrollIfOutsideMiddle80(warningAlert);
  } else {
    const existingBanner = root.querySelector('#sctoolkit-add-pause-banner');
    if (existingBanner) existingBanner.remove();

    const banner = document.createElement('div');
    banner.id = 'sctoolkit-add-pause-banner';
    banner.className = 'alert alert-warning d-flex align-items-center justify-content-between my-3 shadow-sm';
    banner.role = 'alert';
    banner.innerHTML = renderContent(remainingSec);

    if (form.parentNode) {
      form.parentNode.insertBefore(banner, form);
    }
    autoScrollIfOutsideMiddle80(banner);
  }

  Log(
    `Add Multiples: Pause initiated. Adding ${dirtyState.distinctRows} distinct card(s) (${dirtyState.totalQuantity} total qty). Countdown: ${remainingSec}s.`,
    'info'
  );

  const targetContainer = warningAlert || root.querySelector('#sctoolkit-add-pause-banner');
  const timerSpan = targetContainer ? targetContainer.querySelector('#sctoolkit-pause-timer') : null;
  const cancelBtn = targetContainer ? targetContainer.querySelector('#sctoolkit-cancel-add-btn') : null;

  const cleanup = () => {
    if (activePauseInterval) {
      clearInterval(activePauseInterval);
      activePauseInterval = null;
    }
    if (warningAlert && originalHtml) {
      warningAlert.innerHTML = originalHtml;
    } else {
      const banner = root.querySelector('#sctoolkit-add-pause-banner');
      if (banner) banner.remove();
    }
  };

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      cleanup();
      isSubmitting = false;
      Log('Add Multiples: Addition process cancelled by user.', 'info');
    });
  }

  activePauseInterval = setInterval(() => {
    remainingMs -= 1000;
    remainingSec = Math.ceil(remainingMs / 1000);

    if (remainingSec > 0) {
      if (timerSpan) timerSpan.textContent = String(remainingSec);
      Log(`Add Multiples: Countdown ${remainingSec}s remaining...`, 'debug');
    } else {
      cleanup();
      executeFormSubmit(form, dirtyState, root);
    }
  }, 1000);
}

function executeFormSubmit(form, dirtyState, root) {
  const targetWin = (root && root.defaultView) || (typeof window !== 'undefined' ? window : null);
  const currentUrl = targetWin && targetWin.location ? targetWin.location.href : '';
  const currentPageIndex = getPageIndex(currentUrl, root);
  const nextPageUrl = getNextPageUrl(currentPageIndex, root, currentUrl);
  const autoAdvance = Config.global?.addMultiplesAutoAdvance ?? true;

  if (autoAdvance && nextPageUrl) {
    const nextPageIndex = currentPageIndex + 1;
    // Update form action and hidden input to target next page seamlessly on POST
    if (form.action) {
      if (/[?&]PageIndex=\d+/i.test(form.action)) {
        form.action = form.action.replace(/([?&]PageIndex=)\d+/i, `$1${nextPageIndex}`);
      } else {
        form.action += (form.action.includes('?') ? '&' : '?') + `PageIndex=${nextPageIndex}`;
      }
    }
    const pageIndexInput = form.querySelector('input[name="PageIndex"]');
    if (pageIndexInput) {
      pageIndexInput.value = String(nextPageIndex);
    }
  }

  const batchData = {
    distinctRows: dirtyState.distinctRows,
    totalQuantity: dirtyState.totalQuantity,
    pageIndex: currentPageIndex,
    items: getDirtyCardDetails(root),
    timestamp: Date.now()
  };

  try {
    const storage = getStorage(root);
    if (storage) {
      storage.setItem(STORAGE_BATCH_KEY, JSON.stringify(batchData));
    }
  } catch (err) {
    Log(`Add Multiples: Failed to save batch data to sessionStorage: ${err.message}`, 'error');
  }

  isSubmitting = true;
  Log(
    `Add Multiples: Countdown complete. Submitting ${dirtyState.distinctRows} card(s) (${dirtyState.totalQuantity} total qty) from Page ${currentPageIndex}...`,
    'info'
  );

  if (typeof form.submit === 'function') {
    form.submit();
  }
}

/**
 * Check if page just reloaded after an Add operation and update the success alert message.
 * Supports displaying a Details modal listing the added cards (Card No, Player, Qty).
 *
 * @param {Document|HTMLElement} [root=document]
 */
export function checkAndHandlePostReloadSuccess(root = document) {
  if (!root || typeof root.querySelector !== 'function') return;

  let batchData = null;
  const storage = getStorage(root);

  try {
    if (storage) {
      const stored = storage.getItem(STORAGE_BATCH_KEY);
      if (stored) {
        batchData = JSON.parse(stored);
        storage.removeItem(STORAGE_BATCH_KEY);
      }
    }
  } catch (err) {
    Log(`Add Multiples: Failed to read batch data from sessionStorage: ${err.message}`, 'error');
  }

  if (!batchData) return;

  const targetWin = (root && root.defaultView) || (typeof window !== 'undefined' ? window : null);
  const currentUrl = targetWin && targetWin.location ? targetWin.location.href : '';
  const currentPageIndex = getPageIndex(currentUrl, root);

  let successAlert =
    root.querySelector('#content > div.col-md-6.nopadding > div > div.alert.alert-success') ||
    root.querySelector('#content .alert-success') ||
    root.querySelector('.alert.alert-success');

  if (!successAlert) {
    successAlert = document.createElement('div');
    successAlert.className = 'alert alert-success mt-2 mb-3';
    successAlert.role = 'alert';
    const container = root.querySelector('#content > div.col-md-6.nopadding > div') || root.querySelector('#content') || root.body;
    if (container && container.firstChild) {
      container.insertBefore(successAlert, container.firstChild);
    } else if (container) {
      container.appendChild(successAlert);
    }
  }

  const { distinctRows, totalQuantity, pageIndex, items } = batchData;
  const isDifferentPage = (currentPageIndex !== pageIndex);
  const pageLabel = isDifferentPage ? `from Page ${pageIndex}` : `(from Page ${pageIndex})`;

  successAlert.innerHTML = `
    <div class="d-flex align-items-center justify-content-between w-100 flex-wrap gap-2">
      <div>
        <i class="fa-solid fa-circle-check me-1"></i>
        The cards have been added ${pageLabel}: <strong>${distinctRows}</strong> distinct card(s), <strong>${totalQuantity}</strong> total item(s).
      </div>
      ${items && items.length > 0 ? `
        <div>
          <button type="button" id="sctoolkit-added-details-btn" class="btn btn-sm btn-outline-success">
            <i class="fa-solid fa-list me-1"></i> Details
          </button>
        </div>
      ` : ''}
    </div>
  `;

  const detailsBtn = successAlert.querySelector('#sctoolkit-added-details-btn');
  if (detailsBtn && items && items.length > 0) {
    detailsBtn.addEventListener('click', () => {
      showAddedDetailsModal(batchData, root);
    });
  }

  Log(
    `Add Multiples: Enhanced success message rendered on Page ${currentPageIndex} (${distinctRows} card(s), ${totalQuantity} total qty added from Page ${pageIndex}).`,
    'info'
  );
}

/**
 * Show details modal displaying the list of cards added (Card No, Player, Qty).
 *
 * @param {{distinctRows: number, totalQuantity: number, pageIndex: number, items: Array<{cardNo: string, player: string, qty: number}>}} batchData
 * @param {Document|HTMLElement} [root=document]
 */
export function showAddedDetailsModal(batchData, root = document) {
  const existingModal = root.querySelector('#sctoolkit-added-details-modal');
  if (existingModal) existingModal.remove();

  const modal = document.createElement('div');
  modal.id = 'sctoolkit-added-details-modal';
  modal.className = 'modal fade show';
  modal.tabIndex = -1;
  modal.style.cssText = 'display: block; background: rgba(0, 0, 0, 0.5); z-index: 1060;';
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('role', 'dialog');

  const itemsHtml = (batchData.items || []).map((item, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td><strong>${escapeHtml(item.cardNo)}</strong></td>
      <td>${escapeHtml(item.player)}</td>
      <td class="text-end"><span class="badge bg-primary fs-6">${item.qty}</span></td>
    </tr>
  `).join('');

  modal.innerHTML = `
    <div class="modal-dialog modal-lg modal-dialog-centered">
      <div class="modal-content shadow-lg">
        <div class="modal-header">
          <h5 class="modal-title">
            <i class="fa-solid fa-layer-group me-2"></i> Cards Added Details (Page ${batchData.pageIndex})
          </h5>
          <button type="button" class="btn-close" id="sctoolkit-details-modal-close-x" aria-label="Close"></button>
        </div>
        <div class="modal-body" style="max-height: 60vh; overflow-y: auto;">
          <table class="table table-striped table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>#</th>
                <th>Card No</th>
                <th>Player</th>
                <th class="text-end">Quantity</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
        </div>
        <div class="modal-footer d-flex justify-content-between align-items-center">
          <div class="text-muted small">Total: ${batchData.distinctRows} card(s), ${batchData.totalQuantity} total item(s)</div>
          <button type="button" class="btn btn-secondary" id="sctoolkit-details-modal-close-btn">Close</button>
        </div>
      </div>
    </div>
  `;

  const docBody = root.body || (root.ownerDocument ? root.ownerDocument.body : root);
  docBody.appendChild(modal);

  const closeModal = () => {
    modal.remove();
    Log('Add Multiples: Details modal closed.', 'debug');
  };

  const closeBtn = modal.querySelector('#sctoolkit-details-modal-close-btn');
  const closeX = modal.querySelector('#sctoolkit-details-modal-close-x');

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (closeX) closeX.addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
}

/**
 * Focus the first quantity field, and keep it focused against the page's own
 * scripts — but stop the instant the user does anything.
 */
function focusFirstQuantityField() {
  const target = (() => {
    const inputs = InputIndex.getValidInputs();
    return inputs.find((el) => el.value === '0') || inputs[0] || null;
  })();

  if (!target) return;

  let cancelled = false;
  const focusDeadlineMs = Config.global?.addMultiplesFocusDeadlineMs ?? FOCUS_DEADLINE_MS;
  const deadline = Date.now() + focusDeadlineMs;

  const stop = () => {
    if (cancelled) return;
    cancelled = true;
    USER_INTENT_EVENTS.forEach((type) => document.removeEventListener(type, stop, true));
  };

  USER_INTENT_EVENTS.forEach((type) => document.addEventListener(type, stop, true));

  const assert = () => {
    if (cancelled) return;

    if (document.activeElement !== target) {
      target.focus({ preventScroll: true });
      target.select();
    }
    autoScrollIfOutsideMiddle80(target);

    if (Date.now() < deadline) {
      const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function' ? window.requestAnimationFrame : null);
      if (raf) raf(assert);
    } else {
      stop();
    }
  };

  assert();
}

export function initAddMultiplesEnhancer(root = (typeof document !== 'undefined' ? document : null)) {
  if (!root) return;

  if (typeof document !== 'undefined') {
    document.addEventListener('focusin', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) {
        autoScrollIfOutsideMiddle80(e.target);
      }
    });
  }

  const changed = applySaleTypeDefaults(root);
  if (changed > 0) Log(`Add Multiples: defaulted ${changed} sale-type select(s).`, 'debug');

  recordContract(
    'addMultiplesEnhancer',
    `${changed} sale-type select(s) defaulted`,
    root.querySelectorAll('select').length > 0
  );

  isSubmitting = false;

  setupDirtyTracking(root);
  setupBeforeUnloadWarning(typeof window !== 'undefined' ? window : null, root);
  setupSubmitHandler(root);
  checkAndHandlePostReloadSuccess(root);

  focusFirstQuantityField();
}
