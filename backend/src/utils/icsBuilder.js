/**
 * Minimal RFC 5545 (iCalendar) writer for the "add this mass intention to
 * my calendar" flow reached by scanning the QR code on a receipt.
 *
 * A web page can't write directly into someone's calendar without an OAuth
 * grant per provider, so the portable answer is to hand back a .ics file:
 * iOS, Android, Outlook and Apple Calendar all open it with an "Add event?"
 * prompt. No library needed -- a single VEVENT is a few dozen lines.
 */

const CRLF = '\r\n';

/** RFC 5545 §3.3.11: backslash, semicolon and comma are delimiters and must be escaped. */
function escapeText(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * RFC 5545 §3.1: lines longer than 75 octets must be folded, with each
 * continuation starting with a single space. Calendar clients reject or
 * truncate over-long lines, which silently loses the description.
 */
function foldLine(line) {
  if (Buffer.byteLength(line, 'utf8') <= 75) return line;
  const parts = [];
  let current = '';
  for (const char of line) {
    const candidate = current + char;
    // 74 leaves room for the leading space added to continuation lines.
    if (Buffer.byteLength(candidate, 'utf8') > (parts.length === 0 ? 75 : 74)) {
      parts.push(current);
      current = char;
    } else {
      current = candidate;
    }
  }
  if (current) parts.push(current);
  return parts.map((p, i) => (i === 0 ? p : ` ${p}`)).join(CRLF);
}

/** Local ("floating") timestamp: YYYYMMDDTHHMMSS with no Z and no TZID. */
function formatLocal(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `T${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

/** UTC timestamp, used for DTSTAMP which RFC 5545 requires to be absolute. */
function formatUtc(date) {
  return `${date.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
}

/**
 * Builds a single-event calendar.
 *
 * The event deliberately uses floating local time: a Mass at 06:00 happens at
 * 06:00 at the church, and someone travelling shouldn't see it shift on their
 * phone.
 *
 * @param {object} opts
 * @param {string} opts.uid          globally unique id for the event
 * @param {Date}   opts.start        event start (local wall-clock)
 * @param {number} opts.durationMinutes
 * @param {string} opts.summary      calendar entry title
 * @param {string} [opts.description]
 * @param {string} [opts.location]
 * @param {number|null} [opts.reminderMinutesBefore] omit/null for no alarm
 */
function buildCalendar({
  uid,
  start,
  durationMinutes = 60,
  summary,
  description,
  location,
  reminderMinutesBefore = 60,
}) {
  const end = new Date(start.getTime() + durationMinutes * 60_000);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Church Office Management System//Mass Intention//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatUtc(new Date())}`,
    `DTSTART:${formatLocal(start)}`,
    `DTEND:${formatLocal(end)}`,
    `SUMMARY:${escapeText(summary)}`,
  ];

  if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);
  if (location) lines.push(`LOCATION:${escapeText(location)}`);
  lines.push('STATUS:CONFIRMED', 'TRANSP:OPAQUE');

  if (reminderMinutesBefore !== null && reminderMinutesBefore !== undefined) {
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(summary)}`,
      // A 0-minute trigger must still be signed, hence the explicit -PT0M.
      `TRIGGER:-PT${Math.max(0, Number(reminderMinutesBefore))}M`,
      'END:VALARM'
    );
  }

  lines.push('END:VEVENT', 'END:VCALENDAR');

  return lines.map(foldLine).join(CRLF) + CRLF;
}

/**
 * A deliberately tiny VEVENT for embedding *inside a QR code*, so scanning a
 * receipt creates the calendar entry with no network call at all -- the phone
 * builds the event straight from the printed pixels.
 *
 * Every byte here costs printed resolution: more data means a denser QR, and a
 * receipt QR is only ~1 inch wide on thermal paper. So this drops UID, DTSTAMP,
 * PRODID, alarms and description -- none of which a scanner needs to offer
 * "add to calendar" -- and keeps only what the user actually sees in the entry.
 */
function buildCompactEvent({ start, durationMinutes = 60, summary, location }) {
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    `SUMMARY:${escapeText(summary)}`,
    `DTSTART:${formatLocal(start)}`,
    `DTEND:${formatLocal(end)}`,
    ...(location ? [`LOCATION:${escapeText(location)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ].join(CRLF);
}

module.exports = { buildCalendar, buildCompactEvent };
