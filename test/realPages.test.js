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
  CAPTION_TAGS,
  CHECKLIST_HEADER,
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
  'checklist', 'checklist-variations', 'checklist-non-sport', 'view-all',
  'inserts', 'inserts-basketball', 'view-card', 'for-sale-trade', 'wantlist',
  'checklist-var-err-uer-cor', 'add-multiples-text', 'collection-browse', 'collection-mode',
  'player-collection', 'player-wantlist', 'print-collection', 'homepage'
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

  assert.equal(lines[0], 'Year,Base Set,Set Name,Card No,Subject,Tags,Print Run,Team,Variations');
  assert.equal(lines.length, 101);
  assert.equal(lines[1], '2023,Bowman,,1,Byron Buxton,,,Minnesota Twins,');
  // Every row has the full column count, including any that needed quoting.
  table.forEach((row) => assert.equal(row.length, CHECKLIST_HEADER.length));
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
  ['checklist', 'inserts', 'inserts-basketball', 'view-all', 'for-sale-trade', 'wantlist', 'add-multiples-text'].forEach((name) => {
    assert.ok(findFilterScope(doc(name)), `no filter container found on ${name}`);
  });
});

test('real pages: the filter prefers the narrower container when both exist', () => {
  const d = doc('checklist');
  assert.equal(findFilterScope(d).id, 'main-content-area');
});

