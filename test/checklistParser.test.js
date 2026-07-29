import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CHECKLIST_HEADER,
  parseCaptionSegments,
  parseChecklistDocument,
  parseSetIdentity,
  parseSubjectCell,
  parseTotalPages,
  toChecklistTable
} from '../src/data/checklistParser.js';
import { toCSV } from '../src/data/csv.js';
import { documentFrom, fixtureDocument } from './helpers.js';

test('parseSubjectCell: plain name yields no tags and no print run', () => {
  assert.deepEqual(parseSubjectCell('Nolan Ryan'), {
    subject: 'Nolan Ryan',
    tags: '',
    printRun: ''
  });
});

test('parseSubjectCell: trailing all-caps tokens become tags', () => {
  const result = parseSubjectCell('Jane Doe RC AU');
  assert.equal(result.subject, 'Jane Doe');
  assert.equal(result.tags, 'RC, AU');
});

test('parseSubjectCell: generational suffix stays with the name', () => {
  // The regression this guards: without the explicit suffix case, `Jr.` has no
  // lowercase letters and would be classified as a tag.
  const result = parseSubjectCell('Ken Griffey Jr. RC');
  assert.equal(result.subject, 'Ken Griffey Jr.');
  assert.equal(result.tags, 'RC');
});

test('parseSubjectCell: a comma before the suffix is preserved in the name', () => {
  assert.equal(parseSubjectCell('Cal Ripken, Jr.').subject, 'Cal Ripken, Jr.');
});

test('parseSubjectCell: SN token becomes the print run, not a tag', () => {
  const result = parseSubjectCell('Mike Trout AU SN250');
  assert.equal(result.subject, 'Mike Trout');
  assert.equal(result.tags, 'AU');
  assert.equal(result.printRun, '250');
});

test('parseSubjectCell: a tag after the name ends collection', () => {
  // `RC` sits left of a name token, so it is name text, not a tag.
  const result = parseSubjectCell('RC Smith Jones');
  assert.equal(result.subject, 'RC Smith Jones');
  assert.equal(result.tags, '');
});

test('parseSubjectCell: caption annotates a matching tag in place', () => {
  const result = parseSubjectCell('Chipper Jones VAR', { segments: [{ tag: null, desc: 'Batting stance' }] });
  assert.equal(result.subject, 'Chipper Jones');
  assert.equal(result.tags, 'VAR (Batting stance)');
});

test('parseSubjectCell: a caption with no evidence of a variation adds no tag', () => {
  // Real checklist cards caption themselves with the card range they cover.
  // Treating every caption as a variation fabricated tags on 20 rows of one
  // real set — see test/realPages.test.js.
  const result = parseSubjectCell('Derek Jeter', { segments: [{ tag: null, desc: 'Sunglasses on cap' }] });
  assert.equal(result.subject, 'Derek Jeter');
  assert.equal(result.tags, '');
});

test('parseSubjectCell: a keyworded caption synthesises its own tag', () => {
  const result = parseSubjectCell('Derek Jeter', {
    segments: [{ tag: 'VAR', desc: 'Sunglasses on cap' }]
  });
  assert.equal(result.tags, 'VAR (Sunglasses on cap)');
});

test('parseSubjectCell: the caption keyword is preserved, not flattened to VAR', () => {
  // An ERR caption is an error, not a variation. Reporting it as VAR loses the
  // distinction the page went to the trouble of making.
  assert.equal(
    parseSubjectCell('Some Player', { segments: [{ tag: 'ERR', desc: 'Reversed image' }] }).tags,
    'ERR (Reversed image)'
  );
  assert.equal(
    parseSubjectCell('Some Player', { segments: [{ tag: 'COR', desc: 'Batting right-handed' }] }).tags,
    'COR (Batting right-handed)'
  );
  assert.equal(
    parseSubjectCell('Some Player', { segments: [{ tag: 'UER', desc: 'Born in MI, not NJ' }] }).tags,
    'UER (Born in MI, not NJ)'
  );
});

test('parseSubjectCell: a suffixed card number is evidence of a variation', () => {
  // `50b` is a variant of `50` by the site's own numbering convention.
  const result = parseSubjectCell('Derek Jeter', {
    segments: [{ tag: null, desc: 'Sunglasses on cap' }],
    variantCardNo: true
  });
  assert.equal(result.tags, 'VAR (Sunglasses on cap)');
});

test('parseSubjectCell: an existing variation tag absorbs the caption', () => {
  const result = parseSubjectCell('Derek Jeter VAR', {
    segments: [{ tag: null, desc: 'Sunglasses on cap' }]
  });
  assert.equal(result.tags, 'VAR (Sunglasses on cap)');
});

test('parseSubjectCell: a keyworded caption attaches to a bare tag of that kind', () => {
  const result = parseSubjectCell('Some Player ERR', {
    segments: [{ tag: 'ERR', desc: 'Reversed image' }]
  });
  assert.equal(result.tags, 'ERR (Reversed image)');
});

test('parseSubjectCell: variation-panel tags are merged into the tag list', () => {
  const result = parseSubjectCell('Brian Downing DK', { extraTags: ['ERR', 'VAR', 'COR'] });
  assert.equal(result.tags, 'DK, ERR, VAR, COR');
});

