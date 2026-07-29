import test from 'node:test';
import assert from 'node:assert/strict';

import { BLOCK_MARKERS, detectBlock } from '../src/net/blockDetect.js';
import { computeBackoff, parseRetryAfter } from '../src/net/fetcher.js';
import { fixtureHtml } from './helpers.js';

test('detectBlock: ordinary content is not a block', () => {
  assert.equal(detectBlock(fixtureHtml('checklist-single-page.html')), null);
});

test('detectBlock: an empty or missing body is not a block', () => {
  assert.equal(detectBlock(''), null);
  assert.equal(detectBlock(undefined), null);
});

test('detectBlock: a challenge page is detected and the marker reported', () => {
  const marker = detectBlock(fixtureHtml('challenge-page.html'));
  assert.ok(marker, 'expected the challenge fixture to be flagged');
  assert.ok(BLOCK_MARKERS.includes(marker));
});

test('detectBlock: each marker is individually sufficient', () => {
  BLOCK_MARKERS.forEach((marker) => {
    assert.equal(detectBlock(`<html><body>${marker}</body></html>`), marker);
  });
});

test('computeBackoff: doubles per attempt', () => {
  assert.equal(computeBackoff(1, 1000, 15000), 1000);
  assert.equal(computeBackoff(2, 1000, 15000), 2000);
  assert.equal(computeBackoff(3, 1000, 15000), 4000);
});

test('computeBackoff: never exceeds the cap', () => {
  assert.equal(computeBackoff(10, 1000, 15000), 15000);
});

test('parseRetryAfter: absent header yields no wait', () => {
  assert.equal(parseRetryAfter(null), 0);
  assert.equal(parseRetryAfter(''), 0);
});

test('parseRetryAfter: delta-seconds form', () => {
  assert.equal(parseRetryAfter('120'), 120000);
});

test('parseRetryAfter: HTTP-date form', () => {
  const now = Date.parse('2026-01-01T00:00:00Z');
  assert.equal(parseRetryAfter('Thu, 01 Jan 2026 00:00:30 GMT', now), 30000);
});

test('parseRetryAfter: a date already in the past yields no wait', () => {
  const now = Date.parse('2026-01-01T00:01:00Z');
  assert.equal(parseRetryAfter('Thu, 01 Jan 2026 00:00:00 GMT', now), 0);
});

test('parseRetryAfter: an unparseable header yields no wait', () => {
  // The caller falls back to computed backoff rather than retrying instantly.
  assert.equal(parseRetryAfter('soon-ish'), 0);
});
