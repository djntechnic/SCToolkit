/**
 * Diagnostic self-tests module for runtime integrity checks.
 */

import { testUrlMatch } from './config.js';
import { escapeField } from '../data/csv.js';
import { Pacing } from '../net/pacing.js';

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
      const quoted = escapeField('hello, world');
      const plain = escapeField('plain');
      const pass = quoted === '"hello, world"' && plain === 'plain';
      results.push({
        name: 'CSV Field Escaping',
        pass,
        detail: pass ? 'RFC 4180 escaping operational' : `Unexpected result: ${quoted}`
      });
    } catch (err) {
      results.push({ name: 'CSV Field Escaping', pass: false, detail: err.message });
    }

    // 2. Pacing State Initialization
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

    // 3. Route Matching
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

    return results;
  }
};
