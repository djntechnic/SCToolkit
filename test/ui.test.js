/**
 * Cover for the Phase 5 UI work: theme resolution, palette ranking, and the
 * dropdown/dialog behaviour that replaced CSS-only interactions.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { THEMES, resolveTheme } from '../src/ui/theme.js';
import { fuzzyScore, rankCommands } from '../src/ui/palette.js';
import { STACK_LIMIT, TOAST_VARIANTS } from '../src/ui/toast.js';
import { SHORTCUT_KEYS, BADGES } from '../src/ui/badges.js';

// --- theme ------------------------------------------------------------------

test('resolveTheme: an explicit choice wins over the OS', () => {
  assert.equal(resolveTheme('light', true), 'light');
  assert.equal(resolveTheme('dark', false), 'dark');
});

test('resolveTheme: auto follows the OS', () => {
  assert.equal(resolveTheme('auto', true), 'dark');
  assert.equal(resolveTheme('auto', false), 'light');
});

test('resolveTheme: an unknown preference falls back to the OS', () => {
  // A config from a future version, or a hand-edited value.
  assert.equal(resolveTheme('solarized', true), 'dark');
  assert.equal(resolveTheme(undefined, false), 'light');
});

test('THEMES lists exactly the values the resolver understands', () => {
  assert.deepEqual(THEMES, ['auto', 'light', 'dark']);
});

// --- palette ranking --------------------------------------------------------

test('fuzzyScore: a subsequence matches, a non-subsequence does not', () => {
  assert.ok(fuzzyScore('bow', '2023 Bowman') >= 0);
  assert.ok(fuzzyScore('bwm', '2023 Bowman') >= 0);
  assert.equal(fuzzyScore('xyz', '2023 Bowman'), -1);
});

test('fuzzyScore: order matters', () => {
  assert.equal(fuzzyScore('nba', 'Bowman'), -1);
});

test('fuzzyScore: an empty query matches everything', () => {
  assert.equal(fuzzyScore('', 'anything'), 0);
});

test('fuzzyScore: consecutive and word-boundary matches score higher', () => {
  assert.ok(
    fuzzyScore('bow', '2023 Bowman') > fuzzyScore('bow', 'Blue Owl Wax'),
    'a contiguous word-start match should win'
  );
});

test('rankCommands: results are ordered by score', () => {
  const commands = [
    { label: 'Pinned: 2020 Bowman Chrome Sapphire Edition' },
    { label: 'Pinned: 2023 Bowman' },
    { label: 'Open Settings' }
  ];
  const [first] = rankCommands(commands, 'bowman');
  assert.equal(first.label, 'Pinned: 2023 Bowman');
});

test('rankCommands: non-matches are dropped', () => {
  const commands = [{ label: 'Open Settings' }, { label: 'Pinned: 2023 Bowman' }];
  assert.deepEqual(rankCommands(commands, 'settings').map((c) => c.label), ['Open Settings']);
});

test('rankCommands: an empty query returns a capped list', () => {
  const commands = Array.from({ length: 50 }, (_, i) => ({ label: `Set ${i}` }));
  assert.equal(rankCommands(commands, '').length, 12);
});

test('rankCommands: results are capped for a matching query too', () => {
  const commands = Array.from({ length: 50 }, (_, i) => ({ label: `Bowman ${i}` }));
  assert.ok(rankCommands(commands, 'bowman').length <= 12);
});

// --- toasts -----------------------------------------------------------------

test('every toast variant maps to a theme token', () => {
  // Variants must resolve through tokens, or dark mode silently keeps a
  // hardcoded light-mode colour.
  Object.values(TOAST_VARIANTS).forEach((value) => {
    assert.match(value, /^var\(--tk-[a-z-]+\)$/);
  });
});

test('the toast stack is capped', () => {
  assert.ok(STACK_LIMIT > 0 && STACK_LIMIT <= 6);
});

// --- palette command sources ------------------------------------------------

test('every palette shortcut names a badge that can build a URL', () => {
  SHORTCUT_KEYS.forEach((key) => {
    assert.ok(BADGES[key], `${key} is not a badge`);
    assert.equal(typeof BADGES[key].getUrl, 'function', `${key} has no URL builder`);
  });
});

// --- dropdown behaviour -----------------------------------------------------

/** @returns {{dom: JSDOM, dropdown: HTMLElement, trigger: HTMLElement}} */
async function mountDropdown() {
  const dom = new JSDOM(`<!doctype html><body>
    <div class="tk-dropdown">
      <button id="t">Open</button>
      <div class="tk-dropdown-content"><a href="#a">A</a><a href="#b">B</a></div>
    </div>
  </body>`);
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;

  const { initDropdown } = await import('../src/ui/dropdown.js');
  const dropdown = dom.window.document.querySelector('.tk-dropdown');
  const trigger = dom.window.document.getElementById('t');
  initDropdown(dropdown, trigger);
  return { dom, dropdown, trigger };
}

test('dropdown: the trigger reports its state to assistive technology', async () => {
  const { dropdown, trigger } = await mountDropdown();

  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(trigger.getAttribute('aria-haspopup'), 'true');

  trigger.click();
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');
  assert.ok(dropdown.classList.contains('tk-show'));

  trigger.click();
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
});

test('dropdown: Escape closes it and returns focus to the trigger', async () => {
  const { dom, dropdown, trigger } = await mountDropdown();
  trigger.click();

  dropdown.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

  assert.equal(dropdown.classList.contains('tk-show'), false);
  assert.equal(dom.window.document.activeElement, trigger, 'focus must not be stranded');
});

// --- contract checks --------------------------------------------------------

test('assertContract records a result for every selector, pass or fail', async () => {
  const dom = new JSDOM('<!doctype html><body><div id="here"></div></body>');
  globalThis.document = dom.window.document;

  const { assertContract, getContractResults, resetContracts } =
    await import('../src/core/contracts.js');
  resetContracts();

  const ok = assertContract('demo', [
    { selector: '#here', label: 'the present one' },
    { selector: '#missing', label: 'the absent one' }
  ]);

  assert.equal(ok, false);
  const results = getContractResults();
  assert.equal(results.length, 2);
  assert.deepEqual(results.map((r) => r.ok), [true, false]);
  assert.equal(results[1].label, 'the absent one');
});

test('assertContract survives an invalid selector instead of throwing', async () => {
  const dom = new JSDOM('<!doctype html><body></body>');
  globalThis.document = dom.window.document;

  const { assertContract, resetContracts } = await import('../src/core/contracts.js');
  resetContracts();

  // A bug in this script must degrade a feature, not take the toolbar down.
  assert.equal(assertContract('demo', [{ selector: ':::not valid:::' }]), false);
});

test('an optional check is recorded without failing the contract', async () => {
  const dom = new JSDOM('<!doctype html><body></body>');
  globalThis.document = dom.window.document;

  const { assertContract, getContractResults, resetContracts } =
    await import('../src/core/contracts.js');
  resetContracts();

  assert.equal(assertContract('demo', [{ selector: '#nope', optional: true }]), true);
  assert.equal(getContractResults().length, 1);
});

test('recordContract captures non-selector assumptions', async () => {
  const { recordContract, getContractResults, resetContracts } =
    await import('../src/core/contracts.js');
  resetContracts();

  recordContract('demo', 'indexed 0 rows', false);
  const [result] = getContractResults();

  assert.equal(result.ok, false);
  assert.equal(result.moduleId, 'demo');
});
