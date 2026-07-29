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
  'Year', 'Base Set', 'Set Name', 'Card No', 'Subject', 'Tags', 'Print Run', 'Team', 'Variations'
];

/** Generational suffixes that look like all-caps tags but belong to the name. */
const NAME_SUFFIX = /^(Jr\.?|Sr\.?|II|III|IV|V)$/i;

/** Serial-numbering token, e.g. `SN250` for a print run of 250. */
const PRINT_RUN = /^SN\d+$/i;

/**
 * Caption keywords, each naming a distinct kind of note about a card.
 *
 * `COR` — a corrected print — was missing until a real capture produced
 * captions like `COR: Batting right-handed`. Unrecognised, such a caption was
 * either dropped or, on a suffixed card number, relabelled `VAR (COR: ...)`:
 * a correction reported as a variation.
 */
export const CAPTION_TAGS = ['VAR', 'ERR', 'UER', 'COR'];

/** Matches a caption segment opening with one of the keywords. */
const CAPTION_SEGMENT = new RegExp(`^(${CAPTION_TAGS.join('|')}):\\s*`, 'i');

/** Tags whose meaning is completed by a caption description. */
const DESCRIBABLE_TAG = new RegExp(`^(${CAPTION_TAGS.join('|')})$`, 'i');

/** A tags cell holds only uppercase tokens, digits, and separators. */
const TAG_CELL = /^[A-Z0-9]{1,6}(\s*,\s*[A-Z0-9]{1,6})*$/;

/**
 * A card number ending in a letter marks a variation of the base card — `50b`
 * is a variant of `50`. This is the site's own convention and is the strongest
 * available signal that an unprefixed caption describes a variation.
 */
const VARIATION_CARD_NO = /\d+[a-z]$/i;

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
 * @param {string} rawSubject subject-cell text with the caption removed
 * @param {object} [caption]
 * @param {Array<{tag: string|null, desc: string}>} [caption.segments] parsed caption
 * @param {boolean} [caption.variantCardNo] whether the card number ends in a letter
 * @param {string[]} [caption.extraTags] tags found in the row's variation panel
 * @returns {{subject: string, tags: string, printRun: string}}
 */
export function parseSubjectCell(rawSubject, caption = {}) {
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

  // Panel keywords are added before the caption is folded in, so a caption
  // segment can attach itself to one of them rather than duplicating it.
  (caption.extraTags ?? []).forEach((tag) => {
    if (!tagParts.some((t) => t.toUpperCase() === tag.toUpperCase())) tagParts.push(tag);
  });

  tagParts = mergeCaption(tagParts, caption);

  return {
    subject: subjectParts.join(' ').replace(/,\s*$/, '').trim(),
    tags: tagParts.join(', '),
    printRun
  };
}

/**
 * Split a caption into its keyword-led segments.
 *
 * A real caption carries more than one semantic at once:
 * `VAR: Pack border; "(c) 1989 LEAF, INC." on back; ERR: Reverse image`
 * describes both a variation and an error. Splitting on `;` and starting a new
 * segment at each keyword keeps them distinct, so the export can say `ERR` where
 * the page says `ERR` instead of flattening everything to `VAR`.
 *
 * Text before the first keyword, or a caption with no keyword at all, becomes a
 * segment with a `null` tag — the caller decides whether that is a variation.
 *
 * @param {string} raw caption text
 * @returns {Array<{tag: string|null, desc: string}>}
 */
export function parseCaptionSegments(raw) {
  const text = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!text) return [];

  const segments = [];
  text.split(';').forEach((piece) => {
    const part = piece.trim();
    if (!part) return;

    const match = part.match(CAPTION_SEGMENT);
    if (match) {
      segments.push({ tag: match[1].toUpperCase(), desc: part.slice(match[0].length).trim() });
    } else if (segments.length > 0) {
      // A continuation of the previous keyword, not a new note.
      segments[segments.length - 1].desc += `; ${part}`;
    } else {
      segments.push({ tag: null, desc: part });
    }
  });

  return segments.filter((s) => s.desc !== '' || s.tag);
}

