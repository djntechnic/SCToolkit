import test from 'node:test';
import assert from 'node:assert/strict';

import { deriveSetYear } from '../src/core/storage.js';
import { extractSid } from '../src/core/sid.js';

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
