const { resolvePeriod, bucketKeys, parseKey } = require('./period');

// Friday 25 September 2026 (a Friday), local time.
const NOW = new Date(2026, 8, 25, 14, 30);
const p = (query) => resolvePeriod(query, NOW);

describe('resolvePeriod - what "this month" means and what it is compared with', () => {
  it('today is compared with yesterday', () => {
    expect(p({ period: 'today' })).toMatchObject({ from: '2026-09-25', to: '2026-09-25', previous: { from: '2026-09-24', to: '2026-09-24' }, granularity: 'day' });
  });

  it('this week runs Monday to today and is compared with the same days of last week', () => {
    expect(p({ period: 'week' })).toMatchObject({ from: '2026-09-21', to: '2026-09-25', previous: { from: '2026-09-14', to: '2026-09-18' } });
  });

  it('a week that starts on a Sunday still begins on Monday', () => {
    const sunday = resolvePeriod({ period: 'week' }, new Date(2026, 8, 27));
    expect(sunday).toMatchObject({ from: '2026-09-21', to: '2026-09-27' });
  });

  it('this month is the month so far, compared with the same elapsed days of the previous month', () => {
    expect(p({ period: 'month' })).toMatchObject({ from: '2026-09-01', to: '2026-09-25', previous: { from: '2026-08-01', to: '2026-08-25' }, granularity: 'day' });
  });

  it('this quarter and this year are compared with the same elapsed part of the previous one', () => {
    expect(p({ period: 'quarter' })).toMatchObject({ from: '2026-07-01', to: '2026-09-25', previous: { from: '2026-04-01', to: '2026-06-25' }, granularity: 'month' });
    expect(p({ period: 'year' })).toMatchObject({ from: '2026-01-01', to: '2026-09-25', previous: { from: '2025-01-01', to: '2025-09-25' }, granularity: 'month' });
  });

  it('never runs past the end of a shorter month when shifting back', () => {
    const mar31 = resolvePeriod({ period: 'month' }, new Date(2026, 2, 31));
    expect(mar31.previous).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    const leap = resolvePeriod({ period: 'month' }, new Date(2028, 2, 31));
    expect(leap.previous).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });

  it('a custom period is compared with the equal-length period right before it', () => {
    expect(p({ period: 'custom', from: '2026-09-10', to: '2026-09-19' })).toMatchObject({
      from: '2026-09-10', to: '2026-09-19', previous: { from: '2026-08-31', to: '2026-09-09' }, granularity: 'day',
    });
  });

  it('defaults to this month when no period is given', () => {
    expect(p({}).preset).toBe('month');
  });
});

describe('resolvePeriod - bad input is a clear 400, never a guess', () => {
  it('rejects an unknown preset', () => {
    expect(() => p({ period: 'decade' })).toThrow(/Unknown period/);
  });
  it('rejects a custom period with missing, impossible or reversed dates', () => {
    expect(() => p({ period: 'custom' })).toThrow(/valid from and to/);
    expect(() => p({ period: 'custom', from: '2026-02-31', to: '2026-03-05' })).toThrow(/valid from and to/);
    expect(() => p({ period: 'custom', from: '2026-09-10', to: '2026-09-01' })).toThrow(/starts after it ends/);
    expect(() => p({ period: 'custom', from: '2010-01-01', to: '2026-01-01' })).toThrow(/10 years/);
  });
});

describe('buckets - every day or month in the range, so empty ones show as zero', () => {
  it('lists each day for a short range and each month for a long one', () => {
    expect(p({ period: 'week' }).buckets).toEqual(['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25']);
    expect(p({ period: 'year' }).buckets).toEqual(['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']);
  });

  it('uses years for a multi-year custom range', () => {
    const r = p({ period: 'custom', from: '2019-05-01', to: '2026-09-25' });
    expect(r.granularity).toBe('year');
    expect(r.buckets).toEqual(['2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026']);
  });

  it('bucketKeys handles a range that starts mid-month', () => {
    expect(bucketKeys(parseKey('2026-01-31'), parseKey('2026-03-02'), 'month')).toEqual(['2026-01', '2026-02', '2026-03']);
  });
});
