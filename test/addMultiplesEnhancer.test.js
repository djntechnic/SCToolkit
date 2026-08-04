import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { autoScrollIfOutsideMiddle80, initAddMultiplesEnhancer } from '../src/modules/addMultiplesEnhancer.js';
import { InputIndex } from '../src/modules/inputOptimization.js';

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

