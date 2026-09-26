export interface RestrictedDateRow {
  id: number;
  name: string;
  holiday_date: string; // 'YYYY-MM-DD', as returned by the masters API
  reason: string | null;
  is_recurring_yearly: number;
}

export const DEFAULT_RESTRICTED_DATE_REASON =
  'No Mass Intentions are accepted on this day due to church regulations.';

/**
 * Mirrors backend/src/utils/restrictedDates.js's matching rule exactly --
 * the form's warning banner and the server's booking validation must agree
 * on what counts as a Restricted Date, or a date warned about here could
 * still (or fail to) be rejected there.
 */
export function isRestrictedDate(rows: RestrictedDateRow[], date: Date | null): boolean {
  if (!date) return false;
  return rows.some((row) => {
    const [y, m, d] = row.holiday_date.split('-').map(Number);
    if (row.is_recurring_yearly) {
      return date.getMonth() === m - 1 && date.getDate() === d;
    }
    return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
  });
}

/** The specific row a date matches, for showing its name/reason in the warning. */
export function findRestrictedDate(rows: RestrictedDateRow[], date: Date | null): RestrictedDateRow | null {
  if (!date) return null;
  return (
    rows.find((row) => {
      const [y, m, d] = row.holiday_date.split('-').map(Number);
      if (row.is_recurring_yearly) {
        return date.getMonth() === m - 1 && date.getDate() === d;
      }
      return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
    }) ?? null
  );
}
