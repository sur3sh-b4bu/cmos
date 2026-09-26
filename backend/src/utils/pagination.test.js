const { clampPageSize, clampPage, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } = require('./pagination');

describe('clampPageSize', () => {
  it('passes through a normal value unchanged', () => {
    expect(clampPageSize(50)).toBe(50);
  });

  it('caps a value above the max instead of letting it through', () => {
    // The exact bug this guards against: an unbounded pageSize reaching the
    // DB as a literal `LIMIT 999999999`.
    expect(clampPageSize(999999999)).toBe(MAX_PAGE_SIZE);
  });

  it('falls back to the default for zero, negative, or non-numeric input', () => {
    expect(clampPageSize(0)).toBe(DEFAULT_PAGE_SIZE);
    expect(clampPageSize(-5)).toBe(DEFAULT_PAGE_SIZE);
    expect(clampPageSize('not-a-number')).toBe(DEFAULT_PAGE_SIZE);
    expect(clampPageSize(undefined)).toBe(DEFAULT_PAGE_SIZE);
    expect(clampPageSize(NaN)).toBe(DEFAULT_PAGE_SIZE);
  });

  it('coerces a numeric string (as arrives from an Express query param)', () => {
    expect(clampPageSize('50')).toBe(50);
  });

  it('floors a fractional value', () => {
    expect(clampPageSize(25.9)).toBe(25);
  });

  it('respects a custom max', () => {
    expect(clampPageSize(500, 100)).toBe(100);
  });
});

describe('clampPage', () => {
  it('passes through a normal page number unchanged', () => {
    expect(clampPage(3)).toBe(3);
  });

  it('falls back to page 1 for zero, negative, or non-numeric input', () => {
    expect(clampPage(0)).toBe(1);
    expect(clampPage(-1)).toBe(1);
    expect(clampPage('not-a-number')).toBe(1);
    expect(clampPage(undefined)).toBe(1);
  });

  it('coerces a numeric string', () => {
    expect(clampPage('4')).toBe(4);
  });
});
