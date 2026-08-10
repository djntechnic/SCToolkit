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

test('getCollectionCardDetails: extracts cardNo, player, tags, team, qty for added items', async () => {
  const dom = new JSDOM(`
    <table id="main-content-area">
      <tr class="collection_row">
        <td><a href="/edit"><span class="badge bg-primary">2</span></a></td>
        <td><a href="ViewCard.cfm/sid/1/cid/100/2023-Bowman-1-Byron-Buxton">1</a></td>
        <td><a href="ViewCard.cfm/sid/1/cid/100/2023-Bowman-1-Byron-Buxton">Byron Buxton</a> RC</td>
        <td><a href="ViewCard.cfm/sid/1/cid/100/2023-Bowman-1-Byron-Buxton">Minnesota Twins</a></td>
      </tr>
      <tr class="collection_row">
        <td><input type="checkbox" checked></td>
        <td><a href="ViewCard.cfm/sid/1/cid/101/2023-Bowman-2-Triston-Casas">2</a></td>
        <td><a href="ViewCard.cfm/sid/1/cid/101/2023-Bowman-2-Triston-Casas">Triston Casas</a></td>
        <td><a href="ViewCard.cfm/sid/1/cid/101/2023-Bowman-2-Triston-Casas">Boston Red Sox</a></td>
      </tr>
      <tr class="collection_row">
        <td></td>
        <td><a href="ViewCard.cfm/sid/1/cid/102/2023-Bowman-3-Unadded">3</a></td>
        <td><a href="ViewCard.cfm/sid/1/cid/102/2023-Bowman-3-Unadded">Unadded Player</a></td>
        <td><a href="ViewCard.cfm/sid/1/cid/102/2023-Bowman-3-Unadded">Team</a></td>
      </tr>
    </table>
  `);

  const { getCollectionCardDetails } = await import('../src/modules/collectionQuantityCounter.js');
  const details = getCollectionCardDetails(dom.window.document);

  assert.equal(details.length, 2, 'should extract 2 items with qty >= 1');
  assert.equal(details[0].cardNo, '1');
  assert.equal(details[0].player, 'Byron Buxton');
  assert.equal(details[0].tags, 'RC');
  assert.equal(details[0].team, 'Minnesota Twins');
  assert.equal(details[0].qty, 2);

  assert.equal(details[1].cardNo, '2');
  assert.equal(details[1].player, 'Triston Casas');
  assert.equal(details[1].team, 'Boston Red Sox');
  assert.equal(details[1].qty, 1);
});

test('showCollectionQuantityDetailsModal: renders Details button and opens modal window', async () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;

  const { updateQuantityCounterWidget } = await import('../src/modules/collectionQuantityCounter.js');

  updateQuantityCounterWidget({ distinctQtyCount: 1, totalCardRows: 5, totalQuantitySum: 1 });

  const widget = dom.window.document.getElementById('sctk-qty-counter');
  assert.ok(widget);

  const detailsBtn = widget.querySelector('#sctk-qty-details-btn');
  assert.ok(detailsBtn, 'Details button should render in overlay widget');

  detailsBtn.click();

  const modal = dom.window.document.getElementById('sctk-qty-details-modal');
  assert.ok(modal, 'Modal window should open on clicking Details');
  assert.ok(modal.innerHTML.includes('Collection Card Totals &amp; Details'));

  const closeBtn = modal.querySelector('#sctk-qty-modal-close-btn');
  assert.ok(closeBtn);
  closeBtn.click();

  assert.equal(dom.window.document.getElementById('sctk-qty-details-modal'), null, 'Modal should close when clicking close button');
});

test('getCollectionCardDetails: correctly parses 10-cell TCDB collection row structure', async () => {
  const dom = new JSDOM(`
    <table>
      <tr class="collection_row" bgcolor="#9DFF9D">
        <td><a href="/CollectionEdit.cfm?..."><span class="badge bg-primary" title="Quantity">1</span></a></td>
        <td>thumb1</td>
        <td>thumb2</td>
        <td>icon</td>
        <td><div class="dropdown"><ul class="dropdown-menu"><li><a href="/CollectionEdit.cfm">Edit Details...</a></li></ul></div></td>
        <td nowrap="" valign="top"><a href="/ViewCard.cfm/sid/357729/cid/21211724/2023-Bowman-1-Byron-Buxton">1</a></td>
        <td valign="top" width="42%"><a href="/ViewCard.cfm/sid/357729/cid/21211724/2023-Bowman-1-Byron-Buxton">Byron Buxton</a> RC</td>
        <td valign="top" width="42%"><a href="/ViewCard.cfm/sid/357729/cid/21211724/2023-Bowman-1-Byron-Buxton">Minnesota Twins</a></td>
        <td></td>
        <td></td>
      </tr>
    </table>
  `);

  const { getCollectionCardDetails } = await import('../src/modules/collectionQuantityCounter.js');
  const details = getCollectionCardDetails(dom.window.document);

  assert.equal(details.length, 1);
  assert.equal(details[0].qty, 1);
  assert.equal(details[0].cardNo, '1');
  assert.equal(details[0].player, 'Byron Buxton');
  assert.equal(details[0].tags, 'RC');
  assert.equal(details[0].team, 'Minnesota Twins');
});

