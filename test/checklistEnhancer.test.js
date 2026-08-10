import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import {
  applyFilter,
  buildRowIndex,
  findFilterScope,
  initChecklistEnhancer,
  disconnectChecklistEnhancer,
  ActiveObservers
} from '../src/modules/checklistEnhancer.js';

test('applyFilter: supports "." as a valid OR separator', () => {
  const dom = new JSDOM(`
    <div>
      <div id="row1">Card #1 - Justin Verlander</div>
      <div id="row2">Card #2 - Pete Alonso</div>
      <div id="row3">Card #3 - Francisco Lindor</div>
      <div id="row4">Card #4 - Max Scherzer</div>
    </div>
  `);

  const doc = dom.window.document;
  const index = [
    { el: doc.getElementById('row1'), haystack: 'card #1 - justin verlander' },
    { el: doc.getElementById('row2'), haystack: 'card #2 - pete alonso' },
    { el: doc.getElementById('row3'), haystack: 'card #3 - francisco lindor' },
    { el: doc.getElementById('row4'), haystack: 'card #4 - max scherzer' }
  ];

  // Test "1.2.3" -> OR condition matching 1, 2, or 3
  const visibleCount = applyFilter(index, '1.2.3');

  assert.equal(visibleCount, 3, 'Should match 3 rows for 1, 2, or 3');
  assert.equal(doc.getElementById('row1').classList.contains('tk-hidden'), false);
  assert.equal(doc.getElementById('row2').classList.contains('tk-hidden'), false);
  assert.equal(doc.getElementById('row3').classList.contains('tk-hidden'), false);
  assert.equal(doc.getElementById('row4').classList.contains('tk-hidden'), true);
});

test('buildRowIndex: matches ViewAll and ViewAllC links in item elements', () => {
  const dom = new JSDOM(`
    <div id="main-content-area">
      <ul>
        <li><a href="https://www.tcdb.com/ViewAll.cfm/sp/Baseball/year/2023">2023 Baseball</a></li>
        <li><a href="https://www.tcdb.com/ViewAllC.cfm/sp/Baseball/year/2024">2024 Baseball Category</a></li>
      </ul>
    </div>
  `);

  const scope = findFilterScope(dom.window.document);
  assert.ok(scope, 'findFilterScope should find main-content-area');

  const index = buildRowIndex(scope);
  assert.equal(index.length, 2, 'buildRowIndex should index both ViewAll and ViewAllC items');
});

test('observeChecklistFilter & disconnectChecklistEnhancer: installs filter on late-rendered DOM update', (t, done) => {
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
      <body>
        <div id="main-content-area">
          <div class="more">More Links</div>
        </div>
      </body>
    </html>
  `);

  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  globalThis.MutationObserver = dom.window.MutationObserver;

  initChecklistEnhancer();

  assert.equal(ActiveObservers.size, 1, 'Should register an observer');

  // Dynamically append a list after init
  const main = dom.window.document.getElementById('main-content-area');
  const ul = dom.window.document.createElement('ul');
  ul.innerHTML = '<li><a href="/ViewSet.cfm/sid/1">2023 Bowman</a></li>';
  main.appendChild(ul);

  setTimeout(() => {
    const filterWrap = dom.window.document.getElementById('tk-checklist-filter-wrap');
    assert.ok(filterWrap, 'Filter wrap should be installed after dynamic DOM update');

    disconnectChecklistEnhancer();
    assert.equal(ActiveObservers.size, 0, 'Observers should be disconnected');
    done();
  }, 250);
});
