import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { Config } from "../src/core/config.js";
import {
  buildCardLadderUrl,
  CardMetadataExtractor,
  FormattedCopyPopover,
  getCardLadderDate,
  renderInlineQuickLinks,
} from "../src/modules/cardNameFormatter.js";

test("Config: contains default Player Quick Links settings", () => {
  assert.equal(
    Config.global.cardFormatterTemplate,
    "{PlayerName} - {Year} {SetName} {Tags} {PR} #{CardNo}",
  );
  assert.equal(
    Config.global.cardFormatterTSVTemplate,
    "{Year}\\t{SetName}\\t{InsertSetName}\\t{PlayerName}\\t{PlayerTeam}\\t{Tags}\\t{PR}\\t{CardNo}",
  );
  assert.equal(Config.global.cardFormatterIgnoredTags, "ASR, LL, TC, CL");
  assert.equal(Config.global.cardFormatterTagSeparator, "");
  assert.equal(Config.global.cardFormatterTagReplacer, "");
  assert.equal(Config.global.cardFormatterOutputMode, "popover");
  assert.equal(Config.global.cardFormatterLinkTarget, "background");
  assert.equal(Config.global.cardFormatterPopoverDurationMs, 4000);
  assert.equal(Config.global.cardFormatterShowCopy, true);
  assert.equal(Config.global.cardFormatterShowTSV, true);
  assert.equal(Config.global.cardFormatterShowGoogleSheet, false);
  assert.equal(
    Config.global.cardFormatterGoogleSheetId,
    "1E-lfRToeTTXyj8ht6gQVN-0DcKQusN_28U-wNaaOwDI",
  );
  assert.equal(
    Config.global.cardFormatterGoogleSheetWorksheet,
    "Singles & Lots",
  );
  assert.equal(Config.global.cardFormatterShowBRef, true);
  assert.equal(Config.global.cardFormatterShowCardLadder, true);
  assert.equal(Config.global.cardFormatterShowGoogle, true);
});

test("getCardLadderDate: calculates YYYY-MM-01 for 2 months prior", () => {
  // Test current date example (August 27, 2026 -> June 1, 2026)
  const augDate = new Date(2026, 7, 27);
  assert.equal(getCardLadderDate(augDate), "2026-06-01");

  // Test year boundary rollback (January 15, 2026 -> November 1, 2025)
  const janDate = new Date(2026, 0, 15);
  assert.equal(getCardLadderDate(janDate), "2025-11-01");

  // Test year boundary rollback (February 10, 2026 -> December 1, 2025)
  const febDate = new Date(2026, 1, 10);
  assert.equal(getCardLadderDate(febDate), "2025-12-01");

  // Test March rollback (March 31, 2026 -> January 1, 2026)
  const marDate = new Date(2026, 2, 31);
  assert.equal(getCardLadderDate(marDate), "2026-01-01");
});

test("buildCardLadderUrl: formats {Year}%20{Set}%20{CardNo} and strips # from card number", () => {
  const refDate = new Date(2026, 7, 27);

  // Standard case with # in CardNo
  const tokens1 = {
    Year: "2020",
    SetName: "Topps Update",
    CardNo: "#40",
    PlayerName: "Mike Trout",
  };
  const url1 = buildCardLadderUrl(tokens1, refDate);
  assert.equal(
    url1,
    "https://app.cardladder.com/sales-history?sort=date&direction=desc&filters=date%3Agte%3D2026-06-01&q=2020%20Topps%20Update%2040",
  );

  // Set with InsertSetName and raw card number like JMR-12
  const tokens2 = {
    Year: "2023",
    SetName: "Bowman",
    InsertSetName: "Chrome",
    CardNo: "JMR-12",
    PlayerName: "Jackson Chourio",
  };
  const url2 = buildCardLadderUrl(tokens2, refDate);
  assert.equal(
    url2,
    "https://app.cardladder.com/sales-history?sort=date&direction=desc&filters=date%3Agte%3D2026-06-01&q=2023%20Bowman%20Chrome%20JMR-12",
  );

  // Fallback to PlayerName when year/set/cardNo not present
  const tokens3 = { PlayerName: "Shohei Ohtani" };
  const url3 = buildCardLadderUrl(tokens3, refDate);
  assert.equal(
    url3,
    "https://app.cardladder.com/sales-history?sort=date&direction=desc&filters=date%3Agte%3D2026-06-01&q=Shohei%20Ohtani",
  );
});

