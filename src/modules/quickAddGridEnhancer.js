/**
 * Quick Add Grid Enhancer
 *
 * Injects styled, wrapping inline quantity inputs across Collection, Wantlist,
 * and For Sale/Trade views on TCDB.
 */

import { assertContract } from '../core/contracts.js';
import { Log } from '../core/log.js';

/**
 * Determine list context flag: 'W' (Wantlist), 'S' (For Sale/Trade), or 'G' (Collection).
 *
 * @param {string} [pathname]
 * @returns {'G'|'W'|'S'}
 */
export function getListContext(pathname = window.location.pathname) {
  const lowerPath = pathname.toLowerCase();
  if (lowerPath.includes('wantlist')) return 'W';
  if (lowerPath.includes('forsaletrade')) return 'S';
  return 'G';
}

/**
 * Extract context SetID from URL path or query params.
 *
 * @param {string} [pathname]
 * @param {string} [search]
 * @returns {string}
 */
export function getContextSetId(
  pathname = window.location.pathname,
  search = window.location.search
) {
  const pathMatch = pathname.match(/\/sid\/(\d+)/i);
  if (pathMatch) return pathMatch[1];
  const urlParams = new URLSearchParams(search);
  return urlParams.get('SetID') || '';
}

/**
 * Extract sport type string from page breadcrumbs or URL parameters.
 *
 * @param {string} [search]
 * @returns {string}
 */
export function getSportType(search = window.location.search) {
  const breadcrumb = document.querySelector('.breadcrumb, #topnav');
  if (breadcrumb) {
    const typeMatch = breadcrumb.textContent.match(
      /(Baseball|Basketball|Football|Hockey|Soccer|Racing|Non-Sport)/i
    );
    if (typeMatch) return typeMatch[1];
  }
  const urlParams = new URLSearchParams(search);
  return urlParams.get('sp') || 'Baseball';
}

/**
 * Construct URLSearchParams form payload for /CollectionAddM2.cfm.
 *
 * @param {object} params
 * @param {string} params.cardId
 * @param {string} params.quantity
 * @param {string} [params.listContext]
 * @param {string} [params.contextSetId]
 * @param {string} [params.sportType]
 * @param {string} [params.search]
 * @param {string} [params.href]
 * @returns {URLSearchParams}
 */
export function buildQuickAddPayload({
  cardId,
  quantity,
  listContext = getListContext(),
  contextSetId = getContextSetId(),
  sportType = getSportType(),
  search = window.location.search,
  href = window.location.href
}) {
  const urlParams = new URLSearchParams(search);
  const refererUrl = href.split('?')[0];

  return new URLSearchParams({
    SetID: contextSetId,
    CardID: cardId,
    iID: '',
    Type: sportType,
    sReferer: refererUrl,
    ReturnRow: '0',
    Filter: urlParams.get('Filter') || '',
    sTeamID: urlParams.get('sTeamID') || '',
    PageIndex: urlParams.get('PageIndex') || '1',
    ColType: '1',
    sYear: '0',
    sTeam: '',
    sCardNum: '',
    sNote: '',
    sSetName: '',
    BasicID: urlParams.get('BasicID') || '',
    MultiID: urlParams.get('MultiID') || '',
    AddTo: listContext,
    Quantity: quantity
  });
}

/**
 * Process single card row to inject inline quantity input and submit button.
 *
 * @param {HTMLTableRowElement} row
 * @param {object} [context]
 * @returns {boolean} true if UI was injected
 */