test('parseCaptionSegments: splits a multi-keyword caption', () => {
  // Real captions carry two semantics at once.
  assert.deepEqual(
    parseCaptionSegments('VAR: Pack border; "(c) 1989" on back; ERR: Reverse image'),
    [
      { tag: 'VAR', desc: 'Pack border; "(c) 1989" on back' },
      { tag: 'ERR', desc: 'Reverse image' }
    ]
  );
});

test('parseCaptionSegments: an unkeyworded caption is one null-tagged segment', () => {
  assert.deepEqual(parseCaptionSegments('Checklist: 211-245'),
    [{ tag: null, desc: 'Checklist: 211-245' }]);
});

test('parseCaptionSegments: empty input yields nothing', () => {
  assert.deepEqual(parseCaptionSegments(''), []);
  assert.deepEqual(parseCaptionSegments(undefined), []);
});

test('parseSetIdentity: splits a leading year off the h1 and reads the h3', () => {
  const doc = fixtureDocument('checklist-single-page.html');
  assert.deepEqual(parseSetIdentity(doc), {
    year: '2023',
    baseSet: 'Example Chrome',
    setName: 'Refractors'
  });
});

test('parseSetIdentity: an h1 with no leading year yields an empty year', () => {
  const doc = documentFrom('<div id="setname-content"><h1>Example Promos - Cards</h1></div>');
  assert.deepEqual(parseSetIdentity(doc), {
    year: '',
    baseSet: 'Example Promos',
    setName: ''
  });
});

test('parseSetIdentity: a page with no header block yields empty fields', () => {
  assert.deepEqual(parseSetIdentity(documentFrom('<div id="main-content-area"></div>')), {
    year: '',
    baseSet: '',
    setName: ''
  });
});

test('parseTotalPages: no pagination means one page', () => {
  assert.equal(parseTotalPages(fixtureDocument('checklist-single-page.html')), 1);
});

test('parseTotalPages: takes the highest PageIndex offered', () => {
  assert.equal(parseTotalPages(fixtureDocument('checklist-multi-page.html')), 4);
});

test('parseChecklistDocument: parses every card row and skips the rest', () => {
  const { rows, totalPages, year, baseSet, setName } =
    parseChecklistDocument(fixtureDocument('checklist-single-page.html'));

  assert.equal(totalPages, 1);
  assert.equal(year, '2023');
  assert.equal(baseSet, 'Example Chrome');
  assert.equal(setName, 'Refractors');

  // Header row and the totals footer are both rejected.
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], {
    cardNo: '1',
    subject: 'Ken Griffey Jr.',
    tags: 'RC',
    printRun: '',
    team: 'Seattle Mariners',
    variations: ''
  });
  assert.equal(rows[1].printRun, '250');
  assert.equal(rows[2].subject, 'Cal Ripken, Jr.');
});

test('parseChecklistDocument: figcaptions are removed from the subject', () => {
  const { rows } = parseChecklistDocument(fixtureDocument('checklist-figcaption.html'));

  assert.equal(rows.length, 2);
  assert.equal(rows[0].subject, 'Chipper Jones');
  assert.equal(rows[0].tags, 'VAR (Batting stance)');
  assert.equal(rows[1].subject, 'Derek Jeter');
  assert.equal(rows[1].tags, 'VAR (Sunglasses on cap)');
});

test('parseChecklistDocument: rows without a person link fall back to the next cell', () => {
  const { rows } = parseChecklistDocument(fixtureDocument('checklist-no-person-link.html'));

  // The third row's only card link has no text, so it is not a card row.
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    cardNo: '100',
    subject: 'Chicago Cubs Team Checklist',
    tags: 'CL',
    printRun: '',
    team: 'Chicago Cubs',
    variations: ''
  });
  // Empty cells are skipped while walking right from the card number.
  assert.equal(rows[1].subject, 'League Leaders');
  assert.equal(rows[1].tags, 'LL');
});

test('parseChecklistDocument: a page with no content area yields no rows', () => {
  assert.deepEqual(parseChecklistDocument(documentFrom('<p>nothing here</p>')).rows, []);
});

test('golden file: the single-page fixture produces exact CSV bytes', () => {
  const parsed = parseChecklistDocument(fixtureDocument('checklist-single-page.html'));
  const csv = toCSV(toChecklistTable(parsed, parsed.rows));

  assert.equal(csv, [
    'Year,Base Set,Set Name,Card No,Subject,Tags,Print Run,Team,Variations',
    '2023,Example Chrome,Refractors,1,Ken Griffey Jr.,RC,,Seattle Mariners,',
    '2023,Example Chrome,Refractors,2,Mike Trout,AU,250,Los Angeles Angels,',
    '2023,Example Chrome,Refractors,3a,"Cal Ripken, Jr.",,,Baltimore Orioles,'
  ].join('\n'));
});

test('toChecklistTable: header row is first and column count is stable', () => {
  const parsed = parseChecklistDocument(fixtureDocument('checklist-multi-page.html'));
  const table = toChecklistTable(parsed, parsed.rows);

  assert.deepEqual(table[0], CHECKLIST_HEADER);
  table.forEach((row) => assert.equal(row.length, CHECKLIST_HEADER.length));
});