test("CardMetadataExtractor.compile: should replace all tokens correctly when all values exist", () => {
  const template = "{PlayerName} - {Year} {SetName} {Tags} {PR} {CardNo}";
  const tokens = {
    PlayerName: "Ryne Sandberg",
    Year: "1983",
    SetName: "Topps",
    Tags: "RC",
    PR: "/100",
    CardNo: "#83",
  };

  const result = CardMetadataExtractor.compile(template, tokens);
  assert.equal(result, "Ryne Sandberg - 1983 Topps RC /100 #83");
});

test("CardMetadataExtractor.compile: should handle missing tokens gracefully without orphan delimiters", () => {
  const template = "{PlayerName} - {Year} {SetName} {Tags} {PR} {CardNo}";
  const tokens = {
    PlayerName: "Ken Griffey Jr.",
    Year: "1989",
    SetName: "Upper Deck",
    Tags: "",
    PR: "",
    CardNo: "#1",
  };

  const result = CardMetadataExtractor.compile(template, tokens);
  assert.equal(result, "Ken Griffey Jr. - 1989 Upper Deck #1");
});

test("CardMetadataExtractor.compile: should recognize \\t tokens and convert them to real tab characters", () => {
  const template =
    "{Year}\\t{SetName}\\t{InsertSetName}\\t{PlayerName}\\t{PlayerTeam}\\t{Tags}\\t{PR}\\t{CardNo}";
  const tokens = {
    Year: "2019",
    SetName: "Topps Holiday",
    InsertSetName: "Relics",
    PlayerName: "Albert Almora Jr.",
    PlayerTeam: "Chicago Cubs",
    Tags: "MEM",
    PR: "250",
    CardNo: "WHR-AA",
  };

  const result = CardMetadataExtractor.compile(template, tokens);
  assert.equal(
    result,
    "2019\tTopps Holiday\tRelics\tAlbert Almora Jr.\tChicago Cubs\tMEM\t250\tWHR-AA",
  );
});

test("CardMetadataExtractor.compile: should return empty string if tokens object is null or missing", () => {
  assert.equal(CardMetadataExtractor.compile("{PlayerName}", null), "");
  assert.equal(CardMetadataExtractor.compile("", { PlayerName: "Test" }), "");
});

test("CardMetadataExtractor.extract: DOM parsing from mock set document with Toolbar title logic", () => {
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
    <head><title>1993 SP - Foil Baseball Checklist | Trading Card Database</title></head>
    <body>
      <div id="setname-content">
        <h1>1993 SP</h1>
        <h3>Foil</h3>
      </div>
      <div id="main-content-area">
        <table>
          <tr id="test-row">
            <td><a href="ViewCard.cfm/sid/100/cid/1">#279</a></td>
            <td><a href="Person.cfm/pid/1/Derek-Jeter">Derek Jeter</a> RC SN100</td>
            <td><a href="Team.cfm/tid/1/New-York-Yankees">New York Yankees</a></td>
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
      getBoundingClientRect: () => ({
        top: 100,
        bottom: 120,
        left: 50,
        right: 150,
        width: 100,
        height: 20,
      }),
    }),
    toString: () => "Derek Jeter",
  };

  const tokens = CardMetadataExtractor.extract(selection, mockDoc);

  assert.deepEqual(tokens, {
    Year: "1993",
    SetName: "SP",
    InsertSetName: "Foil",
    PlayerName: "Derek Jeter",
    PlayerTeam: "New York Yankees",
    CardNo: "#279",
    Tags: "RC",
    PR: "100",
    Quantity: "1",
    Qty: "1",
  });
});

test("CardMetadataExtractor.extract: ignores tags in cardFormatterIgnoredTags list", () => {
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
    <head><title>2023 Bowman Baseball Checklist | Trading Card Database</title></head>
    <body>
      <div id="setname-content">
        <h1>2023 Bowman</h1>
      </div>
      <div id="main-content-area">
        <table>
          <tr id="test-row">
            <td><a href="ViewCard.cfm/sid/100/cid/1">1</a></td>
            <td><a href="Person.cfm/pid/1/Adley-Rutschman">Adley Rutschman</a> RC ASR LL TC CL MEM</td>
            <td><a href="Team.cfm/tid/1/Baltimore-Orioles">Baltimore Orioles</a></td>
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
      getBoundingClientRect: () => ({
        top: 100,
        bottom: 120,
        left: 50,
        right: 150,
        width: 100,
        height: 20,
      }),
    }),
    toString: () => "Adley Rutschman",
  };

  Config.global.cardFormatterIgnoredTags = "ASR, LL, TC, CL";
  const tokens = CardMetadataExtractor.extract(selection, mockDoc);

  assert.equal(
    tokens.Tags,
    "RC MEM",
    "ASR, LL, TC, and CL tags should be omitted",
  );
});

