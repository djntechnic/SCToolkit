import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';

import {
  countCollectionQuantities,
  updateQuantityCounterWidget
} from '../src/modules/collectionQuantityCounter.js';
import { Config } from '../src/core/config.js';

test('countCollectionQuantities: parses distinct Qty >= 1 and total items from fixture 1', () => {
  const fixturePath = join(process.cwd(), 'test/fixtures/submitted/ForSaleTradeQuantityCount.html');
  const html = readFileSync(fixturePath, 'utf8');
  const dom = new JSDOM(html);

  const counts = countCollectionQuantities(dom.window.document);

  assert.ok(counts.distinctQtyCount > 0, 'distinctQtyCount should be greater than 0');
  assert.ok(counts.totalCardRows > 0, 'totalCardRows should be greater than 0');
  assert.ok(counts.totalQuantitySum >= counts.distinctQtyCount, 'totalQuantitySum should be >= distinctQtyCount');
});

test('countCollectionQuantities: parses 0 checked items and exact 47 total cards from fixture 2', () => {
  const fixturePath = join(process.cwd(), 'test/fixtures/submitted/ForSaleTradeQuantityCount2.html');
  const html = readFileSync(fixturePath, 'utf8');
  const dom = new JSDOM(html);

  const counts = countCollectionQuantities(dom.window.document);

  assert.equal(counts.distinctQtyCount, 0, 'distinctQtyCount should start at 0 when no card checked');
  assert.equal(counts.totalCardRows, 47, 'totalCardRows should be exactly 47 card rows');
  assert.equal(counts.totalQuantitySum, 0, 'totalQuantitySum should start at 0');
});

test('countCollectionQuantities: handles custom DOM rows with badges and inputs', () => {
  const dom = new JSDOM(`
    <table id="main-content-area">
      <tr class="collection_row">
        <td><a href="/edit"><span class="badge bg-primary">1</span></a></td>
        <td>Card 1</td>
      </tr>
      <tr class="collection_row">
        <td><a href="/edit"><span class="badge bg-primary">2</span></a></td>
        <td>Card 2</td>
      </tr>
      <tr class="collection_row">
        <td></td>
        <td>Card 3 (Qty 0)</td>
      </tr>
    </table>
  `);

  const counts = countCollectionQuantities(dom.window.document);

  assert.equal(counts.distinctQtyCount, 2);
  assert.equal(counts.totalCardRows, 3);
  assert.equal(counts.totalQuantitySum, 3);
});

test('updateQuantityCounterWidget: renders bottom-right widget with Card Count format', () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  Config.global.quantityCounterPosition = 'bottom-right';

  updateQuantityCounterWidget({ distinctQtyCount: 5, totalCardRows: 10, totalQuantitySum: 7 });

  const widget = dom.window.document.getElementById('sctk-qty-counter');
  assert.ok(widget);
  assert.ok(widget.className.includes('sctk-qty-counter-bottom-right'));
  assert.ok(widget.parentElement.id.includes('tk-toast-container-bottom-right'));
  assert.ok(widget.innerHTML.includes('Card Count:'));
  assert.ok(widget.innerHTML.includes('5'));
  assert.ok(widget.innerHTML.includes('10'));
  assert.ok(widget.innerHTML.includes('(Total Count: <strong>7</strong>)'));
});

test('toast and quantity counter widget stack inside corner container without overlap', async () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  Config.global.quantityCounterPosition = 'bottom-right';

  const { showToast } = await import('../src/ui/toast.js');

  updateQuantityCounterWidget({ distinctQtyCount: 3, totalCardRows: 5, totalQuantitySum: 3 });
  showToast({ message: 'SCToolkit Active', location: 'bottom-right' });

  const container = dom.window.document.getElementById('tk-toast-container-bottom-right');
  assert.ok(container, 'container should exist');
  assert.equal(container.children.length, 2, 'container should hold 2 stacked elements');

  const toastEl = container.querySelector('.tk-toast-message');
  const widgetEl = container.querySelector('.sctk-qty-counter');

  assert.ok(toastEl, 'toast should exist');
  assert.ok(widgetEl, 'widget should exist');
  assert.equal(container.firstElementChild, toastEl, 'toast should stack above widget');
  assert.equal(container.lastElementChild, widgetEl, 'widget should be at bottom of stack');
});
