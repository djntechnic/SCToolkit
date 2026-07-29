/**
 * Anti-scraping block detection.
 *
 * A "block" is the site telling us to stop. The correct response is always to
 * stop — never to work around it. See `docs/POLITE-USE.md`.
 */

/**
 * Markers that identify a challenge or denial page returned in place of the
 * content that was requested.
 *
 * v2.42.0 checked exactly these three substrings. Broadening the set is Phase 4
 * work; they are named here so the additions have somewhere to land.
 */
export const BLOCK_MARKERS = [
  'g-recaptcha',
  'cf-browser-verification',
  'Access Denied'
];

/**
 * @param {string} html raw response body
 * @returns {string|null} the marker that matched, or `null` if the body looks
 *   like ordinary content
 */
export function detectBlock(html) {
  if (!html) return null;
  return BLOCK_MARKERS.find((marker) => html.includes(marker)) ?? null;
}