test("CardMetadataExtractor.extract: recognizes print run specified with PR# prefix", () => {
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
    <head><title>2019 Topps - Gold Baseball Checklist | Trading Card Database</title></head>
    <body>
      <div id="main-content-area">
        <table>
          <tr id="test-row">
            <td><a href="ViewCard.cfm/sid/100/cid/168">168</a></td>
            <td><a href="Person.cfm/pid/1/Matt-Carpenter">Matt Carpenter</a> PR2019</td>
            <td><a href="Team.cfm/tid/1/St-Louis-Cardinals">St. Louis Cardinals</a></td>
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
      getBoundingClientRect: () => ({
        top: 100,
        bottom: 120,
        left: 50,
        right: 150,
        width: 100,
        height: 20,
      }),
    }),
    toString: () => "Matt Carpenter",
  };

  const tokens = CardMetadataExtractor.extract(selection, mockDoc);
  assert.equal(tokens.PR, "2019");
  assert.equal(tokens.PlayerName, "Matt Carpenter");
});

test("CardMetadataExtractor.extract: returns null if selection is collapsed or empty", () => {
  const dom = new JSDOM("<html><body><p>Text</p></body></html>");
  const mockDoc = dom.window.document;

  const collapsedSelection = { isCollapsed: true };
  assert.equal(
    CardMetadataExtractor.extract(collapsedSelection, mockDoc),
    null,
  );

  const emptySelection = {
    isCollapsed: false,
    anchorNode: mockDoc.body.firstChild,
    toString: () => "   ",
  };
  assert.equal(CardMetadataExtractor.extract(emptySelection, mockDoc), null);
});

test("CardMetadataExtractor.extract: extracts full PlayerName and prefixes CardNo with # even on partial highlight", () => {
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
    <head><title>2022 Topps Chrome Baseball Checklist | Trading Card Database</title></head>
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
      getBoundingClientRect: () => ({
        top: 100,
        bottom: 120,
        left: 50,
        right: 150,
        width: 100,
        height: 20,
      }),
    }),
    toString: () => "uz RC",
  };

  const tokens = CardMetadataExtractor.extract(selection, mockDoc);

  assert.equal(tokens.Year, "2022");
  assert.equal(tokens.SetName, "Topps Chrome");
  assert.equal(tokens.InsertSetName, "");
  assert.equal(tokens.PlayerName, "Oneil Cruz");
  assert.equal(tokens.CardNo, "101");
  assert.equal(tokens.Tags, "RC");

  const compiled = CardMetadataExtractor.compile(
    "{PlayerName} - {Year} {SetName} {Tags} {PR} #{CardNo}",
    tokens,
  );
  assert.equal(compiled, "Oneil Cruz - 2022 Topps Chrome RC #101");
});

test("CardMetadataExtractor.extract: ignores thumbnail img links and extracts text card number", () => {
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
    <head><title>2022 Panini Select Baseball Checklist | Trading Card Database</title></head>
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
      getBoundingClientRect: () => ({
        top: 100,
        bottom: 120,
        left: 50,
        right: 150,
        width: 100,
        height: 20,
      }),
    }),
    toString: () => "ash RC",
  };

  const tokens = CardMetadataExtractor.extract(selection, mockDoc);

  assert.equal(tokens.PlayerName, "Matt Brash");
  assert.equal(tokens.CardNo, "1");
  assert.equal(tokens.Tags, "RC");

  const compiled = CardMetadataExtractor.compile(
    "{PlayerName} - {Year} {SetName} {Tags} {PR} #{CardNo}",
    tokens,
  );
  assert.equal(compiled, "Matt Brash - 2022 Panini Select RC #1");
});

test("FormattedCopyPopover.show and hide: renders and removes popover element", () => {
  const dom = new JSDOM("<html><body></body></html>");
  const mockDoc = dom.window.document;

  const selection = {
    isCollapsed: false,
    rangeCount: 1,
    getRangeAt: () => ({
      getBoundingClientRect: () => ({
        top: 50,
        bottom: 70,
        left: 100,
        right: 200,
        width: 100,
        height: 20,
      }),
    }),
  };

  FormattedCopyPopover.show(
    selection,
    "Derek Jeter - 1993 SP Foil RC /100 #279",
    mockDoc,
  );

  const popover = mockDoc.getElementById(FormattedCopyPopover.elementId);
  assert.notEqual(popover, null);
  assert.equal(popover.className, "tk-formatter-popover");

  const label = popover.querySelector(".tk-popover-label");
  assert.equal(label.textContent, "Derek Jeter - 1993 SP Foil RC /100 #279");

  const copyBtn = popover.querySelector("button.sctk-btn");
  assert.notEqual(copyBtn, null);
  assert.ok(
    copyBtn.querySelector("svg"),
    "copy button should contain SVG icon",
  );

  FormattedCopyPopover.hide(mockDoc);
  assert.equal(mockDoc.getElementById(FormattedCopyPopover.elementId), null);
});

