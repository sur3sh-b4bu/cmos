'use strict';

/**
 * Date-only (calendar date, no time, no timezone) helpers shared by every
 * Excel import/export path.
 *
 * NOTHING in here may read the machine's local timezone or locale: no local
 * getters (getDate/getMonth/...), no toLocale*, no Intl, no `new Date(<text>)`
 * (which parses ISO text as UTC but other text as LOCAL time). A date-only
 * value is either an ISO "YYYY-MM-DD" string or a Date at UTC midnight, and
 * is only ever taken apart with the getUTC* getters -- that is what makes the
 * result identical on every computer, in every timezone and OS region. The
 * static test in excel.static.test.js fails the build if that rule is broken.
 */

const MS_PER_DAY = 86400000;
const MIN_YEAR = 1900;
const MAX_YEAR = 2100;
// Excel's 1900 date system counts a non-existent 29 Feb 1900, so serials
// below 61 (1 Mar 1900) are not reliable dates.
const FIRST_RELIABLE_1900_SERIAL = 61;
const EPOCH_1900_SYSTEM_MS = Date.UTC(1899, 11, 30);
const EPOCH_1904_SYSTEM_MS = Date.UTC(1904, 0, 1);
// The latest UTC offset that exists on Earth (Kiribati, UTC+14).
const MAX_UTC_OFFSET_HOURS = 14;

const ISO_TEXT = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/;
const DMY_TEXT = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/;

function pad(n, width) {
  return String(n).padStart(width, '0');
}

function daysInMonth(year, month) {
  // Day 0 of the NEXT month is the last day of this one.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function toIso(year, month, day) {
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

function fail(reason) {
  return { ok: false, iso: null, reason };
}

function succeed(iso) {
  return { ok: true, iso };
}

function fromParts(year, month, day, shown) {
  if (year < MIN_YEAR || year > MAX_YEAR) {
    return fail(`"${shown}" has a year outside ${MIN_YEAR}-${MAX_YEAR}.`);
  }
  if (month < 1 || month > 12) {
    return fail(`"${shown}" has month ${month}; the month must be 1-12.`);
  }
  const last = daysInMonth(year, month);
  if (day < 1 || day > last) {
    return fail(`"${shown}" is not a real calendar date (that month has ${last} days).`);
  }
  return succeed(toIso(year, month, day));
}

function fromUtcMs(ms, shown) {
  const d = new Date(ms);
  return fromParts(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), shown);
}

function parseText(raw) {
  const text = String(raw).replace(/[\u00a0\u200b]/g, ' ').trim();
  if (!text) return succeed(null);

  const iso = ISO_TEXT.exec(text);
  if (iso) return fromParts(Number(iso[1]), Number(iso[2]), Number(iso[3]), text);

  const dmy = DMY_TEXT.exec(text);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    if (month > 12 && day <= 12) {
      // "04/25/2020": unmistakably month-first. Never silently swap it.
      return fail(
        `"${text}" looks like MM/DD/YYYY (month ${month}). Dates must be written DD-MM-YYYY, for example 05-04-2016.`
      );
    }
    return fromParts(year, month, day, text);
  }

  return fail(`"${text}" is not a valid date. Use DD-MM-YYYY (for example 05-04-2016) or YYYY-MM-DD.`);
}

/**
 * Parses one spreadsheet cell into an ISO "YYYY-MM-DD" date.
 *
 * Accepts a JS Date (what ExcelJS returns for a date-formatted cell: UTC
 * midnight), a numeric Excel serial (1900 or 1904 date system), or text as
 * DD-MM-YYYY / DD/MM/YYYY / D-M-YYYY / YYYY-MM-DD. A blank cell is ok with
 * `iso: null`. Never guesses: month-first text and impossible calendar
 * dates are rejected with a reason that can be shown to the user.
 *
 * @returns {{ok: boolean, iso: string|null, reason?: string}}
 */
function parseDateCell(value, { date1904 = false } = {}) {
  if (value === null || value === undefined || value === '') return succeed(null);

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return fail('The date cell is not a valid date.');
    return fromUtcMs(value.getTime(), 'the date cell');
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return fail('The date cell is not a valid date.');
    const days = Math.floor(value);
    if (!date1904 && days < FIRST_RELIABLE_1900_SERIAL) {
      return fail(`The number ${value} is not a usable date (it falls before 01-03-1900).`);
    }
    if (days < 0) return fail(`The number ${value} is not a usable date.`);
    const epoch = date1904 ? EPOCH_1904_SYSTEM_MS : EPOCH_1900_SYSTEM_MS;
    return fromUtcMs(epoch + days * MS_PER_DAY, String(value));
  }

  if (typeof value === 'string') return parseText(value);

  return fail('The cell does not contain a date.');
}

/** ISO "YYYY-MM-DD" -> Date at UTC midnight (what an Excel date cell needs). */
function isoToUtcDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

/** ISO "YYYY-MM-DD" -> "DD-MM-YYYY" (pure string work, no Date involved). */
function formatDMY(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

/** Date-only part of a DB value ("YYYY-MM-DD" or "YYYY-MM-DD HH:MM:SS"), or null. */
function isoDatePart(value) {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(value || ''));
  return m ? m[1] : null;
}

/**
 * The latest calendar date that exists ANYWHERE on Earth right now (UTC now
 * plus 14 hours). "Not in the future" rules compare against this so a
 * person entering today's date in Kiribati is never rejected, and no
 * server/OS timezone is ever consulted.
 */
function latestDateOnEarthIso(nowMs = Date.now()) {
  const d = new Date(nowMs + MAX_UTC_OFFSET_HOURS * 3600000);
  return toIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

module.exports = {
  parseDateCell,
  isoToUtcDate,
  formatDMY,
  isoDatePart,
  latestDateOnEarthIso,
  MIN_YEAR,
  MAX_YEAR,
};
