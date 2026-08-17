import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { DEFAULT_CONFIG, SettingsStore, testUrlMatch, configToXml, xmlToConfig } from '../src/core/config.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

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
    schemaVersion: DEFAULT_CONFIG.schemaVersion,
    modules: { checklistEnhancer: { enabled: false, urlMatch: [], actions: {} } },
    global: { toastDurationMs: 9000 }
  };
  const result = SettingsStore.migrate(stored);

  assert.equal(result.modules.checklistEnhancer.enabled, false);
  assert.equal(result.global.toastDurationMs, 9000);
});

test('migrate: obsolete global settings present in stored config are pruned', () => {
  const stored = {
    schemaVersion: DEFAULT_CONFIG.schemaVersion,
    modules: {},
    global: {
      toastDurationMs: 8000,
      obsoleteGlobalSetting: 'should_be_pruned',
      anotherDeadKey: 123
    }
  };
  const result = SettingsStore.migrate(stored);

  assert.equal(result.global.toastDurationMs, 8000);
  assert.equal('obsoleteGlobalSetting' in result.global, false);
  assert.equal('anotherDeadKey' in result.global, false);
});

test('migrate: fields absent from storage are filled from defaults', () => {
  const result = SettingsStore.migrate({
    schemaVersion: DEFAULT_CONFIG.schemaVersion, modules: {}, global: {}
  });

  assert.deepEqual(Object.keys(result.modules).sort(), Object.keys(DEFAULT_CONFIG.modules).sort());
  assert.equal(result.global.logLevel, DEFAULT_CONFIG.global.logLevel);
});

test('migrate: any older version upgrades in place rather than resetting', () => {
  // This is the property that matters across a version bump: users keep their
  // settings. A hardcoded "v1 -> v2 only" branch would silently reset everyone
  // the next time the schema moved.
  for (let version = 1; version < DEFAULT_CONFIG.schemaVersion; version++) {
    const result = SettingsStore.migrate({
      schemaVersion: version,
      modules: { setListEnhancer: { enabled: false } },
      global: { logLevel: 'debug' }
    });

    assert.equal(result.modules.setListEnhancer.enabled, false, `v${version} kept module choice`);
    assert.equal(result.global.logLevel, 'debug', `v${version} kept global choice`);
    assert.equal(result.schemaVersion, DEFAULT_CONFIG.schemaVersion);
    // Keys the old version never wrote arrive at their defaults.
    assert.deepEqual(
      result.modules.checklistEnhancer.actions,
      DEFAULT_CONFIG.modules.checklistEnhancer.actions
    );
  }
});

test('migrate: a version newer than this build resets to defaults', () => {
  const result = SettingsStore.migrate({
    schemaVersion: DEFAULT_CONFIG.schemaVersion + 1,
    modules: { checklistEnhancer: { enabled: false } },
    global: { toastDurationMs: 1 }
  });

  assert.deepEqual(result, DEFAULT_CONFIG);
});

test('migrate: a missing or nonsense version resets to defaults', () => {
  assert.deepEqual(SettingsStore.migrate({ modules: {}, global: {} }), DEFAULT_CONFIG);
  assert.deepEqual(SettingsStore.migrate({ schemaVersion: 0 }), DEFAULT_CONFIG);
  assert.deepEqual(SettingsStore.migrate({ schemaVersion: 'two' }), DEFAULT_CONFIG);
  assert.deepEqual(SettingsStore.migrate({ schemaVersion: 2.5 }), DEFAULT_CONFIG);
});

test('migrate: config for a module this build does not know about is dropped', () => {
  const result = SettingsStore.migrate({
    schemaVersion: 3,
    modules: { obsoleteModule: { enabled: true } },
    global: {}
  });

  assert.equal(result.modules.obsoleteModule, undefined);
});

test('migrate: a stored toggle for a removed sub-feature is dropped', () => {
  // `inlineActionCells` was deleted in Phase 2. A stored `true` must not
  // survive in storage where nothing reads it and Settings cannot show it.
  const result = SettingsStore.migrate({
    schemaVersion: 3,
    modules: { checklistEnhancer: { actions: { inlineActionCells: true, realtimeFilter: false } } },
    global: {}
  });

  assert.equal('inlineActionCells' in result.modules.checklistEnhancer.actions, false);
  assert.equal(result.modules.checklistEnhancer.actions.realtimeFilter, false);
});

