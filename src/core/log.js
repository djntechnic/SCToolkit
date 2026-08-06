/**
 * Console logging with configurable timestamp formatting, client timezone auto-detection,
 * and a CLIENT/SERVER origin tag.
 *
 * The origin tag is load-bearing for support: `'server'` marks a line that
 * *is about an HTTP request* — issuing one, or handling its response status.
 * It is not a severity, a category, or a decoration.
 */

/** Ordered low-to-high; a message is emitted when its level >= the runtime level. */
export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'];

/** Mutable runtime knobs, updated by the settings UI without a page reload. */
export const RuntimeSettings = {
  logLevel: 'info',
  timezone: 'auto',
  timestampFormat: 'HH:mm:ss.SSS TZ'
};

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
 * Detect client timezone or resolve user setting fallback.
 * 1) Try to identify current timezone of client user.
 * 2) Fall back to user-selected timezone setting in Settings (defaulting to US CT).
 *
 * @param {string} [preferredZone] Optional override or RuntimeSettings.timezone
 * @returns {string} IANA timezone identifier
 */
export function resolveTimezone(preferredZone = RuntimeSettings.timezone) {
  // If user selected an explicit timezone other than 'auto', attempt to use it
  if (preferredZone && preferredZone !== 'auto') {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: preferredZone });
      return preferredZone;
    } catch {
      // Invalid/unsupported zone string, fall through to auto/default
    }
  }

  // 1. Try to identify current timezone of client user
  try {
    if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
      const clientZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (clientZone && typeof clientZone === 'string') {
        new Intl.DateTimeFormat('en-US', { timeZone: clientZone });
        return clientZone;
      }
    }
  } catch {
    // Auto-detection failed or unavailable
  }

  // 2. Fallback to US Central (America/Chicago)
  return 'America/Chicago';
}

/**
 * Extract zoned date parts for a target timezone.
 *
 * @param {Date} [date=new Date()]
 * @param {string} [timeZone='America/Chicago']
 * @returns {Object} Token dictionary (YYYY, YY, MM, DD, HH, hh, mm, ss, SSS, mmm, A, a, TZ)
 */
export function getZonedDateParts(date = new Date(), timeZone = 'America/Chicago') {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZoneName: 'short'
    });
    const parts = formatter.formatToParts(date);
    const getPart = (type) => parts.find((p) => p.type === type)?.value || '';

    const year = getPart('year');
    const month = getPart('month');
    const day = getPart('day');
    let hour24 = parseInt(getPart('hour'), 10);
    if (isNaN(hour24)) hour24 = date.getHours();
    if (hour24 === 24) hour24 = 0;

    const minute = getPart('minute');
    const second = getPart('second');
    const ms = String(date.getMilliseconds()).padStart(3, '0');

    const hour12Num = hour24 % 12 || 12;
    const hour12 = String(hour12Num).padStart(2, '0');
    const hour24Str = String(hour24).padStart(2, '0');
    const ampm = hour24 >= 12 ? 'PM' : 'AM';

    const tzName = getPart('timeZoneName') || 'UTC';

    return {
      YYYY: year,
      YY: year.slice(-2),
      MM: month,
      DD: day,
      HH: hour24Str,
      hh: hour12,
      mm: minute,
      ss: second,
      SSS: ms,
      mmm: ms,
      A: ampm,
      a: ampm.toLowerCase(),
      TZ: tzName,
      Z: tzName
    };
  } catch {
    const year = String(date.getUTCFullYear());
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hour24 = String(date.getUTCHours()).padStart(2, '0');
    const minute = String(date.getUTCMinutes()).padStart(2, '0');
    const second = String(date.getUTCSeconds()).padStart(2, '0');
    const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
    return {
      YYYY: year,
      YY: year.slice(-2),
      MM: month,
      DD: day,
      HH: hour24,
      hh: hour24,
      mm: minute,
      ss: second,
      SSS: ms,
      mmm: ms,
      A: 'UTC',
      a: 'utc',
      TZ: 'UTC',
      Z: 'UTC'
    };
  }
}

