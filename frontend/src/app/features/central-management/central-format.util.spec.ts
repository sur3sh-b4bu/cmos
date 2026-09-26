import { bucketLabel, churchLabel, formatChange, formatCount, formatMoney, namedLabel, niceTicks, thinIndices, trendDirection, weekdayShort } from './central-format.util';

const INR = { code: 'INR', symbol: '₹' };
const USD = { code: 'USD', symbol: '$' };

describe('formatMoney - compact amounts for a KPI', () => {
  it('uses lakh and crore for rupees', () => {
    expect(formatMoney(124300, INR)).toBe('₹1.2L');
    expect(formatMoney(15000000, INR)).toBe('₹1.5Cr');
    expect(formatMoney(2500000, INR)).toBe('₹25L');
    expect(formatMoney(48000, INR)).toBe('₹48K');
  });

  it('shows small amounts exactly', () => {
    expect(formatMoney(0, INR)).toBe('₹0');
    expect(formatMoney(999, INR)).toBe('₹999');
    expect(formatMoney(250.5, INR)).toBe('₹250.5');
  });

  it('uses K / M / B for other currencies', () => {
    expect(formatMoney(12500, USD)).toBe('$12.5K');
    expect(formatMoney(3400000, USD)).toBe('$3.4M');
    expect(formatMoney(2100000000, USD)).toBe('$2.1B');
  });

  it('gives the exact grouped figure for a tooltip, in Indian grouping', () => {
    expect(formatMoney(124300, INR, 'en', true)).toBe('₹1,24,300');
    expect(formatMoney(-500, INR)).toBe('-₹500');
  });
});

describe('change and trend direction', () => {
  it('formats a change with its sign, and an en dash when there is nothing to compare with', () => {
    expect(formatChange(14.8)).toBe('+14.8%');
    expect(formatChange(-3.2)).toBe('-3.2%');
    expect(formatChange(0)).toBe('0%');
    expect(formatChange(null)).toBe('–');
  });

  it('treats a swing within 2% as flat, and no baseline as new', () => {
    expect(trendDirection(14.8)).toBe('up');
    expect(trendDirection(-9)).toBe('down');
    expect(trendDirection(1.9)).toBe('flat');
    expect(trendDirection(-2)).toBe('flat');
    expect(trendDirection(null)).toBe('new');
  });
});

describe('labels', () => {
  it('counts with Indian grouping', () => {
    expect(formatCount(1234567)).toBe('12,34,567');
    expect(formatCount(1234.6)).toBe('1,235');
  });

  it('labels chart points by granularity', () => {
    expect(bucketLabel('2026-09-25', 'day')).toBe('25 Sept');
    expect(bucketLabel('2026-09', 'month')).toMatch(/Sep.*26/);
    expect(bucketLabel('2026', 'year')).toBe('2026');
  });

  it('names weekdays from MySQL DAYOFWEEK (1 = Sunday)', () => {
    expect(weekdayShort(1)).toBe('Sun');
    expect(weekdayShort(2)).toBe('Mon');
    expect(weekdayShort(7)).toBe('Sat');
  });

  it('shows a church in Tamil only when the language is Tamil and a Tamil name exists', () => {
    const church = { name: "St. Mary's", nameTa: 'புனித மரியாள்' };
    expect(churchLabel(church, 'en')).toBe("St. Mary's");
    expect(churchLabel(church, 'ta')).toBe('புனித மரியாள்');
    expect(churchLabel({ name: 'Holy Cross', nameTa: null }, 'ta')).toBe('Holy Cross');
    expect(churchLabel(null, 'en')).toBe('');
  });

  it('names a type row, falling back for the "other" and custom groups', () => {
    expect(namedLabel({ name: 'Thanksgiving', nameTa: 'நன்றி' }, 'ta', 'x')).toBe('நன்றி');
    expect(namedLabel({ name: 'Thanksgiving', nameTa: null }, 'ta', 'x')).toBe('Thanksgiving');
    expect(namedLabel({ name: null, nameTa: null }, 'en', 'Custom')).toBe('Custom');
  });
});

describe('axis helpers', () => {
  it('makes round ticks that cover the maximum', () => {
    expect(niceTicks(0)).toEqual([0, 1]);
    expect(niceTicks(87)).toEqual([0, 50, 100]);
    expect(niceTicks(3)).toEqual([0, 1, 2, 3]);
    expect(niceTicks(2)).toEqual([0, 1, 2]); // never 0, 0.5, 1, 1.5, 2 for whole-number data
  });

  it('thins labels to fit, always keeping the first and last', () => {
    expect(thinIndices(5, 8)).toEqual([0, 1, 2, 3, 4]);
    const many = thinIndices(30, 6);
    expect(many[0]).toBe(0);
    expect(many[many.length - 1]).toBe(29);
    expect(many.length).toBeLessThanOrEqual(7);
    expect(thinIndices(0, 5)).toEqual([]);
  });
});