test('migrate: a partial actions object leaves the other toggles at defaults', () => {
  const result = SettingsStore.migrate({
    schemaVersion: 3,
    modules: { checklistEnhancer: { enabled: false, actions: {} } },
    global: {}
  });

  assert.equal(result.modules.checklistEnhancer.enabled, false);
  assert.equal(result.modules.checklistEnhancer.actions.realtimeFilter, true);
});

test('cloneDefaults: returns a deep copy, not a shared reference', () => {
  const a = SettingsStore.cloneDefaults();
  a.modules.checklistEnhancer.enabled = false;
  assert.equal(DEFAULT_CONFIG.modules.checklistEnhancer.enabled, true);
});

test('configToXml and xmlToConfig: round-trip preserves all settings', () => {
  const original = SettingsStore.cloneDefaults();
  original.global.theme = 'dark';
  original.global.toastDurationMs = 8000;
  original.modules.checklistEnhancer.enabled = false;
  original.modules.checklistEnhancer.urlMatch = [
    { pattern: '/test\\.cfm', exclude: true }
  ];

  const xml = configToXml(original);
  assert.ok(xml.includes('<sctoolkit-settings'));
  assert.ok(xml.includes('<theme>dark</theme>'));
  assert.ok(xml.includes('pattern="/test\\.cfm"'));

  const parsed = xmlToConfig(xml);
  assert.equal(parsed.global.theme, 'dark');
  assert.equal(parsed.global.toastDurationMs, 8000);
  assert.equal(parsed.modules.checklistEnhancer.enabled, false);
  assert.equal(parsed.modules.checklistEnhancer.urlMatch[0].pattern, '/test\\.cfm');
  assert.equal(parsed.modules.checklistEnhancer.urlMatch[0].exclude, true);
});

test('xmlToConfig: throws descriptive error on invalid XML', () => {
  assert.throws(() => xmlToConfig('<invalid xml>'), /XML Parse Error|Invalid XML/);
});

test('hotlinks: default config contains Top, Bottom, Search, and Year hotlinks', () => {
  const hotlinks = DEFAULT_CONFIG.global.hotlinks;
  assert.ok(Array.isArray(hotlinks));
  assert.equal(hotlinks.length, 4);
  assert.equal(hotlinks[0].id, 'top');
  assert.equal(hotlinks[1].id, 'bottom');
  assert.equal(hotlinks[2].id, 'search');
  assert.equal(hotlinks[2].url, 'https://www.tcdb.com/AdvancedSearch.cfm');
  assert.equal(hotlinks[2].tooltip, 'Perform Advanced Search');
  assert.equal(hotlinks[2].placement, 3);
  assert.equal(hotlinks[3].id, 'year');
  assert.equal(hotlinks[3].url, '/ViewAllC.cfm');
  assert.equal(hotlinks[3].placement, 4);
});

test('migrate: auto-heals stored toolbarBadges by merging missing default badges like PIN and YEAR', () => {
  const storedOld8Badges = [
    { key: 'CHECKLIST', enabled: true },
    { key: 'INSERTS', enabled: true },
    { key: 'PARALLELS', enabled: true },
    { key: 'FOR_SALE', enabled: true },
    { key: 'MULTI', enabled: true },
    { key: 'WANTLIST', enabled: true },
    { key: 'CSV', enabled: true },
    { key: 'HIERARCHY', enabled: true }
  ];

  const stored = {
    schemaVersion: DEFAULT_CONFIG.schemaVersion,
    modules: {},
    global: {
      toolbarBadges: storedOld8Badges
    }
  };

  const result = SettingsStore.migrate(stored);
  const keys = result.global.toolbarBadges.map((b) => b.key);
  assert.ok(keys.includes('PIN'), 'migrated stored config should include PIN badge');
  assert.ok(keys.includes('YEAR'), 'migrated stored config should include YEAR badge');
  assert.equal(result.global.toolbarBadges.length, 10);
});

