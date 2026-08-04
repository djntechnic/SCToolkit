/**
 * Smoke test for the built bundle.
 *
 * Loads `dist/sctoolkit.user.js` into a jsdom page with stubbed `GM_*` globals
 * and asserts that it boots without throwing and mounts its chrome. This is the
 * check that catches import cycles and load-order faults, which unit tests on
 * individual modules cannot see.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

import { ModuleRegistry } from '../src/core/registry.js';

const BUNDLE = fileURLToPath(new URL('../dist/sctoolkit.user.js', import.meta.url));

const PAGE = `<!doctype html>
<html><head><title>2023 Example Chrome Checklist</title></head>
<body>
  <div id="setname-content"><h1>2023 Example Chrome - Cards</h1><h3>Refractors</h3></div>
  <div id="main-content-area">
    <table>
      <tr><td><a href="/ViewCard.cfm/sid/4001/cid/1">1</a></td><td>Sample Player RC</td></tr>
    </table>
  </div>
</body></html>`;

/**
 * @returns {{dom: JSDOM, errors: string[]}}
 */
function bootBundle(url) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (e) => errors.push(e.message));
  // Swallow the script's own console output, but never the error channel: an
  // EventEmitter with no 'error' listener throws on emit.
  ['log', 'info', 'warn', 'error', 'debug'].forEach((level) => virtualConsole.on(level, () => {}));

  const dom = new JSDOM(PAGE, { url, runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole });
  const { window } = dom;

  // jsdom implements no layout, so it has no innerText. For an unrendered
  // document the spec defines innerText as textContent, which is exactly the
  // substitution made here.
  Object.defineProperty(window.HTMLElement.prototype, 'innerText', {
    configurable: true,
    get() { return this.textContent; },
    set(value) { this.textContent = value; }
  });

  // Minimal userscript-manager surface. Storage is in-memory and per-test.
  const store = new Map();
  window.GM_getValue = (key, fallback) => (store.has(key) ? store.get(key) : fallback);
  window.GM_setValue = (key, value) => store.set(key, value);
  window.GM_info = { script: { version: '3.0.0-test' } };
  window.scrollTo = () => {};

  window.eval(readFileSync(BUNDLE, 'utf8'));
  return { dom, errors };
}

/**
 * jsdom is still parsing when the bundle is evaluated, so the script takes its
 * `DOMContentLoaded` path. Wait for that, then let the bootstrap's own async
 * continuation run.
 *
 * @returns {Promise<{dom: JSDOM, errors: string[]}>}
 */
