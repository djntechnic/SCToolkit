/**
 * Behavioural cover for the Phase 3 performance rewrites.
 *
 * These do not measure speed — they pin the properties the optimisations
 * depend on, so a later change cannot quietly reintroduce the per-keystroke
 * work they removed.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { applyFilter, buildRowIndex } from '../src/modules/checklistEnhancer.js';
import { isEligibleInput, getValidInputs, invalidateInputCache } from '../src/modules/inputOptimization.js';
import { applySaleTypeDefaults } from '../src/modules/addMultiplesEnhancer.js';
import { findSetLinks, injectSetActions } from '../src/modules/setListEnhancer.js';

const TABLE = `
<div id="main-content-area">
  <table>
    <tr><th>Card</th><th>Subject</th></tr>
    <tr><td><a href="/ViewCard.cfm/sid/1/cid/1">1</a></td><td>Nolan Ryan</td></tr>
    <tr><td><a href="/ViewCard.cfm/sid/1/cid/2">2</a></td><td>Cal Ripken, Jr.</td></tr>
    <tr><td><a href="/ViewCard.cfm/sid/1/cid/3">3</a></td><td>Ken Griffey Jr. RC</td></tr>
    <tr><td colspan="2">Set totals: 3 cards</td></tr>
  </table>
</div>`;

function mount(html) {
  const dom = new JSDOM(`<!doctype html><body>${html}</body>`, { url: 'https://example.test/ViewAll.cfm/sid/9/' });
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  return dom;
}

// --- checklist filter -------------------------------------------------------

test('buildRowIndex includes only data rows', () => {
  const dom = mount(TABLE);
  const index = buildRowIndex(dom.window.document.getElementById('main-content-area'));

  // The header row and the totals footer carry no card link, input, or select.
  assert.equal(index.length, 3);
  assert.ok(index.every((entry) => entry.haystack === entry.haystack.toLowerCase()));
});

test('buildRowIndex collapses whitespace so multi-line cells stay searchable', () => {
  const dom = mount(`
    <div id="main-content-area"><table>
      <tr><td><a href="/ViewCard.cfm/sid/1/cid/1">1</a></td><td>
          Nolan
          Ryan
      </td></tr>
    </table></div>`);
  const [entry] = buildRowIndex(dom.window.document.getElementById('main-content-area'));

  assert.ok(entry.haystack.includes('nolan ryan'));
});

test('applyFilter hides non-matching rows via a class, not an inline style', () => {
  const dom = mount(TABLE);
  const index = buildRowIndex(dom.window.document.getElementById('main-content-area'));

  const visible = applyFilter(index, 'ryan');

  assert.equal(visible, 1);
  assert.equal(index[0].el.classList.contains('tk-hidden'), false);
  assert.equal(index[1].el.classList.contains('tk-hidden'), true);
  // Nothing writes to style.display, so a row's own stylesheet value survives.
  assert.equal(index[1].el.style.display, '');
});

test('applyFilter with an empty term restores every row', () => {
  const dom = mount(TABLE);
  const index = buildRowIndex(dom.window.document.getElementById('main-content-area'));

  applyFilter(index, 'ryan');
  const visible = applyFilter(index, '');

  assert.equal(visible, 3);
  assert.ok(index.every(({ el }) => !el.classList.contains('tk-hidden')));
});

test('applyFilter matches any column, not just the subject', () => {
  const dom = mount(TABLE);
  const index = buildRowIndex(dom.window.document.getElementById('main-content-area'));

  assert.equal(applyFilter(index, '3'), 1);
});

test('applyFilter is idempotent for the same term', () => {
  const dom = mount(TABLE);
  const index = buildRowIndex(dom.window.document.getElementById('main-content-area'));

  assert.equal(applyFilter(index, 'jr.'), 2);
  assert.equal(applyFilter(index, 'jr.'), 2);
});

test('applyFilter matches OR conditions using comma, semicolon, pipe, or space', () => {
  const dom = mount(TABLE);
  const index = buildRowIndex(dom.window.document.getElementById('main-content-area'));

  // Comma
  assert.equal(applyFilter(index, 'ryan, griffey'), 2);
  // Semicolon
  assert.equal(applyFilter(index, 'ryan; ripken'), 2);
  // Pipe
  assert.equal(applyFilter(index, 'ripken | griffey'), 2);
  // Space
  assert.equal(applyFilter(index, 'ryan griffey'), 2);
  // Multiple delimiters
  assert.equal(applyFilter(index, 'ryan, ripken | griffey'), 3);
});

test('buildRowIndex ignores action dropdown li items inside card rows to prevent double counting', () => {
  const tableWithDropdowns = `
  <div id="main-content-area">
    <table>
      <tr><th>Card</th><th>Subject</th><th>Actions</th></tr>
      <tr>
        <td><a href="/ViewCard.cfm/sid/1/cid/1">1</a></td>
        <td>Nolan Ryan</td>
        <td>
          <div class="btn-group">
            <ul class="dropdown-menu">
              <li><a href="/ViewCard.cfm/sid/1/cid/1">View Details</a></li>
              <li><a href="/Checklist.cfm">Checklist</a></li>
            </ul>
          </div>
        </td>
      </tr>
      <tr>
        <td><a href="/ViewCard.cfm/sid/1/cid/2">2</a></td>
        <td>Cal Ripken, Jr.</td>
        <td>
          <div class="btn-group">
            <ul class="dropdown-menu">
              <li><a href="/ViewCard.cfm/sid/1/cid/2">View Details</a></li>
            </ul>
          </div>
        </td>
      </tr>
    </table>
  </div>`;
  const dom = mount(tableWithDropdowns);
  const index = buildRowIndex(dom.window.document.getElementById('main-content-area'));
  assert.equal(index.length, 2, 'Should index only top-level table rows, excluding dropdown menu li items');
});

// --- input eligibility ------------------------------------------------------

/** jsdom has no layout, so `offsetParent` is stubbed per element. */
function makeInput(dom, { type = 'text', value = '', laidOut = true, ...props } = {}) {
  const el = dom.window.document.createElement('input');
  el.type = type;
  el.value = value;
  Object.assign(el, props);
  Object.defineProperty(el, 'offsetParent', {
    value: laidOut ? dom.window.document.body : null
  });
  return el;
}

