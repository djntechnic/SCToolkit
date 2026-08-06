import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

import {
  parseCollectionBrowseSet,
  parseCollectionBrowsePlayer,
  parseCollectionBrowseTeam,
  parseCollectionBrowseDocument,
  COLLECTION_BROWSE_HEADER,
  parseSetAndChildSet,
  normalizeListType
} from '../src/data/collectionBrowseParser.js';

const fixture = (name) =>
  readFileSync(fileURLToPath(new URL(`./fixtures/submitted/${name}.html`, import.meta.url)), 'utf8');

const doc = (name) => new JSDOM(fixture(name)).window.document;

test('CollectionBrowse.html (Set ForSale): parses context, rows, tags, and filename correctly', () => {
  const document = doc('CollectionBrowse');
  const result = parseCollectionBrowseSet(document);

  assert.equal(result.sport, 'Baseball');
  assert.equal(result.year, '2023');
  assert.equal(result.setName, 'Topps Chrome');
  assert.equal(result.childSet, '');
  assert.equal(result.listType, 'ForSale');
  assert.equal(result.filename, 'Baseball_2023ToppsChrome_ForSale.csv');

  assert.ok(result.rows.length > 20, `expected many rows, got ${result.rows.length}`);

  // Test row 25 Rhys Hoskins (Qty 60)
  const rhysRow = result.rows.find((r) => r[4] === '25');
  assert.ok(rhysRow, 'row 25 should exist');
  assert.equal(rhysRow[0], 'Baseball');
  assert.equal(rhysRow[1], '2023');
  assert.equal(rhysRow[2], 'Topps Chrome');
  assert.equal(rhysRow[3], '');
  assert.equal(rhysRow[4], '25');
  assert.equal(rhysRow[5], 'Rhys Hoskins');
  assert.equal(rhysRow[6], ''); // Tags
  assert.equal(rhysRow[7], ''); // Print Run
  assert.equal(rhysRow[8], '60'); // Qty

  // Test row 29 JJ Bleday RC (Qty 57)
  const bledayRow = result.rows.find((r) => r[4] === '29');
  assert.ok(bledayRow, 'row 29 should exist');
  assert.equal(bledayRow[5], 'JJ Bleday');
  assert.equal(bledayRow[6], 'RC');
  assert.equal(bledayRow[8], '57');
});

test('CollectionBrowse2.html (Set Wantlist): parses context, rows, tags, and appends _Wantlist to filename', () => {
  const document = doc('CollectionBrowse2');
  const result = parseCollectionBrowseSet(document);

  assert.equal(result.sport, 'Baseball');
  assert.equal(result.year, '2019');
  assert.equal(result.setName, 'Topps Holiday');
  assert.equal(result.childSet, '');
  assert.equal(result.listType, 'Wantlist');
  assert.equal(result.filename, 'Baseball_2019ToppsHoliday_Wantlist.csv');

  assert.ok(result.rows.length === 12, `expected 12 rows, got ${result.rows.length}`);

  const hammerRow = result.rows.find((r) => r[4] === 'HW7');
  assert.ok(hammerRow, 'row HW7 should exist');
  assert.equal(hammerRow[5], 'JD Hammer');
  assert.equal(hammerRow[6], 'RC');
  assert.equal(hammerRow[8], '1');
});

test('CollectionBrowseP.html (Player): parses player context, rows, tags, and filename correctly', () => {
  const document = doc('CollectionBrowseP');
  const result = parseCollectionBrowsePlayer(document);

  assert.equal(result.globalPlayer, 'Ryne Sandberg');
  assert.equal(result.globalSport, 'Baseball');
  assert.equal(result.listType, 'Collection');
  assert.equal(result.filename, 'RyneSandberg_Collection.csv');

  assert.ok(result.rows.length > 20, `expected many rows, got ${result.rows.length}`);

  // Test 1984 Fleer #504 Ryne Sandberg
  const fleerRow = result.rows.find((r) => r[2] === 'Fleer' && r[4] === '504');
  assert.ok(fleerRow, '1984 Fleer #504 should exist');
  assert.equal(fleerRow[0], 'Baseball');
  assert.equal(fleerRow[1], '1984');
  assert.equal(fleerRow[2], 'Fleer');
  assert.equal(fleerRow[3], '');
  assert.equal(fleerRow[4], '504');
  assert.equal(fleerRow[5], 'Ryne Sandberg');
  assert.equal(fleerRow[8], '1'); // Qty
});