export function injectRowQuickAdd(row, context = {}) {
  const cardLink = row.querySelector('a[href*="/cid/"]');
  if (!cardLink) return false;

  const href = cardLink.getAttribute('href') || '';
  const cidMatch = href.match(/\/cid\/(\d+)/i);
  if (!cidMatch) return false;
  const cardId = cidMatch[1];

  const targetCell = row.querySelector('td:nth-child(4)') || cardLink.closest('td');
  if (!targetCell || targetCell.querySelector('.tk-inline-add')) return false;

  const container = document.createElement('div');
  container.className = 'tk-inline-add';
  container.style.cssText =
    'display: inline-flex !important; flex-direction: row !important; align-items: center !important; flex-wrap: nowrap !important; margin-top: 4px !important; margin-bottom: 2px !important; width: max-content !important; min-width: 0 !important; max-width: 100% !important; vertical-align: middle !important;';

  const qtyInput = document.createElement('input');
  qtyInput.type = 'number';
  qtyInput.className = 'tk-qty-input';
  qtyInput.value = '1';
  qtyInput.min = '1';
  qtyInput.style.cssText =
    'width: 28px !important; min-width: 28px !important; max-width: 28px !important; flex: 0 0 28px !important; height: 22px !important; text-align: center !important; border: 1px solid var(--tk-border-strong, #ccc) !important; border-right: none !important; border-radius: 3px 0 0 3px !important; font-size: 11px !important; font-family: monospace !important; padding: 0 !important; margin: 0 !important; outline: none !important; background: var(--tk-bg-elevated, #ffffff) !important; color: var(--tk-text, #000000) !important; box-sizing: border-box !important; line-height: 20px !important; -moz-appearance: textfield;';

  const actionBtn = document.createElement('button');
  actionBtn.type = 'button';
  actionBtn.className = 'tk-add-btn';
  actionBtn.textContent = '+';
  actionBtn.style.cssText =
    'width: 24px !important; min-width: 24px !important; max-width: 24px !important; flex: 0 0 24px !important; height: 22px !important; background: var(--tk-accent, #0d6efd) !important; color: #ffffff !important; border: 1px solid var(--tk-accent, #0d6efd) !important; border-radius: 0 3px 3px 0 !important; padding: 0 !important; margin: 0 !important; font-size: 12px !important; font-weight: 700 !important; cursor: pointer !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; box-sizing: border-box !important; line-height: 1 !important; user-select: none !important;';

  actionBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const addQty = qtyInput.value || '1';
    const listContext = context.listContext || getListContext();

    Log(
      `Quick Add Grid: Executing POST for CardID: ${cardId} | Qty: ${addQty} | List: ${listContext}`,
      'info',
      'server'
    );

    const payload = buildQuickAddPayload({
      cardId,
      quantity: addQty,
      listContext,
      contextSetId: context.contextSetId || getContextSetId(),
      sportType: context.sportType || getSportType()
    });

    actionBtn.disabled = true;
    actionBtn.textContent = '...';
    actionBtn.classList.remove('tk-add-btn-success', 'tk-add-btn-error');

    try {
      const response = await fetch('/CollectionAddM2.cfm', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest',
          Referer: window.location.href
        },
        body: payload.toString()
      });

      const responseText = await response.text();

      if (response.ok && !responseText.includes('<title>Error') && !responseText.includes('Login')) {
        Log(`Quick Add Grid: Server response 200 OK for CardID: ${cardId}. Parsing response DOM...`, 'info', 'server');
        const virtualDOM = new DOMParser().parseFromString(responseText, 'text/html');
        const backgroundCardLink = virtualDOM.querySelector(`a[href*="/cid/${cardId}"]`);

        if (backgroundCardLink) {
          const backgroundRow = backgroundCardLink.closest('tr');
          if (backgroundRow) {
            updateRowFromBackground(row, backgroundRow, cardId, addQty, listContext);
          }
        } else {
          Log(`Quick Add Grid: CardID ${cardId} not found in response DOM.`, 'warn', 'server');
        }

        actionBtn.classList.add('tk-add-btn-success');
        setTimeout(() => {
          actionBtn.disabled = false;
          actionBtn.textContent = '+';
          actionBtn.classList.remove('tk-add-btn-success');
        }, 1200);
      } else {
        throw new Error(`HTTP ${response.status} or error page returned`);
      }
    } catch (err) {
      Log(`Quick Add Grid: Error submitting quick add for CardID ${cardId}: ${err.message}`, 'error', 'server');
      actionBtn.classList.add('tk-add-btn-error');
      actionBtn.textContent = '!';
      setTimeout(() => {
        actionBtn.disabled = false;
        actionBtn.textContent = '+';
        actionBtn.classList.remove('tk-add-btn-error');
      }, 2000);
    }
  });

  container.appendChild(qtyInput);
  container.appendChild(actionBtn);
  targetCell.appendChild(container);
  row.dataset.quickAddInjected = 'true';
  return true;
}

/**
 * Updates a live row from a background row HTML returned by TCDB POST response.
 *
 * @param {HTMLTableRowElement} row
 * @param {HTMLTableRowElement} backgroundRow
 * @param {string} cardId
 * @param {string} addQty
 * @param {string} listContext
 */
