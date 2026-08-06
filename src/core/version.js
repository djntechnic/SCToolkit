/**
 * Single source of truth for the application version.
 */
export const APP_VERSION = '0.1.0-beta';

/**
 * Get the current application version string.
 *
 * Prefers `GM_info.script.version` when running in a userscript manager,
 * falling back to `APP_VERSION`.
 *
 * @returns {string}
 */
export function getAppVersion() {
  if (typeof GM_info !== 'undefined' && GM_info?.script?.version) {
    return GM_info.script.version;
  }
  return APP_VERSION;
}
