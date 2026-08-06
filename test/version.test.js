import test from 'node:test';
import assert from 'node:assert/strict';

import { APP_VERSION, getAppVersion } from '../src/core/version.js';

test('APP_VERSION: valid semantic version string', () => {
  assert.equal(typeof APP_VERSION, 'string');
  assert.match(APP_VERSION, /^\d+\.\d+\.\d+/);
});

test('getAppVersion: consistently returns APP_VERSION as authoritative version', () => {
  assert.equal(getAppVersion(), '0.1.0-beta');
  assert.equal(APP_VERSION, '0.1.0-beta');
});
