/**
 * Diagnostic self-tests module for runtime integrity checks.
 */

import { testUrlMatch } from './config.js';
import { Pacing } from '../net/pacing.js';
import { Utils } from './utils.js';
import { getAppVersion } from './version.js';
import { formatLogTimestamp } from './log.js';

export const DiagnosticTests = {
  /**
   * Run lightweight self-tests on key runtime systems.
   *
   * @returns {Array<{ name: string, pass: boolean, detail: string }>}
   */
  run: () => {
    const results = [];

    // 1. CSV Escaping
    try {
      const quoted = Utils.escape.csv('hello, world');
      const plain = Utils.escape.csv('plain');
      const pass = quoted === '"hello, world"' && plain === 'plain';
      results.push({
        name: 'CSV Field Escaping',
        pass,
        detail: pass ? 'RFC 4180 escaping operational' : `Unexpected result: ${quoted}`
      });
    } catch (err) {
      results.push({ name: 'CSV Field Escaping', pass: false, detail: err.message });
    }

    // 2. Year Extraction (Utils)
    try {
      const yearFromUrl = Utils.extractYear('', '/Checklist.cfm/sid/123/2024');
      const yearFromText = Utils.extractYear('2024 Topps Chrome', '');
      const pass = yearFromUrl === '2024' && yearFromText === '2024';
      results.push({
        name: 'Year Extraction (Utils)',
        pass,
        detail: pass ? 'Year parsing operational' : `Unexpected results: url=${yearFromUrl}, text=${yearFromText}`
      });
    } catch (err) {
      results.push({ name: 'Year Extraction (Utils)', pass: false, detail: err.message });
    }

    // 3. Pacing State Initialization
    try {
      const pass =
        typeof Pacing.penaltyMs === 'number' &&
        typeof Pacing.lastLatencyMs === 'number' &&
        Array.isArray(Pacing.samples);
      results.push({
        name: 'Pacing State Initialization',
        pass,
        detail: pass
          ? `Penalty ${Pacing.penaltyMs}ms, Latency ${Pacing.lastLatencyMs}ms`
          : 'Pacing state structure invalid'
      });
    } catch (err) {
      results.push({ name: 'Pacing State Initialization', pass: false, detail: err.message });
    }

    // 4. Route Matching
    try {
      const pass = testUrlMatch(
        [{ pattern: '/checklist\\.cfm', exclude: false }],
        'https://www.tcdb.com/Checklist.cfm/sid/1/'
      );
      results.push({
        name: 'Route Pattern Matching',
        pass,
        detail: pass ? 'Pattern resolution operational' : 'URL pattern matching failed'
      });
    } catch (err) {
      results.push({ name: 'Route Pattern Matching', pass: false, detail: err.message });
    }

    // 5. Version Reporting
    try {
      const ver = getAppVersion();
      const pass = Boolean(ver && ver !== 'unknown');
      results.push({
        name: 'Version Reporting',
        pass,
        detail: pass ? `SCToolkit v${ver}` : 'Version string invalid'
      });
    } catch (err) {
      results.push({ name: 'Version Reporting', pass: false, detail: err.message });
    }

    // 6. Timezone & Timestamp Formatting
    try {
      const ts = formatLogTimestamp(new Date(), 'YYYYmmDDHHMMSS', 'auto');
      const pass = Boolean(ts && /^\d{14}$/.test(ts));
      results.push({
        name: 'Log Timestamp Formatting',
        pass,
        detail: pass ? `Operational (${ts})` : `Unexpected timestamp output: ${ts}`
      });
    } catch (err) {
      results.push({ name: 'Log Timestamp Formatting', pass: false, detail: err.message });
    }

    return results;
  }
};
