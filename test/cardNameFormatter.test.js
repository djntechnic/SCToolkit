import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { CardMetadataExtractor, FormattedCopyPopover } from '../src/modules/cardNameFormatter.js';
import { Config } from '../src/core/config.js';

test('Config: contains default Card Name Formatter settings', () => {
  assert.equal(Config.global.cardFormatterTemplate, '{PlayerName} - {Year} {SetName} {Tags} {PR} #{CardNo}');
  assert.equal(Config.global.cardFormatterOutputMode, 'popover');
  assert.equal(Config.global.cardFormatterPopoverDurationMs, 4000);
});

test('CardMetadataExtractor.compile: should replace all tokens correctly when all values exist', () => {
  const template = '{PlayerName} - {Year} {SetName} {Tags} {PR} {CardNo}';
  const tokens = {
    PlayerName: 'Ryne Sandberg',
    Year: '1983',
    SetName: 'Topps',
    Tags: 'RC',
    PR: '/100',
    CardNo: '#83'
  };

  const result = CardMetadataExtractor.compile(template, tokens);
  assert.equal(result, 'Ryne Sandberg - 1983 Topps RC /100 #83');
});

test('CardMetadataExtractor.compile: should handle missing tokens gracefully without orphan delimiters', () => {
  const template = '{PlayerName} - {Year} {SetName} {Tags} {PR} {CardNo}';
  const tokens = {
    PlayerName: 'Ken Griffey Jr.',
    Year: '1989',
    SetName: 'Upper Deck',
    Tags: '',
    PR: '',
    CardNo: '#1'
  };

  const result = CardMetadataExtractor.compile(template, tokens);
  assert.equal(result, 'Ken Griffey Jr. - 1989 Upper Deck #1');
});

test('CardMetadataExtractor.compile: should return empty string if tokens object is null or missing', () => {
  assert.equal(CardMetadataExtractor.compile('{PlayerName}', null), '');
  assert.equal(CardMetadataExtractor.compile('', { PlayerName: 'Test' }), '');
});

test('CardMetadataExtractor.extract: DOM parsing from mock set document', () => {
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
    <body>
      <div id="setname-content">
        <h1>1993 SP - Cards</h1>
        <h3>Foil</h3>
      </div>
      <div id="main-content-area">
        <table>
          <tr id="test-row">
            <td><a href="ViewCard.cfm/sid/100/cid/1">#279</a></td>
            <td><a href="Person.cfm/pid/1/Derek-Jeter">Derek Jeter</a> RC SN100</td>
          </tr>
        </table>
      </div>
    </body>
    </html>
  `);
  const mockDoc = dom.window.document;
  const personLink = mockDoc.querySelector('a[href*="Person.cfm"]');

  const selection = {
    isCollapsed: false,
    anchorNode: personLink.firstChild,
    rangeCount: 1,
    getRangeAt: () => ({
      getBoundingClientRect: () => ({ top: 100, bottom: 120, left: 50, right: 150, width: 100, height: 20 })
    }),
    toString: () => 'Derek Jeter'
  };

  const tokens = CardMetadataExtractor.extract(selection, mockDoc);

  assert.deepEqual(tokens, {
    Year: '1993',
    SetName: 'SP Foil',
    PlayerName: 'Derek Jeter',
    CardNo: '#279',
    Tags: 'RC',
    PR: '/100'
  });
});

test('CardMetadataExtractor.extract: returns null if selection is collapsed or empty', () => {
  const dom = new JSDOM('<html><body><p>Text</p></body></html>');
  const mockDoc = dom.window.document;

  const collapsedSelection = { isCollapsed: true };
  assert.equal(CardMetadataExtractor.extract(collapsedSelection, mockDoc), null);

  const emptySelection = {
    isCollapsed: false,
    anchorNode: mockDoc.body.firstChild,
    toString: () => '   '
  };
  assert.equal(CardMetadataExtractor.extract(emptySelection, mockDoc), null);
});

test('CardMetadataExtractor.extract: extracts full PlayerName and prefixes CardNo with # even on partial highlight', () => {
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
    <body>
      <div id="setname-content">
        <h1>2022 Topps Chrome - Cards</h1>
      </div>
      <div id="main-content-area">
        <table>
          <tr id="test-row">
            <td><a href="ViewCard.cfm/sid/100/cid/1">101</a></td>
            <td><a href="Person.cfm/pid/1/Oneil-Cruz">Oneil Cruz</a> RC</td>
          </tr>
        </table>
      </div>
    </body>
    </html>
  `);
  const mockDoc = dom.window.document;
  const personLink = mockDoc.querySelector('a[href*="Person.cfm"]');

  // User partially highlights "uz RC"
  const selection = {
    isCollapsed: false,
    anchorNode: personLink.firstChild,
    rangeCount: 1,
    getRangeAt: () => ({
      getBoundingClientRect: () => ({ top: 100, bottom: 120, left: 50, right: 150, width: 100, height: 20 })
    }),
    toString: () => 'uz RC'
  };

  const tokens = CardMetadataExtractor.extract(selection, mockDoc);

  assert.equal(tokens.PlayerName, 'Oneil Cruz');
  assert.equal(tokens.CardNo, '101');
  assert.equal(tokens.Tags, 'RC');

  const compiled = CardMetadataExtractor.compile('{PlayerName} - {Year} {SetName} {Tags} {PR} #{CardNo}', tokens);
  assert.equal(compiled, 'Oneil Cruz - 2022 Topps Chrome RC #101');
});

