/**
 * Tests against sanitized captures of real pages.
 *
 * The synthetic fixtures prove the parser handles the shapes we *believe*
 * exist. These prove it handles the shapes that actually do. Where the two
 * disagree, these win — and they have already won twice, on the filter's
 * container and on the print view's markup.
 *
 * Regenerate a fixture with `scripts/sanitize-fixture.js`; see
 * `test/fixtures/README.md`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

import {
  parseChecklistDocument,
  parseSetIdentity,
  parseTotalPages,
  toChecklistTable
} from '../src/data/checklistParser.js';
import { toCSV } from '../src/data/csv.js';
import { buildExportFilename } from '../src/data/filename.js';
import { findFilterScope, buildRowIndex, applyFilter } from '../src/modules/checklistEnhancer.js';
import { collectRows } from '../src/modules/csvExportEngine.js';
import { findSetLinks } from '../src/modules/setListEnhancer.js';
import { detectBlock } from '../src/net/blockDetect.js';
import { extractSid } from '../src/core/sid.js';

const real = (name) =>
  readFileSync(fileURLToPath(new URL(`./fixtures/real/${name}.html`, import.meta.url)), 'utf8');

const doc = (name) => new JSDOM(real(name)).window.document;

const ALL = [
  'checklist', 'view-all', 'for-sale-trade', 'wantlist', 'add-multiples-text',
  'collection-browse', 'collection-mode', 'print-collection', 'homepage'
];

// --- the captures themselves ------------------------------------------------

test('no capture leaks an account handle', () => {
  // These fixtures come from a logged-in session and live in a public
  // repository. The sanitizer redacts the owner and every third party who
  // appears in a listing; this is the check that it stayed redacted.
  ALL.forEach((name) => {
    const html = real(name);
    assert.equal(/djncards/i.test(html), false, `${name} contains the owner handle`);
    assert.equal(/<script\b/i.test(html), false, `${name} still contains a script tag`);
    assert.equal(/\son[a-z]+\s*=/i.test(html), false, `${name} still has an inline handler`);
  });
});

test('no capture is mistaken for a block page', () => {
  // Every one of these is ordinary content. A false positive here would abort a
  // real export and start a cooldown.
  ALL.forEach((name) => {
    assert.equal(detectBlock(real(name)), null, `${name} was flagged as a block`);
  });
});

// --- the checklist parser, end to end ---------------------------------------

test('real checklist: identity parses from the live header markup', () => {
  assert.deepEqual(parseSetIdentity(doc('checklist')), {
    year: '2023',
    baseSet: 'Bowman',
    setName: ''
  });
});

test('real checklist: every card row is found', () => {
  const parsed = parseChecklistDocument(doc('checklist'));

  assert.equal(parsed.rows.length, 100);
  assert.ok(parsed.rows.every((r) => r.cardNo), 'every row has a card number');
  assert.ok(parsed.rows.every((r) => r.subject), 'every row has a subject');
  assert.ok(parsed.rows.every((r) => r.team), 'every row has a team');
});

test('real checklist: thumbnail links are not mistaken for card numbers', () => {
  // Each card has three ViewCard links — an image thumbnail with no text, the
  // number, and the name. Picking the first would yield an empty card number
  // for all 100 rows.
  const parsed = parseChecklistDocument(doc('checklist'));
  assert.equal(parsed.rows[0].cardNo, '1');
  assert.ok(parsed.rows.every((r) => !/^\s*$/.test(r.cardNo)));
});

test('real checklist: generational suffixes survive on real names', () => {
  const parsed = parseChecklistDocument(doc('checklist'));
  const tatis = parsed.rows.find((r) => r.subject.startsWith('Fernando Tatis'));

  assert.equal(tatis.subject, 'Fernando Tatis Jr.');
  assert.equal(tatis.tags, '', 'Jr. must not be captured as a tag');
});

test('real checklist: rookie tags are extracted, not left in the name', () => {
  const parsed = parseChecklistDocument(doc('checklist'));
  const rc = parsed.rows.filter((r) => r.tags === 'RC');

  assert.ok(rc.length > 10, `expected many RC rows, got ${rc.length}`);
  assert.ok(rc.every((r) => !/\bRC\b/.test(r.subject)), 'RC leaked into a subject');
});

test('real checklist: the exported CSV is well formed', () => {
  const parsed = parseChecklistDocument(doc('checklist'));
  const table = toChecklistTable(parsed, parsed.rows);
  const csv = toCSV(table);
  const lines = csv.split('\n');

  assert.equal(lines[0], 'Year,Base Set,Set Name,Card No,Subject,Tags,Print Run,Team');
  assert.equal(lines.length, 101);
  assert.equal(lines[1], '2023,Bowman,,1,Byron Buxton,,,Minnesota Twins');
  // Every row has the full column count, including any that needed quoting.
  table.forEach((row) => assert.equal(row.length, 8));
});

test('real checklist: the filename derives from the parsed header', () => {
  const parsed = parseChecklistDocument(doc('checklist'));
  assert.equal(
    buildExportFilename({ ...parsed, fallbackLabel: '2023 Bowman', kind: 'checklist' }),
    '2023_Bowman_Checklist.csv'
  );
});

// --- pagination -------------------------------------------------------------

test('real pagination: the page count comes from the last-page link', () => {
  // This is the one that would have silently truncated exports. The control
  // lists pages 1-10 as numbered links, but the set has 18 pages — only the
  // final "»" link carries the true total. Reading the numbered links alone
  // would export 10 of 18 pages and report success.
  assert.equal(parseTotalPages(doc('collection-mode')), 18);
});

test('real pagination: a short control is read exactly', () => {
  assert.equal(parseTotalPages(doc('add-multiples-text')), 2);
});

test('real pagination: a page with no pagination control is one page', () => {
  assert.equal(parseTotalPages(doc('checklist')), 1);
});

test('real pagination: PageIndex on card links is not mistaken for pagination', () => {
  // Every card link on a checklist carries ?PageIndex=1. Scoping the selector
  // to .pagination is what keeps those 300 links out of the page count.
  const d = doc('checklist');
  assert.ok(d.querySelectorAll('a[href*="PageIndex="]').length > 50);
  assert.equal(parseTotalPages(d), 1);
});

// --- the filter's container -------------------------------------------------

test('real pages: the filter finds a container on every route it is configured for', () => {
  // The bug these captures exposed. #main-content-area exists only on
  // checklist and set-index pages; the other three routes in the module's own
  // urlMatch use #content, so the filter silently never appeared there.
  ['checklist', 'for-sale-trade', 'wantlist', 'add-multiples-text'].forEach((name) => {
    assert.ok(findFilterScope(doc(name)), `no filter container found on ${name}`);
  });
});

test('real pages: the filter prefers the narrower container when both exist', () => {
  const d = doc('checklist');
  assert.equal(findFilterScope(d).id, 'main-content-area');
});

test('real pages: the row index picks up data rows on each listing route', () => {
  ['checklist', 'for-sale-trade', 'wantlist', 'add-multiples-text'].forEach((name) => {
    const index = buildRowIndex(findFilterScope(doc(name)));
    assert.ok(index.length > 5, `${name} indexed only ${index.length} rows`);
  });
});

test('real pages: filtering a real checklist narrows to the matching rows', () => {
  const index = buildRowIndex(findFilterScope(doc('checklist')));
  const all = index.length;

  assert.equal(applyFilter(index, 'byron buxton'), 1);
  assert.equal(applyFilter(index, ''), all);
  assert.equal(applyFilter(index, 'zzzznotacard'), 0);
});

// --- set links --------------------------------------------------------------

test('real set index: every badge target is a genuine set link', () => {
  const links = findSetLinks(doc('view-all'));

  assert.ok(links.length > 20, `expected many set links, got ${links.length}`);
  links.forEach((link) => {
    assert.ok(extractSid(link.getAttribute('href')), `no sid on ${link.getAttribute('href')}`);
  });
});

test('real set index: image-only links are excluded', () => {
  const d = doc('view-all');
  const all = d.querySelectorAll('a[href*="/sid/"]').length;
  assert.ok(findSetLinks(d).length < all, 'nothing was filtered out');
});

// --- print view -------------------------------------------------------------

test('real print view: the export is not empty', () => {
  // The print page is a div grid with no table at all. A table-only dump wrote
  // a CSV containing nothing — a download that looked like it worked.
  const rows = collectRows(doc('print-collection'));

  assert.ok(rows.length > 1, `print view yielded ${rows.length} row(s)`);
  assert.deepEqual(rows[0], ['Item']);
  assert.ok(rows[1][0].length > 0);
});

test('real listing pages: table rows still take precedence over the grid', () => {
  const rows = collectRows(doc('for-sale-trade'));
  assert.ok(rows.length > 1);
  assert.ok(rows.some((r) => r.length > 1), 'expected multi-column table rows');
});

// --- negative control -------------------------------------------------------

test('real homepage: the checklist parser finds no card rows', () => {
  // The homepage carries ViewCard and Person links in its featured panels. The
  // parser must still yield nothing, because there is no checklist here.
  const parsed = parseChecklistDocument(doc('homepage'));
  assert.equal(parsed.rows.length, 0);
});
