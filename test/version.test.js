import test from 'node:test';
import assert from 'node:assert/strict';

import { APP_VERSION, getAppVersion } from '../src/core/version.js';

test('APP_VERSION: valid semantic version string', () => {
  assert.equal(typeof APP_VERSION, 'string');
  assert.match(APP_VERSION, /^\d+\.\d+\.\d+/);
});

test('getAppVersion: returns APP_VERSION when GM_info is not present', () => {
  const originalGMInfo = globalThis.GM_info;
  delete globalThis.GM_info;

  assert.equal(getAppVersion(), APP_VERSION);

  if (originalGMInfo) {
    globalThis.GM_info = originalGMInfo;
  }
});

test('getAppVersion: prefers GM_info.script.version when present', () => {
  const originalGMInfo = globalThis.GM_info;
  globalThis.GM_info = { script: { version: '3.0.1-custom' } };

  assert.equal(getAppVersion(), '3.0.1-custom');

  if (originalGMInfo) {
    globalThis.GM_info = originalGMInfo;
  } else {
    delete globalThis.GM_info;
  }
});
