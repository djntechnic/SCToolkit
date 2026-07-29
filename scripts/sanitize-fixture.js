/**
 * Turn a saved page into a committable test fixture.
 *
 * Fixtures live in a public repository, and the captures they come from are of
 * a logged-in session on a site with real user accounts. Sanitizing by hand is
 * a step someone eventually skips, so it is a script — run it, review the diff,
 * commit the output.
 *
 * What it removes:
 *   - scripts, styles, stylesheet links, iframes, noscript, comments
 *   - inline event handlers (`onclick=` and friends)
 *   - every account handle, including third parties who merely appear in a
 *     listing, replaced with stable pseudonyms
 *   - prices and money amounts
 *   - asset paths, which point at the capture's local `*_files` directory
 *
 * What it keeps: the structural markup the parser and the module selectors
 * read — element nesting, ids, classes, and hrefs. It deliberately does not
 * tidy or reformat. A fixture that has been cleaned up stops being evidence of
 * what the site actually returns.
 *
 * Usage:
 *   node scripts/sanitize-fixture.js in.html out.html [--max-rows N]
 *        [--max-links N] [--max-options N] [--owner HANDLE] [--keep 'sel#count']
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

/** Handles map to stable pseudonyms, so cross-references stay coherent. */
const handles = new Map();
function pseudonym(raw) {
  const key = decodeURIComponent(raw).toLowerCase();
  if (!handles.has(key)) handles.set(key, `collector${handles.size + 1}`);
  return handles.get(key);
}

/**
 * Keep the first `limit` elements matching `selector`, remove the rest.
 *
 * Structural trimming goes through a real DOM rather than a regex. A non-greedy
 * `</div>` match cuts a nested wrapper at its first child's closing tag, which
 * silently produces malformed HTML — and a fixture that parses differently from
 * the page it came from is worse than no fixture at all.
 *
 * Truncating from the end preserves headers and the first data rows, which is
 * where the structural variety lives.
 *
 * @param {Document} doc mutated in place
 * @param {string} selector
 * @param {number} limit
 */
function keepFirst(doc, selector, limit) {
  if (!Number.isFinite(limit)) return;
  const nodes = doc.querySelectorAll(selector);
  for (let i = limit; i < nodes.length; i++) nodes[i].remove();
}

/**
 * @param {string} html
 * @param {{maxRows?: number, maxLinks?: number, maxOptions?: number, owner?: string,
 *   keep?: string[]}} limits — `keep` entries are `selector#count`
 * @returns {string}
 */
export function sanitize(html, limits = {}) {
  const {
    maxRows = Infinity,
    maxLinks = Infinity,
    maxOptions = Infinity,
    owner = '',
    keep = []
  } = limits;

  let out = html;

  // --- strip executable and presentational payload --------------------------
  out = out.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  out = out.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  out = out.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '');
  out = out.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '');
  out = out.replace(/<link\b[^>]*>/gi, '');
  out = out.replace(/<!--[\s\S]*?-->/g, '');
  out = out.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '');
  out = out.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '');

  // --- redact identities ----------------------------------------------------
  out = out.replace(/\b(Profile|User)\.cfm\/([^"'<>\s/?]+)/gi,
    (_, page, handle) => `${page}.cfm/${pseudonym(handle)}`);

  // Link text: <a href=".../Profile.cfm/collectorN">Real Name</a>
  out = out.replace(
    /(<a[^>]*(?:Profile|User)\.cfm\/(collector\d+)[^>]*>)([^<]*)(<\/a>)/gi,
    (_, open, alias, __, close) => `${open}${alias}${close}`
  );

  // The account handle also appears as plain text — page headings, "<handle>'s
  // Collection", alt text. Redacting only the profile URLs leaves the identity
  // in the document, which is how a capture of a logged-in session leaks.
  if (owner) {
    const escaped = owner.replace(/[^A-Za-z0-9_]/g, (ch) => '\\' + ch);
    out = out.replace(new RegExp(escaped, 'gi'), 'example_user');
  }

  // --- redact money ---------------------------------------------------------
  out = out.replace(/(\$|USD\s*)\s?\d[\d,]*(\.\d{2})?/g, '$$0.00');

  // --- neutralise asset references -----------------------------------------
  out = out.replace(/(src\s*=\s*")[^"]*(")/gi, '$1asset.png$2');
  out = out.replace(/(srcset\s*=\s*")[^"]*(")/gi, '$1asset.png$2');
  out = out.replace(/(<img[^>]*\balt\s*=\s*")[^"]*(")/gi, '$1$2');

  // --- collapse whitespace --------------------------------------------------
  // The captures carry kilobytes of template indentation. Nothing that reads a
  // fixture is whitespace-sensitive: the parser collapses runs before matching,
  // and no CSS is loaded.
  out = out.replace(/[ \t]{2,}/g, ' ');
  out = out.replace(/(\r?\n[ \t]*){2,}/g, '\n');

  // --- trim bulk ------------------------------------------------------------
  const dom = new JSDOM(out);
  const doc = dom.window.document;

  keepFirst(doc, 'tr', maxRows);
  keepFirst(doc, 'li', maxLinks);
  keepFirst(doc, 'option', maxOptions);
  for (const spec of keep) {
    const [selector, count] = spec.split('#');
    keepFirst(doc, selector, Number(count));
  }

  return dom.serialize();
}

const [input, output, ...rest] = process.argv.slice(2);
if (!input || !output) {
  console.error(
    'usage: node scripts/sanitize-fixture.js in.html out.html ' +
    '[--max-rows N] [--max-links N] [--max-options N]'
  );
  process.exit(1);
}

const strFlag = (name) => {
  const i = rest.indexOf(name);
  return i === -1 ? '' : rest[i + 1];
};

const flag = (name) => {
  const i = rest.indexOf(name);
  return i === -1 ? Infinity : Number(rest[i + 1]);
};

const result = sanitize(readFileSync(input, 'utf8'), {
  maxRows: flag('--max-rows'),
  maxLinks: flag('--max-links'),
  maxOptions: flag('--max-options'),
  owner: strFlag('--owner'),
  keep: rest.filter((v, i) => rest[i - 1] === '--keep')
});

writeFileSync(output, result);
console.log(
  `${output}: ${(result.length / 1024).toFixed(1)} KB, ${handles.size} handle(s) pseudonymised`
);
