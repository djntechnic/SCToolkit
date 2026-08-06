import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PRINT_COLLECTION_HEADER,
  buildPrintCollectionUrlFromDoc,
  parsePrintCollectionDocument,
  parsePrintItem
} from '../src/data/printCollectionParser.js';
import { fixtureDocument, documentFrom } from './helpers.js';

test('parsePrintItem: parses standard card item with Print Run SN99', () => {
  const doc = documentFrom(`
    <div class="yourcol-item">
      <img class="yourcol-box-img" src="checkboxc.gif" width="10" height="10">
      <span class="yourcol-text">1998 Pacific Paramount Holographic 117 Shannon Stewart SN99 $</span>
    </div>
  `);
  const item = doc.querySelector('.yourcol-item');
  const result = parsePrintItem(item, { sport: 'Baseball', includePrice: false });

  assert.ok(result);
  assert.equal(result.qty, 1);
  assert.deepEqual(result.row, [
    'Baseball',
    '1998',
    'Pacific Paramount Holographic',
    '',
    '117',
    'Shannon Stewart',
    '',
    '99',
    1
  ]);
});

test('parsePrintItem: parses player with generational suffix (Jr.) and Print Run', () => {
  const doc = documentFrom(`
    <div class="yourcol-item">
      <img class="yourcol-box-img" src="checkboxc.gif" width="10" height="10">
      <span class="yourcol-text">1999 Pacific Crown Royale Limited S 42 Sandy Alomar Jr. SN99 $</span>
    </div>
  `);
  const item = doc.querySelector('.yourcol-item');
  const result = parsePrintItem(item, { sport: 'Baseball', includePrice: false });

  assert.ok(result);
  assert.deepEqual(result.row, [
    'Baseball',
    '1999',
    'Pacific Crown Royale Limited S',
    '',
    '42',
    'Sandy Alomar Jr.',
    '',
    '99',
    1
  ]);
});

test('parsePrintItem: parses multi-player card description', () => {
  const doc = documentFrom(`
    <div class="yourcol-item">
      <img class="yourcol-box-img" src="checkboxc.gif" width="10" height="10">
      <span class="yourcol-text">1999 Pacific Omega Copper 28 Bruce Chen / Odalis Perez SN99 $</span>
    </div>
  `);
  const item = doc.querySelector('.yourcol-item');
  const result = parsePrintItem(item, { sport: 'Baseball', includePrice: false });

  assert.ok(result);
  assert.equal(result.row[5], 'Bruce Chen / Odalis Perez');
  assert.equal(result.row[7], '99');
});

test('parsePrintItem: parses explicit quantity badge [2]', () => {
  const doc = documentFrom(`
    <div class="yourcol-item">
      <span class="yourcol-qty">[2]</span>
      <span class="yourcol-text">1999 Pacific Omega Copper 42 Jose Offerman SN99 $</span>
    </div>
  `);
  const item = doc.querySelector('.yourcol-item');
  const result = parsePrintItem(item, { sport: 'Baseball', includePrice: false });

  assert.ok(result);
  assert.equal(result.qty, 2);
  assert.equal(result.row[8], 2);
});

test('parsePrintItem: includes price column when includePrice is true', () => {
  const doc = documentFrom(`
    <div class="yourcol-item">
      <img class="yourcol-box-img" src="checkboxc.gif">
      <span class="yourcol-text">2020 Topps Chrome 100 Mike Trout $15.50</span>
    </div>
  `);
  const item = doc.querySelector('.yourcol-item');
  const result = parsePrintItem(item, { sport: 'Baseball', includePrice: true });

  assert.ok(result);
  assert.equal(result.row.length, 10);
  assert.equal(result.row[9], '15.50');
});

test('parsePrintCollectionDocument: parses fixture submitted/PrintYourCollectionPDF.html', () => {
  const doc = fixtureDocument('submitted/PrintYourCollectionPDF.html');
  const parsed = parsePrintCollectionDocument(doc, { includePrice: false });

  assert.ok(parsed.count > 0);
  assert.ok(parsed.quantity >= parsed.count);
  assert.deepEqual(parsed.header, PRINT_COLLECTION_HEADER);
  assert.equal(parsed.header[7], 'Print Run');
  assert.equal(parsed.header[8], 'Qty');

  // Verify first data row header match
  assert.equal(parsed.rows[0].length, 9);

  // Verify row 1 content (1998 Pacific Paramount Holographic 117 Shannon Stewart SN99)
  const firstDataRow = parsed.rows[1];
  assert.equal(firstDataRow[0], 'Baseball');
  assert.equal(firstDataRow[1], '1998');
  assert.equal(firstDataRow[2], 'Pacific Paramount Holographic');
  assert.equal(firstDataRow[4], '117');
  assert.equal(firstDataRow[5], 'Shannon Stewart');
  assert.equal(firstDataRow[7], '99');
  assert.equal(firstDataRow[8], 1);
});

test('Collection.html summary fixture: extracts part links correctly', () => {
  const doc = fixtureDocument('submitted/Collection.html');
  const part1Link = doc.querySelector('a[href*="PrintYourCollectionPDF"], a[href*="PrintCenter.cfm"], a[href*="Part="]');
  assert.ok(part1Link);
  assert.match(part1Link.href, /Report=PrintYourCollectionPDF/);
  assert.match(part1Link.href, /Part=1/);
});

test('buildPrintCollectionUrlFromDoc: constructs PrintYourCollectionPDF URL from DOM and path params', () => {
  const doc = documentFrom(`
    <div id="content">
      <div class="col-md-8 nopadding">
        <div class="block1">
          <h3 class="site">Wantlist Print</h3>
          <p><strong>Baseball</strong></p>
        </div>
      </div>
    </div>
  `);

  const urlPart1 = buildPrintCollectionUrlFromDoc(doc, 1);
  assert.match(urlPart1, /^PrintYourCollectionPDF\.cfm\?/);
  assert.match(urlPart1, /Part=1/);
  assert.match(urlPart1, /Filter=W/);
  assert.match(urlPart1, /Type=Baseball/);
});

test('Collection.html summary fixture: constructs exact PrintYourCollectionPDF.cfm target URL', () => {
  const doc = fixtureDocument(
    'submitted/Collection.html',
    'https://www.tcdb.com/Collection.cfm/member/djncards/collection/6?MODE=PRINT2&Type=Baseball&Total=1743'
  );

  const urlPart1 = buildPrintCollectionUrlFromDoc(doc, 1);
  assert.equal(
    urlPart1,
    'PrintYourCollectionPDF.cfm?Type=Baseball&CollectionID=6&Part=1&columns=2&fontsize=1&prices=N&SetID=&Member=djncards&Filter=W&sTeamID='
  );
});



