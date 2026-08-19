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

test('Select All button: visibility and checking functionality', (t, done) => {
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
      <body>
        <div id="content">
          <table>
            <tbody>
              <tr class="collection_row">
                <td><label><input type="checkbox" id="cb1"></label></td>
                <td>186 Franmil Reyes FS</td>
              </tr>
              <tr class="collection_row">
                <td><label><input type="checkbox" id="cb2"></label></td>
                <td>197 Wrigley Field STAD</td>
              </tr>
              <tr class="collection_row">
                <td><label><input type="checkbox" id="cb3"></label></td>
                <td>226 Albert Almora</td>
              </tr>
            </tbody>
          </table>
        </div>
      </body>
    </html>
  `);

  globalThis.document = dom.window.document;
  globalThis.window = dom.window;

  initChecklistEnhancer();

  const input = dom.window.document.getElementById('tk-checklist-filter');
  const selectAllBtn = dom.window.document.getElementById('tk-checklist-filter-select-all');
  const cb1 = dom.window.document.getElementById('cb1');
  const cb2 = dom.window.document.getElementById('cb2');
  const cb3 = dom.window.document.getElementById('cb3');

  assert.ok(selectAllBtn, 'Select All button should be installed');
  assert.equal(selectAllBtn.style.display, 'none', 'Select All button should be hidden initially when filter is empty');

  // Trigger input for "186.197" -> matches row 1 and row 2, but not row 3
  input.value = '186.197';
  input.dispatchEvent(new dom.window.Event('input'));

  setTimeout(() => {
    assert.notEqual(selectAllBtn.style.display, 'none', 'Select All button should be visible when 1+ matches appear');

    // Click Select All button
    selectAllBtn.click();

    assert.equal(cb1.checked, true, 'Row 1 checkbox (matching) should be checked');
    assert.equal(cb2.checked, true, 'Row 2 checkbox (matching) should be checked');
    assert.equal(cb3.checked, false, 'Row 3 checkbox (non-matching) should remain unchecked');

    // Filter for non-matching term "xyz"
    input.value = 'xyz';
    input.dispatchEvent(new dom.window.Event('input'));

    setTimeout(() => {
      assert.equal(selectAllBtn.style.display, 'none', 'Select All button should hide when 0 matches appear');

      // Clear filter
      input.value = '';
      input.dispatchEvent(new dom.window.Event('input'));

      setTimeout(() => {
        assert.equal(selectAllBtn.style.display, 'none', 'Select All button should hide when filter is cleared');
        disconnectChecklistEnhancer();
        done();
      }, 250);
    }, 250);
  }, 250);
});

test('Select All button: remains hidden for tables without checkboxes', (t, done) => {
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
      <body>
        <div id="content">
          <table>
            <tbody>
              <tr class="collection_row">
                <td>186 Franmil Reyes FS</td>
              </tr>
              <tr class="collection_row">
                <td>197 Wrigley Field STAD</td>
              </tr>
            </tbody>
          </table>
        </div>
      </body>
    </html>
  `);

  globalThis.document = dom.window.document;
  globalThis.window = dom.window;

  initChecklistEnhancer();

  const input = dom.window.document.getElementById('tk-checklist-filter');
  const selectAllBtn = dom.window.document.getElementById('tk-checklist-filter-select-all');

  input.value = 'Franmil';
  input.dispatchEvent(new dom.window.Event('input'));

  setTimeout(() => {
    assert.equal(selectAllBtn.style.display, 'none', 'Select All button should remain hidden when table has no checkboxes');
    disconnectChecklistEnhancer();
    done();
  }, 250);
});