async function bootAndSettle(url) {
  const booted = bootBundle(url);
  const { window } = booted.dom;
  if (window.document.readyState === 'loading') {
    await new Promise((resolve) => window.addEventListener('DOMContentLoaded', resolve));
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
  return booted;
}

test('the bundle boots on a checklist page without throwing', async () => {
  const { dom, errors } = await bootAndSettle('https://example.test/Checklist.cfm/sid/4001/');
  assert.deepEqual(errors, []);

  const doc = dom.window.document;
  assert.ok(doc.getElementById('sctk-toolbar'), 'toolbar should be mounted');
  assert.ok(doc.getElementById('tk-status'), 'status readout should exist');
  assert.ok(doc.getElementById('tk-settings-trigger'), 'settings trigger should be mounted');
  assert.ok(doc.getElementById('tk-checklist-filter'), 'filter box should be installed');
  dom.window.close();
});

test('the settings modal opens and closes, and its CSS arrives only then', async () => {
  const { dom } = await bootAndSettle('https://example.test/Checklist.cfm/sid/4001/');
  const doc = dom.window.document;

  const stylesAtBoot = doc.querySelectorAll('head style').length;

  doc.getElementById('tk-settings-trigger').click();
  assert.ok(doc.getElementById('tk-settings-panel'), 'settings panel should open');
  assert.equal(doc.querySelectorAll('.tk-settings-module-row').length, ModuleRegistry.length);

  // The modal's stylesheet is injected on first open, not at page load.
  assert.equal(doc.querySelectorAll('head style').length, stylesAtBoot + 1);

  doc.getElementById('tk-settings-close').click();
  assert.equal(doc.getElementById('tk-settings-overlay'), null);

  // Reopening must not inject it a second time.
  doc.getElementById('tk-settings-trigger').click();
  assert.equal(doc.querySelectorAll('head style').length, stylesAtBoot + 1);

  dom.window.close();
});

test('the icon sprite is installed and every icon resolves to it', async () => {
  const { dom } = await bootAndSettle('https://example.test/Checklist.cfm/sid/4001/');
  const doc = dom.window.document;

  const sprite = doc.getElementById('sctk-icon-sprite');
  assert.ok(sprite, 'sprite should be installed');

  const symbolIds = new Set(Array.from(sprite.querySelectorAll('symbol'), (s) => `#${s.id}`));
  const uses = doc.querySelectorAll('use');

  assert.ok(uses.length > 0, 'icons should render as <use> references');
  uses.forEach((use) => {
    assert.ok(symbolIds.has(use.getAttribute('href')), `dangling icon reference ${use.getAttribute('href')}`);
  });
});

test('the filter hides rows by class and reports the match count', async () => {
  const { dom } = await bootAndSettle('https://example.test/Checklist.cfm/sid/4001/');
  const doc = dom.window.document;

  const input = doc.getElementById('tk-checklist-filter');
  input.value = 'nothing matches this';
  input.dispatchEvent(new dom.window.Event('input'));

  await new Promise((resolve) => setTimeout(resolve, 250));

  const dataRow = doc.querySelector('#main-content-area tr');
  assert.equal(dataRow.classList.contains('tk-hidden'), true);
  assert.equal(dataRow.style.display, '', 'must not write inline display');
  assert.equal(doc.getElementById('tk-filter-count').textContent, '0 of 1');

  dom.window.close();
});

test('the bundle boots on a page it has no modules for', async () => {
  const { dom, errors } = await bootAndSettle('https://example.test/Person.cfm/pid/1/');
  assert.deepEqual(errors, []);
  assert.ok(dom.window.document.getElementById('sctk-toolbar'));
  dom.window.close();
});

test('the cancel control exists but stays hidden until an export runs', async () => {
  // A 200-page run is minutes of requests; before Phase 4 the only way to stop
  // one was to close the tab.
  const { dom } = await bootAndSettle('https://example.test/Checklist.cfm/sid/4001/');
  const btn = dom.window.document.getElementById('tk-cancel-export');

  assert.ok(btn, 'cancel button should be mounted');
  assert.equal(btn.hidden, true);
  dom.window.close();
});

test('the settings pane exposes the cache and timeout controls', async () => {
  const { dom } = await bootAndSettle('https://example.test/Checklist.cfm/sid/4001/');
  const doc = dom.window.document;
  doc.getElementById('tk-settings-trigger').click();

  const labels = Array.from(doc.querySelectorAll('#tk-settings-global label'), (l) => l.textContent);
  assert.ok(labels.some((t) => /^Request Timeout/i.test(t)), 'timeout slider missing');
  assert.ok(labels.some((t) => /^Export Cache Lifetime/i.test(t)), 'cache TTL slider missing');
  assert.ok(doc.getElementById('tk-cache-purge'), 'cache purge button missing');

  dom.window.close();
});

test('the theme is applied to the document before chrome renders', async () => {
  const { dom } = await bootAndSettle('https://example.test/Checklist.cfm/sid/4001/');
  const theme = dom.window.document.documentElement.getAttribute('data-sctk-theme');

  assert.ok(['light', 'dark'].includes(theme), `unexpected theme ${theme}`);
  dom.window.close();
});

test('the page offset comes from a measured variable, not a fixed 38px', async () => {
  // The old rule was a literal body { padding-top: 38px }. The toolbar was
  // flex-wrap: wrap, so the moment it wrapped to a second row it covered the
  // top of the page.
  //
  // jsdom has no layout, so the observer correctly declines to publish a
  // height of zero — what is checkable here is that the stylesheet consumes
  // the variable and that the toolbar no longer wraps.
  const { dom } = await bootAndSettle('https://example.test/Checklist.cfm/sid/4001/');
  const css = Array.from(dom.window.document.querySelectorAll('head style'), (s) => s.textContent).join('');

  assert.match(css, /padding-top:\s*var\(--tk-toolbar-height,\s*38px\)/);
  assert.equal(/#sctk-toolbar\s*\{[^}]*flex-wrap:\s*wrap/.test(css), false, 'toolbar must not wrap');
  dom.window.close();
});

test('the toolbar publishes a measured height when layout is available', async () => {
  const { dom } = await bootAndSettle('https://example.test/Checklist.cfm/sid/4001/');
  const doc = dom.window.document;
  const bar = doc.getElementById('sctk-toolbar');

  // Stand in for the layout jsdom does not do.
  bar.getBoundingClientRect = () => ({ height: 52 });

  // toolbar.js reads the ambient document, as it does in the page.
  globalThis.document = doc;
  globalThis.window = dom.window;
  const { Toolbar } = await import('../src/ui/toolbar.js');
  Toolbar.observeHeight(bar);

  assert.equal(doc.documentElement.style.getPropertyValue('--tk-toolbar-height'), '52px');
  dom.window.close();
});

test('Ctrl+K opens the command palette and Escape closes it', async () => {
  const { dom } = await bootAndSettle('https://example.test/Checklist.cfm/sid/4001/');
  const doc = dom.window.document;

  doc.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
  const input = doc.getElementById('tk-palette-input');
  assert.ok(input, 'palette should open');
  assert.ok(doc.querySelectorAll('.tk-palette-item').length > 0, 'palette should list commands');

  input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(doc.getElementById('tk-palette-input'), null);
  dom.window.close();
});

test('Ctrl+K is ignored while typing in a page field', async () => {
  // Add Multiples is hundreds of number inputs; swallowing a keystroke there
  // would be worse than not having the shortcut.
  const { dom } = await bootAndSettle('https://example.test/Checklist.cfm/sid/4001/');
  const doc = dom.window.document;

  const field = doc.createElement('input');
  doc.body.appendChild(field);
  field.focus();

  field.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
  assert.equal(doc.getElementById('tk-palette-input'), null);
  dom.window.close();
});

test('the settings dialog is announced as modal and traps focus on open', async () => {
  const { dom } = await bootAndSettle('https://example.test/Checklist.cfm/sid/4001/');
  const doc = dom.window.document;

  doc.getElementById('tk-settings-trigger').click();
  const panel = doc.getElementById('tk-settings-panel');

  assert.equal(panel.getAttribute('role'), 'dialog');
  assert.equal(panel.getAttribute('aria-modal'), 'true');
  assert.ok(panel.contains(doc.activeElement), 'focus should move into the dialog');

  assert.ok(doc.getElementById('tk-settings-diagnostics'), 'diagnostics tab should exist');
  dom.window.close();
});

test('dropdowns no longer open on hover alone', async () => {
  // Hover-open cannot be dismissed on a touch device.
  const { dom } = await bootAndSettle('https://example.test/Checklist.cfm/sid/4001/');
  const css = Array.from(dom.window.document.querySelectorAll('head style'), (s) => s.textContent).join('');

  assert.equal(/\.tk-dropdown:hover\s+\.tk-dropdown-content/.test(css), false);
  assert.ok(/\.tk-dropdown\.tk-show\s+\.tk-dropdown-content/.test(css));
  dom.window.close();
});