test("FormattedCopyPopover.show: renders TSV, BRef, and Google search buttons and handles clicks", () => {
  const dom = new JSDOM("<html><body></body></html>", {
    url: "https://example.com",
  });
  const mockDoc = dom.window.document;

  let writtenText = null;
  Object.defineProperty(dom.window.navigator, "clipboard", {
    value: {
      writeText: async (txt) => {
        writtenText = txt;
      },
    },
    configurable: true,
    writable: true,
  });

  let openedUrl = null;
  let openedTarget = null;
  dom.window.open = (url, target) => {
    openedUrl = url;
    openedTarget = target;
    return {};
  };

  const selection = {
    isCollapsed: false,
    rangeCount: 1,
    getRangeAt: () => ({
      getBoundingClientRect: () => ({
        top: 50,
        bottom: 70,
        left: 100,
        right: 200,
        width: 100,
        height: 20,
      }),
    }),
  };

  const tokens = {
    Year: "2019",
    SetName: "Topps Holiday",
    InsertSetName: "Relics",
    PlayerName: "Albert Almora Jr.",
    PlayerTeam: "Chicago Cubs",
    Tags: "MEM",
    PR: "250",
    CardNo: "WHR-AA",
  };

  FormattedCopyPopover.show(
    selection,
    "Albert Almora Jr. - 2019 Topps Holiday Relics MEM 250 #WHR-AA",
    tokens,
    mockDoc,
  );

  const popover = mockDoc.getElementById(FormattedCopyPopover.elementId);
  assert.notEqual(popover, null);

  const buttons = popover.querySelectorAll("button.sctk-btn");
  assert.equal(
    buttons.length,
    5,
    "Should render copy, TSV, bref, cardladder, and google buttons",
  );

  const copyBtn = buttons[0];
  const tsvBtn = buttons[1];
  const brefBtn = buttons[2];
  const ladderBtn = buttons[3];
  const googleBtn = buttons[4];

  assert.equal(copyBtn.title, "Copy formatted text");
  assert.equal(tsvBtn.title, "Copy tab-separated values (TSV)");
  assert.equal(brefBtn.title, "Search Baseball Reference");
  assert.equal(ladderBtn.title, "Search Card Ladder");
  assert.equal(googleBtn.title, "Search Google");

  // Click TSV button
  tsvBtn.click();
  assert.equal(
    writtenText,
    "2019\tTopps Holiday\tRelics\tAlbert Almora Jr.\tChicago Cubs\tMEM\t250\tWHR-AA",
  );

  // Click BRef button
  brefBtn.click();
  assert.equal(
    openedUrl,
    "https://www.baseball-reference.com/search/search.fcgi?search=Albert+Almora+Jr.",
  );
  assert.equal(openedTarget, "_blank");

  // Click CardLadder button
  ladderBtn.click();
  assert.ok(
    openedUrl.startsWith(
      "https://app.cardladder.com/sales-history?sort=date&direction=desc&filters=date%3Agte%3D",
    ),
  );
  assert.ok(openedUrl.includes("&q=2019%20Topps%20Holiday%20Relics%20WHR-AA"));
  assert.equal(openedTarget, "_blank");

  // Click Google button
  googleBtn.click();
  assert.equal(openedUrl, "https://www.google.com/search?q=Albert+Almora+Jr.");
  assert.equal(openedTarget, "_blank");

  FormattedCopyPopover.hide(mockDoc);
});

