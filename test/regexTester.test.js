import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { SettingsUI } from '../src/ui/settings.js';
import { Config, SettingsStore, testUrlMatch } from '../src/core/config.js';

test('SettingsUI._buildRegexPane: renders pattern input, flags, presets, and live output', () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;

  const pane = SettingsUI._buildRegexPane();
  assert.ok(pane, 'pane created');
  assert.equal(pane.id, 'tk-settings-regex-tester');

  const patternInput = pane.querySelector('.tk-tester-input');
  assert.ok(patternInput, 'has pattern input');

  const statusBadge = pane.querySelector('.tk-status-badge');
  assert.ok(statusBadge, 'has status badge');
  assert.match(statusBadge.textContent, /MATCHED/);

  // Test updating pattern to invalid regex
  patternInput.value = '[unclosed';
  patternInput.dispatchEvent(new dom.window.Event('input'));
  assert.match(statusBadge.textContent, /SYNTAX ERROR/);

  delete global.window;
  delete global.document;
});

test('SettingsUI._buildRouteTesterPane: evaluates URLs against modules and renders MATCH / NO MATCH badges', () => {
  Object.assign(Config, SettingsStore.cloneDefaults());
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;

  const pane = SettingsUI._buildRouteTesterPane();
  assert.ok(pane, 'pane created');
  assert.equal(pane.id, 'tk-settings-route-tester');
  document.body.appendChild(pane);

  const chips = Array.from(pane.querySelectorAll('.tk-preset-chip'));
  const insertsChip = chips.find((c) => c.textContent === 'Inserts');
  assert.ok(insertsChip, 'Inserts preset chip exists');
  insertsChip.click();

  const badges = Array.from(pane.querySelectorAll('.tk-status-badge')).map((b) => b.textContent.trim());
  assert.ok(badges.includes('MATCH'), `expected MATCH in badges, got ${JSON.stringify(badges)}`);
  assert.ok(badges.includes('NO MATCH'), `expected NO MATCH in badges, got ${JSON.stringify(badges)}`);

  delete global.window;
  delete global.document;
});

test('SettingsUI.open: strictly modal, does not close on backdrop click', () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;

  SettingsUI.open();
  const overlay = document.getElementById(SettingsUI.overlayId);
  assert.ok(overlay, 'overlay opened');

  // Click on backdrop
  overlay.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, target: overlay }));
  assert.ok(document.getElementById(SettingsUI.overlayId), 'modal remains open on backdrop click');

  SettingsUI.close();
  assert.equal(document.getElementById(SettingsUI.overlayId), null, 'modal closed via close()');

  delete global.window;
  delete global.document;
});

test('testUrlMatch: correctly matches include and exclude rules', () => {
  const rules = [
    { pattern: '/checklist\\.cfm', exclude: false },
    { pattern: '/addmultiples', exclude: true }
  ];

  assert.equal(testUrlMatch(rules, 'https://www.tcdb.com/Checklist.cfm?SetID=1'), true);
  assert.equal(testUrlMatch(rules, 'https://www.tcdb.com/Checklist.cfm/addmultiples'), false);
  assert.equal(testUrlMatch(rules, 'https://www.tcdb.com/ViewSet.cfm'), false);
});
