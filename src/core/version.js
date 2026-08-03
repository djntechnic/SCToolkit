/**
 * Single source of truth for the application version.
 */
export const APP_VERSION = '3.0.2';

/**
 * Get the current application version string.
 *
 * Prefers `GM_info.script.version` when running in a userscript manager,
 * falling back to `APP_VERSION`.
 *
 * @returns {string}
 */
export function getAppVersion() {
  try {
    if (typeof GM_info !== 'undefined' && GM_info?.script?.version) {
      return GM_info.script.version;
    }
  } catch {
    // Ignore error if GM_info is not present
  }
  return APP_VERSION;
}
