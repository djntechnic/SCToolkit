/**
 * CollectionBrowse and CollectionBrowseP page parsing.
 *
 * Provides structured, 9-column CSV row parsing for set collection browse
 * (CollectionBrowse.cfm) and player collection browse (CollectionBrowseP.cfm).
 */

import { parseSubjectCell } from './checklistParser.js';
import { compactSegment } from './filename.js';
import { Log } from '../core/log.js';

export const COLLECTION_BROWSE_HEADER = [
  'Sport', 'Year', 'Set Name', 'Child Set', 'Card No', 'Player Name', 'Tags', 'Print Run', 'Qty'
];

/**
 * Split set details string by ' - ' into setName and childSet.
 *
 * @param {string} setDetails e.g. "Bowman Platinum - Platinum Presence"
 * @returns {{setName: string, childSet: string}}
 */
export function parseSetAndChildSet(setDetails) {
  const clean = String(setDetails || '').trim();
  if (!clean) return { setName: 'Unknown', childSet: '' };

  const setParts = clean.split(' - ');
  const setName = setParts[0].trim();
  const childSet = setParts.length > 1 ? setParts.slice(1).join(' - ').trim() : '';

  return { setName, childSet };
}

/**
 * Extract clean quantity integer string from a table cell.
 *
 * @param {Element} cell
 * @returns {string}
 */
export function parseQuantity(cell) {
  if (!cell) return '1';
  const badge = cell.querySelector('.badge, span.badge');
  if (badge && badge.textContent.trim()) {
    const bMatch = badge.textContent.trim().match(/^(\d+)/);
    if (bMatch) return bMatch[1];
  }

  const raw = (cell.innerText || cell.textContent || '').replace(/(\r\n|\n|\r|,|\[|\])/gm, ' ').trim();
  const match = raw.match(/^(\d+)/);
  return match ? match[1] : (raw || '1');
}

/**
 * Detect sport from document body text.
 *
 * @param {Document|HTMLElement} root
 * @returns {string}
 */
export function detectPageSport(root) {
  const text = root.body ? root.body.textContent || '' : root.textContent || '';
  if (text.includes('Baseball')) return 'Baseball';
  if (text.includes('Basketball')) return 'Basketball';
  if (text.includes('Football')) return 'Football';
  if (text.includes('Hockey')) return 'Hockey';
  return 'Unknown';
}

/**
 * Normalize collection list type strictly to "Wantlist", "ForSale", or "Collection".
 *
 * @param {Document|HTMLElement} [root]
 * @returns {string} 'Wantlist' | 'ForSale' | 'Collection'
 */
export function normalizeListType(root = document) {
  let rawText = '';
  const filterSelect = root.querySelector ? root.querySelector('select[name="Filter"]') : null;
  if (filterSelect && filterSelect.options && filterSelect.options.length > 0) {
    const selected = filterSelect.options[filterSelect.selectedIndex];
    if (selected) {
      rawText = (selected.text || selected.value || '').trim();
    }
  }

  let href = '';
  if (root.defaultView && root.defaultView.location) {
    href = root.defaultView.location.href || '';
  } else if (typeof window !== 'undefined' && window.location) {
    href = window.location.href || '';
  }

  // Check top HTML comment nodes for saved URL in test fixtures
  if (root.childNodes) {
    Array.from(root.childNodes).forEach((node) => {
      if (node.nodeType === 8) { // Comment
        href += ` ${node.nodeValue || ''}`;
      }
    });
  }

  // Check <strong> header elements near Options button
  const strongHeaders = Array.from(root.querySelectorAll ? root.querySelectorAll('td strong, h3, h4') : []);
  const headerTexts = strongHeaders.map((el) => el.textContent.trim()).join(' ');

  // Check ColdFusion script text for Status=W / Status=S / Status=F
  const scriptsText = Array.from(root.querySelectorAll ? root.querySelectorAll('script') : [])
    .map((s) => s.textContent)
    .join(' ');

  const combined = `${rawText} ${href} ${headerTexts} ${scriptsText}`.toLowerCase();

  if (
    combined.includes('/col/wantlist') ||
    combined.includes('wantlist6') ||
    combined.includes('status=w') ||
    combined.includes('wantlist') ||
    combined.includes('wants') ||
    combined.includes('filter=w')
  ) {
    return 'Wantlist';
  }
  if (
    combined.includes('/col/forsale') ||
    combined.includes('forsale-trade') ||
    combined.includes('status=s') ||
    combined.includes('status=f') ||
    combined.includes('forsale') ||
    combined.includes('for sale') ||
    combined.includes('trade') ||
    combined.includes('filter=fs') ||
    combined.includes('filter=s') ||
    combined.includes('filter=f') ||
    combined.includes('filter=t')
  ) {
    return 'ForSale';
  }
  return 'Collection';
}

/**
 * Parse a Set Collection Browse page (CollectionBrowse.cfm).
 *
 * @param {Document|HTMLElement} root
 * @returns {{type: string, sport: string, year: string, setName: string, childSet: string, listType: string, rows: Array<Array<string>>, filename: string}}
 */
