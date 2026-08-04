import test from 'node:test';
import assert from 'node:assert/strict';

import { deriveSetYear } from '../src/core/storage.js';
import { extractSid, extractParentSid } from '../src/core/sid.js';
import { JSDOM } from 'jsdom';

test('extractSid: path form', () => {
  assert.equal(extractSid('/Checklist.cfm/sid/12345/'), '12345');
});

test('extractSid: query form', () => {
  assert.equal(extractSid('/ViewSet.cfm?sid=678'), '678');
});

test('extractSid: case-insensitive', () => {
  assert.equal(extractSid('/Checklist.cfm/SID/99/'), '99');
});

test('extractSid: absent or empty input yields null', () => {
  assert.equal(extractSid('/Person.cfm/pid/4'), null);
  assert.equal(extractSid(''), null);
  assert.equal(extractSid(null), null);
});

test('extractParentSid: extracts parent SID from .menu-linksV Overview link', () => {
  const dom = new JSDOM(`
    <div id="content">
      <div><div><div>
        <div class="menu-linksV">
          <ul class="menu-listV">
            <li><a href="/ViewSet.cfm/sid/294644/2022-Donruss---Unleashed-Vector">Overview</a></li>
          </ul>
        </div>
      </div></div></div>
    </div>
  `);
  assert.equal(extractParentSid(dom.window.document, '355099'), '294644');
});

test('extractParentSid: extracts parent SID from breadcrumbs when menu is absent', () => {
  const dom = new JSDOM(`
    <ul class="breadcrumb">
      <li><a href="/Baseball/">Baseball</a></li>
      <li><a href="/ViewSet.cfm/sid/10000/2023-Topps">2023 Topps</a></li>
      <li><a href="/ViewCollectionForSaleTrade.cfm/sid/355099/">All-Aces</a></li>
    </ul>
  `);
  assert.equal(extractParentSid(dom.window.document, '355099'), '10000');
});

test('extractParentSid: extracts parent SID from Overview link even when currentSid links precede it', () => {
  const dom = new JSDOM(`
    <div id="content">
      <div><div><div>
        <div class="menu-linksV">
          <ul class="menu-listV">
            <li><a href="/ViewCollectionForSaleTrade.cfm/sid/340973/">Collection Link</a></li>
            <li><a href="/ViewSet.cfm/sid/335310/2022-Donruss-Optic---Orange-Prizm">Overview</a></li>
            <li><a href="/Checklist.cfm/sid/340973/">Checklist</a></li>
          </ul>
        </div>
      </div></div></div>
    </div>
  `);
  assert.equal(extractParentSid(dom.window.document, '340973'), '335310');
});

test('extractParentSid: returns null on base set page where only currentSid exists', () => {
  const dom = new JSDOM(`
    <div class="menu-linksV">
      <a href="/ViewSet.cfm/sid/10000/2023-Topps">Overview</a>
    </div>
  `);
  assert.equal(extractParentSid(dom.window.document, '10000'), null);
});

test('deriveSetYear: the href wins when it carries a year', () => {
  assert.equal(deriveSetYear('Some Set', '/Checklist.cfm/sid/12/1987-topps'), '1987');
});

test('deriveSetYear: falls back to a leading year in the name', () => {
  assert.equal(deriveSetYear('2019 Example Chrome', '/Checklist.cfm/sid/12/'), '2019');
});

test('deriveSetYear: a year that is not leading does not count', () => {
  assert.equal(deriveSetYear('Example Chrome 2019', ''), 'Misc');
});

test('deriveSetYear: no year anywhere groups under Misc', () => {
  assert.equal(deriveSetYear('Example Promos'), 'Misc');
  assert.equal(deriveSetYear(''), 'Misc');
});
