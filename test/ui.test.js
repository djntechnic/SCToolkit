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
import { SHORTCUT_KEYS, BADGES, createBadge } from '../src/ui/badges.js';
import { cleanDocTitle } from '../src/ui/toolbar.js';

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

test('fuzzyScore: long command labels retain positive score and are not dropped', () => {
  const longLabel = 'This set: Export checklist to CSV (includes print run, team, and variations)';
  const score = fuzzyScore('export', longLabel);
  assert.ok(score > 0, `Expected score > 0, got ${score}`);

  const commands = [{ label: longLabel }];
  const ranked = rankCommands(commands, 'export');
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].label, longLabel);
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

test('SettingsUI._trapFocus traps focus inside panel on Tab and Shift+Tab', async () => {
  const dom = new JSDOM('<!doctype html><body></body>');
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;

  const { SettingsUI } = await import('../src/ui/settings.js');
  SettingsUI.open();

  const panel = dom.window.document.getElementById('tk-settings-panel');
  assert.ok(panel, 'settings panel should be mounted');

  const focusable = Array.from(
    panel.querySelectorAll('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])')
  );
  assert.ok(focusable.length >= 2, 'panel should have multiple focusable elements');

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  first.focus();
  assert.equal(dom.window.document.activeElement, first);

  // Pressing Shift+Tab on first element cycles focus to last element
  panel.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
  assert.equal(dom.window.document.activeElement, last);

  // Pressing Tab on last element cycles focus to first element
  panel.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Tab', shiftKey: false, bubbles: true }));
  assert.equal(dom.window.document.activeElement, first);

  SettingsUI.close();
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

// --- cleanDocTitle smart title parser ---------------------------------------

test('cleanDocTitle: ViewAll.cfm / ViewAllC.cfm', () => {
  assert.equal(
    cleanDocTitle('2022 Baseball Sets | Trading Card Database'),
    '2022 Baseball Sets'
  );
});

test('cleanDocTitle: ViewSet.cfm', () => {
  assert.equal(
    cleanDocTitle('2022 Bowman Baseball - Trading Card Database'),
    '2022 Bowman'
  );
});

test('cleanDocTitle: Inserts.cfm', () => {
  assert.equal(
    cleanDocTitle('2022 Bowman Baseball - Inserts and Related Sets - Trading Card Database'),
    '2022 Bowman'
  );
  assert.equal(
    cleanDocTitle('2022 Bowman Baseball - Inserts and Related Sets'),
    '2022 Bowman'
  );
  assert.equal(
    cleanDocTitle('2019 Topps Allen & Ginter Baseball - Inserts and Related Sets | Trading Card Database'),
    '2019 Topps Allen & Ginter'
  );
});

test('cleanDocTitle: Checklist.cfm', () => {
  assert.equal(
    cleanDocTitle('2022 Bowman - Bowman Buybacks Autographs'),
    '2022 Bowman - Bowman Buybacks Autographs'
  );
  assert.equal(
    cleanDocTitle('2019 Topps Allen & Ginter Baseball | Trading Card Database'),
    '2019 Topps Allen & Ginter'
  );
});

test('cleanDocTitle: all fixture set sub-page titles', () => {
  assert.equal(cleanDocTitle('2019 Topps Allen & Ginter X Baseball Forum | Trading Card Database'), '2019 Topps Allen & Ginter X');
  assert.equal(cleanDocTitle('Packaging - 2019 Topps Allen & Ginter X Baseball | Trading Card Database'), '2019 Topps Allen & Ginter X');
  assert.equal(cleanDocTitle('Rookies - 2019 Topps Allen & Ginter X Baseball | Trading Card Database'), '2019 Topps Allen & Ginter X');
  assert.equal(cleanDocTitle('2019 Topps Allen & Ginter X Baseball - Teams | Trading Card Database'), '2019 Topps Allen & Ginter X');
  assert.equal(cleanDocTitle('External Links - 2019 Topps Allen & Ginter X Baseball | Trading Card Database'), '2019 Topps Allen & Ginter X');
  assert.equal(cleanDocTitle('Errors / Variations - 2019 Topps Allen & Ginter X Baseball | Trading Card Database'), '2019 Topps Allen & Ginter X');
  assert.equal(cleanDocTitle('Contributors - 2019 Topps Allen & Ginter X Baseball | Trading Card Database'), '2019 Topps Allen & Ginter X');
  assert.equal(cleanDocTitle('Collection Summary - 2019 Topps Allen & Ginter X Baseball | Trading Card Database'), '2019 Topps Allen & Ginter X');
  assert.equal(cleanDocTitle('Pricing - 2019 Topps Allen & Ginter X Baseball | Trading Card Database'), '2019 Topps Allen & Ginter X');
  assert.equal(cleanDocTitle('Hall of Famers - 2019 Topps Allen & Ginter X Baseball | Trading Card Database'), '2019 Topps Allen & Ginter X');
  assert.equal(cleanDocTitle('Comments - 2019 Topps Allen & Ginter X Baseball | Trading Card Database'), '2019 Topps Allen & Ginter X');
  assert.equal(cleanDocTitle('Sell Sheets / Ads - 2019 Topps Allen & Ginter X Baseball | Trading Card Database'), '2019 Topps Allen & Ginter X');
  assert.equal(cleanDocTitle('Videos - 2019 Topps Allen & Ginter X Baseball | Trading Card Database'), '2019 Topps Allen & Ginter X');
  assert.equal(cleanDocTitle('Glossary - 2019 Topps Allen & Ginter X Baseball | Trading Card Database'), '2019 Topps Allen & Ginter X');
  assert.equal(cleanDocTitle('2019 Topps Allen & Ginter X Baseball - Gallery | Trading Card Database'), '2019 Topps Allen & Ginter X');
  assert.equal(cleanDocTitle('2019 Topps Allen & Ginter X Baseball - Card Rankings | Trading Card Database'), '2019 Topps Allen & Ginter X');
});

test('cleanDocTitle: ViewCollection*.cfm / Rookies.cfm / CollectionAddMultiplesText.cfm', () => {
  assert.equal(
    cleanDocTitle('Collection - 2019 Topps Allen & Ginter Baseball | Trading Card Database'),
    '2019 Topps Allen & Ginter'
  );
  assert.equal(
    cleanDocTitle('Rookies - 2019 Topps Allen & Ginter Baseball | Trading Card Database'),
    '2019 Topps Allen & Ginter'
  );
  assert.equal(
    cleanDocTitle('Collection - 2022 Bowman - Bowman Buybacks Autographs'),
    '2022 Bowman - Bowman Buybacks Autographs'
  );
  assert.equal(
    cleanDocTitle('Collection For Sale/Trade - 2022 Bowman - Bowman Buybacks Autographs'),
    '2022 Bowman - Bowman Buybacks Autographs'
  );
  assert.equal(
    cleanDocTitle('Collection Wantlist - 2022 Bowman'),
    '2022 Bowman'
  );
  assert.equal(
    cleanDocTitle('Collection Add Multiples - 2022 Bowman'),
    '2022 Bowman'
  );
});

test('createBadge: INSERTS and PARALLELS use parentSid when provided', () => {
  const insBadge = createBadge('INSERTS', '355099', null, 'both', '294644');
  assert.equal(insBadge.getAttribute('href'), '/Inserts.cfm/sid/294644/#InsertSets');

  const parBadge = createBadge('PARALLELS', '355099', null, 'both', '294644');
  assert.equal(parBadge.getAttribute('href'), '/Inserts.cfm/sid/294644/#ParallelSets');
});

test('createBadge: INSERTS and PARALLELS fall back to sid when parentSid is null', () => {
  const insBadge = createBadge('INSERTS', '355099', null, 'both', null);
  assert.equal(insBadge.getAttribute('href'), '/Inserts.cfm/sid/355099/#InsertSets');

  const parBadge = createBadge('PARALLELS', '355099', null, 'both', null);
  assert.equal(parBadge.getAttribute('href'), '/Inserts.cfm/sid/355099/#ParallelSets');
});

test('SettingsUI._buildModulesPane: alphabetizes modules and renders accordions', async () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;

  const { SettingsUI } = await import('../src/ui/settings.js');
  const pane = SettingsUI._buildModulesPane();

  const titleEls = Array.from(pane.querySelectorAll('.tk-module-name'));
  const renderedNames = titleEls.map((el) => el.textContent.trim());

  const expectedSortedNames = [...renderedNames].sort((a, b) => a.localeCompare(b));
  assert.deepEqual(renderedNames, expectedSortedNames, 'Modules should be rendered in alphabetical order');

  const firstHeader = pane.querySelector('.tk-accordion-header');
  const firstBody = pane.querySelector('.tk-accordion-body');
  assert.equal(firstBody.style.display, 'none', 'Accordion body should start closed');

  firstHeader.click();
  assert.equal(firstBody.style.display, 'block', 'Accordion body should open on header click');

  firstHeader.click();
  assert.equal(firstBody.style.display, 'none', 'Accordion body should close on second header click');
});

test('Toolbar.renderCenterContext: hotlinks respect toolbarButtonDisplay', async () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="sctk-toolbar"><div id="tk-center-context"></div></div></body></html>');
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;

  const { Config } = await import('../src/core/config.js');
  const { Toolbar } = await import('../src/ui/toolbar.js');

  Config.global.hotlinks = [
    { id: 'top', url: '#top', text: 'Top', enabled: true, icon: 'chevronUp' }
  ];

  // 1. Both mode (icon and text)
  Config.global.toolbarButtonDisplay = 'both';
  Toolbar.renderCenterContext();
  const container = dom.window.document.getElementById('tk-center-context');
  let btn = container.querySelector('.tk-hotlink-btn');
  assert.ok(btn.querySelector('svg'), 'both mode should render icon');
  assert.equal(btn.querySelector('span')?.textContent, 'Top', 'both mode should render text span');

  // 2. Icon only mode
  Config.global.toolbarButtonDisplay = 'icon';
  Toolbar.renderCenterContext();
  btn = container.querySelector('.tk-hotlink-btn');
  assert.ok(btn.querySelector('svg'), 'icon mode should render icon');
  assert.equal(btn.querySelector('span'), null, 'icon mode should not render text span when icon is available');

  // 3. Text only mode
  Config.global.toolbarButtonDisplay = 'text';
  Toolbar.renderCenterContext();
  btn = container.querySelector('.tk-hotlink-btn');
  assert.equal(btn.querySelector('svg'), null, 'text mode should not render icon when text is available');
  assert.equal(btn.querySelector('span')?.textContent, 'Top', 'text mode should render text span');

  // Restore default
  Config.global.toolbarButtonDisplay = 'both';
});

