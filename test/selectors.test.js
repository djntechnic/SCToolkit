import test from 'node:test';
import assert from 'node:assert/strict';

import { SELECTOR_REGISTRY } from '../src/core/selectors.js';

test('SELECTOR_REGISTRY: contains checklist selector grouping', () => {
  assert.ok(SELECTOR_REGISTRY.checklist, 'checklist grouping missing');
  assert.ok(Array.isArray(SELECTOR_REGISTRY.checklist.scopes), 'scopes must be an array');
  assert.equal(SELECTOR_REGISTRY.checklist.scopes.length, 2);
  assert.ok(SELECTOR_REGISTRY.checklist.dataRows, 'dataRows missing');
  assert.ok(SELECTOR_REGISTRY.checklist.itemElements, 'itemElements missing');
  assert.ok(SELECTOR_REGISTRY.checklist.chrome, 'chrome missing');
});

test('SELECTOR_REGISTRY: contains setLinks query list', () => {
  assert.ok(Array.isArray(SELECTOR_REGISTRY.setLinks), 'setLinks must be an array');
  assert.ok(SELECTOR_REGISTRY.setLinks.length >= 5, 'setLinks must contain target selectors');
  SELECTOR_REGISTRY.setLinks.forEach((sel) => {
    assert.equal(typeof sel, 'string');
    assert.ok(sel.startsWith('a['), 'setLink query selector must target <a> elements');
  });
});
