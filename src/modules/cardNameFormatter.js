/**
 * Contextual Card Name Formatter Engine for Cards & Highlights.
 *
 * Dynamically extracts card metadata based on user text selection, compiles it
 * according to a user-defined token template, and outputs via floating popover
 * or direct clipboard auto-copy.
 */

import { Config } from "../core/config.js";
import { Log } from "../core/log.js";
import { Utils } from "../core/utils.js";
import { sendToGoogleSheet } from "../net/googleSheets.js";
import { debounce } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { showToast } from "../ui/toast.js";
import { cleanDocTitle } from "../ui/toolbar.js";

/**
 * Resolve full set title using Toolbar title logic.
 * @param {Document} [doc=document]
 * @returns {string}
 */
export function getToolbarTitle(doc = document) {
  const rawTitle = doc ? doc.title : "";
  let title = cleanDocTitle(rawTitle);

  const genericLabels = [
    "",
    "collection",
    "change log",
    "forum",
    "change log prices",
    "recently added",
    "inaccuracy reports",
    "sctoolkit active",
    "set view",
    "browse",
  ];

  if (!title || genericLabels.includes(title.toLowerCase())) {
    const setWrapperTitle = doc.querySelector?.(".set-title, #setHeader .set-title");
    if (setWrapperTitle && setWrapperTitle.textContent.trim()) {
      title = cleanDocTitle(setWrapperTitle.textContent.trim());
    }
  }

  if (!title || genericLabels.includes(title.toLowerCase())) {
    const setHeader =
      doc.querySelector?.("#setname-content h1") ||
      doc.querySelector?.("#main-content-area h2") ||
      doc.querySelector?.("#main-content-area h1") ||
      doc.querySelector?.("h1.site");
    const subHeader =
      doc.querySelector?.("#setname-content h3") ||
      doc.querySelector?.("#main-content-area h3");

    if (
      setHeader &&
      !setHeader.textContent.toLowerCase().includes("set links") &&
      !setHeader.textContent.toLowerCase().includes("change log")
    ) {
      title = setHeader.textContent.replace(/\s*-\s*Cards$/i, "").trim();
    }

    if (
      subHeader &&
      title &&
      !title.toLowerCase().includes(subHeader.textContent.trim().toLowerCase())
    ) {
      title += ` - ${subHeader.textContent.trim()}`;
    }
  }

  return title;
}

function isActionLink(a) {
  const href = a?.href || "";
  return (
    href.includes("CollectionAdd") ||
    href.includes("CollectionEdit") ||
    href.includes("CollectionWant") ||
    href.includes("CollectionStatus") ||
    href.includes("CollectionMove") ||
    href.includes("CollectionRemove") ||
    href.includes("SalesLinks") ||
    href.includes("MODE=") ||
    href.includes("Team.cfm") ||
    href.includes("Person.cfm")
  );
}

function getCleanCellText(cell) {
  if (!cell) return "";
  const doc = cell.ownerDocument || (typeof document !== "undefined" ? document : null);
  const clone = cell.cloneNode(true);
  clone.querySelectorAll(".tk-player-quick-links-inline, figcaption, .figure-caption").forEach((el) => el.remove());
  if (doc) {
    clone.querySelectorAll("br").forEach((br) => {
      const space = doc.createTextNode(" ");
      br.parentNode?.replaceChild(space, br);
    });
  }
  return clone.textContent.replace(/\s+/g, " ").trim();
}

/**
 * Contextual Metadata Extractor and Compiler.
 */
