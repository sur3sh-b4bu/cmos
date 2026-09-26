const {
  parseDateCell,
  isoToUtcDate,
  formatDMY,
  isoDatePart,
  latestDateOnEarthIso,
} = require('./dateOnly');

const ok = (value, opts) => parseDateCell(value, opts);

describe('parseDateCell - every way a date can arrive from Excel', () => {
  it('accepts a real Excel date cell (JS Date at UTC midnight) without shifting the day', () => {
    expect(ok(new Date(Date.UTC(2016, 3, 5)))).toEqual({ ok: true, iso: '2016-04-05' });
    expect(ok(new Date(Date.UTC(2020, 1, 29)))).toEqual({ ok: true, iso: '2020-02-29' });
    // Year boundary: the classic place a timezone shift shows up.
    expect(ok(new Date(Date.UTC(2019, 0, 1)))).toEqual({ ok: true, iso: '2019-01-01' });
    expect(ok(new Date(Date.UTC(2019, 11, 31)))).toEqual({ ok: true, iso: '2019-12-31' });
  });

  it('takes the UTC calendar date of a Date that carries a time of day', () => {
    expect(ok(new Date(Date.UTC(2016, 3, 5, 23, 59, 59)))).toEqual({ ok: true, iso: '2016-04-05' });
  });

  it('accepts numeric Excel serials in the 1900 system', () => {
    expect(ok(42465)).toEqual({ ok: true, iso: '2016-04-05' });
    expect(ok(42465.75)).toEqual({ ok: true, iso: '2016-04-05' }); // time fraction ignored
    expect(ok(61)).toEqual({ ok: true, iso: '1900-03-01' });
    expect(ok(25569)).toEqual({ ok: true, iso: '1970-01-01' });
  });

  it('rejects serials that fall in Excel\'s fictional 29-Feb-1900 range', () => {
    expect(ok(60).ok).toBe(false);
    expect(ok(1).ok).toBe(false);
    expect(ok(-5).ok).toBe(false);
  });

  it('accepts numeric serials in the 1904 system (a file saved by Excel for Mac, old versions)', () => {
    // Same calendar date, serial is 1462 days smaller in the 1904 system.
    expect(ok(42465 - 1462, { date1904: true })).toEqual({ ok: true, iso: '2016-04-05' });
    expect(ok(0, { date1904: true })).toEqual({ ok: true, iso: '1904-01-01' });
    // ...and the same number means a different date in the 1900 system.
    expect(ok(42465 - 1462).iso).not.toBe('2016-04-05');
  });

  it.each([
    ['05-04-2016', '2016-04-05'],
    ['05/04/2016', '2016-04-05'],
    ['5-4-2016', '2016-04-05'],
    ['5/4/2016', '2016-04-05'],
    ['  05-04-2016  ', '2016-04-05'],
    ['2016-04-05', '2016-04-05'],
    ['2016-4-5', '2016-04-05'],
    ['2016/04/05', '2016-04-05'],
    ['29-02-2020', '2020-02-29'],
    ['\u00a005-04-2016\u00a0', '2016-04-05'], // non-breaking spaces from copy/paste
  ])('accepts text %j as %s', (text, expected) => {
    expect(ok(text)).toEqual({ ok: true, iso: expected });
  });

  it('treats DD-MM-YYYY as day-first and never silently swaps to US month-first', () => {
    expect(ok('04-05-2016').iso).toBe('2016-05-04'); // 4 May, NOT 5 April
    const us = ok('04/25/2020');
    expect(us.ok).toBe(false);
    expect(us.reason).toMatch(/MM\/DD\/YYYY/);
    expect(us.reason).toMatch(/DD-MM-YYYY/);
  });

  it.each([
    ['not-a-date'],
    ['31-02-2020'],
    ['29-02-2019'], // 2019 is not a leap year
    ['00-01-2020'],
    ['32-01-2020'],
    ['10-13-2020x'],
    ['05-04-16'], // two-digit years are ambiguous, never guessed
    ['2020-13-01'],
    ['1850-01-01'],
    ['2200-01-01'],
    ['05 April 2016'],
  ])('rejects %j with a reason', (text) => {
    const r = ok(text);
    expect(r.ok).toBe(false);
    expect(r.iso).toBeNull();
    expect(r.reason).toEqual(expect.any(String));
    expect(r.reason.length).toBeGreaterThan(10);
  });

  it('names the impossible date in the reason', () => {
    expect(ok('31-02-2020').reason).toMatch(/31-02-2020/);
    expect(ok('31-02-2020').reason).toMatch(/29 days/);
  });

  it('treats blank cells as "no value", not an error', () => {
    expect(ok(null)).toEqual({ ok: true, iso: null });
    expect(ok(undefined)).toEqual({ ok: true, iso: null });
    expect(ok('')).toEqual({ ok: true, iso: null });
    expect(ok('   ')).toEqual({ ok: true, iso: null });
  });

  it('rejects values that are not dates at all', () => {
    expect(ok(true).ok).toBe(false);
    expect(ok({}).ok).toBe(false);
    expect(ok(new Date('invalid')).ok).toBe(false);
    expect(ok(Number.NaN).ok).toBe(false);
    expect(ok(Infinity).ok).toBe(false);
  });

  it('gives the same answer for an Excel date cell, a numeric serial and both text forms', () => {
    const fromCell = ok(new Date(Date.UTC(2016, 3, 5))).iso;
    const fromSerial = ok(42465).iso;
    const fromDmy = ok('05-04-2016').iso;
    const fromIso = ok('2016-04-05').iso;
    expect(new Set([fromCell, fromSerial, fromDmy, fromIso]).size).toBe(1);
  });
});

describe('date-only conversion helpers', () => {
  it('turns ISO into a Date at UTC midnight and back without drifting', () => {
    const d = isoToUtcDate('2016-04-05');
    expect(d.getTime()).toBe(Date.UTC(2016, 3, 5));
    expect(d.toISOString()).toBe('2016-04-05T00:00:00.000Z');
    expect(parseDateCell(d).iso).toBe('2016-04-05');
  });

  it('rejects non-ISO input', () => {
    expect(isoToUtcDate('05-04-2016')).toBeNull();
    expect(isoToUtcDate('')).toBeNull();
    expect(isoToUtcDate(null)).toBeNull();
  });

  it('formats DD-MM-YYYY with plain string work', () => {
    expect(formatDMY('2016-04-05')).toBe('05-04-2016');
    expect(formatDMY('2016-04-05 13:00:00')).toBe('05-04-2016');
    expect(formatDMY(null)).toBe('');
  });

  it('extracts the date part of DB values', () => {
    expect(isoDatePart('2026-09-18 14:32:00')).toBe('2026-09-18');
    expect(isoDatePart('2026-09-18')).toBe('2026-09-18');
    expect(isoDatePart('')).toBeNull();
  });
});

describe('latestDateOnEarthIso (the "not in the future" cut-off)', () => {
  it('is UTC now + 14h, so nobody in Kiribati is rejected for entering today', () => {
    // 2026-01-01 10:00 UTC is already 2026-01-02 00:00 in UTC+14.
    expect(latestDateOnEarthIso(Date.UTC(2026, 0, 1, 10, 0, 0))).toBe('2026-01-02');
    expect(latestDateOnEarthIso(Date.UTC(2026, 0, 1, 9, 59, 59))).toBe('2026-01-01');
    expect(latestDateOnEarthIso(Date.UTC(2025, 11, 31, 12, 0, 0))).toBe('2026-01-01');
  });
});