test('CollectionBrowseT.html (Team): parses team context, rows, tags, and filename correctly', () => {
  const document = doc('CollectionBrowseT');
  const result = parseCollectionBrowseTeam(document);

  assert.equal(result.globalTeam, 'Arizona Diamondbacks');
  assert.equal(result.globalSport, 'Baseball');
  assert.equal(result.listType, 'Wantlist');
  assert.equal(result.filename, 'ArizonaDiamondbacks_Wantlist.csv');

  assert.ok(result.rows.length > 5, `expected rows, got ${result.rows.length}`);
});

test('parseCollectionBrowseDocument: routes to set, player, or team parser correctly', () => {
  const setDoc = doc('CollectionBrowse');
  const setParsed = parseCollectionBrowseDocument(setDoc);

  assert.deepEqual(setParsed.header, COLLECTION_BROWSE_HEADER);
  assert.equal(setParsed.type, 'set');
  assert.equal(setParsed.filename, 'Baseball_2023ToppsChrome_ForSale.csv');
  assert.equal(setParsed.rows[0], COLLECTION_BROWSE_HEADER);

  const playerDoc = doc('CollectionBrowseP');
  const playerParsed = parseCollectionBrowseDocument(playerDoc);

  assert.deepEqual(playerParsed.header, COLLECTION_BROWSE_HEADER);
  assert.equal(playerParsed.type, 'player');
  assert.equal(playerParsed.filename, 'RyneSandberg_Collection.csv');
  assert.equal(playerParsed.rows[0], COLLECTION_BROWSE_HEADER);

  const teamDoc = doc('CollectionBrowseT');
  const teamParsed = parseCollectionBrowseDocument(teamDoc);

  assert.deepEqual(teamParsed.header, COLLECTION_BROWSE_HEADER);
  assert.equal(teamParsed.type, 'team');
  assert.equal(teamParsed.filename, 'ArizonaDiamondbacks_Wantlist.csv');
  assert.equal(teamParsed.rows[0], COLLECTION_BROWSE_HEADER);
});

test('parseSetAndChildSet: correctly handles single set name vs child set', () => {
  assert.deepEqual(parseSetAndChildSet('Topps Chrome'), { setName: 'Topps Chrome', childSet: '' });
  assert.deepEqual(parseSetAndChildSet('Bowman Platinum - Platinum Presence'), {
    setName: 'Bowman Platinum',
    childSet: 'Platinum Presence'
  });
  assert.deepEqual(parseSetAndChildSet('Topps - Collector\'s Edition (Tiffany)'), {
    setName: 'Topps',
    childSet: 'Collector\'s Edition (Tiffany)'
  });
});

test('normalizeListType: strictly normalizes list type to Wantlist, ForSale, or Collection', () => {
  const domWants = new JSDOM(
    '<html><body><select name="Filter"><option selected>Wants</option></select></body></html>',
    { url: 'https://www.tcdb.com/CollectionBrowseP.cfm?Filter=W' }
  );
  assert.equal(normalizeListType(domWants.window.document), 'Wantlist');

  const domSale = new JSDOM(
    '<html><body><select name="Filter"><option selected>For Sale / Trade</option></select></body></html>',
    { url: 'https://www.tcdb.com/CollectionBrowseP.cfm?Filter=S' }
  );
  assert.equal(normalizeListType(domSale.window.document), 'ForSale');

  const domColl = new JSDOM(
    '<html><body><select name="Filter"><option selected>All Items</option></select></body></html>',
    { url: 'https://www.tcdb.com/CollectionBrowseP.cfm' }
  );
  assert.equal(normalizeListType(domColl.window.document), 'Collection');
});

test('Tag extraction: correctly extracts RD tag from card text', () => {
  const html = `
    <html>
      <head><title>Collection - djncards - CJ Abrams Trading Card Database</title></head>
      <body>
        <table>
          <tr class="collection_row">
            <td><button><span class="badge">1</span></button></td>
            <td><a>2022 Topps Chrome Update - Purple Refractor #USC102 CJ Abrams RD</a></td>
          </tr>
        </table>
      </body>
    </html>
  `;
  const document = new JSDOM(html).window.document;
  const parsed = parseCollectionBrowsePlayer(document);

  assert.equal(parsed.rows.length, 1);
  const row = parsed.rows[0];
  assert.equal(row[1], '2022');
  assert.equal(row[2], 'Topps Chrome Update');
  assert.equal(row[3], 'Purple Refractor');
  assert.equal(row[4], 'USC102');
  assert.equal(row[5], 'CJ Abrams');
  assert.equal(row[6], 'RD');
  assert.equal(row[8], '1');
});
