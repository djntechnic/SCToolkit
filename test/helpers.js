/**
 * Shared test helpers: fixture loading and DOM construction.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const FIXTURE_DIR = new URL('./fixtures/', import.meta.url);

/**
 * @param {string} name file name inside `test/fixtures/`
 * @returns {string} raw HTML
 */
export function fixtureHtml(name) {
  return readFileSync(fileURLToPath(new URL(name, FIXTURE_DIR)), 'utf8');
}

/**
 * Parse a fixture the way the export runner parses a fetched page: into a
 * detached document with no base URL.
 *
 * @param {string} name
 * @returns {Document}
 */
export function fixtureDocument(name, url) {
  return new JSDOM(fixtureHtml(name), url ? { url } : undefined).window.document;
}

/**
 * @param {string} html
 * @returns {Document}
 */
export function documentFrom(html, url) {
  return new JSDOM(html, url ? { url } : undefined).window.document;
}