export function updateRowFromBackground(row, backgroundRow, cardId, addQty, listContext) {
  if (!row || !backgroundRow) {
    Log(`Quick Add Grid: updateRowFromBackground missing row or backgroundRow for CardID ${cardId}`, 'warn', 'server');
    return;
  }

  // 1. Update row color/background class, style, bgcolor, and onmouseout/onmouseover handlers
  if (backgroundRow.getAttribute('class')) {
    row.className = backgroundRow.className;
  }
  if (backgroundRow.hasAttribute('bgcolor')) {
    const bg = backgroundRow.getAttribute('bgcolor');
    row.setAttribute('bgcolor', bg);
    row.style.backgroundColor = bg;
    row.setAttribute('onmouseout', `this.bgColor='${bg}';`);
  } else if (row.hasAttribute('bgcolor')) {
    row.removeAttribute('bgcolor');
  }
  if (backgroundRow.hasAttribute('style')) {
    row.setAttribute('style', backgroundRow.getAttribute('style'));
  }
  if (backgroundRow.hasAttribute('onmouseout')) {
    row.setAttribute('onmouseout', backgroundRow.getAttribute('onmouseout'));
  }
  if (backgroundRow.hasAttribute('onmouseover')) {
    row.setAttribute('onmouseover', backgroundRow.getAttribute('onmouseover'));
  }
  Log(
    `Quick Add Grid [Card ${cardId}]: Updated row styling (class: '${row.className}', bgcolor: '${row.getAttribute(
      'bgcolor'
    )}').`,
    'info',
    'server'
  );

  // 2. Update Column 1 (Quantity Badge / Icon)
  const serverQtyCell = backgroundRow.querySelector('td:nth-child(1)');
  const liveQtyCell = row.querySelector('td:nth-child(1)');
  if (liveQtyCell) {
    const serverBadge = serverQtyCell?.querySelector('.badge');
    if (serverBadge) {
      liveQtyCell.innerHTML = serverQtyCell.innerHTML;
      Log(`Quick Add Grid [Card ${cardId}]: Synced Column 1 badge from server response: ${liveQtyCell.innerHTML}`, 'info', 'server');
    } else {
      const existingBadge = liveQtyCell.querySelector('.badge');
      const addedNum = parseInt(addQty, 10) || 1;
      if (existingBadge) {
        const currentQty = parseInt(existingBadge.textContent.trim(), 10) || 0;
        existingBadge.textContent = String(currentQty + addedNum);
      } else {
        liveQtyCell.innerHTML = `<span class="badge bg-primary">${addedNum}</span>`;
      }
      Log(`Quick Add Grid [Card ${cardId}]: Injected Column 1 quantity badge: ${liveQtyCell.innerHTML}`, 'info', 'server');
    }
  }

  // 3. Update Column 4 (Status / Checkbox Cell) preserving .tk-inline-add
  const liveStatusCell =
    row.querySelector('.tk-inline-add')?.parentElement ||
    row.querySelector('td:nth-child(4)');
  const serverStatusCell = backgroundRow.querySelector('td:nth-child(4)');
  if (liveStatusCell) {
    const customUI = liveStatusCell.querySelector('.tk-inline-add');
    const hasStatusIcon =
      serverStatusCell &&
      (serverStatusCell.querySelector('img, i, svg, .fa-handshake, .fa-heart, .fa-box') ||
        (!serverStatusCell.querySelector('input[type="checkbox"]') &&
          serverStatusCell.textContent.trim() !== ''));

    if (hasStatusIcon) {
      liveStatusCell.innerHTML = serverStatusCell.innerHTML;
      Log(`Quick Add Grid [Card ${cardId}]: Synced Column 4 status icon from server response.`, 'info', 'server');
    } else {
      let iconHtml = '<i class="fa-solid fa-box text-primary" title="In Collection"></i>';
      if (listContext === 'S') {
        iconHtml = '<i class="fa-solid fa-handshake text-success" title="For Sale / Trade"></i>';
      } else if (listContext === 'W') {
        iconHtml = '<i class="fa-solid fa-heart text-danger" title="On Wantlist"></i>';
      }
      liveStatusCell.innerHTML = iconHtml;
      Log(`Quick Add Grid [Card ${cardId}]: Injected Column 4 status icon '${iconHtml}'.`, 'info', 'server');
    }

    if (customUI) {
      liveStatusCell.appendChild(customUI);
    }
  }

  // 4. Update Context Menu (div[id^="nActions"] or #nActions... or .btn-group)
  const serverActions =
    backgroundRow.querySelector('div[id^="nActions"]') ||
    backgroundRow.querySelector(`#nActions${cardId}`) ||
    backgroundRow.querySelector('.btn-group');
  const liveActions =
    row.querySelector('div[id^="nActions"]') ||
    row.querySelector(`#nActions${cardId}`) ||
    row.querySelector('.btn-group');

  if (serverActions && liveActions) {
    if (serverActions.id) {
      liveActions.id = serverActions.id;
    }
    liveActions.innerHTML = serverActions.innerHTML;
    Log(`Quick Add Grid [Card ${cardId}]: Synced context menu element ID '${liveActions.id}'.`, 'info', 'server');
  } else {
    Log(`Quick Add Grid [Card ${cardId}]: Could not locate serverActions or liveActions container.`, 'warn', 'server');
  }
}