test("FormattedCopyPopover.show: respects config settings to hide individual action buttons", () => {
  const dom = new JSDOM("<html><body></body></html>");
  const mockDoc = dom.window.document;

  const selection = {
    isCollapsed: false,
    rangeCount: 1,
    getRangeAt: () => ({
      getBoundingClientRect: () => ({
        top: 50,
        bottom: 70,
        left: 100,
        right: 200,
        width: 100,
        height: 20,
      }),
    }),
  };

  const tokens = { PlayerName: "Shohei Ohtani" };

  Config.global.cardFormatterShowCopy = false;
  Config.global.cardFormatterShowTSV = false;
  Config.global.cardFormatterShowBRef = true;
  Config.global.cardFormatterShowCardLadder = false;
  Config.global.cardFormatterShowGoogle = false;

  FormattedCopyPopover.show(selection, "Shohei Ohtani", tokens, mockDoc);

  const popover = mockDoc.getElementById(FormattedCopyPopover.elementId);
  const buttons = popover.querySelectorAll("button.sctk-btn");
  assert.equal(buttons.length, 1, "Only BRef button should be shown");
  assert.equal(buttons[0].title, "Search Baseball Reference");

  // Restore defaults
  Config.global.cardFormatterShowCopy = true;
  Config.global.cardFormatterShowTSV = true;
  Config.global.cardFormatterShowBRef = true;
  Config.global.cardFormatterShowCardLadder = true;
  Config.global.cardFormatterShowGoogle = true;

  FormattedCopyPopover.hide(mockDoc);
});

test("renderInlineQuickLinks: renders small in-line buttons across submitted fixtures without row height inflation", () => {
  const fixtures = [
    "ViewCollection.html",
    "ViewCollectionForSaleTrade.html",
    "ViewCollectionPWantlist.html",
    "ViewCollectionWantlist.html",
    "Collection.html",
    "CollectionAddMultiplesText.html",
    "CollectionAddMultiples.html",
    "CollectionBrowse.html",
    "ViewCollectionForSaleTrade-2019Bowman.html",
    "ViewCollectionForSaleTrade-2019BowmanMulti.html",
  ];

  fixtures.forEach((file) => {
    const filePath = path.join(process.cwd(), "test/fixtures/submitted", file);
    if (!fs.existsSync(filePath)) return;
    const html = fs.readFileSync(filePath, "utf8");
    const dom = new JSDOM(html, {
      url: "https://www.tcdb.com/ViewCollection.cfm",
    });
    const mockDoc = dom.window.document;

    renderInlineQuickLinks(mockDoc);

    const inlineContainers = mockDoc.querySelectorAll(
      ".tk-player-quick-links-inline",
    );
    if (file === "Collection.html") {
      assert.equal(
        inlineContainers.length,
        0,
        "Collection.html has no card rows",
      );
    } else {
      assert.ok(
        inlineContainers.length > 0,
        `${file} should have inline quick link containers injected`,
      );
      const container = inlineContainers[0];
      const buttons = container.querySelectorAll("button.sctk-inline-btn");
      assert.equal(
        buttons.length,
        5,
        `${file} row container should include 5 action buttons (copy, tsv, bref, cardladder, google)`,
      );

      // Verify inline buttons container is placed under Player/Subject cell, not Team or Card No
      const parentCellText = container.parentElement.textContent
        .replace("Add to Collection", "")
        .trim();
      assert.ok(
        !parentCellText.includes("Twins") &&
          !parentCellText.includes("Red Sox"),
        `${file}: inline container should not be placed in team cell`,
      );
    }
  });
});

test("renderInlineQuickLinks: button click triggers clipboard copy and handles link opening", () => {
  const dom = new JSDOM(
    `
    <!DOCTYPE html>
    <html>
    <head><title>2023 Bowman Baseball Checklist | Trading Card Database</title></head>
    <body>
      <div id="main-content-area">
        <table>
          <tr>
            <td><a href="ViewCard.cfm/sid/357729/cid/21211725">2</a></td>
            <td><a href="Person.cfm/pid/1/Triston-Casas">Triston Casas</a> RC</td>
            <td><a href="Team.cfm/tid/1/Boston-Red-Sox">Boston Red Sox</a></td>
          </tr>
        </table>
      </div>
    </body>
    </html>
  `,
    { url: "https://www.tcdb.com/Checklist.cfm" },
  );
  const mockDoc = dom.window.document;

  let writtenText = null;
  Object.defineProperty(dom.window.navigator, "clipboard", {
    value: {
      writeText: async (txt) => {
        writtenText = txt;
      },
    },
    configurable: true,
    writable: true,
  });

  Config.global.cardFormatterLinkTarget = "focus";
  renderInlineQuickLinks(mockDoc);

  const container = mockDoc.querySelector(".tk-player-quick-links-inline");
  assert.notEqual(container, null);

  // Verify container is in td[1] (Player cell), not td[0] (Card No) or td[2] (Team)
  const cellIndex = Array.from(
    container.parentElement.parentElement.children,
  ).indexOf(container.parentElement);
  assert.equal(
    cellIndex,
    1,
    "Inline container must be injected into player/subject cell",
  );

  const buttons = container.querySelectorAll("button.sctk-inline-btn");
  assert.equal(buttons.length, 5);

  const copyBtn = buttons[0];
  const tsvBtn = buttons[1];

  copyBtn.click();
  assert.ok(writtenText.includes("Triston Casas"));

  tsvBtn.click();
  assert.ok(writtenText.includes("\tTriston Casas\t"));

  // Reset link target to background
  Config.global.cardFormatterLinkTarget = "background";
});

