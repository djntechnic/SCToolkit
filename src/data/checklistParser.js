/**
 * Checklist page parsing.
 *
 * This is the highest-risk code in the project: it turns loosely structured
 * markup into the exported CSV, and a silent misparse produces a plausible but
 * wrong file. Everything here is a pure function of a `Document`, which is what
 * makes it testable against saved fixtures without touching the network.
 *
 * ## A note on `textContent`
 *
 * v2.42.0 read `innerText` throughout. These documents come from `DOMParser`
 * and are never inserted into a page, so they are not rendered — and for an
 * unrendered element the HTML spec defines `innerText` as returning
 * `textContent`. Reading `textContent` directly is therefore the same value,
 * minus a dependence on layout that no rendered layout ever provides.
 */

/** Column order of the exported checklist CSV. */
export const CHECKLIST_HEADER = [
  'Year', 'Base Set', 'Set Name', 'Card No', 'Subject', 'Tags', 'Print Run', 'Team'
];

/** Generational suffixes that look like all-caps tags but belong to the name. */
const NAME_SUFFIX = /^(Jr\.?|Sr\.?|II|III|IV|V)$/i;

/** Serial-numbering token, e.g. `SN250` for a print run of 250. */
const PRINT_RUN = /^SN\d+$/i;

/** Caption prefixes that duplicate a tag already present in the subject cell. */
const CAPTION_PREFIX = /^(VAR|ERR|UER):\s*/i;

/** Tags whose meaning is completed by a figcaption description. */
const DESCRIBABLE_TAG = /^(VAR|ERR|UER)$/i;

const norm = (node) => (node ? node.textContent.replace(/\s+/g, ' ').trim() : '');

/**
 * Split a subject cell into person name, tags, and print run.
 *
 * The cell is a single run of text with no internal markup to lean on, so
 * classification is positional: tokens are walked **right to left**, and the
 * first token that clearly belongs to the name ends tag collection. Everything
 * to its left is name, whatever remains to its right is tags.
 *
 * | Token (scanning right-to-left)        | Classified as | Ends tag collection |
 * |---------------------------------------|---------------|---------------------|
 * | `SN250` — `SN` + digits               | print run     | no                  |
 * | `Jr.`, `Sr.`, `II`, `III`, `IV`, `V`  | name          | **yes**             |
 * | No lowercase letters, has A-Z or 0-9  | tag           | no                  |
 * | anything else                         | name          | **yes**             |
 * | after collection ended                | name          | —                   |
 *
 * The suffix row is why the order matters: `Ken Griffey Jr. RC` must yield the
 * name `Ken Griffey Jr.` and the tag `RC`. Without the explicit suffix case,
 * `Jr.` has no lowercase letters after the comma strip and would be swallowed
 * as a tag, leaving the subject as `Ken Griffey`.
 *
 * Commas are stripped for *classification* only; the original token, comma and
 * all, is what lands in the name.
 *
 * @param {string} rawSubject subject-cell text with the figcaption removed
 * @param {string} [captionDesc] figcaption text, prefix already stripped
 * @returns {{subject: string, tags: string, printRun: string}}
 */
export function parseSubjectCell(rawSubject, captionDesc = '') {
  const tokens = String(rawSubject || '').split(' ');
  const subjectParts = [];
  let tagParts = [];
  let printRun = '';
  let foundNonTag = false;

  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i].trim();
    if (!token) continue;

    const cleanToken = token.replace(/,/g, '').trim();

    if (!foundNonTag && PRINT_RUN.test(cleanToken)) {
      printRun = cleanToken.replace(/^SN/i, '');
    } else if (!foundNonTag && NAME_SUFFIX.test(cleanToken)) {
      foundNonTag = true;
      subjectParts.unshift(token);
    } else if (!foundNonTag && /^[^a-z]+$/.test(cleanToken) && /[A-Z0-9]/.test(cleanToken)) {
      tagParts.unshift(cleanToken);
    } else {
      foundNonTag = true;
      subjectParts.unshift(token);
    }
  }

  // A figcaption describes the variation. Attach it to the matching tag if one
  // is present; otherwise the caption is itself the evidence of a variation and
  // becomes a synthesised VAR tag.
  if (captionDesc) {
    tagParts = tagParts.map((tag) => (DESCRIBABLE_TAG.test(tag) ? `${tag} (${captionDesc})` : tag));
    if (!tagParts.some((t) => t.includes(captionDesc))) {
      tagParts.push(`VAR (${captionDesc})`);
    }
  }

  return {
    subject: subjectParts.join(' ').replace(/,\s*$/, '').trim(),
    tags: tagParts.join(', '),
    printRun
  };
}

/**
 * Locate the cell holding the card's subject.
 *
 * Preferred path is the cell containing the person link. Rows for unnamed
 * subjects (team cards, checklists, logos) have no person link, so the fallback
 * walks right from the card-number cell to the first cell with any text.
 *
 * @param {Element} row
 * @param {Element} cardNoLink
 * @returns {Element|null}
 */
