import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import {
  ActiveObservers,
  disconnectSetListEnhancer,
  initSetListEnhancer,
  observeSetLinks
} from '../src/modules/setListEnhancer.js';

function setupDOM() {
  const dom = new JSDOM(`<!doctype html>
    <body>
      <div id="main-content-area">
        <a href="/ViewSet.cfm/sid/100/">2023 Bowman Chrome</a>
      </div>
    </body>
  `, { url: 'https://example.test/ViewAll.cfm/sid/100/' });

  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  globalThis.MutationObserver = dom.window.MutationObserver;
  return dom;
}

test('ActiveObservers: observeSetLinks registers observer and disconnectSetListEnhancer clears it', () => {
  setupDOM();
  disconnectSetListEnhancer();

  assert.equal(ActiveObservers.size, 0);

  const obs = observeSetLinks();
  assert.ok(obs, 'observer should be created');
  assert.equal(ActiveObservers.size, 1);
  assert.ok(ActiveObservers.has(obs));

  disconnectSetListEnhancer();
  assert.equal(ActiveObservers.size, 0);
});

test('initSetListEnhancer: re-initialization cleans up lingering observers', () => {
  setupDOM();

  initSetListEnhancer();
  assert.equal(ActiveObservers.size, 1, 'first init should bind 1 observer');

  initSetListEnhancer();
  assert.equal(ActiveObservers.size, 1, 're-init should disconnect previous observer and keep count at 1');

  disconnectSetListEnhancer();
  assert.equal(ActiveObservers.size, 0);
});

test('observeSetLinks: timeoutMs option automatically disconnects observer', async () => {
  setupDOM();
  disconnectSetListEnhancer();

  const obs = observeSetLinks({ timeoutMs: 50 });
  assert.ok(obs, 'observer should be returned');
  assert.equal(ActiveObservers.size, 1);

  await new Promise((resolve) => setTimeout(resolve, 100));

  assert.equal(ActiveObservers.size, 0, 'observer should be disconnected and removed from ActiveObservers after timeout');
});
