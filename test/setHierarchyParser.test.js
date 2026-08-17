import test from 'node:test';
import assert from 'node:assert/strict';
import { fixtureDocument, documentFrom } from './helpers.js';
import { parseViewAllSets, parseChildSets } from '../src/data/setHierarchyParser.js';
import { buildFullSetName, buildFullSetNameTrunc, resolveSportFromDocument, resolveYearFromDocument, stripYearPrefix } from '../src/net/setHierarchyExport.js';

test('parseViewAllSets: parses ViewAll-Sets.html correctly', () => {
  const doc = fixtureDocument('submitted/ViewAll-Sets.html');
  const parentSets = parseViewAllSets(doc, '1955');

  assert.ok(parentSets.length > 0);
  const bowman = parentSets.find((p) => p.setId === '35');
  assert.ok(bowman);
  assert.equal(bowman.setName, 'Bowman');
  assert.equal(bowman.category, 'Major Releases');
  assert.equal(bowman.hasHideDiv, true);

  const topps = parentSets.find((p) => p.setId === '36');
  assert.ok(topps);
  assert.equal(topps.setName, 'Topps');
  assert.equal(topps.category, 'Major Releases');
  assert.equal(topps.hasHideDiv, true);
});

test('parseViewAllSets: parses ViewAllC.html correctly', () => {
  const doc = fixtureDocument('submitted/ViewAllC.html');
  const parentSets = parseViewAllSets(doc, '2023');

  assert.ok(parentSets.length > 0);
  const bowman = parentSets.find((p) => p.setId === '357729');
  assert.ok(bowman);
  assert.equal(bowman.setName, 'Bowman');
  assert.equal(bowman.category, 'Major Releases');
  assert.equal(bowman.hasHideDiv, true);
});

test('parseViewAllSets: handles parent sets without hideDiv correctly', () => {
  const doc = documentFrom(`
    <h3 class="site">Test Category</h3>
    <ul>
      <li>
        <a href="/ViewSet.cfm/sid/100/1955-Leaf">1955 Leaf</a>
      </li>
      <li>
        <a href="/ViewSet.cfm/sid/200/1955-Bowman">1955 Bowman</a>
      </li>
      <div id="hideDiv200"></div>
    </ul>
  `);

  const parentSets = parseViewAllSets(doc, '1955');
  assert.equal(parentSets.length, 2);

  const leaf = parentSets.find((p) => p.setId === '100');
  assert.ok(leaf);
  assert.equal(leaf.setName, 'Leaf');
  assert.equal(leaf.hasHideDiv, false);

  const bowman = parentSets.find((p) => p.setId === '200');
  assert.ok(bowman);
  assert.equal(bowman.setName, 'Bowman');
  assert.equal(bowman.hasHideDiv, true);
});

test('parseChildSets: parses Inserts.html correctly', () => {
  const doc = fixtureDocument('submitted/Inserts.html');
  const childSets = parseChildSets(doc);

  assert.ok(childSets.length > 0);
  const realOne = childSets.find((c) => c.childSetId === '410117');
  assert.ok(realOne);
  assert.equal(realOne.childSetName, '1989 Topps Baseball 35th Anniversary "The Real One"');
  assert.equal(realOne.childCategory, 'Insert Sets');

  const montgomery = childSets.find((c) => c.childSetId === '459116');
  assert.ok(montgomery);
  assert.equal(montgomery.childSetName, '582 Montgomery Club');
  assert.equal(montgomery.childCategory, 'Parallel Sets');
});

test('buildFullSetName: formats set names correctly', () => {
  assert.equal(buildFullSetName('1955', 'Bowman', ''), '1955 Bowman');
  assert.equal(buildFullSetName('1955', 'Bowman', 'Salesman Samples'), '1955 Bowman - Salesman Samples');
});

test('buildFullSetNameTrunc: handles length constraints correctly', () => {
  // 1. Parent Set Name >= 31 characters: truncated at 32 chars, child name excluded
  // "A Very Long Parent Set Name Over 31 Chars" is 41 characters. First 32 chars is "A Very Long Parent Set Name Over"
  assert.equal(
    buildFullSetNameTrunc('1955', 'A Very Long Parent Set Name Over 31 Chars', 'Salesman Samples'),
    '1955 A Very Long Parent Set Name Over'
  );

  // 2. Parent Set Name >= 31 characters, with trailing whitespace in slice: trimmed
  // "A Very Long Parent Set Name Over  " (34 chars). First 32 is "A Very Long Parent Set Name Over  ". Trimmed is "A Very Long Parent Set Name Over"
  assert.equal(
    buildFullSetNameTrunc('1955', 'A Very Long Parent Set Name Over  ', 'Salesman Samples'),
    '1955 A Very Long Parent Set Name Over'
  );

  // 3. Combined length >= 30, parent < 31: truncated at 30 chars
  // Parent "Bowman Chrome" (13 chars), Child "Sapphire Edition Long" (21 chars).
  // Combined: "Bowman Chrome - Sapphire Edition Long" (37 chars).
  // First 30 chars is: "Bowman Chrome - Sapphire Editi"
  assert.equal(
    buildFullSetNameTrunc('1955', 'Bowman Chrome', 'Sapphire Edition Long'),
    '1955 Bowman Chrome - Sapphire Editi'
  );

  // 4. Combined length < 30: no truncation
  assert.equal(
    buildFullSetNameTrunc('1955', 'Bowman', 'Salesman Samples'),
    '1955 Bowman - Salesman Samples'
  );
});

