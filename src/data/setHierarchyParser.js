import { extractSid } from '../core/sid.js';

/**
 * Parses ViewAll.cfm or ViewAllC.cfm document to extract parent sets.
 *
 * @param {Document} doc
 * @param {string} year
 * @returns {Array<{category: string, setId: string, setName: string}>}
 */
export function parseViewAllSets(doc, year) {
  const parentSets = [];
  const h3Elements = doc.querySelectorAll('h3.site');

  h3Elements.forEach((h3) => {
    // Skip bottom navigation headers
    if (
      h3.classList.contains('bottomnav') ||
      h3.closest('.bottomnav') ||
      h3.closest('footer') ||
      h3.closest('#footer')
    ) {
      return;
    }

    const categoryName = h3.textContent.trim();

    // Find the next sibling UL that lists the sets
    let next = h3.nextElementSibling;
    while (next && next.tagName !== 'UL' && next.tagName !== 'H3') {
      next = next.nextElementSibling;
    }

    if (next && next.tagName === 'UL') {
      const liElements = next.querySelectorAll('li');
      liElements.forEach((li) => {
        const primaryAnchor = li.querySelector('a[href*="/sid/"]');
        if (!primaryAnchor) return;

        const href = primaryAnchor.getAttribute('href') || '';
        const setId = extractSid(href);
        if (!setId) return;

        // Extract Set Name: strip the four-digit year prefix matching `Year` and any leading/trailing whitespace
        let setName = primaryAnchor.textContent.trim();
        const yearRegex = new RegExp(`^${year}\\s+`);
        setName = setName.replace(yearRegex, '').trim();

        // Check if there is a hideDiv following the li
        const nextEl = li.nextElementSibling;
        const hasHideDiv = !!(nextEl && nextEl.tagName === 'DIV' && nextEl.id.startsWith('hideDiv'));

        parentSets.push({
          category: categoryName,
          setId,
          setName,
          hasHideDiv
        });
      });
    }
  });

  return parentSets;
}

/**
 * Parses Inserts.cfm document to extract child sets.
 *
 * @param {Document} doc
 * @returns {Array<{childCategory: string, childSetId: string, childSetName: string}>}
 */
export function parseChildSets(doc) {
  const childSets = [];
  const h3Elements = doc.querySelectorAll('h3.site');

  h3Elements.forEach((h3) => {
    // Skip bottom navigation headers
    if (
      h3.classList.contains('bottomnav') ||
      h3.closest('.bottomnav') ||
      h3.closest('footer') ||
      h3.closest('#footer')
    ) {
      return;
    }

    // Clean category name: strip count e.g. "Insert Sets (322)" -> "Insert Sets"
    const categoryName = h3.textContent.trim().replace(/\s*\(\d+\)$/, '');

    // The header 'Inserts' is not a child set category, it lists individual cards
    if (categoryName.toLowerCase() === 'inserts') {
      return;
    }

    // Find the child sets table corresponding to this h3
    const insideTable = h3.closest('table');
    const startElement = insideTable || h3;

    let next = startElement.nextElementSibling;
    let table = null;
    while (next) {
      if (next.tagName === 'TABLE') {
        table = next;
        break;
      }
      if (next.querySelector('h3.site') || next.tagName === 'H3') {
        break;
      }
      next = next.nextElementSibling;
    }

    if (table) {
      const rows = table.querySelectorAll('tr');
      rows.forEach((tr) => {
        const anchors = Array.from(tr.querySelectorAll('a[href*="/sid/"]'));
        // Find the primary anchor that has text content and points to a checklist or view set page
        const setAnchor = anchors.find((a) => {
          const href = a.getAttribute('href') || '';
          const text = a.textContent.trim();
          return (
            text.length > 0 &&
            extractSid(href) &&
            (href.includes('/Checklist.cfm/') ||
              href.includes('/ViewSet.cfm/') ||
              href.includes('Checklist.cfm?') ||
              href.includes('ViewSet.cfm?'))
          );
        });

        if (setAnchor) {
          const href = setAnchor.getAttribute('href') || '';
          const childSetId = extractSid(href);
          const childSetName = setAnchor.textContent.trim();

          const figcaptionEl = tr.querySelector('figcaption.figure-caption') || tr.querySelector('figcaption');
          const childSetNotes = figcaptionEl ? figcaptionEl.textContent.trim() : '';

          if (childSetId) {
            childSets.push({
              childCategory: categoryName,
              childSetId,
              childSetName,
              childSetNotes
            });
          }
        }
      });
    }
  });

  return childSets;
}