/**
 * Format timestamp according to format pattern and preferred timezone.
 * Supports standard format tokens (YYYY, YY, MM, DD, HH, hh, mm, ss, SSS, mmm, A, a, TZ).
 *
 * @param {Date} [date=new Date()]
 * @param {string} [formatPattern]
 * @param {string} [preferredZone]
 * @returns {string}
 */
export function formatLogTimestamp(
  date = new Date(),
  formatPattern = RuntimeSettings.timestampFormat || 'HH:mm:ss.SSS TZ',
  preferredZone = RuntimeSettings.timezone || 'auto'
) {
  const zone = resolveTimezone(preferredZone);
  const parts = getZonedDateParts(date, zone);

  let pattern = formatPattern || 'HH:mm:ss.SSS TZ';

  // Support YYYYmmDDHHMMSS format (where mm is month and MM is minute)
  if (/YYYYmmDD/i.test(pattern)) {
    pattern = pattern
      .replace(/YYYY/g, parts.YYYY)
      .replace(/YY/g, parts.YY)
      .replace(/mm/g, parts.MM)
      .replace(/DD/gi, parts.DD)
      .replace(/HH/gi, parts.HH)
      .replace(/MM/g, parts.mm)
      .replace(/SS/gi, parts.ss);
  } else {
    pattern = pattern
      .replace(/YYYY/g, parts.YYYY)
      .replace(/YY/g, parts.YY)
      .replace(/MM/g, parts.MM)
      .replace(/DD/gi, parts.DD)
      .replace(/HH/g, parts.HH)
      .replace(/hh/g, parts.hh)
      .replace(/mm/g, parts.mm)
      .replace(/SSS/g, parts.SSS)
      .replace(/ss/gi, parts.ss)
      .replace(/\bTZ\b|\bZ\b/g, parts.TZ)
      .replace(/\bA\b/g, parts.A)
      .replace(/\ba\b/g, parts.a);
  }

  return pattern;
}

/**
 * Backward-compatible alias for log timestamp formatting.
 */
export function formatCentralTimestamp() {
  return formatLogTimestamp();
}

/**
 * Emit a log line, subject to the runtime log level.
 *
 * @param {string} msg
 * @param {'debug'|'info'|'warn'|'error'} [level='info']
 * @param {'client'|'server'} [source='client'] `'server'` only when a network request occurred.
 */
export function Log(msg, level = 'info', source = 'client') {
  if (LOG_LEVELS.indexOf(level) < LOG_LEVELS.indexOf(RuntimeSettings.logLevel)) return;
  const consoleMethod = level === 'debug' ? 'log' : level;
  const timestamp = formatLogTimestamp();
  const cleanMsg = String(msg || '').replace(/^\[(CLIENT|SERVER)\]\s*/i, '');

  if (level === 'error') {
    const sourceTag = source === 'server' ? '[SERVER]' : '[CLIENT]';
    const sourceStyle = source === 'server' ? LOG_STYLES.source.server : LOG_STYLES.source.client;
    console.error(
      `%c[SCToolkit | ${timestamp}] %c${sourceTag}%c ${cleanMsg}`,
      LOG_STYLES.prefix,
      sourceStyle,
      'color:#dc3545; font-weight:bold'
    );
    return;
  }

  // 2. Server actions include timestamp and bold blue [SERVER] badge
  if (source === 'server') {
    console[consoleMethod](
      `%c[SCToolkit | ${timestamp}] %c[SERVER]%c ${cleanMsg}`,
      LOG_STYLES.prefix,
      LOG_STYLES.source.server,
      'color:#0d6efd; font-weight:bold'
    );
    return;
  }

  // 3. Standard CLIENT actions include timestamp and grey [CLIENT] badge
  const levelStyle = LOG_STYLES.level[level] || LOG_STYLES.level.info;
  console[consoleMethod](
    `%c[SCToolkit | ${timestamp}] %c[CLIENT]%c ${cleanMsg}`,
    LOG_STYLES.prefix,
    LOG_STYLES.source.client,
    levelStyle
  );
}
