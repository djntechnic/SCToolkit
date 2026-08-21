import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';

import {
  defaultAddToSelect,
  checkCollectionMismatch,
  countTextareaCards,
  validateCardNumbers,
  updateCardCounterWidget,
  initCollectionAddCardNumberEnhancer
} from '../src/modules/collectionAddCardNumberEnhancer.js';
import { Config } from '../src/core/config.js';
import { resetContracts } from '../src/core/contracts.js';

function loadFixtureDom() {
  const fixturePath = path.resolve('test/fixtures/submitted/CollectionAddCardNumber.html');
  const html = fs.readFileSync(fixturePath, 'utf8');
  return new JSDOM(html, { url: 'https://www.tcdb.com/CollectionAddCardNumber.cfm/sid/225294?ACTION=ADD' });
}

test('defaultAddToSelect: defaults AddTo dropdown selection to "S"', () => {
  const dom = loadFixtureDom();
  const select = dom.window.document.querySelector('select[name="AddTo"]');
  assert.equal(select.value, 'G');

  let changeFired = false;
  select.addEventListener('change', () => { changeFired = true; });

  const changed = defaultAddToSelect(dom.window.document);
  assert.equal(changed, true);
  assert.equal(select.value, 'S');
  assert.equal(changeFired, true);
});

test('checkCollectionMismatch: detects mismatch when preferred collection differs from page', () => {
  const dom = loadFixtureDom();
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;

  // Preferred collection ID is '1', fixture has collection/6 ('Black Diamond')
  const result = checkCollectionMismatch(dom.window.document, '1');

  assert.equal(result.isMismatch, true);
  assert.equal(result.pageCollectionId, '6');
  assert.equal(result.preferredCollectionId, '1');
  assert.equal(result.collectionName, 'Black Diamond');

  const warning = dom.window.document.querySelector('#sctk-collection-mismatch-warning');
  assert.ok(warning);
  assert.match(warning.textContent, /Current collection.*Black Diamond.*does not match your preferred collection/);
});

test('checkCollectionMismatch: reports no mismatch when preferred collection matches page', () => {
  const dom = loadFixtureDom();
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;

  const result = checkCollectionMismatch(dom.window.document, '6');

  assert.equal(result.isMismatch, false);
  assert.equal(result.pageCollectionId, '6');
  assert.equal(result.preferredCollectionId, '6');

  const warning = dom.window.document.querySelector('#sctk-collection-mismatch-warning');
  assert.equal(warning, null);
});

test('countTextareaCards: correctly counts distinct and total cards', () => {
  const input = '1\n2\n1\n3\n\n4';
  const counts = countTextareaCards(input);

  assert.equal(counts.totalCount, 5);
  assert.equal(counts.distinctCount, 4);
});

test('updateCardCounterWidget: creates and updates live counter element', () => {
  const dom = loadFixtureDom();
  updateCardCounterWidget({ distinctCount: 3, totalCount: 4 }, dom.window.document);

  const widget = dom.window.document.querySelector('#sctk-card-number-counter');
  assert.ok(widget);
  assert.match(widget.textContent, /Distinct Cards:[\s\S]*3/);
  assert.match(widget.textContent, /Total Cards:[\s\S]*4/);
});

test('validateCardNumbers: passes valid card numbers', () => {
  const input = '1\n2A\n10-B\n1/5\n#42\nMike Trout';
  const result = validateCardNumbers(input);

  assert.equal(result.isValid, true);
  assert.equal(result.errors.length, 0);
});

test('validateCardNumbers: detects leading/trailing whitespace', () => {
  const input = '1\n 2A\n10-B ';
  const result = validateCardNumbers(input);

  assert.equal(result.isValid, false);
  assert.equal(result.errors.length, 2);
  assert.match(result.errors[0].message, /Line 2 has leading or trailing whitespace/);
  assert.match(result.errors[1].message, /Line 3 has leading or trailing whitespace/);
});

test('validateCardNumbers: detects illegal characters', () => {
  const input = '1\n2A<script>\n10$';
  const result = validateCardNumbers(input);

  assert.equal(result.isValid, false);
  assert.equal(result.errors.length, 2);
  assert.match(result.errors[0].message, /Line 2 contains illegal characters/);
  assert.match(result.errors[1].message, /Line 3 contains illegal characters/);
});

test('initCollectionAddCardNumberEnhancer: blocks form submit on invalid input', () => {
  const dom = loadFixtureDom();
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.Event = dom.window.Event;

  Config.global = {
    defaultCollectionId: 1,
    toastDurationMs: 4000,
    toastStackLimit: 4
  };
  Config.modules.collectionAddCardNumberEnhancer = {
    enabled: true,
    urlMatch: [{ pattern: 'collectionaddcardnumber', exclude: false }],
    actions: {
      defaultAddToSale: true,
      collectionWarning: true,
      liveCounter: true,
      validateInput: true
    }
  };
  resetContracts();

  initCollectionAddCardNumberEnhancer();

  const select = dom.window.document.querySelector('select[name="AddTo"]');
  assert.equal(select.value, 'S');

  const textarea = dom.window.document.querySelector('textarea[name="sText"]');
  textarea.value = ' 10 ';

  const form = dom.window.document.querySelector('#CFForm_1');
  let defaultPrevented = false;

  const event = new dom.window.Event('submit', { cancelable: true, bubbles: true });
  form.dispatchEvent(event);

  assert.equal(event.defaultPrevented, true);

  const alert = dom.window.document.querySelector('#sctk-validation-error-alert');
  assert.ok(alert);
  assert.match(alert.textContent, /Line 1 has leading or trailing whitespace/);
});