test('Toolbar.renderCenterContext: hotlinks respect launch target mode', async () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="sctk-toolbar"><div id="tk-center-context"></div></div></body></html>');
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;

  let openedTab = null;
  globalThis.GM_openInTab = (url, options) => {
    openedTab = { url, options };
  };

  const { Config } = await import('../src/core/config.js');
  const { Toolbar } = await import('../src/ui/toolbar.js');

  Config.global.hotlinks = [
    { id: 'inline_link', url: 'https://example.test/page1', text: 'Inline', enabled: true, target: 'inline' },
    { id: 'bg_link', url: 'https://example.test/page2', text: 'Background', enabled: true, target: 'background' }
  ];

  Toolbar.renderCenterContext();
  const container = dom.window.document.getElementById('tk-center-context');
  const links = container.querySelectorAll('a.tk-hotlink-btn');
  assert.equal(links.length, 2);

  const inlineLink = links[0];
  const bgLink = links[1];

  assert.equal(inlineLink.target, '', 'inline link target attribute should be empty');
  assert.equal(bgLink.target, '_blank', 'background link target attribute should be _blank');

  bgLink.click();
  assert.ok(openedTab, 'clicking background link should invoke GM_openInTab');
  assert.equal(openedTab.url, 'https://example.test/page2');
  assert.equal(openedTab.options.active, false, 'opened tab active option should be false for background tab');

  delete globalThis.GM_openInTab;
});



