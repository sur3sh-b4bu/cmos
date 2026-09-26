const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Turns a date-only API value ("2016-04-05") into the Date a datepicker
 * expects -- local midnight of that same calendar day, so the picker shows
 * 05-04-2016 in every timezone (`new Date("2016-04-05")` is UTC midnight,
 * which is the previous evening anywhere west of UTC). Anything that is not
 * a plain date-only string falls back to `new Date(value)`.
 */
export function parseDateOnly(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const match = DATE_ONLY.exec(value);
  const date = match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Single source of truth for displaying a date as DD-MM-YYYY -- the app-wide
 * standard. Table/list column accessors and anything else that formats a date
 * outside Angular's `date` pipe (which can just use `| date:'dd-MM-yyyy'`)
 * should go through this rather than hand-rolling `toLocaleDateString(...)`,
 * which is how the app ended up with several inconsistent formats in the
 * first place.
 */
export function formatDateDMY(value: string | Date | null | undefined): string {
  if (!value) return '-';
  // A date-only value from the API ("2016-04-05") is a calendar date, not a
  // moment in time. `new Date("2016-04-05")` would read it as UTC midnight
  // and the local getters below would then show 04-04-2016 in any timezone
  // west of UTC -- so format it straight from its own digits instead.
  if (typeof value === 'string') {
    const dateOnly = DATE_ONLY.exec(value);
    if (dateOnly) return `${dateOnly[3]}-${dateOnly[2]}-${dateOnly[1]}`;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}-${month}-${date.getFullYear()}`;
}

/** Same DD-MM-YYYY date, with a 24-hour HH:mm alongside it for timestamps
 * (last login, audit log entries) where the time matters. */
export function formatDateTimeDMY(value: string | Date | null | undefined): string {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${formatDateDMY(date)} ${hours}:${minutes}`;
}
