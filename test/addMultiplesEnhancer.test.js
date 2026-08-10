import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import {
  autoScrollIfOutsideMiddle80,
  initAddMultiplesEnhancer,
  getPageIndex,
  getNextPageUrl,
  getDirtyQuantityInputs,
  getDirtyCardDetails,
  getDirtyState,
  setupBeforeUnloadWarning,
  setupSubmitHandler,
  checkAndHandlePostReloadSuccess,
  showAddedDetailsModal,
  STORAGE_BATCH_KEY
} from '../src/modules/addMultiplesEnhancer.js';
import { InputIndex } from '../src/modules/inputOptimization.js';
import { Config } from '../src/core/config.js';

test('autoScrollIfOutsideMiddle80: returns false when element is within middle 80% vertically', () => {
  const dom = new JSDOM('<!DOCTYPE html><input id="test-input" />', {
    url: 'https://example.test/'
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.window.innerHeight = 1000;

  const input = dom.window.document.getElementById('test-input');
  let scrollCalled = false;
  input.scrollIntoView = () => { scrollCalled = true; };
  input.getBoundingClientRect = () => ({ top: 200, bottom: 230, height: 30 });

  const result = autoScrollIfOutsideMiddle80(input);
  assert.equal(result, false);
  assert.equal(scrollCalled, false);
});

test('autoScrollIfOutsideMiddle80: returns true and scrolls to center when element top is above 10%', () => {
  const dom = new JSDOM('<!DOCTYPE html><input id="test-input" />', {
    url: 'https://example.test/'
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.window.innerHeight = 1000;

  const input = dom.window.document.getElementById('test-input');
  let scrollOptions = null;
  input.scrollIntoView = (options) => { scrollOptions = options; };
  input.getBoundingClientRect = () => ({ top: 50, bottom: 80, height: 30 });

  const result = autoScrollIfOutsideMiddle80(input);
  assert.equal(result, true);
  assert.deepEqual(scrollOptions, { block: 'center', inline: 'nearest' });
});

test('autoScrollIfOutsideMiddle80: returns true and scrolls to center when element bottom is below 90%', () => {
  const dom = new JSDOM('<!DOCTYPE html><input id="test-input" />', {
    url: 'https://example.test/'
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.window.innerHeight = 1000;

  const input = dom.window.document.getElementById('test-input');
  let scrollOptions = null;
  input.scrollIntoView = (options) => { scrollOptions = options; };
  input.getBoundingClientRect = () => ({ top: 920, bottom: 950, height: 30 });

  const result = autoScrollIfOutsideMiddle80(input);
  assert.equal(result, true);
  assert.deepEqual(scrollOptions, { block: 'center', inline: 'nearest' });
});

test('initAddMultiplesEnhancer: triggers autoScrollIfOutsideMiddle80 on focusin event', () => {
  const dom = new JSDOM('<!DOCTYPE html><input id="test-input" />', {
    url: 'https://example.test/'
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.window.innerHeight = 1000;

  initAddMultiplesEnhancer();

  const input = dom.window.document.getElementById('test-input');
  let scrollOptions = null;
  input.scrollIntoView = (options) => { scrollOptions = options; };
  input.getBoundingClientRect = () => ({ top: 950, bottom: 980, height: 30 });

  const focusEvent = new dom.window.Event('focusin', { bubbles: true });
  input.dispatchEvent(focusEvent);

  assert.deepEqual(scrollOptions, { block: 'center', inline: 'nearest' });
});

test('initAddMultiplesEnhancer: auto-scrolls initial focused field on load/pagination if outside middle 80%', () => {
  const dom = new JSDOM('<!DOCTYPE html><input id="qty-input" value="0" />', {
    url: 'https://example.test/'
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.window.innerHeight = 1000;
  globalThis.requestAnimationFrame = dom.window.requestAnimationFrame ? dom.window.requestAnimationFrame.bind(dom.window) : ((cb) => setTimeout(cb, 0));

  const input = dom.window.document.getElementById('qty-input');
  let scrollOptions = null;
  input.scrollIntoView = (options) => { scrollOptions = options; };
  input.getBoundingClientRect = () => ({ top: 960, bottom: 990, height: 30 });

  InputIndex.getValidInputs = () => [input];

  initAddMultiplesEnhancer();

  assert.deepEqual(scrollOptions, { block: 'center', inline: 'nearest' });
});

test('getPageIndex: extracts PageIndex parameter from URL or hidden input, defaulting to 1', () => {
  const dom = new JSDOM('<!DOCTYPE html><input name="PageIndex" value="4" />', {
    url: 'https://www.tcdb.com/CollectionAddMultiplesText.cfm/sid/557556?PageIndex=2&AddTo=S'
  });

  // URL query param wins if present
  assert.equal(getPageIndex(dom.window.location.href, dom.window.document), 2);

  // Hidden input used if URL parameter is absent
  assert.equal(getPageIndex('https://www.tcdb.com/CollectionAddMultiplesText.cfm/sid/557556', dom.window.document), 4);

  // Defaults to 1 if neither exists
  const emptyDom = new JSDOM('<!DOCTYPE html><div></div>');
  assert.equal(getPageIndex('https://www.tcdb.com/CollectionAddMultiplesText.cfm/sid/557556', emptyDom.window.document), 1);
});

test('getNextPageUrl: returns URL for next page if present in pagination links', () => {
  const html = `
    <!DOCTYPE html>
    <nav aria-label="Page navigation">
      <ul class="pagination">
        <li class="page-item active"><a class="page-link" href="#">1</a></li>
        <li class="page-item"><a class="page-link" href="/CollectionAddMultiplesText.cfm/sid/357729?PageIndex=2&amp;AddTo=G">2</a></li>
      </ul>
    </nav>
  `;
  const dom = new JSDOM(html, { url: 'https://www.tcdb.com/CollectionAddMultiplesText.cfm/sid/357729?PageIndex=1' });
  const nextPageUrl = getNextPageUrl(1, dom.window.document, dom.window.location.href);

  assert.equal(nextPageUrl, 'https://www.tcdb.com/CollectionAddMultiplesText.cfm/sid/357729?PageIndex=2&AddTo=G');

  // Next page does not exist on page 2
  const noNextUrl = getNextPageUrl(2, dom.window.document, dom.window.location.href);
  assert.equal(noNextUrl, null);
});

test('getDirtyQuantityInputs and getDirtyState: correctly tracks non-zero/non-empty inputs', () => {
  const html = `
    <!DOCTYPE html>
    <input name="Quantity_1" value="0" />
    <input name="Quantity_2" value="3" />
    <input name="Quantity_3" value="" />
    <input name="Quantity_4" value="5" />
  `;
  const dom = new JSDOM(html);
  const dirtyInputs = getDirtyQuantityInputs(dom.window.document);

  assert.equal(dirtyInputs.length, 2);
  assert.equal(dirtyInputs[0].getAttribute('name'), 'Quantity_2');
  assert.equal(dirtyInputs[1].getAttribute('name'), 'Quantity_4');

  const dirtyState = getDirtyState(dom.window.document);
  assert.equal(dirtyState.isDirty, true);
  assert.equal(dirtyState.distinctRows, 2);
  assert.equal(dirtyState.totalQuantity, 8);
});

test('getDirtyCardDetails: extracts Card No, Player, and Qty from table rows', () => {
  const html = `
    <!DOCTYPE html>
    <table>
      <tr>
        <td>thumb1</td>
        <td>thumb2</td>
        <td><input name="Quantity_101" value="2" /></td>
        <td><a href="#">43</a></td>
        <td><a href="#">Josh Jung</a></td>
        <td>Texas Rangers</td>
      </tr>
      <tr>
        <td>thumb1</td>
        <td>thumb2</td>
        <td><input name="Quantity_102" value="0" /></td>
        <td><a href="#">44</a></td>
        <td><a href="#">Maikel Garcia</a></td>
        <td>Kansas City Royals</td>
      </tr>
    </table>
  `;
  const dom = new JSDOM(html);
  const details = getDirtyCardDetails(dom.window.document);

  assert.equal(details.length, 1);
  assert.equal(details[0].cardNo, '43');
  assert.equal(details[0].player, 'Josh Jung');
  assert.equal(details[0].qty, 2);
});

test('showAddedDetailsModal: renders modal with card details table and supports closing', () => {
  const dom = new JSDOM('<!DOCTYPE html><body></body>');
  const batchData = {
    distinctRows: 1,
    totalQuantity: 2,
    pageIndex: 1,
    items: [
      { cardNo: '43', player: 'Josh Jung', qty: 2 }
    ]
  };

  showAddedDetailsModal(batchData, dom.window.document);

  const modal = dom.window.document.querySelector('#sctoolkit-added-details-modal');
  assert.ok(modal !== null);
  assert.ok(modal.textContent.includes('Josh Jung'));
  assert.ok(modal.textContent.includes('43'));

  const closeBtn = modal.querySelector('#sctoolkit-details-modal-close-btn');
  assert.ok(closeBtn !== null);
  closeBtn.click();

  assert.equal(dom.window.document.querySelector('#sctoolkit-added-details-modal'), null);
});

test('setupBeforeUnloadWarning: warns user on beforeunload when isDirty is true', () => {
  const html = `<!DOCTYPE html><input name="Quantity_1" value="2" />`;
  const dom = new JSDOM(html);

  setupBeforeUnloadWarning(dom.window, dom.window.document);

  const event = new dom.window.Event('beforeunload', { cancelable: true });
  let defaultPrevented = false;
  event.preventDefault = () => { defaultPrevented = true; };

  dom.window.dispatchEvent(event);

  assert.equal(defaultPrevented, true);
});

test('setupSubmitHandler: displays pause message in #add .alert-warning on submit with countdown and supports cancellation', async () => {
  const html = `
    <!DOCTYPE html>
    <div id="content">
      <form id="add" action="/CollectionAddMultiplesText.cfm/sid/357729?ACTION=ADD" method="post">
        <input name="Quantity_1" value="4" />
        <button type="submit">Add</button>
        <div class="alert alert-warning" role="alert">Submit additions before navigating</div>
      </form>
    </div>
  `;
  const dom = new JSDOM(html, { url: 'https://www.tcdb.com/CollectionAddMultiplesText.cfm/sid/357729' });

  Config.global = Config.global || {};
  Config.global.addMultiplesPauseDurationMs = 3000;

  setupSubmitHandler(dom.window.document);

  const form = dom.window.document.querySelector('form#add');
  let formSubmitted = false;
  form.submit = () => { formSubmitted = true; };

  const submitEvent = new dom.window.Event('submit', { cancelable: true, bubbles: true });
  form.dispatchEvent(submitEvent);

  const warningAlert = dom.window.document.querySelector('#add .alert-warning');
  assert.ok(warningAlert !== null);
  assert.ok(warningAlert.textContent.includes('Adding 1 distinct card(s) (Total Quantity: 4)'));

  // Test Cancel button restores original alert text
  const cancelBtn = warningAlert.querySelector('#sctoolkit-cancel-add-btn');
  assert.ok(cancelBtn !== null);
  cancelBtn.click();

  assert.ok(warningAlert.textContent.includes('Submit additions before navigating'));
  assert.equal(formSubmitted, false);
});

test('checkAndHandlePostReloadSuccess: renders success message with Details button', () => {
  const html = `
    <!DOCTYPE html>
    <div id="content">
      <div class="col-md-6 nopadding">
        <div>
          <form id="add"></form>
        </div>
      </div>
    </div>
  `;
  const dom = new JSDOM(html, { url: 'https://www.tcdb.com/CollectionAddMultiplesText.cfm/sid/357729?PageIndex=2' });

  const batchData = {
    distinctRows: 1,
    totalQuantity: 2,
    pageIndex: 1,
    items: [
      { name: 'Quantity_43', cardNo: '43', player: 'Josh Jung', qty: 2 }
    ],
    timestamp: Date.now()
  };

  dom.window.sessionStorage.setItem(STORAGE_BATCH_KEY, JSON.stringify(batchData));
  Config.global = Config.global || {};
  Config.global.addMultiplesAutoAdvance = true;

  checkAndHandlePostReloadSuccess(dom.window.document);

  const alertEl = dom.window.document.querySelector('.alert.alert-success');
  assert.ok(alertEl !== null);
  assert.ok(alertEl.textContent.includes('added from Page 1'));

  const detailsBtn = alertEl.querySelector('#sctoolkit-added-details-btn');
  assert.ok(detailsBtn !== null);

  // Click Details opens modal
  detailsBtn.click();

  const modal = dom.window.document.querySelector('#sctoolkit-added-details-modal');
  assert.ok(modal !== null);
  assert.ok(modal.textContent.includes('Josh Jung'));
  assert.ok(modal.textContent.includes('43'));
});
