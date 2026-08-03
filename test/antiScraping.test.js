/**
 * Cover for the Phase 4 anti-scraping work: block detection, cross-tab
 * throttling, adaptive pacing, and the export cache.
 *
 * No test here makes a network request.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BLOCK_MARKERS,
  BLOCK_STATUSES,
  detectBlock,
  isBlockedStatus
} from '../src/net/blockDetect.js';
import { computeSlotWait, waitForSlot } from '../src/net/throttle.js';
import {
  PENALTY_CAP_MS,
  PENALTY_STEP_MS,
  Pacing,
  RELIEF_STEP_MS,
  SLOW_RESPONSE_MS,
  median,
  nextPenalty
} from '../src/net/pacing.js';
import { MAX_ENTRIES, prune } from '../src/net/cache.js';
import { computeBackoff, parseRetryAfter } from '../src/net/fetcher.js';
import { fixtureHtml } from './helpers.js';

// --- block detection --------------------------------------------------------

test('detectBlock: ordinary content is not a block', () => {
  assert.equal(detectBlock(fixtureHtml('checklist-single-page.html')), null);
});

test('detectBlock: an empty or missing body is not a block', () => {
  assert.equal(detectBlock(''), null);
  assert.equal(detectBlock(undefined), null);
});

test('detectBlock: a JavaScript-challenge interstitial is caught', () => {
  // The case v2.42.0 missed entirely: none of its three markers appear here,
  // so the page was parsed as an empty checklist and reported as a missing set.
  const marker = detectBlock(fixtureHtml('challenge-cloudflare.html'));
  assert.ok(marker, 'challenge interstitial must be flagged');
});

test('detectBlock: an hcaptcha gate is caught', () => {
  assert.ok(detectBlock(fixtureHtml('challenge-hcaptcha.html')));
});

test('detectBlock: a legacy recaptcha page is still caught', () => {
  assert.ok(detectBlock(fixtureHtml('challenge-page.html')));
});

test('detectBlock: a denial page is caught by its title and heading', () => {
  assert.equal(detectBlock(fixtureHtml('denial-page.html')), 'denial page heading');
});

test('detectBlock: page copy mentioning a denial is NOT a block', () => {
  // The false positive the tightened check exists to prevent. v2.42.0 searched
  // the whole body for the bare substring and would abort the export here,
  // then start a five-minute cooldown, on a perfectly good page.
  assert.equal(detectBlock(fixtureHtml('checklist-mentions-denial.html')), null);
});

test('detectBlock: each marker is individually sufficient', () => {
  BLOCK_MARKERS.forEach((marker) => {
    assert.equal(detectBlock(`<html><body>${marker}</body></html>`), marker);
  });
});

test('isBlockedStatus: refusal statuses only', () => {
  BLOCK_STATUSES.forEach((status) => assert.equal(isBlockedStatus(status), true));
  [200, 404, 429, 500, 503].forEach((status) => assert.equal(isBlockedStatus(status), false));
});

// --- cross-tab throttle -----------------------------------------------------

test('computeSlotWait: no prior request means go now', () => {
  assert.equal(computeSlotWait(0, 500, 1_000_000), 0);
});

test('computeSlotWait: waits out the remainder of the interval', () => {
  assert.equal(computeSlotWait(1_000_000, 500, 1_000_200), 300);
});

test('computeSlotWait: an elapsed interval means go now', () => {
  assert.equal(computeSlotWait(1_000_000, 500, 1_000_500), 0);
  assert.equal(computeSlotWait(1_000_000, 500, 1_009_999), 0);
});

test('computeSlotWait: a timestamp from the future yields one full interval', () => {
  // A clock change, or a timestamp written by a differently-set machine. The
  // safe reading is "wait", not "wait for nine hours" and not "go immediately".
  assert.equal(computeSlotWait(2_000_000, 500, 1_000_000), 500);
});

test('waitForSlot: claims immediately when the interval has elapsed', async () => {
  let stored = 0;
  const waited = await waitForSlot(500, {
    now: () => 1_000_000,
    sleep: async () => {},
    read: () => 0,
    write: (ts) => { stored = ts; }
  });

  assert.equal(waited, 0);
  assert.equal(stored, 1_000_000, 'the slot must be claimed by writing the timestamp');
});

test('waitForSlot: sleeps until the shared interval has passed', async () => {
  let clock = 1_000_000;
  let stored = 1_000_000;

  const waited = await waitForSlot(500, {
    now: () => clock,
    sleep: async (ms) => { clock += ms; },
    read: () => stored,
    write: (ts) => { stored = ts; }
  });

  assert.equal(waited, 500);
  assert.equal(stored, 1_000_500);
});

test('waitForSlot: another tab claiming mid-wait pushes this one back', async () => {
  // The whole point of re-reading after each sleep slice. A single sleep of the
  // computed duration would let both tabs fire together.
  let clock = 1_000_000;
  let stored = 1_000_000;
  let interfered = false;

  const waited = await waitForSlot(500, {
    now: () => clock,
    sleep: async (ms) => {
      clock += ms;
      if (!interfered && clock >= 1_000_400) {
        interfered = true;
        stored = clock; // a second tab claims the slot
      }
    },
    read: () => stored,
    write: (ts) => { stored = ts; }
  });

  assert.ok(waited > 500, `expected to wait past the first interval, waited ${waited}`);
});

// --- adaptive pacing --------------------------------------------------------

test('median: odd, even, and empty', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
  assert.equal(median([]), 0);
  assert.equal(median([7]), 7);
});

test('nextPenalty: strain increases, success relieves', () => {
  assert.equal(nextPenalty(0, 'throttled'), PENALTY_STEP_MS);
  assert.equal(nextPenalty(0, 'slow'), PENALTY_STEP_MS);
  assert.equal(nextPenalty(PENALTY_STEP_MS, 'ok'), PENALTY_STEP_MS - RELIEF_STEP_MS);
});

test('nextPenalty: rises faster than it falls', () => {
  // AIMD in the direction that matters: a struggling server gets relief at
  // once and has to actually recover before pressure returns.
  assert.ok(PENALTY_STEP_MS > RELIEF_STEP_MS);
});

test('nextPenalty: clamped at both ends', () => {
  assert.equal(nextPenalty(PENALTY_CAP_MS, 'throttled'), PENALTY_CAP_MS);
  assert.equal(nextPenalty(0, 'ok'), 0);
});

test('Pacing: a throttle response raises the penalty', () => {
  Pacing.reset();
  assert.equal(Pacing.record(100, true), 'throttled');
  assert.equal(Pacing.penaltyMs, PENALTY_STEP_MS);
});

test('Pacing: sustained slow responses raise the penalty', () => {
  Pacing.reset();
  for (let i = 0; i < 5; i++) Pacing.record(SLOW_RESPONSE_MS + 1000);
  assert.ok(Pacing.penaltyMs > 0);
});

test('Pacing: normal latency leaves pacing nominal', () => {
  Pacing.reset();
  for (let i = 0; i < 5; i++) assert.equal(Pacing.record(200), 'ok');
  assert.equal(Pacing.penaltyMs, 0);
  assert.equal(Pacing.describe(), '');
});

test('Pacing: recovery decays the penalty back to zero', () => {
  Pacing.reset();
  Pacing.record(100, true);
  const peak = Pacing.penaltyMs;
  assert.ok(peak > 0);

  for (let i = 0; i < peak / RELIEF_STEP_MS; i++) Pacing.record(150);
  assert.equal(Pacing.penaltyMs, 0);
});

test('Pacing: lastLatencyMs is initialized to 0, updated on record, and cleared on reset', () => {
  Pacing.reset();
  assert.equal(Pacing.lastLatencyMs, 0);

  Pacing.record(350);
  assert.equal(Pacing.lastLatencyMs, 350);

  Pacing.record(800, true);
  assert.equal(Pacing.lastLatencyMs, 800);

  Pacing.reset();
  assert.equal(Pacing.lastLatencyMs, 0);
});

test('Pacing: the sample window is bounded', () => {
  Pacing.reset();
  for (let i = 0; i < 50; i++) Pacing.record(100);
  assert.ok(Pacing.samples.length <= 10);
});

test('Pacing: a penalty is surfaced for the status readout', () => {
  Pacing.reset();
  Pacing.penalize();
  assert.match(Pacing.describe(), /pacing \+\d+ms/);
  Pacing.reset();
});

// --- cache ------------------------------------------------------------------

const entry = (ts, rows = 1) => ({ ts, payload: { rows: new Array(rows).fill({}) } });

test('prune: expired entries are dropped', () => {
  const now = 1_000_000;
  const result = prune({ a: entry(now - 100), b: entry(now - 999_999) }, 1000, now);

  assert.deepEqual(Object.keys(result), ['a']);
});

test('prune: the cache is capped, newest kept', () => {
  const now = 1_000_000;
  const entries = {};
  for (let i = 0; i < MAX_ENTRIES + 5; i++) entries[`s${i}`] = entry(now - i);

  const result = prune(entries, 999_999, now);

  assert.equal(Object.keys(result).length, MAX_ENTRIES);
  assert.ok('s0' in result, 'newest must survive');
  assert.equal(`s${MAX_ENTRIES + 4}` in result, false, 'oldest must be evicted');
});

test('prune: malformed entries are discarded rather than trusted', () => {
  const now = 1_000_000;
  const result = prune({ a: null, b: { ts: 'soon' }, c: entry(now) }, 1000, now);

  assert.deepEqual(Object.keys(result), ['c']);
});

test('prune: does not mutate its input', () => {
  const now = 1_000_000;
  const input = { a: entry(now - 999_999) };
  prune(input, 1000, now);
  assert.deepEqual(Object.keys(input), ['a']);
});

// --- backoff (unchanged behaviour, re-pinned after the fetcher rewrite) ------

test('computeBackoff: doubles per attempt and respects the cap', () => {
  assert.equal(computeBackoff(1, 1000, 15000), 1000);
  assert.equal(computeBackoff(3, 1000, 15000), 4000);
  assert.equal(computeBackoff(10, 1000, 15000), 15000);
});

test('parseRetryAfter: both header forms, and neither', () => {
  const now = Date.parse('2026-01-01T00:00:00Z');
  assert.equal(parseRetryAfter('120'), 120000);
  assert.equal(parseRetryAfter('Thu, 01 Jan 2026 00:00:30 GMT', now), 30000);
  assert.equal(parseRetryAfter('soon-ish'), 0);
  assert.equal(parseRetryAfter(null), 0);
});

// --- cache round-trip through stubbed userscript storage --------------------

/** Point `storage.js`'s `GM_*` lookups at an in-memory map. */
function stubStorage() {
  const map = new Map();
  globalThis.GM_getValue = (key, fallback) => (map.has(key) ? map.get(key) : fallback);
  globalThis.GM_setValue = (key, value) => map.set(key, value);
  return map;
}

