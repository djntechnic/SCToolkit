/**
 * Global utility engine for sctoolkit.
 *
 * Centralizes redundant string operations (year parsing, HTML/XML/CSV escaping).
 */

const LEADING_YEAR_REGEX = /^(\d{4})/;

export const Utils = {
  /**
   * Extract a four-digit year from a text label or URL href.
   *
   * @param {string} [text] e.g. "2024 Topps Chrome"
   * @param {string} [href] e.g. "/Checklist.cfm/sid/123/2024"
   * @returns {string|null} four-digit year string, or null
   */
  extractYear(text = '', href = '') {
    if (href) {
      const fromHref = href.match(/\/sid\/\d+\/(\d{4})/i)
        || href.match(/sid=\d+.*?(\d{4})/i)
        || href.match(/[?&]year=(\d{4})/i)
        || href.match(/\/(\d{4})(?:[/-]|\b)/);
      if (fromHref) return fromHref[1];
    }
    const match = String(text || '').match(LEADING_YEAR_REGEX);
    return match ? match[1] : null;
  },

  escape: {
    /**
     * Escape a string for safe HTML interpolation.
     *
     * @param {*} str
     * @returns {string}
     */
    html(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },

    /**
     * Escape a string for safe XML interpolation.
     *
     * @param {*} str
     * @returns {string}
     */
    xml(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    },

    /**
     * Escape a field for RFC 4180 CSV serialization.
     *
     * @param {*} value
     * @returns {string}
     */
    csv(value) {
      const str = (value === null || value === undefined) ? '' : String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }
  }
};
