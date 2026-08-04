/**
 * Collection Quantity Counter module.
 *
 * Counts distinct cards with Qty >= 1, overall cards, and total item quantity
 * on ViewCollectionForSaleTrade and ViewCollectionWantlist pages.
 * Displays a small overlay (bottom-left, bottom-right, or toolbar) that
 * updates dynamically whenever input fields/checkboxes/AJAX rows change.
 */

import { Config } from '../core/config.js';
import { Log } from '../core/log.js';
import { containerFor } from '../ui/toast.js';

let activeObserver = null;
let boundListeners = [];

/**
 * Extract counts from table rows on the page.
 *
 * @param {Document|HTMLElement} [root=document]
 * @returns {{ distinctQtyCount: number, totalCardRows: number, totalQuantitySum: number }}
 */
export function countCollectionQuantities(root = document) {
  let distinctQtyCount = 0;
  let totalCardRows = 0;
  let totalQuantitySum = 0;

  // Locate data rows in card table.
  // Prefer explicit TCDB `tr.collection_row` elements if present.
  let cardRows = Array.from(root.querySelectorAll('tr.collection_row'));

  if (cardRows.length === 0) {
    cardRows = Array.from(
      root.querySelectorAll('#main-content-area table tr, #content table tr')
    ).filter((tr) => {
      // Exclude toolbar, filter bar, sidebar/legend columns, and offcanvas panels
      if (
        tr.closest('#sctk-toolbar') ||
        tr.closest('#tk-checklist-filter-wrap') ||
        tr.closest('.col-md-3') ||
        tr.closest('.col-lg-3') ||
        tr.closest('#offcanvas') ||
        tr.closest('.sidebar')
      ) {
        return false;
      }
      return !!tr.querySelector('a[href*="ViewCard.cfm"], a[href*="CollectionEdit.cfm"]');
    });
  }

  totalCardRows = cardRows.length;

  cardRows.forEach((row) => {
    let qty = 0;

    // 1. Look for quantity badge (span.badge, .badge.bg-primary) in first cell / row
    const badge = row.querySelector('.badge, span.badge, a[href*="CollectionEdit.cfm"] .badge');
    if (badge) {
      const parsed = parseInt(badge.textContent.trim(), 10);
      if (!isNaN(parsed)) qty = Math.max(0, parsed);
    }

    // 2. Look for checked checkbox or quantity input if no badge gave a value
    if (qty === 0) {
      const qtyInput = row.querySelector('input[name*="QTY" i], input[type="number"]');
      if (qtyInput && qtyInput.value) {
        const parsed = parseInt(qtyInput.value.trim(), 10);
        if (!isNaN(parsed)) qty = Math.max(0, parsed);
      } else {
        const checkbox = row.querySelector('input[type="checkbox"]');
        if (checkbox && checkbox.checked) {
          qty = 1;
        }
      }
    }

    if (qty >= 1) {
      distinctQtyCount++;
      totalQuantitySum += qty;
    }
  });

  return { distinctQtyCount, totalCardRows, totalQuantitySum };
}

/**
 * Render or update the quantity counter widget on the page.
 *
 * @param {{ distinctQtyCount: number, totalCardRows: number, totalQuantitySum: number }} counts
 */
export function updateQuantityCounterWidget(counts) {
  let widget = document.getElementById('sctk-qty-counter');
  if (!widget) {
    widget = document.createElement('div');
    widget.id = 'sctk-qty-counter';
  }

  const position = Config.global?.quantityCounterPosition || 'bottom-right';

  // Apply position class
  widget.className = `sctk-qty-counter sctk-qty-counter-${position}`;

  const html = `
    <span class="tk-qty-label">Card Count:</span>
    <strong class="tk-qty-val">${counts.distinctQtyCount}</strong>
    <span class="tk-qty-sep">/</span>
    <span class="tk-qty-total">${counts.totalCardRows}</span>
    <span class="tk-qty-sub">(Total Count: <strong>${counts.totalQuantitySum}</strong>)</span>
  `;

  widget.innerHTML = html;
  widget.title = `Card Count: ${counts.distinctQtyCount} / ${counts.totalCardRows} (Total Count: ${counts.totalQuantitySum})`;

  // Mount in desired DOM location
  if (position === 'toolbar') {
    const toolbarCenter = document.getElementById('tk-center-context') || document.getElementById('tk-actions');
    if (toolbarCenter && widget.parentElement !== toolbarCenter) {
      toolbarCenter.appendChild(widget);
    }
  } else {
    const container = containerFor(position);
    if (widget.parentElement !== container) {
      container.appendChild(widget);
    }
  }
}

/**
 * Initialize Collection Quantity Counter module.
 */
export function initCollectionQuantityCounter() {
  Log('Initializing Collection Quantity Counter module', 'debug');

  const update = () => {
    const counts = countCollectionQuantities(document);
    updateQuantityCounterWidget(counts);
  };

  // Initial calculation
  update();

  // Clean up any old listeners/observers
  cleanupCollectionQuantityCounter();

  // 1. Dynamic event listeners for input / change / click events on form fields
  const handleEvent = (e) => {
    const target = e.target;
    if (
      target &&
      (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.classList?.contains('badge') || target.closest?.('.badge'))
    ) {
      setTimeout(update, 50);
    }
  };

  document.addEventListener('change', handleEvent, true);
  document.addEventListener('input', handleEvent, true);
  document.addEventListener('click', handleEvent, true);
  boundListeners.push({ type: 'change', fn: handleEvent }, { type: 'input', fn: handleEvent }, { type: 'click', fn: handleEvent });

  // 2. MutationObserver for DOM changes (AJAX updates, row color change, ColdFusion navigate)
  const targetArea = document.querySelector('#main-content-area') || document.querySelector('#content') || document.body;
  if (targetArea && typeof MutationObserver !== 'undefined') {
    let debounceTimer = null;
    activeObserver = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(update, 100);
    });
    activeObserver.observe(targetArea, { childList: true, subtree: true, attributes: true });
  }
}

/** Clean up observers & listeners */
export function cleanupCollectionQuantityCounter() {
  if (activeObserver) {
    activeObserver.disconnect();
    activeObserver = null;
  }
  boundListeners.forEach(({ type, fn }) => {
    document.removeEventListener(type, fn, true);
  });
  boundListeners = [];
}
