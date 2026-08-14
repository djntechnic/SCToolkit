import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import {
  getListContext,
  getContextSetId,
  getSportType,
  buildQuickAddPayload,
  injectRowQuickAdd,
  initQuickAddGridEnhancer
} from '../src/modules/quickAddGridEnhancer.js';
import { resetContracts } from '../src/core/contracts.js';

function makeCardTableDom(url = 'https://www.tcdb.com/ViewCollection.cfm/sid/100') {
  return new JSDOM(
    `<!DOCTYPE html>
    <html>
      <head></head>
      <body>
        <div class="breadcrumb">Baseball > 2024 Topps</div>
        <table>
          <tbody>
            <tr>
              <td><span class="badge">1</span></td>
              <td>1</td>
              <td>Mike Trout</td>
              <td><a href="/Person.cfm/pid/123/Mike-Trout">Mike Trout</a></td>
            </tr>
            <tr>
              <td><span class="badge">0</span></td>
              <td>101</td>
              <td>Shohei Ohtani</td>
              <td>
                <a href="/ViewCard.cfm/sid/100/cid/55555/101-Shohei-Ohtani">Card Link</a>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>`,
    { url }
  );
}

// ---------------------------------------------------------------------------
// Context Detection Tests
// ---------------------------------------------------------------------------

test('getListContext: detects list type correctly based on URL pathname', () => {
  assert.equal(getListContext('/ViewCollection.cfm'), 'G');
  assert.equal(getListContext('/ViewCollectionWantlist.cfm'), 'W');
  assert.equal(getListContext('/ViewCollectionForSaleTrade.cfm'), 'S');
});

test('getContextSetId: extracts SetID from path or query params', () => {
  assert.equal(getContextSetId('/ViewCollection.cfm/sid/12345', ''), '12345');
  assert.equal(getContextSetId('/ViewCollection.cfm', '?SetID=6789'), '6789');
  assert.equal(getContextSetId('/ViewCollection.cfm', ''), '');
});

test('getSportType: extracts sport from DOM breadcrumb or URL parameter', () => {
  const dom = makeCardTableDom();
  globalThis.document = dom.window.document;

  assert.equal(getSportType(''), 'Baseball');
  assert.equal(getSportType('?sp=Basketball'), 'Baseball'); // breadcrumb wins when present
});

test('buildQuickAddPayload: constructs expected form payload params', () => {
  const payload = buildQuickAddPayload({
    cardId: '55555',
    quantity: '2',
    listContext: 'W',
    contextSetId: '100',
    sportType: 'Baseball',
    search: '?Filter=Base&PageIndex=3',
    href: 'https://www.tcdb.com/ViewCollectionWantlist.cfm?Filter=Base&PageIndex=3'
  });

  assert.equal(payload.get('SetID'), '100');
  assert.equal(payload.get('CardID'), '55555');
  assert.equal(payload.get('Quantity'), '2');
  assert.equal(payload.get('AddTo'), 'W');
  assert.equal(payload.get('Type'), 'Baseball');
  assert.equal(payload.get('Filter'), 'Base');
  assert.equal(payload.get('PageIndex'), '3');
  assert.equal(payload.get('sReferer'), 'https://www.tcdb.com/ViewCollectionWantlist.cfm');
});

// ---------------------------------------------------------------------------
// DOM Injection & Integration Tests
// ---------------------------------------------------------------------------

test('injectRowQuickAdd: injects inline quick add UI into card row', () => {
  const dom = makeCardTableDom();
  const row = dom.window.document.querySelectorAll('table tr')[1];

  const injected = injectRowQuickAdd(row, { listContext: 'G', contextSetId: '100', sportType: 'Baseball' });
  assert.equal(injected, true);

  const container = row.querySelector('.tk-inline-add');
  assert.ok(container, 'Expected .tk-inline-add container in row');
  const input = container.querySelector('.tk-qty-input');
  assert.ok(input, 'Expected .tk-qty-input in container');
  assert.equal(input.value, '1');
  const btn = container.querySelector('.tk-add-btn');
  assert.ok(btn, 'Expected .tk-add-btn in container');
  assert.equal(btn.textContent, '+');
});

test('injectRowQuickAdd: skips rows without card link and is idempotent', () => {
  const dom = makeCardTableDom();
  const rows = dom.window.document.querySelectorAll('table tr');

  // Row 0 has no card link matching /cid/
  const injectedRow0 = injectRowQuickAdd(rows[0]);
  assert.equal(injectedRow0, false);

  // Row 1 has card link
  const injectedFirst = injectRowQuickAdd(rows[1]);
  assert.equal(injectedFirst, true);

  // Second pass on Row 1 should skip (idempotent)
  const injectedSecond = injectRowQuickAdd(rows[1]);
  assert.equal(injectedSecond, false);
});

test('initQuickAddGridEnhancer: initializes module and injects controls into card rows', () => {
  const dom = makeCardTableDom();
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLDocument = dom.window.HTMLDocument;

  resetContracts();
  initQuickAddGridEnhancer();

  const injectedContainers = dom.window.document.querySelectorAll('.tk-inline-add');
  assert.equal(injectedContainers.length, 1);
});

test('injectRowQuickAdd: click handler dispatches POST and updates row color, badge, and context menu ID', async () => {
  const dom = new JSDOM(
    `<!DOCTYPE html>
    <html>
      <body>
        <table>
          <tbody>
            <tr class="collection_row" bgcolor="#FFFFFF">
              <td></td>
              <td>101</td>
              <td><div id="nActions55555"><ul class="dropdown-menu"><li>Add to Collection</li></ul></div></td>
              <td>
                <a href="/ViewCard.cfm/sid/100/cid/55555/101-Shohei-Ohtani">Card Link</a>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>`,
    { url: 'https://www.tcdb.com/ViewCollectionForSaleTrade.cfm/sid/100' }
  );

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.DOMParser = dom.window.DOMParser;
  globalThis.fetch = async () => ({
    ok: true,
    text: async () => `
      <html>
        <body>
          <table>
            <tr class="collection_row table-success" bgcolor="#d4edda">
              <td><span class="badge">1</span></td>
              <td>101</td>
              <td><div id="nActions5555598518"><ul class="dropdown-menu"><li>Add Another to Collection</li><li>Remove</li></ul></div></td>
              <td><a href="/ViewCard.cfm/sid/100/cid/55555/101-Shohei-Ohtani">Card Link</a></td>
            </tr>
          </table>
        </body>
      </html>
    `
  });

  const row = dom.window.document.querySelector('table tr');
  injectRowQuickAdd(row, { listContext: 'S', contextSetId: '100', sportType: 'Baseball' });

  const btn = row.querySelector('.tk-add-btn');
  assert.ok(btn);

  btn.click();
  // Wait for promise microtask resolution
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.equal(row.getAttribute('bgcolor'), '#d4edda');
  assert.equal(row.className, 'collection_row table-success');

  const liveBadge = row.querySelector('td:nth-child(1) .badge');
  assert.ok(liveBadge, 'Expected quantity badge in Column 1');
  assert.equal(liveBadge.textContent.trim(), '1');

  const updatedActions = row.querySelector('#nActions5555598518');
  assert.ok(updatedActions, 'Expected element with updated ID nActions5555598518');
  assert.ok(updatedActions.innerHTML.includes('Add Another to Collection'));
  assert.ok(updatedActions.innerHTML.includes('Remove'));
});


