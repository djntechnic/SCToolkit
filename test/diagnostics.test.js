import test from 'node:test';
import assert from 'node:assert/strict';

import { DiagnosticTests } from '../src/core/diagnostics.js';

test('DiagnosticTests: runs all runtime self-tests and reports pass', () => {
  const results = DiagnosticTests.run();
  assert.equal(results.length, 5);

  results.forEach(({ name, pass, detail }) => {
    assert.equal(pass, true, `Diagnostic self-test '${name}' failed: ${detail}`);
  });
});
