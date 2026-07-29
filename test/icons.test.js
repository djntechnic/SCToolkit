import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { ICONS, SPRITE_ID, buildSprite, icon, installIconSprite, symbolId } from '../src/ui/icons.js';
import { BADGES } from '../src/ui/badges.js';

test('the sprite defines a symbol for every icon', () => {
  const sprite = buildSprite();
  Object.keys(ICONS).forEach((name) => {
    assert.ok(sprite.includes(`id="${symbolId(name)}"`), `no symbol for '${name}'`);
  });
});

test('every symbol carries a viewBox and inheritable stroke attributes', () => {
  // These live on the symbol precisely so a <use> reference can carry nothing
  // but a size. If they moved onto the children, icons would still render —
  // which is why this is asserted rather than eyeballed.
  const doc = new JSDOM(`<body>${buildSprite()}</body>`).window.document;
  const symbols = doc.querySelectorAll('symbol');

  assert.equal(symbols.length, Object.keys(ICONS).length);
  symbols.forEach((sym) => {
    assert.equal(sym.getAttribute('viewBox'), '0 0 24 24');
    assert.equal(sym.getAttribute('fill'), 'none');
    assert.equal(sym.getAttribute('stroke'), 'currentColor');
    assert.ok(Number(sym.getAttribute('stroke-width')) > 0);
    assert.ok(sym.children.length > 0, `'${sym.id}' has no geometry`);
  });
});

test('icon() references a symbol that exists and sets the declared size', () => {
  const sprite = buildSprite();
  Object.entries(ICONS).forEach(([name, def]) => {
    const markup = icon(name);
    assert.ok(markup.includes(`href="#${symbolId(name)}"`));
    assert.ok(sprite.includes(`id="${symbolId(name)}"`));
    assert.ok(markup.includes(`width="${def.size}"`));
    assert.ok(markup.includes(`height="${def.size}"`));
  });
});

test('icon() degrades to empty markup for an unknown name', () => {
  // A typo should lose the icon, not emit broken markup into innerHTML.
  assert.equal(icon('nope'), '');
  assert.equal(icon(''), '');
  assert.equal(icon(undefined), '');
});

test('every badge names an icon that exists', () => {
  Object.entries(BADGES).forEach(([key, def]) => {
    assert.ok(ICONS[def.icon], `badge '${key}' names missing icon '${def.icon}'`);
  });
});

test('installIconSprite is idempotent', () => {
  const dom = new JSDOM('<!doctype html><body></body>');
  globalThis.document = dom.window.document;

  installIconSprite();
  installIconSprite();

  assert.equal(dom.window.document.querySelectorAll(`#${SPRITE_ID}`).length, 1);
});

test('the sprite is hidden and not exposed to assistive technology', () => {
  const dom = new JSDOM('<!doctype html><body></body>');
  globalThis.document = dom.window.document;
  installIconSprite();

  const sprite = dom.window.document.getElementById(SPRITE_ID);
  assert.equal(sprite.getAttribute('aria-hidden'), 'true');
  assert.match(sprite.getAttribute('style'), /width:0/);
});
