import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import {
  COLLECTION_SELECT_SELECTOR,
  applyCollectionDefault,
  getDefaultCollectionId,
  initCollectionDefaulter
} from '../src/modules/collectionDefaulter.js';
import { Config } from '../src/core/config.js';
import { resetContracts } from '../src/core/contracts.js';

/** Minimal ViewCollection-shaped DOM with three collection options. */
function makeCollectionDom(selectedValue = '1') {
  const options = ['1', '2', '6']
    .map((v) => `<option value="${v}"${v === selectedValue ? ' selected' : ''}>${v}</option>`)
    .join('');

  return new JSDOM(
    `<!DOCTYPE html>
    <form id="CFForm_1">
      <select name="CollectionID">${options}</select>
    </form>`,
    { url: 'https://www.tcdb.com/ViewCollection.cfm/sid/357729' }
  );
}

// ---------------------------------------------------------------------------
// getDefaultCollectionId
// ---------------------------------------------------------------------------

test('getDefaultCollectionId: returns string representation of Config.global.defaultCollectionId', () => {
  Config.global = { defaultCollectionId: 6 };
  assert.equal(getDefaultCollectionId(), '6');
});

test('getDefaultCollectionId: returns null when defaultCollectionId is absent', () => {
  Config.global = {};
  assert.equal(getDefaultCollectionId(), null);
});

test('getDefaultCollectionId: returns null when defaultCollectionId is null', () => {
  Config.global = { defaultCollectionId: null };
  assert.equal(getDefaultCollectionId(), null);
});

// ---------------------------------------------------------------------------
// applyCollectionDefault
// ---------------------------------------------------------------------------

test('applyCollectionDefault: sets value and dispatches change when different', () => {
  const dom = makeCollectionDom('1');
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.Event = dom.window.Event;

  const select = dom.window.document.querySelector(COLLECTION_SELECT_SELECTOR);
  let changeDispatched = false;
  select.addEventListener('change', () => { changeDispatched = true; });

  const result = applyCollectionDefault(select, '6');

  assert.equal(result, true);
  assert.equal(select.value, '6');
  assert.equal(changeDispatched, true);
});

test('applyCollectionDefault: does nothing when already on the target value', () => {
  const dom = makeCollectionDom('6');
  globalThis.document = dom.window.document;

  const select = dom.window.document.querySelector(COLLECTION_SELECT_SELECTOR);
  let changeDispatched = false;
  select.addEventListener('change', () => { changeDispatched = true; });

  const result = applyCollectionDefault(select, '6');

  assert.equal(result, false);
  assert.equal(select.value, '6');
  assert.equal(changeDispatched, false);
});

test('applyCollectionDefault: returns false and does not dispatch when option value does not exist', () => {
  const dom = makeCollectionDom('1');
  globalThis.document = dom.window.document;

  const select = dom.window.document.querySelector(COLLECTION_SELECT_SELECTOR);
  let changeDispatched = false;
  select.addEventListener('change', () => { changeDispatched = true; });

  const result = applyCollectionDefault(select, '999');

  assert.equal(result, false);
  assert.equal(select.value, '1');
  assert.equal(changeDispatched, false);
});

test('applyCollectionDefault: returns false when targetId is null', () => {
  const dom = makeCollectionDom('1');
  globalThis.document = dom.window.document;

  const select = dom.window.document.querySelector(COLLECTION_SELECT_SELECTOR);
  const result = applyCollectionDefault(select, null);

  assert.equal(result, false);
  assert.equal(select.value, '1');
});

test('applyCollectionDefault: returns false when select is null', () => {
  const result = applyCollectionDefault(null, '6');
  assert.equal(result, false);
});

// ---------------------------------------------------------------------------
// Integration: selector constant
// ---------------------------------------------------------------------------

test('COLLECTION_SELECT_SELECTOR: resolves in a ViewCollection-shaped DOM', () => {
  const dom = makeCollectionDom('1');
  const el = dom.window.document.querySelector(COLLECTION_SELECT_SELECTOR);
  assert.ok(el, `Expected "${COLLECTION_SELECT_SELECTOR}" to match an element`);
  assert.equal(el.tagName, 'SELECT');
});

// ---------------------------------------------------------------------------
// initCollectionDefaulter — smoke test
// ---------------------------------------------------------------------------

test('initCollectionDefaulter: applies default collection on init', () => {
  const dom = makeCollectionDom('1');
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.Event = dom.window.Event;

  Config.global = { defaultCollectionId: 6 };
  resetContracts();

  const select = dom.window.document.querySelector(COLLECTION_SELECT_SELECTOR);
  let changeDispatched = false;
  select.addEventListener('change', () => { changeDispatched = true; });

  initCollectionDefaulter();

  assert.equal(select.value, '6');
  assert.equal(changeDispatched, true);
});
