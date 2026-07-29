import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import {
  BADGES,
  SET_LINK_BADGES,
  TOOLBAR_BADGES,
  createBadge,
  renderBadgeSet
} from '../src/ui/badges.js';

// badges.js builds elements through the ambient `document`, as it does in the
// page. One shared document is enough; each test renders into its own span.
const dom = new JSDOM('<!doctype html><body></body>');
globalThis.document = dom.window.document;

const container = () => dom.window.document.createElement('span');
const labels = (el) => Array.from(el.children).map((c) => c.textContent.trim());

test('createBadge: a definition with a URL renders as a link', () => {
  const badge = createBadge('INSERTS', '4001');
  assert.equal(badge.tagName, 'A');
  assert.equal(badge.getAttribute('href'), '/Inserts.cfm/sid/4001/#InsertSets');
});

test('createBadge: a handler forces a button even for a link definition', () => {
  const badge = createBadge('INSERTS', '4001', () => {});
  assert.equal(badge.tagName, 'SPAN');
  assert.equal(badge.getAttribute('role'), 'button');
  assert.equal(badge.getAttribute('aria-label'), BADGES.INSERTS.title);
  assert.equal(badge.tabIndex, 0);
});

test('createBadge: an unknown key yields null rather than throwing', () => {
  assert.equal(createBadge('NOT_A_BADGE', '1'), null);
});

test('renderBadgeSet: toolbar order, with the export action last', () => {
  const el = renderBadgeSet(container(), '4001', { onExport: () => {} });
  assert.deepEqual(labels(el), ['INS', 'PAR', 'FS', 'MULTI', 'WANT', 'CSV']);
});

test('renderBadgeSet: set-link order leads with the two actions', () => {
  const el = renderBadgeSet(container(), '4001', {
    include: SET_LINK_BADGES,
    onPin: () => {},
    onExport: () => {}
  });
  assert.deepEqual(labels(el), ['PIN', 'CSV', 'INS', 'PAR', 'FS', 'MULTI', 'WANT']);
});

test('renderBadgeSet: an action with no handler is skipped, not rendered dead', () => {
  // This is the guarantee the helper exists to provide: a caller cannot emit a
  // PIN or CSV badge that looks clickable and does nothing.
  const el = renderBadgeSet(container(), '4001', { include: SET_LINK_BADGES });
  assert.deepEqual(labels(el), ['INS', 'PAR', 'FS', 'MULTI', 'WANT']);
});

test('renderBadgeSet: include controls exactly what is rendered', () => {
  const el = renderBadgeSet(container(), '4001', { include: ['WANTLIST', 'FOR_SALE'] });
  assert.deepEqual(labels(el), ['WANT', 'FS']);
});

test('renderBadgeSet: the export handler is wired to the CSV badge', () => {
  let clicked = 0;
  const el = renderBadgeSet(container(), '4001', { onExport: () => { clicked++; } });
  el.querySelector('[role="button"]').dispatchEvent(new dom.window.Event('click'));
  assert.equal(clicked, 1);
});

test('every badge key in both orders is a real definition', () => {
  [...TOOLBAR_BADGES, ...SET_LINK_BADGES].forEach((key) => {
    assert.ok(BADGES[key], `${key} is not a defined badge`);
  });
});
