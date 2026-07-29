import test from 'node:test';
import assert from 'node:assert/strict';

import { ModuleRegistry, resolveModules } from '../src/core/registry.js';
import { Config, DEFAULT_CONFIG } from '../src/core/config.js';

const ids = (url) => resolveModules(url).map((m) => m.id);

const URL_CHECKLIST = 'https://example.test/Checklist.cfm/sid/1/';
const URL_WANTLIST = 'https://example.test/ViewCollectionWantlist.cfm/sid/1/';
const URL_ADD_MULTIPLES = 'https://example.test/CollectionAddMultiplesText.cfm/sid/1/';
const URL_VIEWALL = 'https://example.test/ViewAll.cfm/sid/1/';
const URL_PERSON = 'https://example.test/Person.cfm/pid/9/';

test('every registry entry has a matching config block', () => {
  // Without one, resolveModules silently never runs the module.
  ModuleRegistry.forEach((mod) => {
    assert.ok(DEFAULT_CONFIG.modules[mod.id], `no config for '${mod.id}'`);
  });
});

test('every config block has a matching registry entry', () => {
  const registered = new Set(ModuleRegistry.map((m) => m.id));
  Object.keys(DEFAULT_CONFIG.modules).forEach((id) => {
    assert.ok(registered.has(id), `config for unregistered module '${id}'`);
  });
});

test('the removed modules are gone from both the registry and the config', () => {
  assert.equal(ModuleRegistry.some((m) => m.id === 'cardNameFormatter'), false);
  assert.equal('cardNameFormatter' in DEFAULT_CONFIG.modules, false);
  assert.equal(
    'inlineActionCells' in DEFAULT_CONFIG.modules.checklistEnhancer.actions,
    false
  );
});

test('actionLabels only name toggles that exist in config', () => {
  ModuleRegistry.forEach((mod) => {
    Object.keys(mod.actionLabels || {}).forEach((key) => {
      assert.ok(
        key in DEFAULT_CONFIG.modules[mod.id].actions,
        `'${mod.id}' labels unknown action '${key}'`
      );
    });
  });
});

test('the checklist filter resolves on every listing route', () => {
  [URL_CHECKLIST, URL_WANTLIST, URL_ADD_MULTIPLES].forEach((url) => {
    assert.ok(ids(url).includes('checklistEnhancer'), url);
  });
});

test('the checklist filter does not resolve on unrelated routes', () => {
  assert.equal(ids(URL_PERSON).includes('checklistEnhancer'), false);
});

test('route rules are the only gate — editing them moves the module', () => {
  // The point of Phase 2's double-gating removal: this edit used to have no
  // effect, because the module re-checked the route itself and refused.
  const original = Config.modules.checklistEnhancer.urlMatch;
  try {
    Config.modules.checklistEnhancer.urlMatch = [{ pattern: '/person\\.cfm', exclude: false }];
    assert.ok(ids(URL_PERSON).includes('checklistEnhancer'));
    assert.equal(ids(URL_CHECKLIST).includes('checklistEnhancer'), false);
  } finally {
    Config.modules.checklistEnhancer.urlMatch = original;
  }
});

test('a disabled module never resolves', () => {
  const original = Config.modules.setListEnhancer.enabled;
  try {
    Config.modules.setListEnhancer.enabled = false;
    assert.equal(ids(URL_VIEWALL).includes('setListEnhancer'), false);
  } finally {
    Config.modules.setListEnhancer.enabled = original;
  }
});

test('the add-multiples exclusions hold', () => {
  const onAddMultiples = ids(URL_ADD_MULTIPLES);
  assert.equal(onAddMultiples.includes('csvExportEngine'), false);
  assert.equal(onAddMultiples.includes('paginationLoader'), false);
  assert.ok(onAddMultiples.includes('addMultiplesEnhancer'));
});

test('only the pagination loader is async', () => {
  const async = ModuleRegistry.filter((m) => m.isAsync).map((m) => m.id);
  assert.deepEqual(async, ['paginationLoader']);
});
