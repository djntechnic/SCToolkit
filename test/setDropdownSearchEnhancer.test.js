import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import {
  enhanceSetDropdownSearch,
  initSetDropdownSearchEnhancer
} from '../src/modules/setDropdownSearchEnhancer.js';

test('enhanceSetDropdownSearch: overrides startsWith search with substring and OR matching', () => {
  const dom = new JSDOM(`<!doctype html>
    <body>
      <div id="setWrapper">
        <div id="setDropdown">
          <input type="text" id="setSearch" placeholder="Search sets...">
          <ul id="setList">
            <li><a href="/ViewSet.cfm/sid/100">Panini Stars & Stripes USA Baseball - Base Set</a></li>
            <li><a href="/ViewSet.cfm/sid/101">13U/14U National Team Materials PE</a></li>
            <li><a href="/ViewSet.cfm/sid/102">13U/14U National Team Signatures Gold</a></li>
          </ul>
        </div>
      </div>
    </body>
  `);

  const doc = dom.window.document;
  const searchInput = doc.getElementById('setSearch');
  const setList = doc.getElementById('setList');

  // Register native TCDB-style startsWith listener first
  searchInput.addEventListener('input', () => {
    const term = searchInput.value.toLowerCase();
    [...setList.querySelectorAll('li')].forEach((li) => {
      const text = li.querySelector('a').textContent.trim().toLowerCase();
      li.classList.toggle('hidden', !text.startsWith(term));
    });
  });

  // Enhance dropdown search
  const enhanced = enhanceSetDropdownSearch(doc);
  assert.ok(enhanced, 'should enhance set dropdown search');

  // Search 'Materials' (appears in middle of set title)
  searchInput.value = 'Materials';
  searchInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));

  const visibleMaterials = [...setList.querySelectorAll('li')].filter((li) => !li.classList.contains('hidden'));
  assert.equal(visibleMaterials.length, 1);
  assert.equal(visibleMaterials[0].querySelector('a').textContent, '13U/14U National Team Materials PE');

  // Search OR condition 'Signatures, Base'
  searchInput.value = 'Signatures, Base';
  searchInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));

  const visibleOR = [...setList.querySelectorAll('li')].filter((li) => !li.classList.contains('hidden'));
  assert.equal(visibleOR.length, 2);
});

test('initSetDropdownSearchEnhancer: runs enhanceSetDropdownSearch when enabled', () => {
  const dom = new JSDOM(`<!doctype html>
    <body>
      <div id="setWrapper">
        <div id="setDropdown">
          <input type="text" id="setSearch" placeholder="Search sets...">
          <ul id="setList">
            <li><a href="/ViewSet.cfm/sid/100">Panini Stars & Stripes USA Baseball - Base Set</a></li>
          </ul>
        </div>
      </div>
    </body>
  `);

  globalThis.document = dom.window.document;
  globalThis.window = dom.window;

  initSetDropdownSearchEnhancer();
  const searchInput = dom.window.document.getElementById('setSearch');
  assert.equal(searchInput.dataset.tkEnhanced, 'true');
});