test('CardMetadataExtractor.extract: ignores thumbnail img links and extracts text card number', () => {
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
    <body>
      <div id="setname-content">
        <h1>2022 Panini Select - Cards</h1>
      </div>
      <div id="main-content-area">
        <table>
          <tr id="test-row">
            <td><a href="ViewCard.cfm/sid/1/cid/100"><img src="front.jpg" /></a></td>
            <td><a href="ViewCard.cfm/sid/1/cid/100"><img src="back.jpg" /></a></td>
            <td><a href="ViewCard.cfm/sid/1/cid/100">1</a></td>
            <td><a href="Person.cfm/pid/2/Matt-Brash">Matt Brash</a> RC</td>
          </tr>
        </table>
      </div>
    </body>
    </html>
  `);
  const mockDoc = dom.window.document;
  const personLink = mockDoc.querySelector('a[href*="Person.cfm"]');

  const selection = {
    isCollapsed: false,
    anchorNode: personLink.firstChild,
    rangeCount: 1,
    getRangeAt: () => ({
      getBoundingClientRect: () => ({ top: 100, bottom: 120, left: 50, right: 150, width: 100, height: 20 })
    }),
    toString: () => 'ash RC'
  };

  const tokens = CardMetadataExtractor.extract(selection, mockDoc);

  assert.equal(tokens.PlayerName, 'Matt Brash');
  assert.equal(tokens.CardNo, '1');
  assert.equal(tokens.Tags, 'RC');

  const compiled = CardMetadataExtractor.compile('{PlayerName} - {Year} {SetName} {Tags} {PR} #{CardNo}', tokens);
  assert.equal(compiled, 'Matt Brash - 2022 Panini Select RC #1');
});

test('FormattedCopyPopover.show and hide: renders and removes popover element', () => {
  const dom = new JSDOM('<html><body></body></html>');
  const mockDoc = dom.window.document;

  const selection = {
    isCollapsed: false,
    rangeCount: 1,
    getRangeAt: () => ({
      getBoundingClientRect: () => ({ top: 50, bottom: 70, left: 100, right: 200, width: 100, height: 20 })
    })
  };

  FormattedCopyPopover.show(selection, 'Derek Jeter - 1993 SP Foil RC /100 #279', mockDoc);

  const popover = mockDoc.getElementById(FormattedCopyPopover.elementId);
  assert.notEqual(popover, null);
  assert.equal(popover.className, 'tk-formatter-popover');

  const label = popover.querySelector('.tk-popover-label');
  assert.equal(label.textContent, 'Derek Jeter - 1993 SP Foil RC /100 #279');

  const copyBtn = popover.querySelector('button.sctk-btn');
  assert.notEqual(copyBtn, null);
  assert.ok(copyBtn.querySelector('svg'), 'copy button should contain SVG icon');

  FormattedCopyPopover.hide(mockDoc);
  assert.equal(mockDoc.getElementById(FormattedCopyPopover.elementId), null);
});