export function parseCollectionBrowseSet(root) {
  let year = 'Unknown';
  let sport = 'Unknown';
  let setName = 'Unknown';
  let childSet = '';
  const listType = normalizeListType(root);

  const docTitle = root.title || '';
  try {
    const titleData = docTitle.split('|')[0].trim();
    const prefixMatch = titleData.match(/^Collection\s+-\s+.*?\s+-\s+(\d{4}.*)$/);

    if (prefixMatch) {
      let details = prefixMatch[1];

      const sportMatch = details.match(/(.*)\s+([a-zA-Z-]+)$/);
      if (sportMatch) {
        sport = sportMatch[2];
        details = sportMatch[1];
      }

      const yearMatch = details.match(/^(\d{4}(?:-\d{2})?)\s+(.*)$/);
      if (yearMatch) {
        year = yearMatch[1];
        details = yearMatch[2];
      }

      const setInfo = parseSetAndChildSet(details);
      setName = setInfo.setName;
      childSet = setInfo.childSet;
    }
  } catch (e) {
    Log(`Title parsing failed for CollectionBrowse: ${e.message}`, 'error');
  }

  Log(
    `[CLIENT] Parsed CollectionBrowse set context: Sport='${sport}', Year='${year}', SetName='${setName}', ChildSet='${childSet}', ListType='${listType}'`,
    'debug',
    'client'
  );

  const rowEls = Array.from(
    root.querySelectorAll('tr.collection_row, tr[class*="collection_row"], tr.collection.row')
  );

  const dataRows = [];
  rowEls.forEach((tr) => {
    const cells = Array.from(tr.querySelectorAll('td'));
    if (cells.length >= 5) {
      const qty = parseQuantity(cells[0]);
      const cardNo = (cells[2] ? (cells[2].innerText || cells[2].textContent) : '')
        .replace(/(\r\n|\n|\r|,)/gm, ' ')
        .trim();
      const rawPlayerText = (cells[4] ? (cells[4].innerText || cells[4].textContent) : '')
        .replace(/(\r\n|\n|\r|,)/gm, ' ')
        .trim();

      const { subject: playerName, tags, printRun } = parseSubjectCell(rawPlayerText);

      dataRows.push([sport, year, setName, childSet, cardNo, playerName, tags, printRun, qty]);
    }
  });

  const listSuffix = listType === 'Collection' ? '' : `_${listType}`;
  const filename = `${compactSegment(sport)}_${compactSegment(year)}${compactSegment(setName)}${compactSegment(childSet)}${listSuffix}.csv`;

  Log(`[CLIENT] Extracted ${dataRows.length} data rows for CollectionBrowse set export: ${filename}`, 'debug', 'client');

  return {
    type: 'set',
    sport,
    year,
    setName,
    childSet,
    listType,
    rows: dataRows,
    filename
  };
}

/**
 * Parse a Player Collection Browse page (CollectionBrowseP.cfm).
 *
 * @param {Document|HTMLElement} root
 * @returns {{type: string, globalPlayer: string, globalSport: string, listType: string, rows: Array<Array<string>>, filename: string}}
 */