/**
 * Fold caption segments into the tag list.
 *
 * A caption is not automatically a variation. Real checklist cards caption
 * themselves with the range they cover — `Checklist: 211-245` — and v2.42.0
 * turned every one into a fabricated `VAR (Checklist: 211-245)`: twenty wrong
 * rows in a single real set. An unkeyworded caption therefore becomes a
 * variation only on evidence — the row already carries a variation tag, or the
 * card number is suffixed, which is the site's own convention for a variant.
 *
 * @param {string[]} tagParts
 * @param {{segments?: Array<{tag: string|null, desc: string}>, variantCardNo?: boolean}} caption
 * @returns {string[]}
 */
function mergeCaption(tagParts, caption) {
  const segments = caption.segments ?? [];
  if (segments.length === 0) return tagParts;

  let tags = [...tagParts];

  segments.forEach(({ tag, desc }) => {
    if (!desc) return;

    if (tag) {
      // Attach to an existing bare tag of the same kind, else add one.
      const at = tags.findIndex((t) => t.toUpperCase() === tag);
      if (at >= 0) tags[at] = `${tag} (${desc})`;
      else tags.push(`${tag} (${desc})`);
      return;
    }

    const attached = tags.some((t) => DESCRIBABLE_TAG.test(t));
    if (!attached && !caption.variantCardNo) return;

    tags = tags.map((t) => (DESCRIBABLE_TAG.test(t) ? `${t} (${desc})` : t));
    if (!tags.some((t) => t.includes(desc))) tags.push(`VAR (${desc})`);
  });

  return tags;
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

  const cardNo = cardNoLink.textContent.trim();
  let rawSubject = '';
  let segments = [];

  if (subjectTd) {
    const figcaptionEl = subjectTd.querySelector('figcaption, .figure-caption');
    if (figcaptionEl) segments = parseCaptionSegments(norm(figcaptionEl));

    // Clone so the figcaption can be removed without mutating the source
    // document, which later rows in the same table still read from.
    const cloneTd = subjectTd.cloneNode(true);
    cloneTd.querySelectorAll('figcaption, .figure-caption').forEach((el) => el.remove());
    rawSubject = norm(cloneTd);
  }

  const variations = parseVariationPanel(row);

  // The panel's own keywords belong in the Tags column: they are what a reader
  // filters on, and the main row does not repeat them.
  const panelTags = [...new Set(variations.flatMap((v) => v.tags))];

  const { subject, tags, printRun } = parseSubjectCell(rawSubject, {
    segments,
    variantCardNo: VARIATION_CARD_NO.test(cardNo),
    extraTags: panelTags
  });

  return {
    cardNo,
    subject,
    tags,
    printRun,
    team: teamLink ? teamLink.textContent.trim() : '',
    variations: variations.map((v) => v.desc).filter(Boolean).join(' | ')
  };
}

/**
 * Read the collapsed variation panel attached to a checklist row.
 *
 * The site lists a card's variations, errors, and corrections in a panel that is
 * hidden until expanded, keyed by `aria-controls` on the row's expand toggle.
 * Those rows carry no card number, so the row parser skips them — which meant
 * every variation, error, and correction on a set was absent from the export.
 * The 1990 Donruss capture has 725 such panels and produced none of this data.
 *
 * Each variation is one nested table row: a cell of tag tokens, and a cell of
 * description text. The panel is found by id rather than by DOM position, so a
 * layout change does not silently pair a row with the wrong panel.
 *
 * @param {Element} row a main checklist row
 * @returns {Array<{tags: string[], desc: string}>}
 */
export function parseVariationPanel(row) {
  const toggle = row.querySelector('a[aria-controls], [data-bs-toggle="collapse"][aria-controls]');
  const panelId = toggle?.getAttribute('aria-controls');
  if (!panelId) return [];

  const panel = row.ownerDocument.getElementById(panelId);
  if (!panel) return [];

  return Array.from(panel.querySelectorAll('tr')).map((tr) => {
    const cells = Array.from(tr.querySelectorAll('td'))
      .map((td) => norm(td))
      .filter((text) => text !== '' && text !== ' ');

    const tags = [];
    const description = [];

    cells.forEach((text) => {
      if (TAG_CELL.test(text)) tags.push(...text.split(',').map((t) => t.trim()));
      else description.push(text);
    });

    return { tags, desc: description.join(' ') };
  }).filter((v) => v.tags.length > 0 || v.desc !== '');
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
      r.team,
      r.variations ?? ''
    ])
  ];
}
