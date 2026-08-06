/**
 * Parsing logic for Print Collection PDF pages (PrintYourCollectionPDF.cfm).
 *
 * Extracts structured card metadata from the `.yourcol-item` grid:
 * Sport, Year, Set Name, Child Set, Card No, Player Name, Tags, Print Run, Qty[, Price]
 */

import { isTagToken, PRINT_RUN, NAME_SUFFIX } from './checklistParser.js';

export const PRINT_COLLECTION_HEADER = [
  'Sport', 'Year', 'Set Name', 'Child Set', 'Card No', 'Player Name', 'Tags', 'Print Run', 'Qty'
];

/**
 * Check if the current URL or document query string specifies prices=Y.
 *
 * @param {Document} [doc=document]
 * @returns {boolean}
 */
export function checkIncludePrice(doc = document) {
  let search = '';
  if (doc.defaultView && doc.defaultView.location) {
    search = doc.defaultView.location.search || '';
  } else if (typeof window !== 'undefined' && window.location) {
    search = window.location.search || '';
  }
  const partLink = doc.querySelector?.('a[href*="PrintYourCollectionPDF"], a[href*="PrintCenter.cfm"], a[href*="prices="]');
  if (partLink && partLink.href) {
    search += (search ? '&' : '?') + (partLink.href.split('?')[1] || '');
  }
  const params = new URLSearchParams(search);
  return params.get('prices') === 'Y' || params.get('prices') === 'y';
}

/**
 * Get sport name from URL search parameters or page heading.
 *
 * @param {Document} [doc=document]
 * @returns {string}
 */
export function getSportFromDoc(doc = document) {
  let search = '';
  if (doc.defaultView && doc.defaultView.location) {
    search = doc.defaultView.location.search || '';
  } else if (typeof window !== 'undefined' && window.location) {
    search = window.location.search || '';
  }
  const partLink = doc.querySelector?.('a[href*="PrintYourCollectionPDF"], a[href*="PrintCenter.cfm"], a[href*="Type="]');
  if (partLink && partLink.href) {
    search += (search ? '&' : '?') + (partLink.href.split('?')[1] || '');
  }
  const params = new URLSearchParams(search);
  const type = params.get('Type');
  if (type) return type;

  const headerTitle = doc.querySelector?.('.yourcol-title h4');
  if (headerTitle) {
    const text = headerTitle.textContent.trim();
    const parts = text.split('-');
    if (parts.length > 1) {
      return parts[parts.length - 1].trim();
    }
  }

  return 'Unknown';
}

/**
 * Construct the target PrintYourCollectionPDF URL for Collection.cfm print summary pages.
 *
 * Pattern:
 *   PrintYourCollectionPDF.cfm?Type={Sport}&CollectionID={CollectionID}&Part={Part}&columns=2&fontsize=1&prices=N&SetID=&Member={Member}&Filter={ListType}&sTeamID=
 *
 * @param {Document} [doc=document]
 * @param {number} [part=1]
 * @returns {string}
 */
export function buildPrintCollectionUrlFromDoc(doc = document, part = 1) {
  const currentUrl = (typeof window !== 'undefined' && window.location) ? window.location.href : '';
  const searchParams = new URLSearchParams((typeof window !== 'undefined' && window.location) ? window.location.search : '');

  // Inspect any part link on page to extract query parameters if needed
  const existingLink = doc.querySelector?.('a[href*="PrintYourCollectionPDF"], a[href*="PrintCenter.cfm"], a[href*="Part="]');
  let linkParams = new URLSearchParams();
  if (existingLink && existingLink.href) {
    try {
      const q = existingLink.href.split('?')[1];
      if (q) linkParams = new URLSearchParams(q);
    } catch {
      // Ignore link parse failure and fall back to URL/DOM extraction
    }
  }

  // 1. Extract Member from URL path (/member/{Member}) or linkParams or searchParams
  const memberMatch = currentUrl.match(/\/member\/([^/?]+)/i);
  const member = memberMatch ? memberMatch[1] : (linkParams.get('Member') || searchParams.get('Member') || '');

  // 2. Extract CollectionID from URL path (/collection/{CollectionID}) or linkParams or searchParams
  const collectionMatch = currentUrl.match(/\/collection\/(\d+)/i);
  const collectionId = collectionMatch ? collectionMatch[1] : (linkParams.get('CollectionID') || searchParams.get('CollectionID') || '');

  // 3. Extract Sport from searchParams or linkParams or DOM (#content div.col-md-8 p strong / .block1 p strong)
  let sport = searchParams.get('Type') || linkParams.get('Type') || '';
  if (!sport && doc.querySelector) {
    const strongEl = doc.querySelector('#content div.col-md-8 p strong, .block1 p strong, p strong');
    if (strongEl) {
      sport = strongEl.textContent.trim();
    }
  }
  if (!sport) sport = 'Baseball';

  // 4. Extract ListType (Filter) from linkParams or searchParams or DOM (#content div.col-md-8 h3 / .block1 h3)
  let filter = searchParams.get('Filter') || linkParams.get('Filter') || '';
  if (!filter && doc.querySelector) {
    const h3El = doc.querySelector('#content div.col-md-8 h3, .block1 h3, h3');
    const h3Text = h3El ? h3El.textContent.trim().toLowerCase() : '';
    if (h3Text.includes('wantlist')) {
      filter = 'W';
    } else if (h3Text.includes('for sale') || h3Text.includes('trade')) {
      filter = 'FS';
    } else {
      filter = 'S';
    }
  }
  if (!filter) filter = 'S';

  const prices = (searchParams.get('prices') === 'Y' || linkParams.get('prices') === 'Y') ? 'Y' : 'N';

  return `PrintYourCollectionPDF.cfm?Type=${encodeURIComponent(sport)}&CollectionID=${encodeURIComponent(collectionId)}&Part=${part}&columns=2&fontsize=1&prices=${prices}&SetID=&Member=${encodeURIComponent(member)}&Filter=${encodeURIComponent(filter)}&sTeamID=`;
}