test("renderInlineQuickLinks: places container in player cell even when row has dropdown action links with CardID=", () => {
  const dom = new JSDOM(
    `
    <!DOCTYPE html>
    <html>
    <body>
      <table>
        <tr class="collection_row">
          <td>1</td>
          <td><img src="thumb.jpg"></td>
          <td><button>v</button></td>
          <td>
            <a href="CollectionAddO.cfm?Type=Baseball&SetID=204993&CardID=13091014">Add to Collection</a>
            <a href="CollectionAddOFST.cfm?Type=Baseball&SetID=204993&CardID=13091014">Add to For Sale</a>
          </td>
          <td><a href="ViewCard.cfm/sid/204993/cid/13091014">BCP-138</a></td>
          <td><a href="ViewCard.cfm/sid/204993/cid/13091014">Alex Kirilloff</a></td>
          <td><a href="ViewCard.cfm/sid/204993/cid/13091014">Minnesota Twins</a></td>
        </tr>
      </table>
    </body>
    </html>
  `,
    { url: "https://www.tcdb.com/ViewCollectionForSaleTrade.cfm/sid/204993" },
  );
  const mockDoc = dom.window.document;

  renderInlineQuickLinks(mockDoc);

  const container = mockDoc.querySelector(".tk-player-quick-links-inline");
  assert.notEqual(container, null);

  // Target cell should be td[5] (Alex Kirilloff), NOT td[3] (Action links dropdown)
  const cellIndex = Array.from(
    container.parentElement.parentElement.children,
  ).indexOf(container.parentElement);
  assert.equal(
    cellIndex,
    5,
    "Inline container must be injected into Player cell (td[5]), not dropdown cell (td[3])",
  );
  assert.ok(container.parentElement.textContent.includes("Alex Kirilloff"));
});

