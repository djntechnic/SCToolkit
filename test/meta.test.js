import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildBanner } from '../src/meta.js';

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8')
);
const banner = buildBanner(pkg);

test('banner is a well-formed userscript metadata block', () => {
  assert.match(banner, /^\/\/ ==UserScript==\n/);
  assert.match(banner, /\n\/\/ ==\/UserScript==\n$/);
});

test('banner version tracks package.json', () => {
  assert.match(banner, new RegExp(`@version\\s+${pkg.version.replace(/\./g, '\\.')}$`, 'm'));
});

test('banner declares the auto-update endpoints', () => {
  for (const key of ['updateURL', 'downloadURL']) {
    assert.match(banner, new RegExp(`@${key}\\s+https://raw\\.githubusercontent\\.com/\\S+/dist/sctoolkit\\.user\\.js$`, 'm'));
  }
});

test('banner does not declare grants the script never uses', () => {
  assert.doesNotMatch(banner, /@grant\s+GM_addStyle/);
});

test('description is a single sentence, not a changelog', () => {
  assert.ok(pkg.description.length < 160, 'description should stay short');
  assert.equal(pkg.description.split('. ').length, 1);
});
