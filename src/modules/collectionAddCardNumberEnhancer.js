/**
 * Collection Add Card Number Enhancer
 *
 * Enhances CollectionAddCardNumber.cfm page with:
 * 1. Defaulting "Add To:" dropdown to "S" (For Sale/Trade).
 * 2. Presenting a warning if the breadcrumb collection is not equal to the preferred collection.
 * 3. Live counting of distinct card numbers and total card numbers in textarea sText.
 * 4. Validation on submit preventing illegal characters and leading/trailing whitespace around card numbers.
 */

import { Config } from '../core/config.js';
import { assertContract } from '../core/contracts.js';
import { Log } from '../core/log.js';
import { showToast } from '../ui/toast.js';
import { getDefaultCollectionId } from './collectionDefaulter.js';

export const BREADCRUMB_SELECTOR = '#content > div.col-md-6.nopadding > div > div.d-none.d-md-block > nav > ol > li:nth-child(3)';
export const FALLBACK_BREADCRUMB_SELECTOR = 'nav[aria-label="breadcrumb"] ol.breadcrumb > li:nth-child(3)';
export const ADD_TO_SELECT_SELECTOR = 'form[name="CFForm_1"] select[name="AddTo"], #CFForm_1 select[name="AddTo"]';
export const TEXTAREA_SELECTOR = 'form[name="CFForm_1"] textarea[name="sText"], #CFForm_1 textarea[name="sText"]';
export const FORM_SELECTOR = 'form[name="CFForm_1"], #CFForm_1';

/**
 * Default the "Add To:" dropdown to "S" (For Sale/Trade).
 *
 * @param {Document|HTMLElement} [root=document]
 * @returns {boolean} true if value was changed
 */
export function defaultAddToSelect(root = document) {
  const select = root.querySelector(ADD_TO_SELECT_SELECTOR);
  if (!select) return false;

  const targetValue = 'S';
  if (select.value === targetValue) {
    Log('Collection Add Card Number: "Add To" dropdown already on "S".', 'debug');
    return false;
  }

  const optionExists = Array.from(select.options).some((o) => o.value === targetValue);
  if (!optionExists) {
    Log('Collection Add Card Number: option "S" not found in "Add To" select.', 'warn');
    return false;
  }

  select.value = targetValue;
  const EventCtor = select.ownerDocument?.defaultView?.Event || Event;
  select.dispatchEvent(new EventCtor('change', { bubbles: true }));
  Log('Collection Add Card Number: defaulted "Add To" dropdown to "S" (For Sale/Trade).', 'info');
  return true;
}

/**
 * Check if the active collection in breadcrumb matches preferred collection.
 * If not equal, displays a warning alert and toast notification.
 *
 * @param {Document|HTMLElement} [root=document]
 * @param {string|null} [preferredId]
 * @returns {{ isMismatch: boolean, pageCollectionId: string|null, preferredCollectionId: string|null, collectionName: string }}
 */