test('cache: a written export reads back and reports in stats', async () => {
  stubStorage();
  const cache = await import('../src/net/cache.js');
  const payload = { identity: { year: '2023' }, rows: [{ cardNo: '1' }, { cardNo: '2' }], totalPages: 1 };

  assert.equal(cache.write('4001', payload, 24, 1_000_000), true);
  assert.deepEqual(cache.read('4001', 24, 1_000_000), payload);
  assert.deepEqual(cache.stats(24, 1_000_000), { sets: 1, rows: 2 });

  cache.clear();
  assert.equal(cache.read('4001', 24, 1_000_000), null);
});

test('cache: a TTL of zero disables reads and writes entirely', async () => {
  stubStorage();
  const cache = await import('../src/net/cache.js');
  const payload = { identity: {}, rows: [{}], totalPages: 1 };

  assert.equal(cache.write('4001', payload, 0), false);
  assert.equal(cache.read('4001', 0), null);
});

test('cache: an entry past its TTL is not served', async () => {
  stubStorage();
  const cache = await import('../src/net/cache.js');
  cache.write('4001', { identity: {}, rows: [{}], totalPages: 1 }, 24, 1_000_000);

  const oneDayLater = 1_000_000 + 24 * 3600000;
  assert.equal(cache.read('4001', 24, oneDayLater), null);
  assert.ok(cache.read('4001', 24, oneDayLater - 1));
});

