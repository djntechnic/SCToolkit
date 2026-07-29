import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_CONFIG, SettingsStore, testUrlMatch } from '../src/core/config.js';

const URL_CHECKLIST = 'https://example.test/Checklist.cfm/sid/1/';
const URL_ADD_MULTIPLES = 'https://example.test/CollectionAddMultiplesText.cfm/sid/1/';

test('testUrlMatch: no rules matches everything', () => {
  assert.equal(testUrlMatch([], URL_CHECKLIST), true);
  assert.equal(testUrlMatch(undefined, URL_CHECKLIST), true);
});

test('testUrlMatch: include-only requires at least one hit', () => {
  const rules = [{ pattern: '/checklist\\.cfm', exclude: false }];
  assert.equal(testUrlMatch(rules, URL_CHECKLIST), true);
  assert.equal(testUrlMatch(rules, URL_ADD_MULTIPLES), false);
});

test('testUrlMatch: exclude-only admits everything it does not match', () => {
  const rules = [{ pattern: 'addmultiples', exclude: true }];
  assert.equal(testUrlMatch(rules, URL_CHECKLIST), true);
  assert.equal(testUrlMatch(rules, URL_ADD_MULTIPLES), false);
});

test('testUrlMatch: an exclude beats an include on the same URL', () => {
  const rules = [
    { pattern: '/collection', exclude: false },
    { pattern: 'addmultiples', exclude: true }
  ];
  assert.equal(testUrlMatch(rules, URL_ADD_MULTIPLES), false);
});

test('testUrlMatch: matching is case-insensitive', () => {
  assert.equal(testUrlMatch([{ pattern: '/CHECKLIST\\.CFM' }], URL_CHECKLIST), true);
});

test('testUrlMatch: an invalid include pattern never matches', () => {
  // It must not throw, and it must not widen scope.
  assert.equal(testUrlMatch([{ pattern: '([unclosed', exclude: false }], URL_CHECKLIST), false);
});

test('testUrlMatch: an invalid exclude pattern does not exclude', () => {
  assert.equal(testUrlMatch([{ pattern: '([unclosed', exclude: true }], URL_CHECKLIST), true);
});

test('migrate: a current-version config keeps its stored values', () => {
  const stored = {
    schemaVersion: 2,
    modules: { checklistEnhancer: { enabled: false, urlMatch: [], actions: {} } },
    global: { toastDurationMs: 9000 }
  };
  const result = SettingsStore.migrate(stored);

  assert.equal(result.modules.checklistEnhancer.enabled, false);
  assert.equal(result.global.toastDurationMs, 9000);
});

test('migrate: fields absent from storage are filled from defaults', () => {
  const result = SettingsStore.migrate({ schemaVersion: 2, modules: {}, global: {} });

  assert.deepEqual(Object.keys(result.modules).sort(), Object.keys(DEFAULT_CONFIG.modules).sort());
  assert.equal(result.global.logLevel, DEFAULT_CONFIG.global.logLevel);
});

test('migrate: v1 upgrades in place rather than resetting', () => {
  const result = SettingsStore.migrate({
    schemaVersion: 1,
    modules: { setListEnhancer: { enabled: false } },
    global: { logLevel: 'debug' }
  });

  assert.equal(result.modules.setListEnhancer.enabled, false);
  assert.equal(result.global.logLevel, 'debug');
  // The v2-only actions object is present even though v1 never wrote one.
  assert.deepEqual(result.modules.checklistEnhancer.actions, DEFAULT_CONFIG.modules.checklistEnhancer.actions);
});

test('migrate: an unknown schema version resets to defaults', () => {
  const result = SettingsStore.migrate({
    schemaVersion: 99,
    modules: { checklistEnhancer: { enabled: false } },
    global: { toastDurationMs: 1 }
  });

  assert.deepEqual(result, DEFAULT_CONFIG);
});

test('migrate: config for a module this build does not know about is dropped', () => {
  const result = SettingsStore.migrate({
    schemaVersion: 2,
    modules: { someRemovedModule: { enabled: true } },
    global: {}
  });

  assert.equal(result.modules.someRemovedModule, undefined);
});

test('migrate: action toggles merge rather than replace', () => {
  const result = SettingsStore.migrate({
    schemaVersion: 2,
    modules: { checklistEnhancer: { actions: { inlineActionCells: true } } },
    global: {}
  });

  assert.equal(result.modules.checklistEnhancer.actions.inlineActionCells, true);
  // Not clobbered by the partial stored actions object.
  assert.equal(result.modules.checklistEnhancer.actions.realtimeFilter, true);
});

test('cloneDefaults: returns a deep copy, not a shared reference', () => {
  const a = SettingsStore.cloneDefaults();
  a.modules.checklistEnhancer.enabled = false;
  assert.equal(DEFAULT_CONFIG.modules.checklistEnhancer.enabled, true);
});
