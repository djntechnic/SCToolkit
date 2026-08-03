/**
 * Ctrl+K command palette.
 *
 * Fuzzy search over the pinned sets, the shortcut actions for the current set,
 * export, and settings — so the common actions are reachable from the keyboard
 * without hunting through the toolbar.
 */

import { BADGES, SHORTCUT_KEYS } from './badges.js';
import { Pins } from '../core/storage.js';
import { extractSid } from '../core/sid.js';
import { exportSetCSV } from '../net/setExport.js';
import { Utils } from '../core/utils.js';

const OVERLAY_ID = 'tk-palette-overlay';

/** Most results rendered at once. */
const MAX_RESULTS = 12;

/**
 * Subsequence match with a crude quality score.
 *
 * Every character of the query must appear in order. Consecutive matches and
 * matches at a word boundary score higher, which is enough to float "2023
 * Bowman" above "2020 Bowman Chrome Sapphire" for the query `bow`.
 *
 * @param {string} query lowercased
 * @param {string} text
 * @returns {number} score, or -1 when it does not match
 */
export function fuzzyScore(query, text) {
  if (query === '') return 0;

  const haystack = text.toLowerCase();
  let score = 0;
  let cursor = 0;
  let previous = -2;

  for (const ch of query) {
    const found = haystack.indexOf(ch, cursor);
    if (found === -1) return -1;

    if (found === previous + 1) score += 3;
    if (found === 0 || /[\s\-_/]/.test(haystack[found - 1])) score += 2;
    score += 1;

    previous = found;
    cursor = found + 1;
  }

  // Baseline boost for substring matches
  if (haystack.includes(query)) {
    score += 5;
  }

  // Prefer shorter targets when the score is otherwise equal.
  const finalScore = score - haystack.length / 500;
  return Math.max(0, finalScore);
}

/**
 * Rank commands against a query.
 *
 * @param {Array<{label: string}>} commands
 * @param {string} query
 * @returns {Array<{label: string}>}
 */
export function rankCommands(commands, query) {
  const q = query.trim().toLowerCase();
  if (q === '') return commands.slice(0, MAX_RESULTS);

  return commands
    .map((command) => ({ command, score: fuzzyScore(q, command.label) }))
    .filter(({ score }) => score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS)
    .map(({ command }) => command);
}

/**
 * Everything the palette can do right now.
 *
 * @param {object} [deps] injectable for tests
 * @returns {Array<{label: string, hint: string, run: () => void}>}
 */
export function buildCommands({ href = window.location.href, pins = Pins.all() } = {}) {
  const commands = [];
  const currentSid = extractSid(href);

  if (currentSid) {
    SHORTCUT_KEYS.forEach((key) => {
      const badge = BADGES[key];
      commands.push({
        label: `This set: ${badge.title}`,
        hint: 'current set',
        run: () => { window.location.href = badge.getUrl(currentSid); }
      });
    });
    commands.push({
      label: 'This set: Export checklist to CSV',
      hint: 'current set',
      run: () => exportSetCSV(currentSid, document.title || 'Set')
    });
  }

  pins.forEach((pin) => {
    commands.push({
      label: `Pinned: ${pin.name}`,
      hint: pin.year,
      run: () => { window.location.href = pin.url; }
    });
    commands.push({
      label: `Pinned: Export ${pin.name}`,
      hint: 'CSV',
      run: () => exportSetCSV(pin.id, pin.name)
    });
  });

  return commands;
}

/** @returns {boolean} whether the palette is open */
export const isOpen = () => !!document.getElementById(OVERLAY_ID);

export function closePalette() {
  document.getElementById(OVERLAY_ID)?.remove();
}

/**
 * @param {object} [deps]
 */
export function openPalette(deps = {}) {
  if (isOpen()) return;

  const commands = [
    ...buildCommands(deps),
    { label: 'Open Settings', hint: 'configuration', run: () => deps.openSettings?.() }
  ];

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closePalette(); });

  const panel = document.createElement('div');
  panel.id = 'tk-palette-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'SCToolkit command palette');

  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'tk-palette-input';
  input.placeholder = 'Search sets and actions...';
  input.setAttribute('aria-label', 'Search sets and actions');
  input.autocomplete = 'off';

  const list = document.createElement('div');
  list.id = 'tk-palette-results';
  list.setAttribute('role', 'listbox');

  let active = 0;
  let shown = [];

  const render = () => {
    shown = rankCommands(commands, input.value);
    list.innerHTML = '';
    active = Math.min(active, Math.max(shown.length - 1, 0));

    if (shown.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'tk-palette-empty';
      empty.textContent = 'No matches.';
      list.appendChild(empty);
      return;
    }

    shown.forEach((command, i) => {
      const row = document.createElement('div');
      row.className = `tk-palette-item${i === active ? ' active' : ''}`;
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', String(i === active));
      row.innerHTML =
        `<span class="tk-palette-label">${Utils.escape.html(command.label)}</span>` +
        `<span class="tk-palette-hint">${Utils.escape.html(command.hint)}</span>`;
      row.addEventListener('click', () => { closePalette(); command.run(); });
      list.appendChild(row);
    });
  };

  input.addEventListener('input', () => { active = 0; render(); });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closePalette(); return; }
    if (e.key === 'Enter') {
      const command = shown[active];
      if (command) { closePalette(); command.run(); }
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;

    e.preventDefault();
    if (shown.length === 0) return;
    active = e.key === 'ArrowDown'
      ? (active + 1) % shown.length
      : (active - 1 + shown.length) % shown.length;
    render();
    list.children[active]?.scrollIntoView({ block: 'nearest' });
  });

  panel.append(input, list);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  render();
  input.focus();
}

/**
 * Bind Ctrl+K / Cmd+K.
 *
 * The shortcut is ignored while the user is typing in a page field, so it
 * cannot swallow input on a data-entry page — the one place this script is most
 * likely to be in the way.
 *
 * @param {object} [deps]
 */
export function initPalette(deps = {}) {
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'k' && e.key !== 'K') return;
    if (!e.ctrlKey && !e.metaKey) return;

    const el = document.activeElement;
    const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
    if (typing && el.id !== 'tk-palette-input') return;

    e.preventDefault();
    if (isOpen()) closePalette();
    else openPalette(deps);
  });
}
