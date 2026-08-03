import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveTimezone,
  getZonedDateParts,
  formatLogTimestamp,
  formatCentralTimestamp,
  RuntimeSettings,
  Log
} from '../src/core/log.js';

test('resolveTimezone: auto detects or falls back to America/Chicago', () => {
  const autoZone = resolveTimezone('auto');
  assert.ok(typeof autoZone === 'string' && autoZone.length > 0);

  const explicitZone = resolveTimezone('America/New_York');
  assert.equal(explicitZone, 'America/New_York');

  const invalidZone = resolveTimezone('Invalid/Timezone_Name_123');
  assert.ok(typeof invalidZone === 'string' && invalidZone.length > 0);
});

test('getZonedDateParts: returns structured date tokens for target timezone', () => {
  const testDate = new Date('2026-08-03T15:30:45.123Z');
  const parts = getZonedDateParts(testDate, 'UTC');

  assert.equal(parts.YYYY, '2026');
  assert.equal(parts.YY, '26');
  assert.equal(parts.MM, '08');
  assert.equal(parts.DD, '03');
  assert.equal(parts.HH, '15');
  assert.equal(parts.hh, '03');
  assert.equal(parts.mm, '30');
  assert.equal(parts.ss, '45');
  assert.equal(parts.SSS, '123');
  assert.equal(parts.A, 'PM');
  assert.equal(parts.TZ, 'UTC');
});

test('formatLogTimestamp: formats standard HH:mm:ss.SSS TZ pattern', () => {
  const testDate = new Date('2026-08-03T15:30:45.123Z');
  const result = formatLogTimestamp(testDate, 'HH:mm:ss.SSS TZ', 'UTC');
  assert.equal(result, '15:30:45.123 UTC');
});

test('formatLogTimestamp: formats standard YYYYmmDDHHMMSS pattern', () => {
  const testDate = new Date('2026-08-03T15:30:45.123Z');
  const result = formatLogTimestamp(testDate, 'YYYYmmDDHHMMSS', 'UTC');
  assert.equal(result, '20260803153045');
});

test('formatLogTimestamp: formats standard YYYY-MM-DD HH:mm:ss pattern', () => {
  const testDate = new Date('2026-08-03T15:30:45.123Z');
  const result = formatLogTimestamp(testDate, 'YYYY-MM-DD HH:mm:ss', 'UTC');
  assert.equal(result, '2026-08-03 15:30:45');
});

test('formatCentralTimestamp: backward compatible wrapper returns valid timestamp string', () => {
  const result = formatCentralTimestamp();
  assert.ok(typeof result === 'string' && result.length > 0);
});

test('RuntimeSettings: timezone and timestampFormat knobs sync dynamically', () => {
  RuntimeSettings.timezone = 'UTC';
  RuntimeSettings.timestampFormat = 'YYYYmmDDHHMMSS';

  const testDate = new Date('2026-08-03T15:30:45.123Z');
  const result = formatLogTimestamp(testDate);
  assert.equal(result, '20260803153045');

  // Reset to default
  RuntimeSettings.timezone = 'auto';
  RuntimeSettings.timestampFormat = 'HH:mm:ss.SSS TZ';
});

test('Log: colors server actions in blue starting with [SERVER] and no timestamp', () => {
  const calls = [];
  const origInfo = console.info;
  console.info = (fmt, style) => calls.push({ fmt, style });

  try {
    Log('Fetching page 1', 'info', 'server');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].fmt, '%c[SERVER] Fetching page 1');
    assert.equal(calls[0].style, 'color:#0d6efd; font-weight:bold');
  } finally {
    console.info = origInfo;
  }
});

test('Log: colors errors in red starting with [CLIENT/SERVER] note and no timestamp', () => {
  const calls = [];
  const origError = console.error;
  console.error = (fmt, style) => calls.push({ fmt, style });

  try {
    Log('Network failure', 'error', 'server');
    Log('Parsing failed', 'error', 'client');
    assert.equal(calls.length, 2);
    assert.equal(calls[0].fmt, '%c[SERVER] Network failure');
    assert.equal(calls[0].style, 'color:#dc3545; font-weight:bold');
    assert.equal(calls[1].fmt, '%c[CLIENT] Parsing failed');
    assert.equal(calls[1].style, 'color:#dc3545; font-weight:bold');
  } finally {
    console.error = origError;
  }
});