function findSubjectCell(row, cardNoLink) {
  const personLink = row.querySelector('a[href*="Person.cfm"]');
  if (personLink) return personLink.closest('td');

  const cardTd = cardNoLink.closest('td');
  let cell = cardTd ? cardTd.nextElementSibling : null;
  while (cell && !cell.textContent.trim()) {
    cell = cell.nextElementSibling;
  }
  return cell;
}

/**
 * Parse one table row into checklist fields.
 *
 * @param {Element} row
 * @returns {{cardNo: string, subject: string, tags: string, printRun: string, team: string}|null}
 *   `null` when the row is not a card row — headers, spacers, and footers all
 *   reach here and are rejected by the absence of a card-number link.
 */
export function parseChecklistRow(row) {
  const cardLinks = Array.from(row.querySelectorAll('a[href*="ViewCard.cfm"]'));
  const cardNoLink = cardLinks.find((a) => a.textContent.trim().length > 0);
  if (!cardNoLink) return null;

  const teamLink = row.querySelector('a[href*="Team.cfm"]');
  const subjectTd = findSubjectCell(row, cardNoLink);

  let rawSubject = '';
  let captionDesc = '';

  if (subjectTd) {
    const figcaptionEl = subjectTd.querySelector('figcaption, .figure-caption');
    if (figcaptionEl) {
      captionDesc = norm(figcaptionEl).replace(CAPTION_PREFIX, '').trim();
    }

    // Clone so the figcaption can be removed without mutating the source
    // document, which later rows in the same table still read from.
    const cloneTd = subjectTd.cloneNode(true);
    cloneTd.querySelectorAll('figcaption, .figure-caption').forEach((el) => el.remove());
    rawSubject = norm(cloneTd);
  }

  const { subject, tags, printRun } = parseSubjectCell(rawSubject, captionDesc);

  return {
    cardNo: cardNoLink.textContent.trim(),
    subject,
    tags,
    printRun,
    team: teamLink ? teamLink.textContent.trim() : ''
  };
}

/**
 * Read the set's identity from the page header.
 *
 * `2023 Topps Chrome - Cards` in the `h1` splits into year `2023` and base set
 * `Topps Chrome`; an `h1` with no leading year yields an empty year and the
 * whole string as the base set. The `h3`, when present, is the sub-set.
 *
 * @param {Document} doc
 * @returns {{year: string, baseSet: string, setName: string}}
 */
export function parseSetIdentity(doc) {
  let year = '';
  let baseSet = '';
  let setName = '';

  const setnameContent = doc.getElementById('setname-content');
  if (setnameContent) {
    const h1 = setnameContent.querySelector('h1');
    if (h1) {
      const h1Text = norm(h1).replace(/\s*-\s*Cards$/i, '').trim();
      const yearMatch = h1Text.match(/^(\d{4})\s+(.+)/);
      if (yearMatch) {
        year = yearMatch[1];
        baseSet = yearMatch[2];
      } else {
        baseSet = h1Text;
      }
    }
    const h3 = setnameContent.querySelector('h3');
    if (h3) setName = norm(h3);
  }

  return { year, baseSet, setName };
}

/**
 * Determine how many pages the checklist spans, from the highest `PageIndex`
 * offered by the pagination control. A page with no pagination is one page.
 *
 * @param {Document} doc
 * @returns {number} at least 1
 */
export function parseTotalPages(doc) {
  let totalPages = 1;
  doc.querySelectorAll('.pagination a[href*="PageIndex="]').forEach((link) => {
    // Read the attribute rather than the resolved `.href`: these documents have
    // no base URL, and resolution differs between browsers and test runtimes.
    const href = link.getAttribute('href') || '';
    const pMatch = href.match(/PageIndex=(\d+)/i);
    if (pMatch) {
      const pNum = parseInt(pMatch[1], 10);
      if (pNum > totalPages) totalPages = pNum;
    }
  });
  return totalPages;
}

/**
 * Parse a full checklist page into set identity, page count, and card rows.
 *
 * @param {Document} doc a parsed checklist page
 * @returns {{year: string, baseSet: string, setName: string, totalPages: number,
 *   rows: Array<{cardNo: string, subject: string, tags: string, printRun: string, team: string}>}}
 */
export function parseChecklistDocument(doc) {
  const identity = parseSetIdentity(doc);
  const totalPages = parseTotalPages(doc);

  const rows = [];
  const mainContent = doc.getElementById('main-content-area');
  if (mainContent) {
    mainContent.querySelectorAll('table tr').forEach((row) => {
      const parsed = parseChecklistRow(row);
      if (parsed) rows.push(parsed);
    });
  }

  return { ...identity, totalPages, rows };
}

/**
 * Project parsed rows into CSV field order, prefixed with the header row.
 *
 * @param {{year: string, baseSet: string, setName: string}} identity
 * @param {Array<object>} rows
 * @returns {Array<Array<string>>}
 */
export function toChecklistTable(identity, rows) {
  return [
    CHECKLIST_HEADER,
    ...rows.map((r) => [
      identity.year,
      identity.baseSet,
      identity.setName,
      r.cardNo,
      r.subject,
      r.tags,
      r.printRun,
      r.team
    ])
  ];
}
