#!/usr/bin/env node
/**
 * Bundle src/main.js into the single distributable userscript.
 *
 * esbuild is invoked through its JS API rather than the CLI so the banner can
 * be composed in-process — the shell-substitution form of `--banner:js` is not
 * portable to PowerShell.
 */
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildBanner } from '../src/meta.js';

const root = new URL('../', import.meta.url);
const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('package.json', root)), 'utf8'));

await build({
  entryPoints: [fileURLToPath(new URL('src/main.js', root))],
  outfile: fileURLToPath(new URL('dist/sctoolkit.user.js', root)),
  bundle: true,
  format: 'iife',
  target: 'chrome110',
  charset: 'utf8',
  legalComments: 'none',
  banner: { js: buildBanner(pkg) },
  logLevel: 'info'
});
