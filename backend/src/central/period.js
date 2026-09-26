'use strict';

/**
 * Central Management analytics periods.
 *
 * A period is a closed date range [from, to] plus the range it is compared with. "This month" means
 * the month so far (1st .. today) and is compared with the same elapsed part of the PREVIOUS month
 * (1st .. same day), so a half-finished month is never measured against a whole one. All dates are
 * plain calendar days (YYYY-MM-DD) in the server's local time -- the same "today" the office sees.
 */

const ApiError = require('../utils/ApiError');

const PRESETS = ['today', 'week', 'month', 'quarter', 'year', 'custom'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SPAN_DAYS = 3660;

const pad = (n) => String(n).padStart(2, '0');
const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function parseKey(key) {
  if (!DATE_RE.test(key)) return null;
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  // Rejects 2026-02-31 and friends instead of letting them roll into March.
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
}

const addDays = (date, n) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
const daysBetween = (a, b) => Math.round((b.getTime() - a.getTime()) / 86400000);

/** Same day-of-month `months` earlier, clamped to that month's last day (31 Mar - 1 month = 28/29 Feb). */
function shiftMonths(date, months) {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(date.getDate(), lastDay));
}

function granularityFor(from, to) {
  const span = daysBetween(from, to) + 1;
  if (span <= 45) return 'day';
  if (span <= 800) return 'month';
  return 'year';
}

/** Every bucket key from `from` to `to`, so a chart shows empty days/months as zero instead of skipping them. */
function bucketKeys(from, to, granularity) {
  const keys = [];
  if (granularity === 'day') {
    for (let d = from; d <= to; d = addDays(d, 1)) keys.push(toKey(d));
  } else if (granularity === 'month') {
    for (let d = new Date(from.getFullYear(), from.getMonth(), 1); d <= to; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      keys.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
    }
  } else {
    for (let y = from.getFullYear(); y <= to.getFullYear(); y += 1) keys.push(String(y));
  }
  return keys;
}

/**
 * @param {{period?: string, from?: string, to?: string}} query
 * @param {Date} [now]
 * @returns {{preset: string, from: string, to: string, previous: {from: string, to: string}, granularity: 'day'|'month'|'year', buckets: string[]}}
 */
function resolvePeriod(query = {}, now = new Date()) {
  const preset = query.period || 'month';
  if (!PRESETS.includes(preset)) throw ApiError.badRequest(`Unknown period "${preset}". Use one of: ${PRESETS.join(', ')}.`);

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let from;
  let to = today;
  let prevFrom;
  let prevTo;

  if (preset === 'custom') {
    from = parseKey(query.from || '');
    to = parseKey(query.to || '');
    if (!from || !to) throw ApiError.badRequest('A custom period needs a valid from and to date (YYYY-MM-DD).');
    if (from > to) throw ApiError.badRequest('The custom period starts after it ends.');
    const span = daysBetween(from, to) + 1;
    if (span > MAX_SPAN_DAYS) throw ApiError.badRequest('A custom period can cover at most 10 years.');
    prevTo = addDays(from, -1);
    prevFrom = addDays(prevTo, -(span - 1));
  } else if (preset === 'today') {
    from = today;
    prevFrom = prevTo = addDays(today, -1);
  } else if (preset === 'week') {
    const monday = addDays(today, -((today.getDay() + 6) % 7));
    from = monday;
    prevFrom = addDays(monday, -7);
    prevTo = addDays(today, -7);
  } else if (preset === 'month') {
    from = new Date(today.getFullYear(), today.getMonth(), 1);
    prevFrom = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    prevTo = shiftMonths(today, -1);
  } else if (preset === 'quarter') {
    from = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
    prevFrom = new Date(from.getFullYear(), from.getMonth() - 3, 1);
    prevTo = shiftMonths(today, -3);
  } else {
    from = new Date(today.getFullYear(), 0, 1);
    prevFrom = new Date(today.getFullYear() - 1, 0, 1);
    prevTo = shiftMonths(today, -12);
  }

  const granularity = granularityFor(from, to);
  return {
    preset,
    from: toKey(from),
    to: toKey(to),
    previous: { from: toKey(prevFrom), to: toKey(prevTo) },
    granularity,
    buckets: bucketKeys(from, to, granularity),
  };
}

/** The same period, but for "This year (to date)" style side numbers that ignore the chosen period. */
function yearToDate(now = new Date()) {
  return resolvePeriod({ period: 'year' }, now);
}

module.exports = { PRESETS, resolvePeriod, yearToDate, bucketKeys, parseKey, toKey };
