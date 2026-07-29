#!/usr/bin/env node
/** Print the userscript metadata block to stdout. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildBanner } from '../src/meta.js';

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8')
);

process.stdout.write(buildBanner(pkg));