export function parseCollectionBrowsePlayer(root) {
  let globalPlayer = 'Unknown';
  const globalSport = detectPageSport(root);
  const listType = normalizeListType(root);

  const docTitle = root.title || '';
  try {
    const titleData = docTitle.split('|')[0].replace('Trading Card Database', '').trim();
    const titleMatch = titleData.match(/^Collection\s+-\s+.*?\s+-\s+(.*)$/);
    if (titleMatch) {
      globalPlayer = titleMatch[1].trim();
    }
  } catch (e) {
    Log(`Title parsing failed for CollectionBrowseP: ${e.message}`, 'error');
  }

  Log(
    `[CLIENT] Parsed CollectionBrowseP player context: Player='${globalPlayer}', Sport='${globalSport}', ListType='${listType}'`,
    'debug',
    'client'
  );

  const rowEls = Array.from(
    root.querySelectorAll('tr.collection.row, tr[class*="collection row"], tr.collection_row')
  );

  const dataRows = [];
  rowEls.forEach((tr) => {
    const cells = Array.from(tr.querySelectorAll('td'));
    if (cells.length >= 2) {
      const qtyRaw = (cells[0] ? (cells[0].innerText || cells[0].textContent) : '')
        .replace(/(\r\n|\n|\r|,|\[|\])/gm, ' ')
        .trim();
      const qtyMatch = qtyRaw.match(/^(\d+)/);
      if (!qtyMatch) return;
      const qty = qtyMatch[1];

      const cardCell =
        cells[1] && (cells[1].innerText || cells[1].textContent || '').includes('#')
          ? cells[1]
          : cells[2] || cells[1];
      if (!cardCell) return;

      const cardText = (cardCell.innerText || cardCell.textContent || '')
        .replace(/(\r\n|\n|\r|,)/gm, ' ')
        .trim();

      const cardMatch = cardText.match(/^(\d{4}(?:-\d{2})?)\s+(.*?)\s+#([^\s]+)\s+(.*)$/);

      let year = 'Unknown';
      let setName = 'Unknown';
      let childSet = '';
      let cardNo = 'Unknown';
      let playerName = globalPlayer;
      let tags = '';
      let printRun = '';

      if (cardMatch) {
        year = cardMatch[1];
        const setDetails = cardMatch[2];
        cardNo = cardMatch[3];

        const setInfo = parseSetAndChildSet(setDetails);
        setName = setInfo.setName;
        childSet = setInfo.childSet;

        const parsedSubject = parseSubjectCell(cardMatch[4].trim());
        playerName = parsedSubject.subject || globalPlayer;
        tags = parsedSubject.tags;
        printRun = parsedSubject.printRun;
      } else {
        setName = cardText;
        const parsedSubject = parseSubjectCell(globalPlayer);
        playerName = parsedSubject.subject || globalPlayer;
        tags = parsedSubject.tags;
        printRun = parsedSubject.printRun;
      }

      dataRows.push([globalSport, year, setName, childSet, cardNo, playerName, tags, printRun, qty]);
    }
  });

  const filename = `${compactSegment(globalPlayer)}_${compactSegment(listType)}.csv`;

  Log(`[CLIENT] Extracted ${dataRows.length} data rows for CollectionBrowseP player export: ${filename}`, 'debug', 'client');

  return {
    type: 'player',
    globalPlayer,
    globalSport,
    listType,
    rows: dataRows,
    filename
  };
}

/**
 * Parse a Team Collection Browse page (CollectionBrowseT.cfm).
 *
 * @param {Document|HTMLElement} root
 * @returns {{type: string, globalTeam: string, globalSport: string, listType: string, rows: Array<Array<string>>, filename: string}}
 */
export function parseCollectionBrowseTeam(root) {
  let globalTeam = 'Unknown';
  const globalSport = detectPageSport(root);
  const listType = normalizeListType(root);

  const docTitle = root.title || '';
  try {
    const titleData = docTitle.split('|')[0].replace('Trading Card Database', '').trim();
    const titleMatch = titleData.match(/^Collection\s+-\s+.*?\s+-\s+(.*)$/);
    if (titleMatch) {
      globalTeam = titleMatch[1].trim();
    }
  } catch (e) {
    Log(`Title parsing failed for CollectionBrowseT: ${e.message}`, 'error');
  }

  Log(
    `[CLIENT] Parsed CollectionBrowseT team context: Team='${globalTeam}', Sport='${globalSport}', ListType='${listType}'`,
    'debug',
    'client'
  );

  const playerResult = parseCollectionBrowsePlayer(root);
  const filename = `${compactSegment(globalTeam)}_${compactSegment(listType)}.csv`;

  Log(`[CLIENT] Extracted ${playerResult.rows.length} data rows for CollectionBrowseT team export: ${filename}`, 'debug', 'client');

  return {
    type: 'team',
    globalTeam,
    globalSport,
    listType,
    rows: playerResult.rows,
    filename
  };
}

/**
 * Main parser entry point for CollectionBrowse.cfm, CollectionBrowseP.cfm, and CollectionBrowseT.cfm pages.
 *
 * @param {Document|HTMLElement} root
 * @returns {{header: string[], rows: Array<Array<string>>, filename: string, type: string, meta: object}}
 */
export function parseCollectionBrowseDocument(root = document) {
  let isTeamBrowse = false;
  let isPlayerBrowse = false;

  let href = '';
  if (root.defaultView && root.defaultView.location) {
    href = root.defaultView.location.href || '';
  } else if (typeof window !== 'undefined' && window.location) {
    href = window.location.href || '';
  }

  if (root.childNodes) {
    Array.from(root.childNodes).forEach((node) => {
      if (node.nodeType === 8) {
        href += ` ${node.nodeValue || ''}`;
      }
    });
  }

  const hrefLower = href.toLowerCase();

  if (hrefLower.includes('collectionbrowset.cfm')) {
    isTeamBrowse = true;
  } else if (hrefLower.includes('collectionbrowsep.cfm')) {
    isPlayerBrowse = true;
  } else {
    const docTitle = root.title || '';
    const titleData = docTitle.split('|')[0].trim();
    if (/^Collection\s+-\s+.*?\s+-\s+[^\d]/i.test(titleData)) {
      isPlayerBrowse = true;
    }
  }

  const result = isTeamBrowse
    ? parseCollectionBrowseTeam(root)
    : isPlayerBrowse
    ? parseCollectionBrowsePlayer(root)
    : parseCollectionBrowseSet(root);

  return {
    header: COLLECTION_BROWSE_HEADER,
    rows: [COLLECTION_BROWSE_HEADER, ...result.rows],
    filename: result.filename,
    type: result.type,
    meta: result
  };
}
