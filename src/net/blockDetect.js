/**
 * Anti-scraping block detection.
 *
 * A "block" is the site telling us to stop. The correct response is always to
 * stop — never to work around it. Nothing here attempts to identify, solve, or
 * evade a challenge; the markers exist only so the script can recognise that it
 * has been handed one instead of content, and quit.
 *
 * See `docs/POLITE-USE.md`.
 */

/**
 * Substrings that identify a challenge or denial page returned in place of the
 * content that was requested.
 *
 * v2.42.0 checked three of these. The additions cover challenge formats that
 * postdate it — a page that says "Just a moment..." while running a JavaScript
 * challenge is a block, even though it contains none of the original markers,
 * and previously it was parsed as an empty checklist and reported as a
 * mysteriously missing set.
 */
export const BLOCK_MARKERS = [
  'g-recaptcha',
  'cf-browser-verification',
  'cf-challenge',
  '__cf_chl',
  'challenge-platform',
  'Just a moment',
  'hcaptcha',
  'h-captcha'
];

/**
 * Denial phrasings, matched only inside a `<title>` or `<h1>`.
 *
 * v2.42.0 searched the whole body for the bare substring `Access Denied`, which
 * any page could contain in ordinary copy — a forum post, a help article, a set
 * named after it. A denial page says so in its title; page copy does not.
 */
const DENIAL_HEADINGS = [
  /<title[^>]*>[^<]*\b(access denied|forbidden|blocked|rate limited)\b/i,
  /<h1[^>]*>\s*(access denied|forbidden|blocked|rate limited)\b/i
];

/** HTTP statuses that are themselves a block, independent of the body. */
export const BLOCK_STATUSES = [401, 403];

/**
 * @param {string} html raw response body
 * @returns {string|null} the marker that matched, or `null` if the body looks
 *   like ordinary content
 */
export function detectBlock(html) {
  if (!html) return null;

  const marker = BLOCK_MARKERS.find((m) => html.includes(m));
  if (marker) return marker;

  const denial = DENIAL_HEADINGS.find((re) => re.test(html));
  return denial ? 'denial page heading' : null;
}

/**
 * @param {number} status
 * @returns {boolean} whether the status alone means we have been blocked
 */
export function isBlockedStatus(status) {
  return BLOCK_STATUSES.includes(status);
}
