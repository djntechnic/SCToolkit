#!/usr/bin/env node
/**
 * Fail if the committed dist/ artifact differs from a fresh build.
 *
 * dist/sctoolkit.user.js is the @updateURL target, so a stale commit would ship
 * old code to every installed client. CI runs `npm run build` and then this
 * check; a non-empty `git status --porcelain dist/` means the build was not
 * committed.
 */
import { execFileSync } from 'node:child_process';

const out = execFileSync('git', ['status', '--porcelain', '--', 'dist/'], {
  encoding: 'utf8'
}).trim();

if (out) {
  console.error('dist/ is out of date with src/. Run `npm run build` and commit the result.\n');
  console.error(out);
  process.exit(1);
}

console.log('dist/ matches the current build.');
