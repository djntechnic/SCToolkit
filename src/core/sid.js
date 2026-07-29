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
  const match = String(url).match(/sid[=/](\d+)/i);
  return match ? match[1] : null;
}

export const Sid = { extract: extractSid };