export function checkCollectionMismatch(root = document, preferredId = getDefaultCollectionId()) {
  const result = {
    isMismatch: false,
    pageCollectionId: null,
    preferredCollectionId: preferredId ? String(preferredId) : null,
    collectionName: ''
  };

  if (!preferredId) return result;

  const breadcrumbLi = root.querySelector(BREADCRUMB_SELECTOR) || root.querySelector(FALLBACK_BREADCRUMB_SELECTOR);
  if (!breadcrumbLi) {
    Log('Collection Add Card Number: breadcrumb li:nth-child(3) element not found.', 'debug');
    return result;
  }

  const link = breadcrumbLi.querySelector('a');
  const collectionName = (link ? link.textContent : breadcrumbLi.textContent).trim();
  result.collectionName = collectionName;

  const href = link ? (link.getAttribute('href') || '') : '';
  const match = href.match(/collection\/(\d+)|CollectionID=(\d+)/i);
  if (match) {
    result.pageCollectionId = match[1] || match[2];
  }

  if (result.pageCollectionId && result.pageCollectionId !== result.preferredCollectionId) {
    result.isMismatch = true;
    Log(
      `Collection Add Card Number: Preferred collection mismatch. Current page collection ID: "${result.pageCollectionId}" ("${collectionName}"), Preferred ID: "${result.preferredCollectionId}".`,
      'warn'
    );

    // Render warning alert if not already present
    const form = root.querySelector(FORM_SELECTOR);
    const existingWarning = root.querySelector('#sctk-collection-mismatch-warning');
    if (!existingWarning && form) {
      const warningDiv = document.createElement('div');
      warningDiv.id = 'sctk-collection-mismatch-warning';
      warningDiv.className = 'alert alert-warning d-flex align-items-center my-2';
      warningDiv.setAttribute('role', 'alert');
      warningDiv.innerHTML = `
        <i class="fa-solid fa-triangle-exclamation me-2 fs-5"></i>
        <div>
          <strong>Collection Mismatch Warning:</strong> Current collection (<strong>${escapeHtml(collectionName)}</strong>) does not match your preferred collection (ID: <strong>${escapeHtml(result.preferredCollectionId)}</strong>).
        </div>
      `;
      form.parentNode.insertBefore(warningDiv, form);
    }

    showToast({
      message: `<b>Collection Warning:</b> Current collection ("${escapeHtml(collectionName)}") does not match your preferred collection.`,
      variant: 'warn',
      location: 'bottom-right'
    });
  }

  return result;
}

/**
 * Calculate card counts from sText input value.
 *
 * @param {string} text
 * @returns {{ distinctCount: number, totalCount: number, lines: string[] }}
 */
export function countTextareaCards(text = '') {
  const rawLines = text.split(/\r?\n/);
  const nonEmptyLines = [];

  rawLines.forEach((line) => {
    if (line.trim() !== '') {
      nonEmptyLines.push(line);
    }
  });

  const totalCount = nonEmptyLines.length;
  const distinctSet = new Set(nonEmptyLines.map((l) => l.trim()));
  const distinctCount = distinctSet.size;

  return { distinctCount, totalCount, lines: nonEmptyLines };
}

/**
 * Validate lines in card numbers input.
 * Rejects leading/trailing whitespace around card numbers and illegal characters.
 *
 * @param {string} text
 * @returns {{ isValid: boolean, errors: Array<{ lineNum: number, lineText: string, message: string }> }}
 */