/**
 * Parse a single `.yourcol-item` DOM element.
 *
 * @param {Element} item
 * @param {object} [options]
 * @param {string} [options.sport='Unknown']
 * @param {boolean} [options.includePrice=false]
 * @returns {{row: Array<string|number>, qty: number}|null}
 */
export function parsePrintItem(item, options = {}) {
  const sport = options.sport || 'Unknown';
  const includePrice = !!options.includePrice;

  const textSpan = item.querySelector('.yourcol-text');
  if (!textSpan) return null;

  let qty = 1;
  const qtySpan = item.querySelector('.yourcol-qty');
  if (qtySpan) {
    const qtyMatch = qtySpan.textContent.match(/\d+/);
    if (qtyMatch) {
      qty = parseInt(qtyMatch[0], 10);
    }
  }

  let entry = textSpan.textContent.replace(/\s+/g, ' ').trim();
  let price = '';

  if (includePrice) {
    const dollarParts = entry.split('$');
    if (dollarParts.length > 1) {
      let lastPart = dollarParts.pop().trim();
      lastPart = lastPart.replace(/\$/g, '').trim();

      if (lastPart.length > 0) {
        const num = parseFloat(lastPart.replace(/,/g, ''));
        if (!isNaN(num)) {
          price = num.toFixed(2);
        } else {
          price = lastPart;
        }
      }
      entry = dollarParts.join('$').trim();
    }
  }

  // Strip trailing dollar signs
  entry = entry.replace(/(?:\s*\$)+$/, '').trim();
  if (!entry) return null;

  let year = '';
  const yearMatch = entry.match(/^(\d{4})\s+/);
  if (yearMatch) {
    year = yearMatch[1];
    entry = entry.substring(yearMatch[0].length).trim();
  }

  const childSet = '';
  const tokens = entry.split(' ');

  let cardIdx = -1;

  // Search backwards to identify Card No boundary (token with digits or uppercase/hyphen pattern)
  for (let i = tokens.length - 2; i >= 0; i--) {
    const part = tokens[i];
    if (/\d/.test(part) || (/^[A-Z0-9-]+$/.test(part) && (part.length >= 3 || /-/.test(part)))) {
      cardIdx = i;
      break;
    }
  }

  let setName = '';
  let cardNo = '';
  let remainingSubject = '';

  if (cardIdx !== -1) {
    setName = tokens.slice(0, cardIdx).join(' ');
    cardNo = tokens[cardIdx];
    remainingSubject = tokens.slice(cardIdx + 1).join(' ');
  } else {
    setName = entry;
  }

  // Tokenize remainingSubject for Player Name, Tags, and Print Run
  const subTokens = remainingSubject.split(' ');
  const playerParts = [];
  const tagParts = [];
  let printRun = '';
  let foundNonTag = false;

  for (let i = subTokens.length - 1; i >= 0; i--) {
    const token = subTokens[i].trim();
    if (!token) continue;

    const cleanToken = token.replace(/,/g, '').trim();

    if (!foundNonTag && PRINT_RUN.test(cleanToken)) {
      printRun = cleanToken.replace(/^SN/i, '');
    } else if (!foundNonTag && NAME_SUFFIX.test(cleanToken)) {
      foundNonTag = true;
      playerParts.unshift(token);
    } else if (!foundNonTag && isTagToken(cleanToken)) {
      tagParts.unshift(cleanToken);
    } else {
      foundNonTag = true;
      playerParts.unshift(token);
    }
  }

  const playerName = playerParts.join(' ').replace(/,\s*$/, '').trim();
  const tags = tagParts.join(', ');

  const row = [
    sport,
    year,
    setName,
    childSet,
    cardNo,
    playerName,
    tags,
    printRun,
    qty
  ];

  if (includePrice) {
    row.push(price);
  }

  return { row, qty };
}

/**
 * Parse an entire Print Collection document into structured CSV rows.
 *
 * @param {Document|HTMLElement} [doc=document]
 * @param {object} [options]
 * @param {boolean} [options.includeHeader=true]
 * @param {string} [options.sport]
 * @param {boolean} [options.includePrice]
 * @returns {{rows: Array<Array<string|number>>, count: number, quantity: number, skipped: number, header: string[]}}
 */
export function parsePrintCollectionDocument(doc = document, options = {}) {
  const includePrice = options.includePrice !== undefined ? options.includePrice : checkIncludePrice(doc);
  const sport = options.sport || getSportFromDoc(doc);
  const items = Array.from(doc.querySelectorAll('.yourcol-item'));

  const header = [...PRINT_COLLECTION_HEADER];
  if (includePrice) {
    header.push('Price');
  }

  const rows = options.includeHeader !== false ? [header] : [];
  let count = 0;
  let quantity = 0;
  let skipped = 0;

  items.forEach((item) => {
    try {
      const parsed = parsePrintItem(item, { sport, includePrice });
      if (parsed) {
        rows.push(parsed.row);
        count++;
        quantity += parsed.qty;
      } else {
        skipped++;
      }
    } catch {
      skipped++;
    }
  });

  return { rows, count, quantity, skipped, header };
}
