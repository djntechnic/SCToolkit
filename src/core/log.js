/**
 * Console logging with a US-Central timestamp and a CLIENT/SERVER origin tag.
 *
 * The origin tag is load-bearing for support: `'server'` means *an HTTP request
 * to the target site actually happened*. It is not a severity, a category, or a
 * decoration — if a log line is tagged `'server'` and no request was issued, the
 * tag is wrong. Everything else is `'client'`.
 */

/** Ordered low-to-high; a message is emitted when its level >= the runtime level. */
export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'];

/** Mutable runtime knobs, updated by the settings UI without a page reload. */
export const RuntimeSettings = { logLevel: 'info' };

const LOG_STYLES = {
  prefix: 'color:#6c757d',
  source: {
    client: 'color:#6c757d; font-weight:bold',
    server: 'color:#0d6efd; font-weight:bold'
  },
  level: {
    debug: 'color:#6c757d',
    info: 'color:inherit',
    warn: 'color:#d97706; font-weight:bold',
    error: 'color:#dc3545; font-weight:bold'
  }
};

/**
 * Format the current time as `HH:MM:SS.mmm CT`, DST-aware.
 *
 * Falls back to UTC if the runtime lacks full ICU data (some minimal Node and
 * embedded browser builds ship without the tz database).
 *
 * @returns {string}
 */
export function formatCentralTimestamp() {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    }).format(new Date()) + ' CT';
  } catch {
    return new Date().toISOString().split('T')[1].slice(0, -1) + ' UTC';
  }
}

/**
 * Emit a log line, subject to the runtime log level.
 *
 * @param {string} msg
 * @param {'debug'|'info'|'warn'|'error'} [level]
 * @param {'client'|'server'} [source] `'server'` only when a network request occurred.
 */
export function Log(msg, level = 'info', source = 'client') {
  if (LOG_LEVELS.indexOf(level) < LOG_LEVELS.indexOf(RuntimeSettings.logLevel)) return;
  const timestamp = formatCentralTimestamp();
  const consoleMethod = level === 'debug' ? 'log' : level;
  const sourceLabel = source === 'server' ? '[SERVER]' : '[CLIENT]';
  const sourceStyle = LOG_STYLES.source[source] || LOG_STYLES.source.client;
  const levelStyle = LOG_STYLES.level[level] || LOG_STYLES.level.info;
  console[consoleMethod](
    `%c[SCToolkit | ${timestamp}] %c${sourceLabel}%c ${msg}`,
    LOG_STYLES.prefix,
    sourceStyle,
    levelStyle
  );
}