export function validateCardNumbers(text = '') {
  const rawLines = text.split(/\r?\n/);
  const errors = [];

  rawLines.forEach((line, idx) => {
    const lineNum = idx + 1;
    // Ignore trailing completely empty line if it's the last line and empty
    if (line === '' && idx === rawLines.length - 1) return;

    if (line !== '') {
      // Check 1: Whitespace on either side
      if (line.trimStart() !== line || line.trimEnd() !== line) {
        errors.push({
          lineNum,
          lineText: line,
          message: `Line ${lineNum} has leading or trailing whitespace ("${line}")`
        });
      }

      // Check 2: Illegal characters
      const trimmed = line.trim();
      // Allowed: alphanumeric, whitespace, hyphens, slashes, periods, hashes, ampersands
      if (/[^\w\s\-\/\.\#\&]/i.test(trimmed)) {
        errors.push({
          lineNum,
          lineText: line,
          message: `Line ${lineNum} contains illegal characters ("${trimmed}")`
        });
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Render or update live card counter widget near textarea.
 *
 * @param {{ distinctCount: number, totalCount: number }} counts
 * @param {Document|HTMLElement} [root=document]
 */
export function updateCardCounterWidget(counts, root = document) {
  let widget = root.querySelector('#sctk-card-number-counter');
  if (!widget) {
    widget = document.createElement('div');
    widget.id = 'sctk-card-number-counter';
    widget.className = 'sctk-qty-counter ms-2 align-top';
    widget.style.cssText = 'margin-left: 10px; vertical-align: top; display: inline-flex;';

    const textarea = root.querySelector(TEXTAREA_SELECTOR);
    if (textarea && textarea.parentNode) {
      if (textarea.nextSibling) {
        textarea.parentNode.insertBefore(widget, textarea.nextSibling);
      } else {
        textarea.parentNode.appendChild(widget);
      }
    } else {
      const form = root.querySelector(FORM_SELECTOR);
      if (form) form.appendChild(widget);
    }
  }

  widget.innerHTML = `
    <span class="tk-qty-label">Distinct Cards:</span>
    <strong class="tk-qty-val">${counts.distinctCount}</strong>
    <span class="tk-qty-sep">/</span>
    <span class="tk-qty-sub">Total Cards: <strong>${counts.totalCount}</strong></span>
  `;
  widget.title = `Distinct Cards: ${counts.distinctCount}, Total Lines: ${counts.totalCount}`;
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
 * Initialize Collection Add Card Number Enhancer module.
 */
export function initCollectionAddCardNumberEnhancer() {
  Log('Initializing Collection Add Card Number Enhancer module', 'debug');

  const ok = assertContract('collectionAddCardNumberEnhancer', [
    { selector: FORM_SELECTOR, label: '#CFForm_1 (Add Card Number Form)' },
    { selector: TEXTAREA_SELECTOR, label: 'textarea[name="sText"] (Card Numbers Input)' }
  ]);

  if (!ok) return;

  const form = document.querySelector(FORM_SELECTOR);
  const textarea = document.querySelector(TEXTAREA_SELECTOR);
  const modConfig = Config.modules.collectionAddCardNumberEnhancer;
  const actions = modConfig?.actions || {};

  // 1. Default Add To dropdown to "S"
  if (actions.defaultAddToSale !== false) {
    defaultAddToSelect(document);
  }

  // 2. Collection Mismatch Warning
  if (actions.collectionWarning !== false) {
    checkCollectionMismatch(document);
  }

  // 3. Live Counter
  if (actions.liveCounter !== false && textarea) {
    const updateCounter = () => {
      const counts = countTextareaCards(textarea.value);
      updateCardCounterWidget(counts, document);
    };

    updateCounter();

    textarea.addEventListener('input', updateCounter);
    textarea.addEventListener('change', updateCounter);
    textarea.addEventListener('keyup', updateCounter);
  }

  // 4. Form Validation on Submit
  if (actions.validateInput !== false && form && textarea) {
    form.addEventListener('submit', (e) => {
      const validation = validateCardNumbers(textarea.value);

      // Remove any existing validation alert
      const existingAlert = form.querySelector('#sctk-validation-error-alert');
      if (existingAlert) existingAlert.remove();

      if (!validation.isValid) {
        e.preventDefault();
        e.stopPropagation();

        Log(`Collection Add Card Number: validation failed with ${validation.errors.length} error(s).`, 'warn');

        const alertDiv = document.createElement('div');
        alertDiv.id = 'sctk-validation-error-alert';
        alertDiv.className = 'alert alert-danger my-2';
        alertDiv.setAttribute('role', 'alert');

        const errorItems = validation.errors
          .map((err) => `<li>${escapeHtml(err.message)}</li>`)
          .join('');

        alertDiv.innerHTML = `
          <i class="fa-solid fa-triangle-exclamation me-2"></i>
          <strong>Validation Error:</strong> Card numbers cannot contain illegal characters or whitespace on either side.
          <ul class="mb-0 mt-1 ps-3">
            ${errorItems}
          </ul>
        `;

        textarea.parentNode.insertBefore(alertDiv, textarea);

        showToast({
          message: `<b>Validation Error:</b> Please fix ${validation.errors.length} issue(s) before submitting.`,
          variant: 'error',
          location: 'bottom-right'
        });

        textarea.focus();
        return false;
      }
    });
  }
}