test('real pages: the row index picks up data rows on each listing route', () => {
  ['checklist', 'inserts', 'inserts-basketball', 'view-all', 'for-sale-trade', 'wantlist', 'add-multiples-text'].forEach((name) => {
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

test('real pages: filtering an inserts page narrows to the matching insert sets', () => {
  const index = buildRowIndex(findFilterScope(doc('inserts')));
  const all = index.length;

  assert.ok(all > 5, `inserts indexed ${all} rows`);
  assert.ok(applyFilter(index, 'autograph') < all, 'filtering by autograph should narrow results');
  assert.equal(applyFilter(index, ''), all);
  assert.equal(applyFilter(index, 'zzzznotaninsert'), 0);
});

test('real pages: findFilterTarget selects the main listing element, avoiding sidebar/dropdown chrome', () => {
  import('../src/modules/checklistEnhancer.js').then(({ findFilterTarget }) => {
    ['checklist', 'inserts', 'inserts-basketball', 'view-all', 'for-sale-trade', 'wantlist', 'add-multiples-text'].forEach((name) => {
      const scope = findFilterScope(doc(name));
      const target = findFilterTarget(scope);
      assert.ok(target, `no filter target found on ${name}`);
      assert.equal(target.closest('.set-dropdown, .col-md-3, .col-md-4, nav, .breadcrumb'), null, `filter target on ${name} fell into sidebar/nav chrome`);
    });
  });
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

// --- variations, and the captions that are not variations -------------------

test('real variations: a genuine VAR caption is attached to the tag', () => {
  const parsed = parseChecklistDocument(doc('checklist-variations'));
  const soto = parsed.rows.find((r) => r.cardNo === '50b');

  assert.equal(soto.subject, 'Juan Soto');
  assert.match(soto.tags, /VAR \(In Yankees uniform with team designation\)/);
});

test('real variations: a checklist-range caption is NOT turned into a variation', () => {
  // The bug this capture found. Checklist cards caption themselves with the
  // range they cover — "Checklist: 211-245". v2.42.0 fabricated a
  // `VAR (Checklist: 211-245)` tag for every one of them: 20 wrong rows in a
  // single real set, in a column people filter on.
  const parsed = parseChecklistDocument(doc('checklist-variations'));

  const fabricated = parsed.rows.filter((r) => /VAR \(Checklist:/.test(r.tags));
  assert.deepEqual(fabricated, [], 'a card-range caption is metadata, not a variation');

  const card38 = parsed.rows.find((r) => r.cardNo === '38');
  assert.equal(card38.tags, 'CL, CPC');
});

test('real variations: an unprefixed caption on a suffixed card still counts', () => {
  // `126b` is a variant of `126` by the site's own numbering convention, so an
  // unprefixed caption there is describing the variation.
  const parsed = parseChecklistDocument(doc('checklist-variations'));
  const card = parsed.rows.find((r) => r.cardNo === '126b');

  assert.match(card.tags, /VAR \(Kevin Hart image variation\)/);
});

test('real variations: print runs are extracted from real SN tokens', () => {
  const parsed = parseChecklistDocument(doc('checklist-variations'));
  const numbered = parsed.rows.filter((r) => r.printRun);

  assert.ok(numbered.length > 0, 'expected serial-numbered cards');
  numbered.forEach((r) => {
    assert.match(r.printRun, /^\d+$/, `bad print run ${r.printRun}`);
    assert.equal(/\bSN\d+/.test(r.subject), false, 'SN token leaked into the subject');
  });
});

test('real variations: no row ends up with an empty subject', () => {
  const parsed = parseChecklistDocument(doc('checklist-variations'));
  assert.deepEqual(parsed.rows.filter((r) => !r.subject), []);
});

// --- a non-sport set --------------------------------------------------------

test('real non-sport set: parses without team links', () => {
  // Every other capture is Baseball. Non-sport cards have no team, which the
  // parser must treat as an empty column rather than a failure.
  const parsed = parseChecklistDocument(doc('checklist-non-sport'));

  assert.equal(parsed.year, '2025');
  assert.ok(parsed.rows.length > 10);
  assert.ok(parsed.rows.every((r) => r.cardNo && r.subject));
  assert.ok(parsed.rows.some((r) => r.team === ''), 'expected rows with no team');
});

// --- checklists do not paginate --------------------------------------------

test('real checklists render in full on one page', () => {
  // Confirmed across three captures, including a 727-row set: Checklist.cfm
  // has no pagination control at all. The export's page loop therefore makes
  // exactly one request per set today — it exists for the case where that
  // changes, and the safety ceiling still bounds it.
  ['checklist', 'checklist-variations', 'checklist-non-sport'].forEach((name) => {
    const d = doc(name);
    assert.equal(d.querySelectorAll('.pagination').length, 0, `${name} grew a pagination control`);
    assert.equal(parseTotalPages(d), 1);
  });
});

test('real collection views do paginate, and the total comes from the last link', () => {
  // These are the routes where pagination is real, and where a truncated
  // numbered list would silently cost pages.
  assert.equal(parseTotalPages(doc('collection-mode')), 18);
  assert.ok(parseTotalPages(doc('player-collection')) > 1);
  assert.ok(parseTotalPages(doc('player-wantlist')) > 100);
});

// --- inserts pages ----------------------------------------------------------

test('real inserts pages: set links are found for badge injection', () => {
  // A configured setListEnhancer route that had no coverage at all.
  ['inserts', 'inserts-basketball'].forEach((name) => {
    const links = findSetLinks(doc(name));
    assert.ok(links.length > 10, `${name} yielded ${links.length} set links`);
    links.forEach((l) => assert.ok(extractSid(l.getAttribute('href')), `no sid on ${l.getAttribute('href')}`));
  });
});

test('real inserts pages: the parser finds no card rows there', () => {
  // An inserts index lists sets, not cards. It must not produce an export.
  ['inserts', 'inserts-basketball'].forEach((name) => {
    assert.equal(parseChecklistDocument(doc(name)).rows.length, 0, name);
  });
});

// --- single card ------------------------------------------------------------

test('real card page: no card rows, and a sid is available for the toolbar', () => {
  const d = doc('view-card');
  assert.equal(parseChecklistDocument(d).rows.length, 0);

  const sid = extractSid('https://www.tcdb.com/ViewCard.cfm/sid/410117/cid/23854627/x');
  assert.equal(sid, '410117');
});

// --- player collection routes ----------------------------------------------

test('real player collection views expose a filterable table', () => {
  ['player-collection', 'player-wantlist'].forEach((name) => {
    const scope = findFilterScope(doc(name));
    assert.ok(scope, `no filter container on ${name}`);
    assert.ok(buildRowIndex(scope).length > 5, `too few rows indexed on ${name}`);
  });
});

// --- VAR / ERR / UER / COR, and the collapsed variation panels --------------

test('real set: every caption keyword reaches the export', () => {
  // Before the variation panels were read, this set exported none of this:
  // the keywords live in collapsed panels attached to each row, and the row
  // parser skips those because they carry no card number.
  const parsed = parseChecklistDocument(doc('checklist-var-err-uer-cor'));
  const tagged = (keyword) => parsed.rows.filter((r) =>
    r.tags.split(/,\s*/).some((t) => t.split(' ')[0] === keyword));

  CAPTION_TAGS.forEach((keyword) => {
    assert.ok(tagged(keyword).length > 0, `no row carries ${keyword}`);
  });
});

test('real set: a card with an error and a correction reports both', () => {
  const parsed = parseChecklistDocument(doc('checklist-var-err-uer-cor'));
  const card = parsed.rows.find((r) => r.cardNo === '10');

  assert.equal(card.subject, 'Brian Downing');
  assert.equal(card.team, 'California Angels');
  // DK from the subject cell; ERR/VAR/COR from the variation panel.
  ['DK', 'ERR', 'VAR', 'COR'].forEach((t) => {
    assert.ok(card.tags.split(/,\s*/).includes(t), `missing ${t} in "${card.tags}"`);
  });
});

test('real set: variation descriptions are carried in their own column', () => {
  const parsed = parseChecklistDocument(doc('checklist-var-err-uer-cor'));
  const card = parsed.rows.find((r) => r.cardNo === '10');

  assert.match(card.variations, /Pack border/);
  assert.match(card.variations, /Reverse image/);
  // One entry per variation, pipe-separated.
  assert.ok(card.variations.split(' | ').length >= 3);
});

test('real set: the variation panels do not become extra card rows', () => {
  // Each panel row has image-only card links and no card number. Counting them
  // as cards would duplicate every card in the set several times over.
  const d = doc('checklist-var-err-uer-cor');
  const parsed = parseChecklistDocument(d);

  assert.ok(d.querySelectorAll('div.collapse[id^=collapseArea]').length > 0,
    'fixture should contain variation panels');

  // The rows that legitimately count are those outside a collapse panel with a
  // card link carrying text. Panel rows have image-only links and no number.
  const mainRows = Array.from(d.querySelectorAll('#main-content-area table tr')).filter((tr) =>
    !tr.closest('div.collapse')
    && Array.from(tr.querySelectorAll('a[href*="ViewCard.cfm"]')).some((a) => a.textContent.trim())
  );

  assert.equal(parsed.rows.length, mainRows.length, 'row count must match the main rows exactly');
  assert.ok(parsed.rows.every((r) => /\d/.test(r.cardNo)), 'a row has no card number');
});

test('real set: multiple plain tags on one card survive intact', () => {
  const parsed = parseChecklistDocument(doc('checklist-var-err-uer-cor'));
  const multi = parsed.rows.filter((r) => r.tags.split(/,\s*/).length >= 3);

  assert.ok(multi.length > 5, `only ${multi.length} rows had three or more tags`);
});

test('real set: a keyworded caption keeps its own keyword', () => {
  // An ERR is an error, not a variation. The parser used to flatten every
  // caption to VAR, which discarded a distinction the page makes explicitly.
  const parsed = parseChecklistDocument(doc('checklist-var-err-uer-cor'));
  const errRows = parsed.rows.filter((r) => /\bERR\b/.test(r.tags));

  assert.ok(errRows.length > 0);
  errRows.forEach((r) => {
    assert.equal(/VAR \(ERR:/.test(r.tags), false, `ERR mislabelled as VAR on ${r.cardNo}`);
  });
});

test('real set: the CSV keeps a stable column count with variation text', () => {
  const parsed = parseChecklistDocument(doc('checklist-var-err-uer-cor'));
  const table = toChecklistTable(parsed, parsed.rows);

  assert.deepEqual(table[0], CHECKLIST_HEADER);
  table.forEach((row) => assert.equal(row.length, CHECKLIST_HEADER.length));

  // Descriptions contain commas and quotes; the CSV must quote them.
  const csv = toCSV(table);
  assert.equal(csv.split('\n').length, parsed.rows.length + 1);
});
