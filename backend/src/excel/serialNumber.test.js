const { extractSerial, formatSerial, serialResolver, serialHint } = require('./serialNumber');

const number = (raw, prefix = 'RCT') => extractSerial(raw, prefix).number;
const error = (raw, prefix = 'RCT') => extractSerial(raw, prefix).error;

describe('extractSerial - the number inside a register cell', () => {
  it('reads a plain number however Excel or a person wrote it', () => {
    expect(number('12')).toBe(12);
    expect(number(' 12 ')).toBe(12);
    expect(number('0012')).toBe(12);
    expect(number('12.0')).toBe(12); // Excel showing a whole number as a decimal
    expect(number('7')).toBe(7);
  });

  it('ignores labels around it: No. 12, S.No-5, #12', () => {
    expect(number('No. 12')).toBe(12);
    expect(number('S.No-5')).toBe(5);
    expect(number('Sl No 33')).toBe(33);
    expect(number('#12')).toBe(12);
  });

  it('strips this church\'s own prefix, with or without a separator, in any case', () => {
    expect(number('RCT0012')).toBe(12);
    expect(number('rct-12')).toBe(12);
    expect(number('RCT/0012')).toBe(12);
    expect(number('BAP0007', 'BAP')).toBe(7);
  });

  it('takes the FIRST number when there are several, so a year or page after it is ignored', () => {
    expect(number('12/2020')).toBe(12);
    expect(number('BAP/0012/2020', 'BAP')).toBe(12);
  });

  it('a blank cell is blank (the row is numbered automatically), not an error', () => {
    expect(extractSerial('', 'RCT')).toEqual({ blank: true });
    expect(extractSerial('   ', 'RCT')).toEqual({ blank: true });
    expect(extractSerial(null, 'RCT')).toEqual({ blank: true });
    expect(extractSerial(undefined, 'RCT')).toEqual({ blank: true });
  });

  it('refuses what is not a usable number, saying why', () => {
    expect(error('abc')).toMatch(/No number found in "abc"/);
    expect(error('0')).toMatch(/must be 1 or more/);
    expect(error('1.5')).toMatch(/not a whole number/);
    expect(error('12,5')).toMatch(/not a whole number/);
    expect(error('9999999999')).toMatch(/too large/);
  });

  it('refuses a cell Excel turned into a date, instead of silently reading its day as the number', () => {
    expect(error('01-02-2026')).toMatch(/looks like a date/);
  });

  it('copes with a prefix that contains regex characters', () => {
    expect(number('A.B-12', 'A.B')).toBe(12);
    expect(number('A+B12', 'A+B')).toBe(12);
  });
});

describe('formatSerial / serialResolver / serialHint', () => {
  it('adds the prefix and pads to the series\' width, but never cuts a longer number', () => {
    expect(formatSerial('RCT', 4, 12)).toBe('RCT0012');
    expect(formatSerial('STM', 3, 7)).toBe('STM007');
    expect(formatSerial('BAP', 4, 123456)).toBe('BAP123456');
  });

  it('resolves a cell to the church\'s formatted number, or an error for the row', () => {
    const lookups = { serialFormat: { prefix: 'STM', padding: 3 } };
    expect(serialResolver('No. 7', lookups)).toEqual({ value: 'STM007' });
    expect(serialResolver('STM-15', lookups)).toEqual({ value: 'STM015' });
    expect(serialResolver('nope', lookups).error).toMatch(/No number found/);
  });

  it('describes the rule using the church\'s real prefix, in both languages', () => {
    expect(serialHint({ prefix: 'STM', padding: 3 }, 'en')).toContain('12 becomes STM012');
    expect(serialHint({ prefix: 'STM', padding: 3 }, 'ta')).toContain('12 → STM012');
  });
});