test("CardMetadataExtractor.extract: retains PlayerTeam when PlayerName matches TeamName (e.g. New York Yankees)", () => {
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
    <head><title>2020 Topps Baseball Checklist | Trading Card Database</title></head>
    <body>
      <div id="setname-content">
        <h1>2020 Topps</h1>
      </div>
      <div id="main-content-area">
        <table>
          <tr id="test-row">
            <td><a href="ViewCard.cfm/sid/209948/cid/14198249">83</a></td>
            <td><a href="ViewCard.cfm/sid/209948/cid/14198249">New York Yankees</a> TC</td>
            <td><a href="ViewCard.cfm/sid/209948/cid/14198249">New York Yankees</a></td>
          </tr>
        </table>
      </div>
    </body>
    </html>
  `);
  const mockDoc = dom.window.document;
  const subjectLink = mockDoc.querySelectorAll('a[href*="ViewCard.cfm"]')[1];

  const selection = {
    isCollapsed: false,
    anchorNode: subjectLink.firstChild,
    rangeCount: 1,
    getRangeAt: () => ({
      getBoundingClientRect: () => ({
        top: 100,
        bottom: 120,
        left: 50,
        right: 150,
        width: 100,
        height: 20,
      }),
    }),
    toString: () => "New York Yankees",
  };

  const tokens = CardMetadataExtractor.extract(selection, mockDoc);

  assert.equal(tokens.PlayerName, "New York Yankees");
  assert.equal(
    tokens.PlayerTeam,
    "New York Yankees",
    "PlayerTeam should not be omitted when it matches PlayerName",
  );
  assert.equal(tokens.CardNo, "83");

  const tsvTemplate =
    "{Year}\\t{SetName}\\t{InsertSetName}\\t{PlayerName}\\t{PlayerTeam}\\t{Tags}\\t{PR}\\t{CardNo}";
  const compiled = CardMetadataExtractor.compile(tsvTemplate, tokens);
  assert.equal(
    compiled,
    "2020\tTopps\t\tNew York Yankees\tNew York Yankees\t\t\t83",
  );
});

test("CardMetadataExtractor.extract: preserves VAR tag when card has SP, VAR or SSP, VAR and figcaption", () => {
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
    <head><title>2020 Topps Baseball Checklist | Trading Card Database</title></head>
    <body>
      <div id="setname-content">
        <h1>2020 Topps</h1>
      </div>
      <div id="main-content-area">
        <table>
          <tr id="test-row-1">
            <td><a href="ViewCard.cfm/sid/209948/cid/14198243">78</a></td>
            <td>
              <a href="ViewCard.cfm/sid/209948/cid/14198243">Bo Bichette</a> SP, VAR<br>
              <figcaption class="figure-caption">VAR: Player's Weekend uniform</figcaption>
            </td>
            <td><a href="Team.cfm/tid/1/Toronto-Blue-Jays">Toronto Blue Jays</a></td>
          </tr>
          <tr id="test-row-2">
            <td><a href="ViewCard.cfm/sid/209948/cid/14198244">78</a></td>
            <td>
              <a href="ViewCard.cfm/sid/209948/cid/14198244">Bo Bichette</a> SSP, VAR<br>
              <figcaption class="figure-caption">VAR: Close up</figcaption>
            </td>
            <td><a href="Team.cfm/tid/1/Toronto-Blue-Jays">Toronto Blue Jays</a></td>
          </tr>
        </table>
      </div>
    </body>
    </html>
  `);
  const mockDoc = dom.window.document;
  const row1Link = mockDoc.querySelector('#test-row-1 a[href*="ViewCard.cfm"]');
  const row2Link = mockDoc.querySelector('#test-row-2 a[href*="ViewCard.cfm"]');

  const selection1 = {
    isCollapsed: false,
    anchorNode: row1Link.firstChild,
    toString: () => "Bo Bichette",
  };
  const tokens1 = CardMetadataExtractor.extract(selection1, mockDoc);
  assert.equal(tokens1.PlayerName, "Bo Bichette");
  assert.equal(
    tokens1.Tags,
    "SP VAR",
    "VAR tag should be preserved alongside SP",
  );

  const selection2 = {
    isCollapsed: false,
    anchorNode: row2Link.firstChild,
    toString: () => "Bo Bichette",
  };
  const tokens2 = CardMetadataExtractor.extract(selection2, mockDoc);
  assert.equal(tokens2.PlayerName, "Bo Bichette");
  assert.equal(
    tokens2.Tags,
    "SSP VAR",
    "VAR tag should be preserved alongside SSP",
  );
});

test("CardMetadataExtractor.extract: parses CollectionAddMultiplesText-TeamCL.html fixture for Team cards and VAR cards", () => {
  const filePath = path.join(
    process.cwd(),
    "test/fixtures/submitted/CollectionAddMultiplesText-TeamCL.html",
  );
  if (!fs.existsSync(filePath)) return;
  const html = fs.readFileSync(filePath, "utf8");
  const dom = new JSDOM(html, {
    url: "https://www.tcdb.com/CollectionAddMultiplesText.cfm",
  });
  const mockDoc = dom.window.document;

  // Test Row 83: New York Yankees (Team card)
  const yankeesRow = Array.from(mockDoc.querySelectorAll("tr")).find(
    (r) =>
      r.textContent.includes("83") &&
      r.textContent.includes("New York Yankees"),
  );
  assert.ok(yankeesRow, "Should find row for New York Yankees card 83");

  const yankeesLink = yankeesRow.querySelector("a");
  const yankeesSel = {
    isCollapsed: false,
    anchorNode: yankeesLink.firstChild,
    toString: () => "New York Yankees",
  };
  const yankeesTokens = CardMetadataExtractor.extract(yankeesSel, mockDoc);
  assert.equal(yankeesTokens.PlayerName, "New York Yankees");
  assert.equal(yankeesTokens.PlayerTeam, "New York Yankees");
  assert.equal(yankeesTokens.CardNo, "83");

  // Test Row 78: Bo Bichette SSP, VAR
  const bichetteVarRow = Array.from(mockDoc.querySelectorAll("tr")).find(
    (r) => r.textContent.includes("78") && r.textContent.includes("SSP, VAR"),
  );
  assert.ok(bichetteVarRow, "Should find row for Bo Bichette SSP, VAR card 78");

  const bichetteLink = bichetteVarRow.querySelector("a");
  const bichetteSel = {
    isCollapsed: false,
    anchorNode: bichetteLink.firstChild,
    toString: () => "Bo Bichette",
  };
  const bichetteTokens = CardMetadataExtractor.extract(bichetteSel, mockDoc);
  assert.equal(bichetteTokens.PlayerName, "Bo Bichette");
  assert.equal(bichetteTokens.PlayerTeam, "Toronto Blue Jays");
  assert.equal(bichetteTokens.Tags, "SSP VAR");
});

