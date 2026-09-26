/**
 * Shared "is this date a Restricted Date" logic -- used both to validate
 * Mass Intention bookings and to list upcoming Restricted Dates on the
 * dashboard, so the two features can never disagree about what counts as one.
 *
 * `holidays` rows come back from mysql2 as plain 'YYYY-MM-DD' strings (the
 * pool is configured with dateStrings: true), so every date here is handled
 * as a string/local-midnight Date rather than relying on DB timezone
 * conversion, matching the pattern used elsewhere in the app (e.g. the daily
 * register's own date handling).
 */

function parseDateOnly(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** True if `row` (a holidays record) falls on `targetDateStr` ('YYYY-MM-DD'). */
function matchesDate(row, targetDateStr) {
  const target = parseDateOnly(targetDateStr);
  const rowDate = parseDateOnly(row.holiday_date);
  if (row.is_recurring_yearly) {
    return rowDate.getMonth() === target.getMonth() && rowDate.getDate() === target.getDate();
  }
  return rowDate.getTime() === target.getTime();
}

/** First matching Restricted Date among `rows` for one date, or null. */
function findMatch(rows, targetDateStr) {
  return rows.find((row) => matchesDate(row, targetDateStr)) || null;
}

/**
 * The next real calendar date `row` falls on, on/after `from`. Recurring rows
 * roll forward to next year once this year's occurrence has passed.
 *
 * Note: a recurring restricted date dated Feb 29 has no real occurrence in a
 * non-leap year; such a row is skipped in those years rather than shifted to
 * Feb 28/Mar 1, since either substitution would be a guess.
 */
function nextOccurrence(row, from) {
  const rowDate = parseDateOnly(row.holiday_date);
  if (!row.is_recurring_yearly) {
    return rowDate >= from ? rowDate : null;
  }
  // Leap years are at most 8 years apart (the Gregorian century-non-leap
  // rule), so searching 9 years ahead always finds the next real Feb 29 if
  // one exists; every other recurring date resolves within the first 2 years.
  const isFeb29 = rowDate.getMonth() === 1 && rowDate.getDate() === 29;
  const yearsToCheck = isFeb29 ? 9 : 2;
  for (let i = 0; i < yearsToCheck; i += 1) {
    const year = from.getFullYear() + i;
    if (isFeb29 && !isLeapYear(year)) continue;
    const candidate = new Date(year, rowDate.getMonth(), rowDate.getDate());
    if (candidate >= from) return candidate;
  }
  return null;
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** `rows` sorted by next occurrence on/after `from`, capped to `limit`. */
function listUpcoming(rows, from, limit) {
  return rows
    .map((row) => ({ ...row, next_occurrence: nextOccurrence(row, from) }))
    .filter((row) => row.next_occurrence !== null)
    .sort((a, b) => a.next_occurrence - b.next_occurrence)
    .slice(0, limit);
}

module.exports = { matchesDate, findMatch, nextOccurrence, listUpcoming, parseDateOnly };
