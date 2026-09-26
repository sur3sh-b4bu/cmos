import ExcelJS from 'exceljs';
import { ImportColumn, coerceImportValue, parseExcelRows, previewExcelFile } from './excel-import.util';

// The Masters/Users import path still reads the sheet in the browser. Dates
// must come out as the calendar day in the sheet in every timezone (run with
// TZ=Pacific/Pago_Pago and TZ=Pacific/Kiritimati as well as the default).
describe('coerceImportValue(date)', () => {
  it('reads an Excel date cell (a Date at UTC midnight) as the day shown in Excel', () => {
    expect(coerceImportValue('date', new Date(Date.UTC(2016, 3, 5)))).toBe('2016-04-05');
  });

  it('reads DD-MM-YYYY, DD/MM/YYYY and ISO text as the same day', () => {
    expect(coerceImportValue('date', '05-04-2016')).toBe('2016-04-05');
    expect(coerceImportValue('date', ' 5/4/2016 ')).toBe('2016-04-05');
    expect(coerceImportValue('date', '2016-04-05')).toBe('2016-04-05');
  });

  it('does not roll an impossible date over to the next month', () => {
    expect(coerceImportValue('date', '31-02-2020')).toBe('31-02-2020');
  });

  it('does not guess at other text; the API rejects it with a message', () => {
    expect(coerceImportValue('date', 'April 5, 2016')).toBe('April 5, 2016');
  });
});

// The "match columns" step, browser-side path (Masters): the sheet is read here, not by the API.
describe('previewExcelFile / parseExcelRows with a chosen mapping', () => {
  const COLUMNS: ImportColumn[] = [
    { key: 'name', label: 'Name', required: true },
    { key: 'code', label: 'Code' },
    { key: 'note', label: 'Description', aliases: ['Notes'] },
  ];

  async function sheetFile(rows: unknown[][]): Promise<File> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Sheet1');
    rows.forEach((r) => ws.addRow(r));
    const buffer = await wb.xlsx.writeBuffer();
    return { arrayBuffer: () => Promise.resolve(buffer) } as unknown as File;
  }

  it('lists the file columns with sample values and suggests fields by heading (or alias)', async () => {
    const file = await sheetFile([['NAME', 'Colour', 'notes'], ['Anna', 'red', 'x'], ['Ben', 'blue', 'y']]);
    const preview = await previewExcelFile(file, COLUMNS);

    expect(preview.rowCount).toBe(2);
    expect(preview.sourceColumns).toEqual([
      { number: 1, heading: 'NAME', samples: ['Anna', 'Ben'] },
      { number: 2, heading: 'Colour', samples: ['red', 'blue'] },
      { number: 3, heading: 'notes', samples: ['x', 'y'] },
    ]);
    expect(preview.fields).toEqual([
      { key: 'name', label: 'Name', required: true, suggestedColumn: 1 },
      { key: 'code', label: 'Code', required: false, suggestedColumn: null },
      { key: 'note', label: 'Description', required: false, suggestedColumn: 3 },
    ]);
  });

  it('shows real date cells as DD-MM-YYYY in the samples', async () => {
    const file = await sheetFile([['Name', 'When'], ['A', new Date(Date.UTC(2016, 3, 5))]]);
    const preview = await previewExcelFile(file, COLUMNS);
    expect(preview.sourceColumns[1].samples).toEqual(['05-04-2016']);
  });

  it('reads exactly the columns the user chose, whatever the headings say', async () => {
    const file = await sheetFile([['A', 'B', 'C'], ['Anna', 'K1', 'first'], ['Ben', 'K2', 'second']]);
    const rows = await parseExcelRows(file, COLUMNS, { name: 1, note: 3 }); // "code" left out
    expect(rows).toEqual([
      { name: 'Anna', note: 'first' },
      { name: 'Ben', note: 'second' },
    ]);
  });

  it('fills several fields from one column when the user maps it more than once', async () => {
    const file = await sheetFile([['A', 'B'], ['Anna', 'K1'], ['Ben', 'K2']]);
    const rows = await parseExcelRows(file, COLUMNS, { name: 1, note: 1, code: 2 });
    expect(rows).toEqual([
      { name: 'Anna', note: 'Anna', code: 'K1' },
      { name: 'Ben', note: 'Ben', code: 'K2' },
    ]);
  });

  it('ignores mapping entries for unknown fields, and still matches by heading without a mapping', async () => {
    const file = await sheetFile([['Name', 'Code'], ['Anna', 'K1']]);
    expect(await parseExcelRows(file, COLUMNS, { name: 1, bogus: 2 })).toEqual([{ name: 'Anna' }]);
    expect(await parseExcelRows(file, COLUMNS)).toEqual([{ name: 'Anna', code: 'K1' }]);
  });
});
