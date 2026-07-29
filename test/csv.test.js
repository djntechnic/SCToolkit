import test from 'node:test';
import assert from 'node:assert/strict';

import { buildRow, escapeField, toCSV } from '../src/data/csv.js';

test('escapeField: plain text is emitted unquoted', () => {
  assert.equal(escapeField('Nolan Ryan'), 'Nolan Ryan');
});

test('escapeField: a comma forces quoting', () => {
  assert.equal(escapeField('Ripken, Cal'), '"Ripken, Cal"');
});

test('escapeField: embedded quotes are doubled and the field quoted', () => {
  assert.equal(escapeField('Nolan "Express" Ryan'), '"Nolan ""Express"" Ryan"');
});

test('escapeField: newlines force quoting', () => {
  assert.equal(escapeField('line one\nline two'), '"line one\nline two"');
  assert.equal(escapeField('line one\rline two'), '"line one\rline two"');
});

test('escapeField: null and undefined become empty, not the text "null"', () => {
  assert.equal(escapeField(null), '');
  assert.equal(escapeField(undefined), '');
});

test('escapeField: zero and false survive as their string forms', () => {
  assert.equal(escapeField(0), '0');
  assert.equal(escapeField(false), 'false');
});

test('buildRow: fields are comma-joined after escaping', () => {
  assert.equal(buildRow(['a', 'b,c', null]), 'a,"b,c",');
});

test('toCSV: rows are newline-joined with no trailing newline', () => {
  assert.equal(toCSV([['a', 'b'], ['c', 'd']]), 'a,b\nc,d');
});