/**
 * Resets a card row back to uncollected state after removal.
 *
 * @param {HTMLTableRowElement} row
 * @param {string} cardId
 */
export function resetRowToUncollected(row, cardId) {
  if (!row) return;

  // 1. Reset row background & hover styling
  row.className = 'collection_row';
  row.removeAttribute('bgcolor');
  row.style.backgroundColor = '';
  row.setAttribute('onmouseout', "this.bgColor='#F7F9F9';");
  row.setAttribute('onmouseover', "this.bgColor='#FFCC00';");

  // 2. Clear Column 1 (Quantity Badge)
  const liveQtyCell = row.querySelector('td:nth-child(1)');
  if (liveQtyCell) {
    liveQtyCell.innerHTML = '';
  }

  // 3. Reset Column 4 (Status Cell) to checkbox + .tk-inline-add
  const liveStatusCell =
    row.querySelector('.tk-inline-add')?.parentElement ||
    row.querySelector('td:nth-child(4)');
  if (liveStatusCell) {
    const customUI = liveStatusCell.querySelector('.tk-inline-add');
    const checkboxHtml = `<label><input type="checkbox" class="form-check-input" style="transform: scale(1.4); margin: 3px;"></label>`;
    liveStatusCell.innerHTML = checkboxHtml;

    if (customUI) {
      liveStatusCell.appendChild(customUI);
      const qtyInput = customUI.querySelector('.tk-qty-input');
      if (qtyInput) qtyInput.value = '1';
    }
  }

  // 4. Trigger Collection Quantity Counter update if active
  if (window.SCToolkit?.modules?.collectionQuantityCounter?.init) {
    try {
      window.SCToolkit.modules.collectionQuantityCounter.init();
    } catch (err) {
      Log(`Quick Add Grid: Could not update counter: ${err.message}`, 'debug');
    }
  } else if (typeof window !== 'undefined' && typeof window.CustomEvent !== 'undefined') {
    document.dispatchEvent(new window.CustomEvent('sctk:collection-changed'));
  }

  Log(`Quick Add Grid [Card ${cardId}]: Row reset to uncollected state.`, 'info', 'server');
}

/**
 * Initialize Quick Add Grid Enhancer module.
 */
export function initQuickAddGridEnhancer() {
  const ok = assertContract('quickAddGridEnhancer', [
    { selector: 'table tr', label: 'table rows' },
    { selector: 'a[href*="/cid/"]', label: 'card links', optional: true }
  ]);

  if (!ok) return;

  const listContext = getListContext();
  const contextSetId = getContextSetId();
  const sportType = getSportType();

  Log(
    `Quick Add Grid Enhancer initialized (Context: ${listContext}, SetID: ${contextSetId || 'N/A'}, Sport: ${sportType})`,
    'info'
  );

  const rows = document.querySelectorAll('table tr');
  let injectedCount = 0;

  rows.forEach((row) => {
    if (injectRowQuickAdd(row, { listContext, contextSetId, sportType })) {
      injectedCount++;
    }
  });

  Log(`Quick Add Grid Enhancer: Injected quick-add controls into ${injectedCount} row(s).`, 'debug');
}
