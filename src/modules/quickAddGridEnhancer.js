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

  const qtyInput = document.createElement('input');
  qtyInput.type = 'number';
  qtyInput.className = 'tk-qty-input';
  qtyInput.value = '1';
  qtyInput.min = '1';

  const actionBtn = document.createElement('button');
  actionBtn.type = 'button';
  actionBtn.className = 'tk-add-btn';
  actionBtn.textContent = '+';

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
        Log(`Quick Add Grid: Server response 200 OK for CardID: ${cardId}. Updating DOM...`, 'debug', 'server');

        const virtualDOM = new DOMParser().parseFromString(responseText, 'text/html');
        const backgroundCardLink = virtualDOM.querySelector(`a[href*="/cid/${cardId}"]`);

        if (backgroundCardLink) {
          const backgroundRow = backgroundCardLink.closest('tr');

          // Update Column 1 (Quantity Badge)
          const serverQtyCell = backgroundRow ? backgroundRow.querySelector('td:nth-child(1)') : null;
          const liveQtyCell = row.querySelector('td:nth-child(1)');
          if (serverQtyCell && liveQtyCell) {
            liveQtyCell.innerHTML = serverQtyCell.innerHTML;
          }

          // Update Column 4 (Context Menu / Icons)
          const serverMenuCell = backgroundRow ? backgroundRow.querySelector('td:nth-child(4)') : null;
          const liveMenuCell = row.querySelector('td:nth-child(4)');
          if (serverMenuCell && liveMenuCell) {
            const customUI = liveMenuCell.querySelector('.tk-inline-add');
            liveMenuCell.innerHTML = serverMenuCell.innerHTML;
            if (customUI) liveMenuCell.appendChild(customUI);
          }
        } else {
          Log(`Quick Add Grid: CardID ${cardId} not found in response DOM.`, 'warn', 'server');
        }

        actionBtn.textContent = '✓';
        actionBtn.classList.add('tk-add-btn-success');

        setTimeout(() => {
          actionBtn.textContent = '+';
          actionBtn.classList.remove('tk-add-btn-success');
          actionBtn.disabled = false;
          qtyInput.value = '1';
        }, 2000);
      } else {
        throw new Error('Transaction rejected by server');
      }
    } catch (err) {
      Log(`Quick Add Grid: Request failed for CardID ${cardId}: ${err.message}`, 'error', 'server');
      actionBtn.disabled = false;
      actionBtn.textContent = 'Err';
      actionBtn.classList.add('tk-add-btn-error');
    }
  });

  container.appendChild(qtyInput);
  container.appendChild(actionBtn);
  targetCell.appendChild(container);
  return true;
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
