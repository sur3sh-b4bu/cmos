import { formatDateDMY, formatDateTimeDMY, parseDateOnly } from './date-format.util';

describe('formatDateDMY', () => {
  it('formats a Date object as DD-MM-YYYY', () => {
    expect(formatDateDMY(new Date(2026, 0, 5))).toBe('05-01-2026');
  });

  it('pads single-digit day and month', () => {
    expect(formatDateDMY(new Date(2026, 8, 3))).toBe('03-09-2026');
  });

  it('does not pad the year', () => {
    expect(formatDateDMY(new Date(1999, 11, 25))).toBe('25-12-1999');
  });

  it('returns a dash for null/undefined/empty string', () => {
    expect(formatDateDMY(null)).toBe('-');
    expect(formatDateDMY(undefined)).toBe('-');
    expect(formatDateDMY('')).toBe('-');
  });

  it('returns a dash for an unparseable string instead of throwing', () => {
    expect(formatDateDMY('not-a-date')).toBe('-');
  });

  // A date-only API value is a calendar date: the same day in every timezone
  // (run the suite with TZ=Pacific/Pago_Pago and TZ=Pacific/Kiritimati too).
  it('shows a date-only string as its own day, whatever the browser timezone', () => {
    expect(formatDateDMY('2016-04-05')).toBe('05-04-2016');
    expect(formatDateDMY('2020-01-01')).toBe('01-01-2020');
    expect(formatDateDMY('2020-12-31')).toBe('31-12-2020');
  });
});

describe('parseDateOnly', () => {
  it('gives the local-midnight Date a datepicker needs, on the same calendar day', () => {
    const date = parseDateOnly('2016-04-05')!;
    expect([date.getFullYear(), date.getMonth() + 1, date.getDate()]).toEqual([2016, 4, 5]);
  });

  it('returns null for empty or unparseable input', () => {
    expect(parseDateOnly(null)).toBeNull();
    expect(parseDateOnly('')).toBeNull();
    expect(parseDateOnly('nope')).toBeNull();
  });
});

describe('formatDateTimeDMY', () => {
  it('appends a 24-hour HH:mm after the DD-MM-YYYY date', () => {
    expect(formatDateTimeDMY(new Date(2026, 0, 5, 9, 5))).toBe('05-01-2026 09:05');
  });

  it('uses 24-hour hours (no AM/PM) for an afternoon time', () => {
    expect(formatDateTimeDMY(new Date(2026, 0, 5, 23, 45))).toBe('05-01-2026 23:45');
  });

  it('returns a dash for null/undefined, same as formatDateDMY', () => {
    expect(formatDateTimeDMY(null)).toBe('-');
    expect(formatDateTimeDMY(undefined)).toBe('-');
  });
});
