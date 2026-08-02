/**
 * RFC 4180 CSV serialization and browser download.
 */

/**
 * Quote a single field if it contains a delimiter, a quote, or a line break.
 * Embedded quotes are doubled. `null`/`undefined` become the empty string
 * rather than the text `"null"`.
 *
 * @param {*} value
 * @returns {string}
 */
export function escapeField(value) {
  const str = (value === null || value === undefined) ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * @param {Array<*>} fields
 * @returns {string}
 */
export function buildRow(fields) {
  return fields.map(escapeField).join(',');
}

/**
 * @param {Array<Array<*>>} rows
 * @returns {string}
 */
export function toCSV(rows) {
  return rows.map(buildRow).join('\n');
}

/**
 * Trigger a client-side download. No network request is involved — the file is
 * assembled from an in-memory blob.
 *
 * @param {string} csvContent
 * @param {string} filename
 */
export function download(csvContent, filename) {
  // Prepend UTF-8 BOM (\uFEFF) to guarantee proper character rendering in MS Excel
  const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
  const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });

  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const CSV = { escapeField, buildRow, toCSV, download };
