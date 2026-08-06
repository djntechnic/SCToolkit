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

  /**
   * Convert a path or relative URL to a complete absolute URL.
   *
   * @param {string} [path] e.g. "/Checklist.cfm/sid/311171/"
   * @returns {string} full URL e.g. "https://www.tcdb.com/Checklist.cfm/sid/311171/"
   */
  toFullUrl(path = '') {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const origin = (typeof window !== 'undefined' && window.location && window.location.origin)
      ? window.location.origin
      : 'https://www.tcdb.com';
    return `${origin}${path.startsWith('/') ? '' : '/'}${path}`;
  },

  /**
   * Format a URL into a concise, readable string for console logging.
   * Prevents long URLs from causing ugly line wrapping in developer tools.
   *
   * @param {string} [url]
   * @returns {string} e.g. "ViewCollectionMode.cfm?PageIndex=2"
   */
  formatLogUrl(url = '') {
    if (!url) return '';
    try {
      const parsed = new URL(url, typeof window !== 'undefined' && window.location ? window.location.href : 'https://www.tcdb.com');
      const filename = parsed.pathname.split('/').pop() || parsed.pathname;
      const partParam = parsed.searchParams.get('Part');
      if (partParam) {
        return `${filename}?Part=${partParam}`;
      }
      const pageIndex = parsed.searchParams.get('PageIndex') || parsed.searchParams.get('page');
      if (pageIndex) {
        return `${filename}?PageIndex=${pageIndex}`;
      }
      const search = parsed.search;
      if (search && search.length > 40) {
        return `${filename}${search.slice(0, 37)}...`;
      }
      return `${filename}${search}`;
    } catch {
      return url;
    }
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
