/**
 * Set-ID extraction.
 *
 * A SID appears in URLs in two shapes — `/sid/12345/` in path form and
 * `sid=12345` in query form — and both are treated identically.
 */

/**
 * @param {string} url
 * @returns {string|null} the SID, or `null` when the URL carries none
 */
export function extractSid(url) {
  if (!url) return null;
  const str = String(url);
  const match = str.match(/(?:sid|setid)[=/](\d+)/i)
    || str.match(/\/(?:page\/s|s)\/id\/(\d+)/i);
  return match ? match[1] : null;
}

/**
 * Extract parent set ID (SID) for the current set page if the set is an insert/sub-set.
 *
 * @param {Document|HTMLElement} [doc=document]
 * @param {string|null} [currentSid=null]
 * @returns {string|null} The parent set ID if found and distinct from currentSid; otherwise null.
 */
export function extractParentSid(doc = document, currentSid = null) {
  if (!doc || typeof doc.querySelector !== 'function') return null;

  const getHref = (el) => (el ? (el.getAttribute ? (el.getAttribute('href') || el.href) : el.href) : '') || '';

  const isToolkitEl = (el) =>
    !!(
      el &&
      el.closest &&
      el.closest('#sctk-toolbar, [data-sctk], .sctk-element, .tk-dropdown, .tk-pin-item, .tk-injected-badge-group')
    );

  // 1. Look specifically for the "Overview" link in .menu-linksV, .menu-listV, #offcanvas, or sidebar/content
  const candidateAnchors = Array.from(
    doc.querySelectorAll(
      '.menu-linksV a, .menu-listV a, #offcanvas a, #content a[href*="ViewSet.cfm/sid/"], a[href*="ViewSet.cfm/sid/"]'
    )
  ).filter((a) => !isToolkitEl(a));

  const overviewLink = candidateAnchors.find((a) => {
    const text = (a.textContent || '').trim().toLowerCase();
    const href = getHref(a).toLowerCase();
    return text.includes('overview') && (href.includes('viewset.cfm/sid/') || href.includes('viewset.cfm?sid='));
  });

  if (overviewLink) {
    const sid = extractSid(getHref(overviewLink));
    if (sid && sid !== currentSid) return sid;
  }

  // 2. Loop through ALL candidate sidebar menu links to find any SID distinct from currentSid
  const menuAnchors = Array.from(
    doc.querySelectorAll('.menu-linksV a, .menu-listV a, #offcanvas a')
  ).filter((a) => !isToolkitEl(a));

  for (const link of menuAnchors) {
    const sid = extractSid(getHref(link));
    if (sid && sid !== currentSid) return sid;
  }

  // 3. Loop through ALL breadcrumb links
  const breadcrumbLinks = Array.from(
    doc.querySelectorAll(
      '.breadcrumb a[href*="/sid/"], .breadcrumb a[href*="sid="], ' +
      'ol.breadcrumb a[href*="/sid/"], ul.breadcrumb a[href*="/sid/"], ' +
      'nav a[href*="/sid/"]'
    )
  ).filter((a) => !isToolkitEl(a));

  for (const link of breadcrumbLinks) {
    const sid = extractSid(getHref(link));
    if (sid && sid !== currentSid) return sid;
  }

  // 4. Header links
  const headerLink = doc.querySelector(
    '#setname-content h1 a[href*="/sid/"], #main-content-area h1 a[href*="/sid/"]'
  );
  if (headerLink && !isToolkitEl(headerLink)) {
    const sid = extractSid(getHref(headerLink));
    if (sid && sid !== currentSid) return sid;
  }

  return null;
}

export const Sid = { extract: extractSid, extractParent: extractParentSid };

