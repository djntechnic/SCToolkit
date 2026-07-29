import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildExportFilename,
  compactSegment,
  sanitizeSegment,
  underscoreSegment
} from '../src/data/filename.js';

test('sanitizeSegment: runs of punctuation collapse to one underscore', () => {
  assert.equal(sanitizeSegment('Topps  Chrome - Update!'), 'Topps_Chrome_Update');
});

test('sanitizeSegment: leading and trailing underscores are trimmed', () => {
  assert.equal(sanitizeSegment('  Bowman  '), 'Bowman');
  assert.equal(sanitizeSegment('---'), '');
});

test('compactSegment: every non-alphanumeric is dropped', () => {
  assert.equal(compactSegment('Blue Refractors /150'), 'BlueRefractors150');
});

test('underscoreSegment: runs are NOT collapsed', () => {
  // Deliberately different from sanitizeSegment; this is the historical
  // behaviour of the player-collection export path.
  assert.equal(underscoreSegment('Ken Griffey Jr.'), 'Ken_Griffey_Jr_');
});

test('buildExportFilename: year, base set, sub-set, and kind suffix', () => {
  assert.equal(
    buildExportFilename({
      year: '2023',
      baseSet: 'Example Chrome',
      setName: 'Blue Refractors',
      kind: 'checklist'
    }),
    '2023_Example_Chrome_BlueRefractors_Checklist.csv'
  );
});

test('buildExportFilename: no sub-set means no sub-set segment', () => {
  assert.equal(
    buildExportFilename({ year: '1989', baseSet: 'Example Base' }),
    '1989_Example_Base_Checklist.csv'
  );
});

test('buildExportFilename: a missing year is recovered from the fallback label', () => {
  assert.equal(
    buildExportFilename({ baseSet: 'Example Base', fallbackLabel: '1991 Example Base' }),
    '1991_Example_Base_Checklist.csv'
  );
});

test('buildExportFilename: with no year anywhere the segment is omitted entirely', () => {
  // Not `_Example_Base_Checklist.csv` — a leading underscore would be a bug.
  assert.equal(
    buildExportFilename({ baseSet: 'Example Base', fallbackLabel: 'Example Base' }),
    'Example_Base_Checklist.csv'
  );
});

test('buildExportFilename: the fallback label only matches a leading year', () => {
  assert.equal(
    buildExportFilename({ baseSet: 'Promos', fallbackLabel: 'Promos 1997' }),
    'Promos_Checklist.csv'
  );
});

test('buildExportFilename: each kind gets its own suffix', () => {
  const base = { year: '2020', baseSet: 'Example' };
  assert.match(buildExportFilename({ ...base, kind: 'forSale' }), /_ForSale\.csv$/);
  assert.match(buildExportFilename({ ...base, kind: 'wantlist' }), /_Wantlist\.csv$/);
  assert.match(buildExportFilename({ ...base, kind: 'addMultiples' }), /_AddMultiples\.csv$/);
});

test('buildExportFilename: an unknown kind falls back to the checklist suffix', () => {
  assert.match(
    buildExportFilename({ year: '2020', baseSet: 'Example', kind: 'nonsense' }),
    /_Checklist\.csv$/
  );
});
