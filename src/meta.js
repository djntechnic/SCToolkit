/**
 * Userscript metadata block template.
 *
 * The banner is generated rather than hand-maintained so that the version,
 * description, and URLs can never drift from package.json. `scripts/banner.js`
 * prints the result; `scripts/build.js` prepends it to the bundle.
 *
 * Note on @match: the metadata block must name the host the script runs on —
 * that is a functional requirement of the userscript manager, not branding.
 * All user-facing naming elsewhere in this project is "SCToolkit".
 */

import { APP_VERSION } from './core/version.js';

const RAW_BASE = 'https://raw.githubusercontent.com/djntechnic/SCToolkit/main/dist';

/**
 * Build the `==UserScript==` metadata block.
 *
 * @param {object} pkg Parsed package.json.
 * @returns {string} The banner, newline-terminated.
 */
export function buildBanner(pkg) {
  const version = pkg?.version || APP_VERSION;
  const lines = [
    ['name', 'SCToolkit'],
    ['namespace', pkg.homepage],
    ['version', version],
    ['description', pkg.description],
    ['author', pkg.author],
    ['license', pkg.license],
    ['homepageURL', pkg.homepage],
    ['supportURL', pkg.bugs.url],
    ['updateURL', `${RAW_BASE}/sctoolkit.user.js`],
    ['downloadURL', `${RAW_BASE}/sctoolkit.user.js`],
    ['match', '*://*.tcdb.com/*'],
    ['match', '*://tcdb.com/*'],
    ['grant', 'GM_setValue'],
    ['grant', 'GM_getValue'],
    ['grant', 'GM_info'],
    ['run-at', 'document-end']
  ];

  const pad = Math.max(...lines.map(([k]) => k.length)) + 2;
  const body = lines
    .map(([k, v]) => `// @${k.padEnd(pad, ' ')}${v}`)
    .join('\n');

  return `// ==UserScript==\n${body}\n// ==/UserScript==\n`;
}

export { RAW_BASE };