export const CardMetadataExtractor = {
  /**
   * Extract token values for a given window Selection
   * @param {Selection} selection
   * @param {Document} [doc=document] - Document object (supports mock DOM in tests)
   * @returns {Object|null} Token dictionary or null if invalid
   */
  extract: function (selection, doc = document) {
    if (!selection || selection.isCollapsed) return null;

    const anchorNode = selection.anchorNode;
    if (!anchorNode) return null;

    const containerEl =
      anchorNode.nodeType === 1 ? anchorNode : anchorNode.parentElement;

    if (!containerEl) return null;

    // Locate closest tabular row or content item container
    const row = containerEl.closest("tr, .yourcol-item, #main-content-area");
    if (!row) return null;

    const selectedText = selection.toString().trim();
    if (!selectedText) return null;

    // 1. Year, Set Name & Insert Set Name Resolution via Toolbar Title Logic
    const toolbarTitle = getToolbarTitle(doc);
    let year = "";
    let setName = "";
    let insertSetName = "";

    if (toolbarTitle) {
      const yearMatch = toolbarTitle.match(/^(\d{4}(?:-\d{2,4})?)\s+(.+)/);
      if (yearMatch) {
        year = yearMatch[1];
        const rest = yearMatch[2];
        const dashIdx = rest.indexOf("-");
        if (dashIdx !== -1) {
          setName = rest.slice(0, dashIdx).trim();
          insertSetName = rest.slice(dashIdx + 1).trim();
        } else {
          setName = rest.trim();
        }
      } else {
        const dashIdx = toolbarTitle.indexOf("-");
        if (dashIdx !== -1) {
          setName = toolbarTitle.slice(0, dashIdx).trim();
          insertSetName = toolbarTitle.slice(dashIdx + 1).trim();
        } else {
          setName = toolbarTitle.trim();
        }
      }
    }

    // 2. Card Number Resolution
    let cardNo = "";
    let cardLink = null;
    const cardLinks = Array.from(
      row.querySelectorAll(
        'a[href*="ViewCard.cfm"], a[href*="/cid/"], a[href*="CollectionCard.cfm"]',
      ),
    ).filter(
      (a) =>
        !a.querySelector("img") &&
        !a.querySelector("i") &&
        a.textContent.trim().length > 0 &&
        !isActionLink(a),
    );

    if (cardLinks.length > 0) {
      cardNo = cardLinks[0].textContent.trim();
      cardLink = cardLinks[0];
    } else {
      const firstTd = row.querySelector("td");
      if (firstTd) {
        const text = firstTd.textContent.trim();
        if (
          /^#?[A-Z0-9-]{1,10}$/i.test(text) &&
          !firstTd.querySelector("img")
        ) {
          cardNo = text;
        }
      }
    }

    // 3. Tags & Print Run Parsing
    let tags = "";
    let printRun = "";
    const personLink = row.querySelector('a[href*="Person.cfm"]');
    const teamLink = row.querySelector('a[href*="Team.cfm"]');

    const ignoredTagsRaw = Config.global.cardFormatterIgnoredTags ?? "ASR, LL, TC, CL";
    const ignoredTagsSet = new Set(
      String(ignoredTagsRaw)
        .split(",")
        .map((t) => t.trim().toUpperCase())
        .filter(Boolean)
    );

    const tagSeparatorRaw = Config.global.cardFormatterTagSeparator;
    const tagSeparator =
      tagSeparatorRaw !== undefined &&
      tagSeparatorRaw !== null &&
      String(tagSeparatorRaw) !== ""
        ? String(tagSeparatorRaw)
        : " ";

    const tagReplacerRaw = Config.global.cardFormatterTagReplacer ?? "";
    const tagReplacements = new Map();
    if (tagReplacerRaw) {
      String(tagReplacerRaw)
        .split(/,|\n/)
        .forEach((pair) => {
          const colonIdx = pair.indexOf(":");
          if (colonIdx !== -1) {
            const key = pair.slice(0, colonIdx).trim().toUpperCase();
            const val = pair.slice(colonIdx + 1).trim();
            if (key && val) {
              tagReplacements.set(key, val);
            }
          }
        });
    }

    const subjectTd = personLink
      ? personLink.closest("td")
      : cardLink
        ? cardLink.closest("td")?.nextElementSibling
        : null;

    if (subjectTd) {
      const rawSubject = getCleanCellText(subjectTd);
      const tokens = rawSubject.split(" ");
      const tagParts = [];

      tokens.forEach((token) => {
        const clean = token.replace(/,/g, "").trim();
        if (/^(?:SN|PR)\d+$/i.test(clean)) {
          printRun = clean.replace(/^(?:SN|PR)/i, "");
        } else if (
          /^[A-Z0-9]{2,4}$/.test(clean) &&
          !/^(Jr|Sr|II|III|IV|V)$/i.test(clean)
        ) {
          const upperClean = clean.toUpperCase();
          let targetTag = clean;
          if (tagReplacements.has(upperClean)) {
            targetTag = tagReplacements.get(upperClean);
          }
          if (targetTag && !ignoredTagsSet.has(targetTag.toUpperCase())) {
            tagParts.push(targetTag);
          }
        }
      });
      tags = tagParts.join(tagSeparator);
    }

    // 4. Player / Subject Name Resolution
    let playerName = "";
    if (personLink) {
      playerName = personLink.textContent.trim();
    } else if (cardLinks.length >= 2) {
      playerName = cardLinks[1].textContent.trim();
    }

    if (!playerName && subjectTd) {
      let rawName = getCleanCellText(subjectTd);
      if (printRun) {
        rawName = rawName.replace(new RegExp(`\\b(?:SN|PR)${printRun}\\b`, "i"), "");
      }
      if (tags) {
        const tagList = tags.split(tagSeparator);
        tagList.forEach((t) => {
          const trimmedTag = String(t).trim();
          if (!trimmedTag) return;
          const escT = trimmedTag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          rawName = rawName.replace(new RegExp(`\\b${escT}\\b`, "g"), "");
        });
      }
      playerName = rawName.replace(/\s+/g, " ").trim();
    }

    if (!playerName) {
      playerName = selectedText;
      if (cardNo) {
        const cleanCardNo = cardNo.replace(/^#/, "");
        const escapeRegExp = (s) =>
          String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const prefixRegex = new RegExp(
          `^(?:#?${escapeRegExp(cardNo)}|#?${escapeRegExp(cleanCardNo)})\\b\\s*`,
          "i",
        );
        playerName = playerName.replace(prefixRegex, "").trim();
      }
      if (/^#?\d+[a-z]?\s+/i.test(playerName) && cardNo) {
        playerName = playerName.replace(/^#?\d+[a-z]?\s+/i, "").trim();
      }
      if (!playerName) playerName = selectedText;
    }

    // 5. Player Team Resolution
    let playerTeam = "";
    if (teamLink) {
      playerTeam = teamLink.textContent.trim();
    } else if (cardLinks.length >= 3 && !cardLinks[2].querySelector("img")) {
      const thirdText = cardLinks[2].textContent.trim();
      if (thirdText && thirdText !== cardNo) {
        playerTeam = thirdText;
      }
    } else if (subjectTd && subjectTd.nextElementSibling) {
      const nextTd = subjectTd.nextElementSibling;
      const linkInNext = nextTd.querySelector("a");
      if (linkInNext) {
        playerTeam = linkInNext.textContent.trim();
      } else {
        playerTeam = getCleanCellText(nextTd);
      }
    }

    return {
      Year: year,
      SetName: setName,
      InsertSetName: insertSetName,
      PlayerName: playerName,
      PlayerTeam: playerTeam,
      CardNo: cardNo,
      Tags: tags,
      PR: printRun ? String(printRun).replace(/^\//, "") : "",
      Quantity: "1",
      Qty: "1",
    };
  },

  /**
   * Extract token values directly from a row element.
   * @param {HTMLElement} row
   * @param {Document} [doc=document]
   * @returns {Object|null} Token dictionary or null if invalid
   */
  extractFromRow: function (row, doc = document) {
    if (!row) return null;
    const targetNode = row.querySelector("a") || row.firstChild || row;
    const fakeSelection = {
      isCollapsed: false,
      anchorNode: targetNode,
      toString: () => row.textContent.trim(),
    };
    return this.extract(fakeSelection, doc);
  },

  /**
   * Replace tokens in template string with extracted values
   * @param {string} template - Tokenized template (e.g. "{PlayerName} - {Year}")
   * @param {Object} tokens - Extracted token dictionary
   * @returns {string} Formatted output string
   */
  compile: function (template, tokens) {
    if (!tokens || !template) return "";
    const isTSV = template.includes("\t") || template.includes("\\t");
    let result = template.replace(/\\t/g, "\t");
    if (!tokens.CardNo) {
      result = result.replace(/#\{CardNo\}/g, "{CardNo}");
    }
    Object.keys(tokens).forEach((key) => {
      const pattern = new RegExp(`\\{${key}\\}`, "g");
      const val = (tokens[key] || "").trim();
      result = result.replace(pattern, val);
    });
    if (isTSV) {
      return result;
    }
    // Sanitize extra consecutive spaces and orphaned trailing/leading delimiters
    return result
      .replace(/\s+/g, " ")
      .replace(/\s+#$/, "")
      .replace(/\s+-\s+$/, "")
      .replace(/^\s+-\s+/, "")
      .replace(/\s+-\s+(?=-|\s|$)/g, " ")
      .trim();
  },
};

/**
 * Contextual Floating Popover for Quick Copy Actions
 */
export const FormattedCopyPopover = {
  elementId: "tk-card-formatter-popover",
  _dismissTimer: null,

  /**
   * Render popover near user selection coordinates
   * @param {Selection} selection
   * @param {string} formattedText
   * @param {Object|Document} [tokensOrDoc=document] - Tokens dictionary or Document object
   * @param {Document} [doc=document] - Document object
   */
  show: function (selection, formattedText, tokensOrDoc, doc) {
    const defaultDoc = typeof document !== "undefined" ? document : null;
    let tokens = null;
    let targetDoc = doc || defaultDoc;

    if (tokensOrDoc && (tokensOrDoc.nodeType === 9 || tokensOrDoc.defaultView)) {
      targetDoc = tokensOrDoc;
      tokens = null;
    } else if (tokensOrDoc && typeof tokensOrDoc === "object") {
      tokens = tokensOrDoc;
      if (!doc) targetDoc = defaultDoc;
    }

    if (!targetDoc) return;
    this.hide(targetDoc);
    if (!selection || selection.rangeCount === 0) return;

    let rect;
    try {
      const range = selection.getRangeAt(0);
      rect = range.getBoundingClientRect();
    } catch {
      return;
    }

    const win = targetDoc.defaultView || window;
    const top = (win.scrollY || 0) + rect.bottom + 6;
    const left = Math.max(10, (win.scrollX || 0) + rect.left);

    const popover = targetDoc.createElement("div");
    popover.id = this.elementId;
    popover.className = "tk-formatter-popover";
    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;

    const label = targetDoc.createElement("span");
    label.className = "tk-popover-label";
    label.textContent = formattedText;
    label.title = formattedText;
    popover.appendChild(label);

    if (Config.global.cardFormatterShowCopy !== false) {
      const copyBtn = targetDoc.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "sctk-btn";
      copyBtn.innerHTML = icon("copy");
      copyBtn.title = "Copy formatted text";
      copyBtn.setAttribute("aria-label", "Copy formatted text");

      copyBtn.addEventListener("click", () => {
        const writePromise = win.navigator?.clipboard?.writeText
          ? win.navigator.clipboard.writeText(formattedText)
          : Promise.resolve();

        writePromise
          .then(() => {
            copyBtn.innerHTML = icon("check");
            showToast({
              message: `Copied: <b>${Utils.escape.html(formattedText)}</b>`,
              variant: "success",
            });
            setTimeout(() => this.hide(targetDoc), 1000);
          })
          .catch((err) => {
            Log(`Clipboard write failed: ${err.message}`, "error");
          });
      });
      popover.appendChild(copyBtn);
    }

    if (Config.global.cardFormatterShowTSV !== false) {
      const tsvBtn = targetDoc.createElement("button");
      tsvBtn.type = "button";
      tsvBtn.className = "sctk-btn";
      tsvBtn.innerHTML = icon("tsv");
      tsvBtn.title = "Copy tab-separated values (TSV)";
      tsvBtn.setAttribute("aria-label", "Copy tab-separated values (TSV)");

      tsvBtn.addEventListener("click", () => {
        const tsvTemplate =
          Config.global.cardFormatterTSVTemplate ||
          "{Year}\\t{SetName}\\t{InsertSetName}\\t{PlayerName}\\t{PlayerTeam}\\t{Tags}\\t{PR}\\t{CardNo}";
        const tsvLine = CardMetadataExtractor.compile(tsvTemplate, tokens || {});

        const writePromise = win.navigator?.clipboard?.writeText
          ? win.navigator.clipboard.writeText(tsvLine)
          : Promise.resolve();

        writePromise
          .then(() => {
            tsvBtn.innerHTML = icon("check");
            showToast({
              message: `Copied TSV: <b>${Utils.escape.html(tsvLine)}</b>`,
              variant: "success",
            });
            setTimeout(() => this.hide(targetDoc), 1000);
          })
          .catch((err) => {
            Log(`Clipboard write failed: ${err.message}`, "error");
          });
      });
      popover.appendChild(tsvBtn);
    }

    if (Config.global.cardFormatterShowGoogleSheet) {
      const sheetsBtn = targetDoc.createElement("button");
      sheetsBtn.type = "button";
      sheetsBtn.className = "sctk-btn";
      sheetsBtn.innerHTML = icon("sheets");
      sheetsBtn.title = "Send to Google Sheet";
      sheetsBtn.setAttribute("aria-label", "Send to Google Sheet");

      sheetsBtn.addEventListener("click", async () => {
        const tsvTemplate =
          Config.global.cardFormatterTSVTemplate ||
          "{Year}\\t{SetName}\\t{InsertSetName}\\t{PlayerName}\\t{PlayerTeam}\\t{Tags}\\t{PR}\\t{CardNo}";
        const tsvLine = CardMetadataExtractor.compile(tsvTemplate, tokens || {});

        sheetsBtn.disabled = true;
        showToast({
          message: "Sending row to Google Sheet...",
          variant: "info",
        });

        const res = await sendToGoogleSheet({
          sheetId: Config.global.cardFormatterGoogleSheetId,
          worksheet: Config.global.cardFormatterGoogleSheetWorksheet,
          tsvLine: tsvLine,
          webAppUrl: Config.global.cardFormatterGoogleSheetWebAppUrl,
        });

        sheetsBtn.disabled = false;
        if (res.success) {
          sheetsBtn.innerHTML = icon("check");
          showToast({
            message: `Pasted into <b>${Utils.escape.html(res.sheetName || Config.global.cardFormatterGoogleSheetWorksheet || "Google Sheet")}</b> at cell <b>${Utils.escape.html(res.cellRef || "")}</b>`,
            variant: "success",
          });
          setTimeout(() => {
            sheetsBtn.innerHTML = icon("sheets");
            this.hide(targetDoc);
          }, 1200);
        } else {
          showToast({
            message: `Google Sheet Error: <b>${Utils.escape.html(res.message)}</b>`,
            variant: "error",
          });
        }
      });
      popover.appendChild(sheetsBtn);
    }

    const playerName = tokens?.PlayerName || "";
    if (playerName) {
      const searchQuery = encodeURIComponent(playerName.trim()).replace(/%20/g, "+");

      if (Config.global.cardFormatterShowBRef !== false) {
        const brefBtn = targetDoc.createElement("button");
        brefBtn.type = "button";
        brefBtn.className = "sctk-btn";
        brefBtn.innerHTML = icon("bref");
        brefBtn.title = "Search Baseball Reference";
        brefBtn.setAttribute("aria-label", "Search Baseball Reference");

        brefBtn.addEventListener("click", () => {
          const brefUrl = `https://www.baseball-reference.com/search/search.fcgi?search=${searchQuery}`;
          const inBackground = Config.global.cardFormatterLinkTarget !== "focus";
          Utils.openInTab(brefUrl, inBackground, win);
        });
        popover.appendChild(brefBtn);
      }

      if (Config.global.cardFormatterShowGoogle !== false) {
        const googleBtn = targetDoc.createElement("button");
        googleBtn.type = "button";
        googleBtn.className = "sctk-btn";
        googleBtn.innerHTML = icon("google");
        googleBtn.title = "Search Google";
        googleBtn.setAttribute("aria-label", "Search Google");

        googleBtn.addEventListener("click", () => {
          const googleUrl = `https://www.google.com/search?q=${searchQuery}`;
          const inBackground = Config.global.cardFormatterLinkTarget !== "focus";
          Utils.openInTab(googleUrl, inBackground, win);
        });
        popover.appendChild(googleBtn);
      }
    }

    targetDoc.body.appendChild(popover);

    const duration = Config.global.cardFormatterPopoverDurationMs || 4000;
    this._dismissTimer = setTimeout(() => {
      this.hide(targetDoc);
    }, duration);
  },

  /**
   * Remove popover element if present
   * @param {Document} [doc=document]
   */
  hide: function (doc) {
    const targetDoc = doc || (typeof document !== "undefined" ? document : null);
    if (!targetDoc) return;
    if (this._dismissTimer) {
      clearTimeout(this._dismissTimer);
      this._dismissTimer = null;
    }
    const existing = targetDoc.getElementById(this.elementId);
    if (existing) existing.remove();
  },
};

/**
 * Render inline quick links below player/card elements in table rows.
 * @param {Document} [doc=document]
 */
export function renderInlineQuickLinks(doc = document) {
  const targetDoc = doc || (typeof document !== "undefined" ? document : null);
  if (!targetDoc) return;

  const showCopy = Config.global.cardFormatterShowCopy !== false;
  const showTSV = Config.global.cardFormatterShowTSV !== false;
  const showGoogleSheet = !!Config.global.cardFormatterShowGoogleSheet;
  const showBRef = Config.global.cardFormatterShowBRef !== false;
  const showGoogle = Config.global.cardFormatterShowGoogle !== false;

  if (!showCopy && !showTSV && !showGoogleSheet && !showBRef && !showGoogle) return;

  const win = targetDoc.defaultView || (typeof window !== "undefined" ? window : null);
  const rows = targetDoc.querySelectorAll("tr, .yourcol-item");

  rows.forEach((row) => {
    if (row.querySelector("th")) return;

    if (
      row.closest?.(
        ".col-md-3, .col-md-4, nav, #topnav, #sctk-toolbar, .menu-linksV, .dropdown-menu, .modal"
      )
    )
      return;

    const personLink = row.querySelector('a[href*="Person.cfm"]');
    const cardLinks = Array.from(
      row.querySelectorAll(
        'a[href*="ViewCard.cfm"], a[href*="/cid/"], a[href*="CollectionCard.cfm"]'
      )
    ).filter(
      (a) =>
        !a.querySelector("img") &&
        !a.querySelector("i") &&
        a.textContent.trim().length > 0 &&
        !isActionLink(a)
    );

    let targetCell = null;
    let targetNode = null;

    if (personLink) {
      targetNode = personLink;
      targetCell = personLink.closest("td");
    } else if (cardLinks.length >= 2) {
      targetNode = cardLinks[1];
      targetCell = cardLinks[1].closest("td");
    } else if (cardLinks.length === 1) {
      const cardNoTd = cardLinks[0].closest("td");
      if (
        cardNoTd &&
        cardNoTd.nextElementSibling &&
        !cardNoTd.nextElementSibling.querySelector('a[href*="Team.cfm"]')
      ) {
        targetCell = cardNoTd.nextElementSibling;
        targetNode = targetCell.querySelector("a") || cardLinks[0];
      } else {
        targetNode = cardLinks[0];
        targetCell = cardNoTd;
      }
    }

    if (!targetCell) return;

    // Purge any misaligned or duplicate containers in this row outside targetCell
    const existingContainers = row.querySelectorAll(
      ".tk-player-quick-links-inline"
    );
    existingContainers.forEach((c) => {
      if (c.parentElement !== targetCell) {
        c.remove();
      }
    });

    if (targetCell.querySelector(".tk-player-quick-links-inline")) return;

    const evalNode = targetNode || targetCell;
    const fakeSelection = {
      isCollapsed: false,
      anchorNode: evalNode.firstChild || evalNode,
      toString: () => evalNode.textContent.trim(),
    };

    const tokens = CardMetadataExtractor.extract(fakeSelection, targetDoc);
    if (!tokens || !tokens.PlayerName) return;

    const template =
      Config.global.cardFormatterTemplate ||
      "{PlayerName} - {Year} {SetName} {Tags} {PR} #{CardNo}";
    const formatted = CardMetadataExtractor.compile(template, tokens);

    const inlineContainer = targetDoc.createElement("div");
    inlineContainer.className = "tk-player-quick-links-inline";

    if (showCopy && formatted) {
      const copyBtn = targetDoc.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "sctk-inline-btn";
      copyBtn.innerHTML = icon("copy");
      copyBtn.title = "Copy formatted text";
      copyBtn.setAttribute("aria-label", "Copy formatted text");

      copyBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const writePromise = win?.navigator?.clipboard?.writeText
          ? win.navigator.clipboard.writeText(formatted)
          : Promise.resolve();

        writePromise
          .then(() => {
            copyBtn.innerHTML = icon("check");
            showToast({
              message: `Copied: <b>${Utils.escape.html(formatted)}</b>`,
              variant: "success",
            });
            setTimeout(() => {
              copyBtn.innerHTML = icon("copy");
            }, 1200);
          })
          .catch((err) => {
            Log(`Clipboard write failed: ${err.message}`, "error");
          });
      });
      inlineContainer.appendChild(copyBtn);
    }

    if (showTSV) {
      const tsvBtn = targetDoc.createElement("button");
      tsvBtn.type = "button";
      tsvBtn.className = "sctk-inline-btn";
      tsvBtn.innerHTML = icon("tsv");
      tsvBtn.title = "Copy tab-separated values (TSV)";
      tsvBtn.setAttribute("aria-label", "Copy tab-separated values (TSV)");

      tsvBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const tsvTemplate =
          Config.global.cardFormatterTSVTemplate ||
          "{Year}\\t{SetName}\\t{InsertSetName}\\t{PlayerName}\\t{PlayerTeam}\\t{Tags}\\t{PR}\\t{CardNo}";
        const tsvLine = CardMetadataExtractor.compile(tsvTemplate, tokens);

        const writePromise = win?.navigator?.clipboard?.writeText
          ? win.navigator.clipboard.writeText(tsvLine)
          : Promise.resolve();

        writePromise
          .then(() => {
            tsvBtn.innerHTML = icon("check");
            showToast({
              message: `Copied TSV: <b>${Utils.escape.html(tsvLine)}</b>`,
              variant: "success",
            });
            setTimeout(() => {
              tsvBtn.innerHTML = icon("tsv");
            }, 1200);
          })
          .catch((err) => {
            Log(`Clipboard write failed: ${err.message}`, "error");
          });
      });
      inlineContainer.appendChild(tsvBtn);
    }

    if (showGoogleSheet) {
      const sheetsBtn = targetDoc.createElement("button");
      sheetsBtn.type = "button";
      sheetsBtn.className = "sctk-inline-btn";
      sheetsBtn.innerHTML = icon("sheets");
      sheetsBtn.title = "Send to Google Sheet";
      sheetsBtn.setAttribute("aria-label", "Send to Google Sheet");

      sheetsBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const tsvTemplate =
          Config.global.cardFormatterTSVTemplate ||
          "{Year}\\t{SetName}\\t{InsertSetName}\\t{PlayerName}\\t{PlayerTeam}\\t{Tags}\\t{PR}\\t{CardNo}";
        const tsvLine = CardMetadataExtractor.compile(tsvTemplate, tokens);

        sheetsBtn.disabled = true;
        showToast({
          message: "Sending row to Google Sheet...",
          variant: "info",
        });

        const res = await sendToGoogleSheet({
          sheetId: Config.global.cardFormatterGoogleSheetId,
          worksheet: Config.global.cardFormatterGoogleSheetWorksheet,
          tsvLine: tsvLine,
          webAppUrl: Config.global.cardFormatterGoogleSheetWebAppUrl,
        });

        sheetsBtn.disabled = false;
        if (res.success) {
          sheetsBtn.innerHTML = icon("check");
          showToast({
            message: `Pasted into <b>${Utils.escape.html(res.sheetName || Config.global.cardFormatterGoogleSheetWorksheet || "Google Sheet")}</b> at cell <b>${Utils.escape.html(res.cellRef || "")}</b>`,
            variant: "success",
          });
          setTimeout(() => {
            sheetsBtn.innerHTML = icon("sheets");
          }, 1200);
        } else {
          showToast({
            message: `Google Sheet Error: <b>${Utils.escape.html(res.message)}</b>`,
            variant: "error",
          });
        }
      });
      inlineContainer.appendChild(sheetsBtn);
    }

    const playerName = tokens.PlayerName;
    if (playerName) {
      const searchQuery = encodeURIComponent(playerName.trim()).replace(/%20/g, "+");

      if (showBRef) {
        const brefBtn = targetDoc.createElement("button");
        brefBtn.type = "button";
        brefBtn.className = "sctk-inline-btn";
        brefBtn.innerHTML = icon("bref");
        brefBtn.title = "Search Baseball Reference";
        brefBtn.setAttribute("aria-label", "Search Baseball Reference");

        brefBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const brefUrl = `https://www.baseball-reference.com/search/search.fcgi?search=${searchQuery}`;
          const inBackground = Config.global.cardFormatterLinkTarget !== "focus";
          Utils.openInTab(brefUrl, inBackground, win);
        });
        inlineContainer.appendChild(brefBtn);
      }

      if (showGoogle) {
        const googleBtn = targetDoc.createElement("button");
        googleBtn.type = "button";
        googleBtn.className = "sctk-inline-btn";
        googleBtn.innerHTML = icon("google");
        googleBtn.title = "Search Google";
        googleBtn.setAttribute("aria-label", "Search Google");

        googleBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const googleUrl = `https://www.google.com/search?q=${searchQuery}`;
          const inBackground = Config.global.cardFormatterLinkTarget !== "focus";
          Utils.openInTab(googleUrl, inBackground, win);
        });
        inlineContainer.appendChild(googleBtn);
      }
    }

    if (inlineContainer.childElementCount > 0) {
      targetCell.appendChild(inlineContainer);
    }
  });
}