test('isEligibleInput accepts laid-out text and number fields', () => {
  const dom = mount('');
  assert.equal(isEligibleInput(makeInput(dom, { type: 'text' })), true);
  assert.equal(isEligibleInput(makeInput(dom, { type: 'number' })), true);
});

test('isEligibleInput rejects other input types', () => {
  const dom = mount('');
  ['checkbox', 'radio', 'submit', 'hidden', 'file'].forEach((type) => {
    assert.equal(isEligibleInput(makeInput(dom, { type })), false, type);
  });
});

test('isEligibleInput rejects readonly, disabled, and hidden fields', () => {
  const dom = mount('');
  assert.equal(isEligibleInput(makeInput(dom, { readOnly: true })), false);
  assert.equal(isEligibleInput(makeInput(dom, { disabled: true })), false);
  assert.equal(isEligibleInput(makeInput(dom, { hidden: true })), false);
});

test('isEligibleInput rejects fields that are not laid out', () => {
  const dom = mount('');
  assert.equal(isEligibleInput(makeInput(dom, { laidOut: false })), false);
});

test('isEligibleInput keeps zero-quantity fields even when unmeasurable', () => {
  // The escape hatch that makes the feature work on the page it exists for.
  const dom = mount('');
  assert.equal(isEligibleInput(makeInput(dom, { value: '0', laidOut: false })), true);
});

test('getValidInputs scopes queries to #main-content-area when present', () => {
  const dom = mount(`
    <div id="sidebar"><input id="s1" type="text"></div>
    <div id="main-content-area"><input id="m1" type="text"><input id="m2" type="number"></div>
  `);
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;

  dom.window.document.querySelectorAll('input').forEach((el) => {
    Object.defineProperty(el, 'offsetParent', { value: dom.window.document.body });
  });

  invalidateInputCache();
  const valid = getValidInputs();
  assert.equal(valid.length, 2);
  assert.deepEqual(valid.map((i) => i.id), ['m1', 'm2']);
});

// --- add multiples ----------------------------------------------------------

test('applySaleTypeDefaults selects the For Sale/Trade option where offered', () => {
  const dom = mount(`
    <select id="a"><option value="1">Collection</option><option value="2">For Sale/Trade</option></select>
    <select id="b"><option value="9">Collection</option></select>`);
  const doc = dom.window.document;

  assert.equal(applySaleTypeDefaults(doc), 1);
  assert.equal(doc.getElementById('a').value, '2');
  assert.equal(doc.getElementById('b').value, '9');
});

test('applySaleTypeDefaults reports no change when already correct', () => {
  const dom = mount('<select><option value="1">Collection</option><option value="2" selected>For Sale/Trade</option></select>');
  assert.equal(applySaleTypeDefaults(dom.window.document), 0);
});

// --- set list ---------------------------------------------------------------

test('findSetLinks skips image-only and empty links', () => {
  const dom = mount(`
    <a href="/Checklist.cfm/sid/1/">Real Set</a>
    <a href="/Checklist.cfm/sid/2/"><img src="t.png"></a>
    <a href="/Checklist.cfm/sid/3/">   </a>`);

  const links = findSetLinks(dom.window.document);
  assert.deepEqual(links.map((l) => l.textContent.trim()), ['Real Set']);
});

test('injectSetActions attaches one badge group per link', () => {
  const dom = mount('<div><a href="/Checklist.cfm/sid/11/">Set A</a></div>');
  const doc = dom.window.document;

  assert.equal(injectSetActions(findSetLinks(doc)), 1);

  const group = doc.querySelector('a + span');
  assert.ok(group, 'badge group should follow the link');
  assert.ok(group.querySelectorAll('.sctk-badge').length >= 5);
});

test('injectSetActions is idempotent — a second pass adds nothing', () => {
  const dom = mount('<div><a href="/Checklist.cfm/sid/11/">Set A</a></div>');
  const doc = dom.window.document;
  const links = findSetLinks(doc);

  injectSetActions(links);
  assert.equal(injectSetActions(links), 0);
  assert.equal(doc.querySelectorAll('.sctk-badge').length, doc.querySelectorAll('a + span .sctk-badge').length);
});

test('injectSetActions skips links with no set id', () => {
  const dom = mount('<div><a href="/Person.cfm/pid/4/">A Person</a></div>');
  const doc = dom.window.document;

  assert.equal(injectSetActions(Array.from(doc.querySelectorAll('a'))), 0);
  assert.equal(doc.querySelector('a + span'), null);
});

test('injectSetActions skips the set the page is already on', () => {
  // The page URL in these fixtures is /ViewAll.cfm/sid/9/.
  const dom = mount('<div><a href="/Checklist.cfm/sid/9/">This Set</a></div>');
  const doc = dom.window.document;

  injectSetActions(findSetLinks(doc));
  assert.equal(doc.querySelector('a + span'), null);
});
