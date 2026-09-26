/**
 * Single source of truth for displaying a date as DD-MM-YYYY on generated
 * PDFs (receipts, certificates, the daily register) -- mirrors
 * frontend/src/app/core/utils/date-format.util.ts so print output and screen
 * display never disagree.
 */
function formatDateDMY(value) {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}-${month}-${date.getFullYear()}`;
}

/**
 * "Today"/an arbitrary Date as a YYYY-MM-DD string in the SERVER's local
 * timezone -- deliberately NOT `date.toISOString().slice(0, 10)`, which is
 * UTC and silently drifts the calendar day backward for any local time
 * before the timezone's UTC offset (e.g. every save made between midnight
 * and 05:29 IST got stamped with *yesterday's* date -- this bug is why a
 * bulk save entered right after midnight showed up as "yesterday" on the
 * dashboard/collections until it was fixed here). Used anywhere a query or
 * default value means "today" as the office understands it, not UTC's.
 */
function toLocalDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

module.exports = { formatDateDMY, toLocalDateString };