test('cache: an oversized result is not stored', async () => {
  stubStorage();
  const cache = await import('../src/net/cache.js');
  const huge = { identity: {}, rows: new Array(cache.MAX_ROWS + 1).fill({}), totalPages: 1 };

  assert.equal(cache.write('4001', huge, 24), false);
  assert.equal(cache.read('4001', 24), null);
});

test('cache: corrupt stored data degrades to a miss, not a crash', async () => {
  const map = stubStorage();
  const cache = await import('../src/net/cache.js');
  map.set('tk_export_cache_v1', 'not an object');

  assert.equal(cache.read('4001', 24), null);
  assert.deepEqual(cache.stats(24), { sets: 0, rows: 0 });
});

test('waitForSlot: jitter offset serializes simultaneous requests from multiple tabs', async () => {
  let clock = 1_000_000;
  let stored = 0;
  const writtenTimestamps = [];

  const createTabDeps = (tabJitterMs) => ({
    now: () => clock,
    sleep: async (ms) => { clock += ms; },
    read: () => stored,
    write: (ts) => {
      writtenTimestamps.push(ts);
      stored = ts;
    },
    jitter: () => tabJitterMs
  });

  // Tab 1 with 20ms jitter, Tab 2 with 50ms jitter, Tab 3 with 80ms jitter
  await Promise.all([
    waitForSlot(500, createTabDeps(20)),
    waitForSlot(500, createTabDeps(50)),
    waitForSlot(500, createTabDeps(80))
  ]);

  assert.equal(writtenTimestamps.length, 3);
  for (let i = 1; i < writtenTimestamps.length; i++) {
    assert.ok(
      writtenTimestamps[i] >= writtenTimestamps[i - 1] + 500,
      `Expected slot timestamps to be serialized by interval, got ${writtenTimestamps[i]} vs ${writtenTimestamps[i - 1]}`
    );
  }
});
