import { safeCell, safeFileName, safeSheetName } from './report-builder';

describe('report-builder - what goes into a downloaded workbook', () => {
  it('never lets typed text be read by Excel as a formula', () => {
    expect(safeCell('=HYPERLINK("http://evil","x")')).toBe(`'=HYPERLINK("http://evil","x")`);
    expect(safeCell('+1+1')).toBe("'+1+1");
    expect(safeCell('-2+3')).toBe("'-2+3");
    expect(safeCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(safeCell('\tcmd')).toBe("'\tcmd");
  });

  it('leaves ordinary values alone, numbers included', () => {
    expect(safeCell("St. Mary's Church")).toBe("St. Mary's Church");
    expect(safeCell('திருச்சிலுவை பேராலயம்')).toBe('திருச்சிலுவை பேராலயம்');
    expect(safeCell(0)).toBe(0);
    expect(safeCell(-12.5)).toBe(-12.5);
    expect(safeCell(null)).toBeNull();
  });

  it('makes sheet names Excel accepts: at most 31 characters and none of the forbidden ones', () => {
    expect(safeSheetName('Church/Branch: [Q1]?')).toBe('Church Branch   Q1');
    expect(safeSheetName('A very long report name that goes past thirty-one characters').length).toBe(31);
    expect(safeSheetName('???')).toBe('Report');
  });

  it('makes file names safe on every operating system', () => {
    expect(safeFileName('church activity: 2026/09')).toBe('church-activity-2026-09');
    expect(safeFileName('a"b<c>d|e')).toBe('a-b-c-d-e');
    expect(safeFileName('x'.repeat(200)).length).toBe(80);
  });
});