test('parseChildSets: parses child set notes from figcaption correctly', () => {
  const doc = documentFrom(`
    <h3 class="site">Insert Sets</h3>
    <table>
      <tr>
        <td>
          <a href="/ViewSet.cfm/sid/123/1955-Bowman-Gold">Gold</a>
          <figcaption class="figure-caption">Randomly inserted in pack.</figcaption>
        </td>
      </tr>
      <tr>
        <td>
          <a href="/ViewSet.cfm/sid/456/1955-Bowman-Silver">Silver</a>
        </td>
      </tr>
    </table>
  `);

  const childSets = parseChildSets(doc);
  assert.equal(childSets.length, 2);

  const gold = childSets.find((c) => c.childSetId === '123');
  assert.ok(gold);
  assert.equal(gold.childSetName, 'Gold');
  assert.equal(gold.childSetNotes, 'Randomly inserted in pack.');

  const silver = childSets.find((c) => c.childSetId === '456');
  assert.ok(silver);
  assert.equal(silver.childSetName, 'Silver');
  assert.equal(silver.childSetNotes, '');
});

test('resolveSportFromDocument: parses sport from document breadcrumbs and fallback', () => {
  const doc = documentFrom(`
    <ol class="breadcrumb">
      <li><a href="/">Home</a></li>
      <li><a href="/Browse.cfm">Browse</a></li>
      <li><a href="/ViewAll.cfm/sp/Baseball">Baseball</a></li>
    </ol>
  `);
  globalThis.document = doc;
  assert.equal(resolveSportFromDocument(), 'Baseball');

  // Test URL fallback
  const docUrl = documentFrom(`<div>No breadcrumb</div>`, 'https://www.tcdb.com/ViewAll.cfm/sp/Basketball');
  globalThis.document = docUrl;
  assert.equal(resolveSportFromDocument(), 'Basketball');

  const docFallback = documentFrom(`<div>No breadcrumb</div>`);
  globalThis.document = docFallback;
  assert.equal(resolveSportFromDocument(), 'Baseball');
});

test('resolveYearFromDocument: parses year from URL and fallback', () => {
  const docUrl = documentFrom(`<div>No title</div>`, 'https://www.tcdb.com/ViewAll.cfm/sp/Baseball/year/1988');
  globalThis.document = docUrl;
  assert.equal(resolveYearFromDocument('Fleer Star Stickers'), '1988');

  const doc = documentFrom(`<div>Test Title</div>`);
  globalThis.document = doc;

  // Title fallback
  globalThis.document.title = '1988 Fleer Star Stickers';
  assert.equal(resolveYearFromDocument('Fleer Star Stickers'), '1988');

  // setName fallback
  globalThis.document.title = 'Some Title';
  assert.equal(resolveYearFromDocument('1955 Bowman'), '1955');

  // absolute fallback
  assert.equal(resolveYearFromDocument('Bowman'), 'Misc');
});

test('stripYearPrefix: removes leading year and space correctly', () => {
  assert.equal(stripYearPrefix('1988 Fleer', '1988'), 'Fleer');
  assert.equal(stripYearPrefix('2024 Bowman Chrome', '2024'), 'Bowman Chrome');
  assert.equal(stripYearPrefix('Bowman', '1955'), 'Bowman');
  assert.equal(stripYearPrefix('', '1955'), '');
  assert.equal(stripYearPrefix('1988 Fleer', ''), '1988 Fleer');
});

test('resolveSportFromDocument and resolveYearFromDocument: parses sport and year across submitted fixtures', () => {
  const fixtures = [
    { file: 'submitted/ViewCollectionForSaleTrade.html', expectedSport: 'Baseball', expectedYear: '2023' },
    { file: 'submitted/ViewCollectionWantlist.html', expectedSport: 'Baseball', expectedYear: '2023' },
    { file: 'submitted/CollectionAddMultiplesText.html', expectedSport: 'Baseball', expectedYear: '2023' },
    { file: 'submitted/CollectionAddMultiples.html', expectedSport: 'Baseball', expectedYear: '2023' },
    { file: 'submitted/Checklist.html (with Vars).html', expectedSport: 'Baseball', expectedYear: '2024' }
  ];

  fixtures.forEach(({ file, expectedSport, expectedYear }) => {
    const doc = fixtureDocument(file);
    const sport = resolveSportFromDocument(doc);
    const year = resolveYearFromDocument('', doc);
    assert.equal(sport, expectedSport, `Sport mismatch for ${file}`);
    assert.equal(year, expectedYear, `Year mismatch for ${file}`);
  });
});