let activeObserver = null;

/**
 * Initialize Player Quick Links Module.
 */
export function initCardNameFormatter() {
  Log("Initializing Player Quick Links module", "info");

  if (activeObserver) {
    activeObserver.disconnect();
    activeObserver = null;
  }

  if (Config.global.cardFormatterOutputMode === "inline") {
    renderInlineQuickLinks(document);

    const targetArea =
      document.querySelector("#main-content-area") ||
      document.querySelector("#content") ||
      document.body;

    if (targetArea && typeof MutationObserver !== "undefined") {
      const debouncedRender = debounce(() => {
        renderInlineQuickLinks(document);
      }, 150);
      activeObserver = new MutationObserver(debouncedRender);
      activeObserver.observe(targetArea, { childList: true, subtree: true });
    }
    return;
  }

  const handleSelection = debounce(() => {
    if (Config.global.cardFormatterOutputMode === "inline") {
      FormattedCopyPopover.hide();
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      FormattedCopyPopover.hide();
      return;
    }

    const tokens = CardMetadataExtractor.extract(selection);
    if (!tokens || !tokens.PlayerName) {
      FormattedCopyPopover.hide();
      return;
    }

    const template =
      Config.global.cardFormatterTemplate ||
      "{PlayerName} - {Year} {SetName} {Tags} {PR} #{CardNo}";
    const formatted = CardMetadataExtractor.compile(template, tokens);

    if (!formatted) {
      FormattedCopyPopover.hide();
      return;
    }

    const showCopy = Config.global.cardFormatterShowCopy !== false;
    const showTSV = Config.global.cardFormatterShowTSV !== false;
    const showBRef = Config.global.cardFormatterShowBRef !== false;
    const showGoogle = Config.global.cardFormatterShowGoogle !== false;
    const hasSearch = showBRef || showGoogle;

    if (!showCopy && !showTSV && !hasSearch) {
      FormattedCopyPopover.hide();
      return;
    }

    if (!hasSearch && !showTSV && showCopy && Config.global.cardFormatterOutputMode === "clipboard") {
      if (window.navigator?.clipboard?.writeText) {
        window.navigator.clipboard.writeText(formatted).then(() => {
          showToast({
            message: `Copied: <b>${Utils.escape.html(formatted)}</b>`,
            variant: "success",
          });
        });
      }
    } else {
      FormattedCopyPopover.show(selection, formatted, tokens);
    }
  }, 250);

  document.addEventListener("selectionchange", handleSelection);

  document.addEventListener("mousedown", (e) => {
    const popover = document.getElementById(FormattedCopyPopover.elementId);
    if (popover && !popover.contains(e.target)) {
      FormattedCopyPopover.hide();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      FormattedCopyPopover.hide();
    }
  });
}


