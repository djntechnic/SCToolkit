import test from 'node:test';
import assert from 'node:assert/strict';

import { Utils } from '../src/core/utils.js';

// --- Utils.extractYear ------------------------------------------------------

test('Utils.extractYear: extracts year from href when present', () => {
  assert.equal(Utils.extractYear('Some Set', '/Checklist.cfm/sid/123/2024'), '2024');
  assert.equal(Utils.extractYear('Some Set', '/Checklist.cfm/sid/12/1987-topps'), '1987');
  assert.equal(Utils.extractYear('Some Set', 'https://www.tcdb.com/ViewSet.cfm/sid/999?year=2023'), '2023');
});

test('Utils.extractYear: falls back to leading 4 digits in text when href lacks year', () => {
  assert.equal(Utils.extractYear('2019 Example Chrome', '/Checklist.cfm/sid/12/'), '2019');
  assert.equal(Utils.extractYear('2022 Topps Chrome', ''), '2022');
});

test('Utils.extractYear: non-leading year in text is rejected when href lacks year', () => {
  assert.equal(Utils.extractYear('Example Chrome 2019', ''), null);
});

test('Utils.extractYear: returns null when no year in text or href', () => {
  assert.equal(Utils.extractYear('Example Promos', ''), null);
  assert.equal(Utils.extractYear('', ''), null);
});

// --- Utils.toFullUrl --------------------------------------------------------

test('Utils.toFullUrl: resolves relative paths to absolute URLs', () => {
  assert.equal(Utils.toFullUrl('/Checklist.cfm/sid/123/'), 'https://www.tcdb.com/Checklist.cfm/sid/123/');
  assert.equal(Utils.toFullUrl('Checklist.cfm/sid/123/'), 'https://www.tcdb.com/Checklist.cfm/sid/123/');
  assert.equal(Utils.toFullUrl('https://example.test/foo'), 'https://example.test/foo');
  assert.equal(Utils.toFullUrl(''), '');
});

// --- Utils.escape.html ------------------------------------------------------

test('Utils.escape.html: escapes HTML entities', () => {
  assert.equal(Utils.escape.html('<script>alert("xss & \'fun\'")</script>'), '&lt;script&gt;alert(&quot;xss &amp; &#39;fun&#39;&quot;)&lt;/script&gt;');
  assert.equal(Utils.escape.html(null), '');
  assert.equal(Utils.escape.html(undefined), '');
  assert.equal(Utils.escape.html(123), '123');
});

// --- Utils.escape.xml -------------------------------------------------------

test('Utils.escape.xml: escapes XML entities using &apos;', () => {
  assert.equal(Utils.escape.xml('<foo attr="val\'s & more">'), '&lt;foo attr=&quot;val&apos;s &amp; more&quot;&gt;');
  assert.equal(Utils.escape.xml(null), '');
  assert.equal(Utils.escape.xml(undefined), '');
});

// --- Utils.escape.csv -------------------------------------------------------

test('Utils.escape.csv: plain text is emitted unquoted', () => {
  assert.equal(Utils.escape.csv('Nolan Ryan'), 'Nolan Ryan');
});

test('Utils.escape.csv: delimiters force quoting', () => {
  assert.equal(Utils.escape.csv('Ripken, Cal'), '"Ripken, Cal"');
  assert.equal(Utils.escape.csv('line 1\nline 2'), '"line 1\nline 2"');
  assert.equal(Utils.escape.csv('line 1\rline 2'), '"line 1\rline 2"');
});

test('Utils.escape.csv: embedded quotes are doubled and quoted', () => {
  assert.equal(Utils.escape.csv('Nolan "Express" Ryan'), '"Nolan ""Express"" Ryan"');
});

test('Utils.escape.csv: null and undefined become empty string', () => {
  assert.equal(Utils.escape.csv(null), '');
  assert.equal(Utils.escape.csv(undefined), '');
});

test('Utils.escape.csv: numbers and booleans survive in string form', () => {
  assert.equal(Utils.escape.csv(0), '0');
  assert.equal(Utils.escape.csv(false), 'false');
});
