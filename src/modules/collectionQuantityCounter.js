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
      const qtyInput = row.querySelector('input[name*="QTY" i], input[type="number"]:not(.tk-qty-input)');
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

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Extract Card No, Player, Tags, Team, and Qty details for added cards (Qty >= 1).
 *
 * @param {Document|HTMLElement} [root=document]
 * @returns {Array<{cardNo: string, player: string, tags: string, team: string, qty: number}>}
 */
export function getCollectionCardDetails(root = document) {
  let cardRows = Array.from(root.querySelectorAll('tr.collection_row'));

  if (cardRows.length === 0) {
    cardRows = Array.from(
      root.querySelectorAll('#main-content-area table tr, #content table tr')
    ).filter((tr) => {
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

  const items = [];

  cardRows.forEach((row) => {
    let qty = 0;
    const badge = row.querySelector('.badge, span.badge, a[href*="CollectionEdit.cfm"] .badge');
    if (badge) {
      const parsed = parseInt(badge.textContent.trim(), 10);
      if (!isNaN(parsed)) qty = Math.max(0, parsed);
    }

    if (qty === 0) {
      const qtyInput = row.querySelector('input[name*="QTY" i], input[type="number"]:not(.tk-qty-input)');
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

    if (qty < 1) return;

    let cardNo = '';
    let player = '';
    let tags = '';
    let team = '';

    const tds = Array.from(row.querySelectorAll('td'));

    if (tds.length >= 8) {
      // Standard TCDB collection row layout:
      // 1st <td> (tds[0]): Qty
      // 6th <td> (tds[5]): Card #
      // 7th <td> (tds[6]): Player with Tags
      // 8th <td> (tds[7]): Team
      const cardNoLink = tds[5].querySelector('a[href*="ViewCard.cfm"]');
      cardNo = (cardNoLink ? cardNoLink.textContent : tds[5].textContent).trim();

      const playerLink = tds[6].querySelector('a[href*="ViewCard.cfm"], a[href*="Person.cfm"]');
      player = (playerLink ? playerLink.textContent : tds[6].textContent).trim();

      const playerTdClone = tds[6].cloneNode(true);
      playerTdClone.querySelectorAll('a').forEach((a) => a.remove());
      tags = playerTdClone.textContent.trim();

      const teamLink = tds[7].querySelector('a[href*="ViewCard.cfm"], a[href*="Team.cfm"]');
      team = (teamLink ? teamLink.textContent : tds[7].textContent).trim();
    } else {
      // Fallback targeting ViewCard.cfm links explicitly (ignoring CollectionEdit.cfm dropdown links)
      const viewCardLinks = Array.from(row.querySelectorAll('a[href*="ViewCard.cfm"]'));

      if (viewCardLinks.length >= 2) {
        cardNo = viewCardLinks[0].textContent.trim();
        player = viewCardLinks[1].textContent.trim();
        if (viewCardLinks.length >= 3) {
          team = viewCardLinks[2].textContent.trim();
        }
        const playerTd = viewCardLinks[1].closest('td');
        if (playerTd) {
          const playerTdClone = playerTd.cloneNode(true);
          playerTdClone.querySelectorAll('a').forEach((a) => a.remove());
          tags = playerTdClone.textContent.trim();
        }
      } else if (viewCardLinks.length === 1) {
        cardNo = viewCardLinks[0].textContent.trim();
        const cardTd = viewCardLinks[0].closest('td');
        const nextTd = cardTd ? cardTd.nextElementSibling : null;
        if (nextTd) {
          const playerLink = nextTd.querySelector('a');
          player = playerLink ? playerLink.textContent.trim() : nextTd.textContent.trim();
          const playerClone = nextTd.cloneNode(true);
          playerClone.querySelectorAll('a').forEach((a) => a.remove());
          tags = playerClone.textContent.trim();

          const teamTd = nextTd.nextElementSibling;
          if (teamTd) {
            team = teamTd.textContent.trim();
          }
        }
      }
    }

    if (!team) {
      const teamLink = row.querySelector('a[href*="Team.cfm"], a[href*="ViewTeams.cfm"]');
      if (teamLink) team = teamLink.textContent.trim();
    }

    items.push({
      cardNo: cardNo || 'N/A',
      player: player || 'Unknown',
      tags: tags || '',
      team: team || '',
      qty
    });
  });

  return items;
}

/**
 * Display a modal showing Card No, Player, Tags, Team, and Qty for added items in collection.
 *
 * @param {{ distinctQtyCount?: number, totalCardRows?: number, totalQuantitySum?: number }} [counts]
 * @param {Document|HTMLElement} [root=document]
 */
export function showCollectionQuantityDetailsModal(counts = {}, root = document) {
  const doc = root.ownerDocument || root;
  const docBody = doc.body || root;

  const existingModal = docBody.querySelector('#sctk-qty-details-modal');
  if (existingModal) existingModal.remove();

  const items = getCollectionCardDetails(root);

  const distinctCount = counts.distinctQtyCount ?? items.length;
  const totalQuantity = counts.totalQuantitySum ?? items.reduce((sum, item) => sum + item.qty, 0);

  const itemsHtml = items.length > 0
    ? items.map((item) => `
        <tr>
          <td><strong>${escapeHtml(item.cardNo)}</strong></td>
          <td>${escapeHtml(item.player)}</td>
          <td>${item.tags ? `<span class="badge bg-secondary">${escapeHtml(item.tags)}</span>` : ''}</td>
          <td>${escapeHtml(item.team)}</td>
          <td class="text-end"><span class="badge bg-primary fs-6">${item.qty}</span></td>
        </tr>
      `).join('')
    : `<tr><td colspan="5" class="text-center text-muted py-4">No added items found (Qty >= 1).</td></tr>`;

  const modal = document.createElement('div');
  modal.id = 'sctk-qty-details-modal';
  modal.className = 'modal fade show';
  modal.tabIndex = -1;
  modal.style.cssText = 'display: block; background: rgba(0, 0, 0, 0.5); z-index: 1060;';
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('role', 'dialog');

  modal.innerHTML = `
    <div class="modal-dialog modal-lg modal-dialog-centered">
      <div class="modal-content shadow-lg">
        <div class="modal-header">
          <h5 class="modal-title">
            <i class="fa-solid fa-list-check me-2"></i> Collection Card Totals & Details
          </h5>
          <button type="button" class="btn-close" id="sctk-qty-modal-close-x" aria-label="Close"></button>
        </div>
        <div class="modal-body" style="max-height: 60vh; overflow-y: auto;">
          <table class="table table-striped table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Card No</th>
                <th>Player</th>
                <th>Tags</th>
                <th>Team</th>
                <th class="text-end">Qty</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
        </div>
        <div class="modal-footer d-flex justify-content-between align-items-center">
          <div class="text-muted small">Total: <strong>${distinctCount}</strong> distinct card(s), <strong>${totalQuantity}</strong> total item(s)</div>
          <button type="button" class="btn btn-secondary" id="sctk-qty-modal-close-btn">Close</button>
        </div>
      </div>
    </div>
  `;

  docBody.appendChild(modal);
  Log(`Collection Quantity Counter: Details modal opened showing ${items.length} card(s).`, 'info');

  const closeModal = () => {
    modal.remove();
    Log('Collection Quantity Counter: Details modal closed.', 'debug');
  };

  const closeBtn = modal.querySelector('#sctk-qty-modal-close-btn');
  const closeX = modal.querySelector('#sctk-qty-modal-close-x');

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (closeX) closeX.addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
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
    <button type="button" id="sctk-qty-details-btn" class="btn btn-sm btn-outline-primary ms-2 tk-qty-details-btn" style="padding: 1px 6px; font-size: 11px; margin-left: 6px;">
      <i class="fa-solid fa-list me-1"></i> Details
    </button>
  `;

  widget.innerHTML = html;
  widget.title = `Card Count: ${counts.distinctQtyCount} / ${counts.totalCardRows} (Total Count: ${counts.totalQuantitySum})`;

  const detailsBtn = widget.querySelector('#sctk-qty-details-btn');
  if (detailsBtn) {
    detailsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showCollectionQuantityDetailsModal(counts, widget.ownerDocument || document);
    });
  }

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

  const handleCustomEvent = () => setTimeout(update, 50);
  document.addEventListener('change', handleEvent, true);
  document.addEventListener('input', handleEvent, true);
  document.addEventListener('click', handleEvent, true);
  document.addEventListener('sctk:collection-changed', handleCustomEvent, true);
  boundListeners.push(
    { type: 'change', fn: handleEvent },
    { type: 'input', fn: handleEvent },
    { type: 'click', fn: handleEvent },
    { type: 'sctk:collection-changed', fn: handleCustomEvent }
  );

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