test("CardMetadataExtractor.extract: cardFormatterTagSeparator formats multiple tags with custom delimiter", () => {
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
    <head><title>2020 Topps Baseball Checklist | Trading Card Database</title></head>
    <body>
      <div id="main-content-area">
        <table>
          <tr id="test-row">
            <td><a href="ViewCard.cfm/sid/1/cid/1">78</a></td>
            <td>
              <a href="ViewCard.cfm/sid/1/cid/1">Bo Bichette</a> RC SP VAR
            </td>
            <td><a href="Team.cfm/tid/1/Toronto-Blue-Jays">Toronto Blue Jays</a></td>
          </tr>
        </table>
      </div>
    </body>
    </html>
  `);
  const mockDoc = dom.window.document;
  const link = mockDoc.querySelector('a[href*="ViewCard.cfm"]');
  const sel = {
    isCollapsed: false,
    anchorNode: link.firstChild,
    toString: () => "Bo Bichette",
  };

  // 1. Default (blank) resolves to single space " "
  Config.global.cardFormatterTagSeparator = "";
  const tokensDefault = CardMetadataExtractor.extract(sel, mockDoc);
  assert.equal(tokensDefault.Tags, "RC SP VAR");

  // 2. Custom comma separator ", "
  Config.global.cardFormatterTagSeparator = ", ";
  const tokensComma = CardMetadataExtractor.extract(sel, mockDoc);
  assert.equal(tokensComma.Tags, "RC, SP, VAR");

  // 3. Custom semicolon separator "; "
  Config.global.cardFormatterTagSeparator = "; ";
  const tokensSemicolon = CardMetadataExtractor.extract(sel, mockDoc);
  assert.equal(tokensSemicolon.Tags, "RC; SP; VAR");

  // 4. Custom hyphen separator "-"
  Config.global.cardFormatterTagSeparator = "-";
  const tokensHyphen = CardMetadataExtractor.extract(sel, mockDoc);
  assert.equal(tokensHyphen.Tags, "RC-SP-VAR");

  // Reset
  Config.global.cardFormatterTagSeparator = "";
});

test("CardMetadataExtractor.extract: cardFormatterTagReplacer replaces matching tags based on left-side key", () => {
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
    <head><title>2020 Topps Baseball Checklist | Trading Card Database</title></head>
    <body>
      <div id="main-content-area">
        <table>
          <tr id="test-row">
            <td><a href="ViewCard.cfm/sid/1/cid/1">10</a></td>
            <td>
              <a href="ViewCard.cfm/sid/1/cid/1">Shohei Ohtani</a> AU SP
            </td>
            <td><a href="Team.cfm/tid/1/Los-Angeles-Angels">Los Angeles Angels</a></td>
          </tr>
        </table>
      </div>
    </body>
    </html>
  `);
  const mockDoc = dom.window.document;
  const link = mockDoc.querySelector('a[href*="ViewCard.cfm"]');
  const sel = {
    isCollapsed: false,
    anchorNode: link.firstChild,
    toString: () => "Shohei Ohtani",
  };

  // 1. Tag replacer replaces AU with AUTO
  Config.global.cardFormatterTagReplacer = "AU: AUTO";
  Config.global.cardFormatterTagSeparator = " ";
  const tokens1 = CardMetadataExtractor.extract(sel, mockDoc);
  assert.equal(tokens1.Tags, "AUTO SP");

  // 2. Multiple tag replacements (case-insensitive left-side keys)
  Config.global.cardFormatterTagReplacer = "au: AUTOGRAPH, sp: SHORT PRINT";
  Config.global.cardFormatterTagSeparator = ", ";
  const tokens2 = CardMetadataExtractor.extract(sel, mockDoc);
  assert.equal(tokens2.Tags, "AUTOGRAPH, SHORT PRINT");

  // 3. Replacement tag in ignored tags list is excluded
  Config.global.cardFormatterIgnoredTags = "ASR, LL, TC, CL, EXCLUDED";
  Config.global.cardFormatterTagReplacer = "AU: EXCLUDED, SP: SHORT PRINT";
  const tokens3 = CardMetadataExtractor.extract(sel, mockDoc);
  assert.equal(tokens3.Tags, "SHORT PRINT");

  // Reset
  Config.global.cardFormatterIgnoredTags = "ASR, LL, TC, CL";
  Config.global.cardFormatterTagSeparator = "";
  Config.global.cardFormatterTagReplacer = "";
});
