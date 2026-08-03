/**
 * Single source of truth for the application version.
 */
export const APP_VERSION = '3.0.3';

/**
 * Get the current application version string.
 *
 * Prefers `GM_info.script.version` when running in a userscript manager,
 * falling back to `APP_VERSION`.
 *
 * @returns {string}
 */
export function getAppVersion() {
  return APP_VERSION;
}
