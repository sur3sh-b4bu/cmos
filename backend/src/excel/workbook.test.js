const ExcelJS = require('exceljs');
const JSZip = require('jszip');
const { readWorkbook, previewWorkbook, normalizeHeading } = require('./workbookReader');
const { buildWorkbookBuffer, looksLikeFormula } = require('./workbookWriter');
const { parseDateCell } = require('./dateOnly');

const COLUMNS = [
  { key: 'name', label: { en: "Child's Christian Name", ta: 'குழந்தையின் கிறிஸ்தவ பெயர்' }, required: true },
  { key: 'gender', label: { en: 'Sex', ta: 'பாலினம்' }, aliases: ['Gender'], required: true },
  { key: 'born', label: { en: 'Date of Birth', ta: 'பிறந்த தேதி' }, type: 'date', required: true },
  { key: 'remarks', label: { en: 'Remarks', ta: 'குறிப்புகள்' } },
  { key: 'receipt', label: { en: 'Receipt No.', ta: 'ரசீது எண்.' }, info: true },
];

/** A workbook the way Excel would save it: real date cells or numeric serials. */
async function makeXlsx({ headers, rows, date1904 = false, dateColumns = [], sheetName = 'Data', extraSheet = false }) {
  const wb = new ExcelJS.Workbook();
  if (date1904) wb.properties.date1904 = true;
  const ws = wb.addWorksheet(sheetName);
  ws.addRow(headers);
  rows.forEach((r) => ws.addRow(r));
  dateColumns.forEach((c) => {
    ws.getColumn(c).numFmt = 'dd-mm-yyyy';
  });
  if (extraSheet) wb.addWorksheet('Notes').addRow(['ignored', 'sheet']);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const HEADERS = ["Child's Christian Name", 'Sex', 'Date of Birth', 'Remarks'];
const D = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
const read = (buffer, extra = {}) => readWorkbook(buffer, { columns: COLUMNS, fileName: 'data.xlsx', ...extra });
const rejection = async (promise) => promise.then(() => null, (e) => e);

describe('readWorkbook - reading files as Excel and other tools save them', () => {
  it('reads text dates, real Excel date cells and numeric serials to the SAME calendar date', async () => {
    const text = await read(await makeXlsx({ headers: HEADERS, rows: [['A', 'Male', '05-04-2016', null]] }));
    const iso = await read(await makeXlsx({ headers: HEADERS, rows: [['A', 'Male', '2016-04-05', null]] }));
    const dateCell = await read(await makeXlsx({ headers: HEADERS, rows: [['A', 'Male', D(2016, 4, 5), null]], dateColumns: [3] }));
    const serial = await read(await makeXlsx({ headers: HEADERS, rows: [['A', 'Male', 42465, null]] }));

    const iso1 = (r) => parseDateCell(r.rows[0].values.born, { date1904: r.date1904 }).iso;
    expect([text, iso, dateCell, serial].map(iso1)).toEqual(['2016-04-05', '2016-04-05', '2016-04-05', '2016-04-05']);
    expect(dateCell.rows[0].values.born).toBeInstanceOf(Date);
    expect(typeof serial.rows[0].values.born).toBe('number');
  });

  it('detects the 1904 date system and reads dates correctly under it', async () => {
    const wb1904 = await read(await makeXlsx({ headers: HEADERS, rows: [['A', 'Male', D(2016, 4, 5), null]], dateColumns: [3], date1904: true }));
    expect(wb1904.date1904).toBe(true);
    expect(parseDateCell(wb1904.rows[0].values.born, { date1904: true }).iso).toBe('2016-04-05');

    // A bare serial in a 1904 workbook (General format) needs the flag.
    const serial1904 = await read(await makeXlsx({ headers: HEADERS, rows: [['A', 'Male', 42465 - 1462, null]], date1904: true }));
    expect(parseDateCell(serial1904.rows[0].values.born, { date1904: serial1904.date1904 }).iso).toBe('2016-04-05');

    const normal = await read(await makeXlsx({ headers: HEADERS, rows: [['A', 'Male', 42465, null]] }));
    expect(normal.date1904).toBe(false);
  });

  it('keeps original row numbers, ignores fully empty rows and trims whitespace', async () => {
    const buf = await makeXlsx({
      headers: HEADERS,
      rows: [['  Anna  ', ' Female ', '05-04-2016', null], [null, null, null, null], ['   ', null, null, null], ['Ben', 'Male', '2017-01-02', '  hi  ']],
    });
    const { rows } = await read(buf);
    expect(rows.map((r) => r.rowNumber)).toEqual([2, 5]);
    expect(rows[0].values).toMatchObject({ name: 'Anna', gender: 'Female' });
    expect(rows[1].values.remarks).toBe('hi');
  });

  it('accepts English, Tamil, legacy and key headings, and reports unknown ones as ignored', async () => {
    const buf = await makeXlsx({
      headers: ['குழந்தையின் கிறிஸ்தவ பெயர்', 'Sex (Name or ID)', 'date of birth ', 'Something Else'],
      rows: [['Ravi', 'M', '05-04-2016', 'x']],
    });
    const r = await read(buf);
    expect(r.rows[0].values).toMatchObject({ name: 'Ravi', gender: 'M', born: '05-04-2016' });
    expect(r.ignoredHeadings).toEqual(['Something Else']);

    const legacy = await makeXlsx({ headers: ["Child's Christian Name", 'Gender', 'Date of Birth'], rows: [['A', 'F', '05-04-2016']] });
    expect((await read(legacy)).rows[0].values.gender).toBe('F');
  });

  it('ignores read-only info columns (they are export-only)', async () => {
    const buf = await makeXlsx({ headers: [...HEADERS, 'Receipt No.'], rows: [['A', 'Male', '05-04-2016', null, 'RCT0001']] });
    const r = await read(buf);
    expect(r.rows[0].values.receipt).toBeUndefined();
    expect(r.ignoredHeadings).toEqual(['Receipt No.']);
  });

  it('reads from the "Data" sheet even when other sheets exist', async () => {
    const buf = await makeXlsx({ headers: HEADERS, rows: [['A', 'Male', '05-04-2016', null]], extraSheet: true });
    expect((await read(buf)).rows).toHaveLength(1);
  });

  it('unwraps rich text, hyperlinks and formula results into plain values', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Data');
    ws.addRow(HEADERS);
    ws.addRow([{ richText: [{ text: 'Ri' }, { text: 'ch' }] }, { text: 'Male', hyperlink: 'http://x' }, { formula: 'DATE(2016,4,5)', result: D(2016, 4, 5) }, null]);
    const r = await read(Buffer.from(await wb.xlsx.writeBuffer()));
    expect(r.rows[0].values.name).toBe('Rich');
    expect(r.rows[0].values.gender).toBe('Male');
    expect(parseDateCell(r.rows[0].values.born).iso).toBe('2016-04-05');
  });

  it('reads every non-date column as plain text, even when Excel guessed a different cell type', async () => {
    // Excel aggressively auto-detects date-looking and number-looking text
    // even in columns that have nothing to do with dates or numbers -- a
    // "Remarks" cell showing "05-04-2016" or "007" on screen can genuinely be
    // stored as a real Date or a Number underneath. The column's own
    // declared type (not Excel's guess) decides how a cell is read: `remarks`
    // isn't a 'date' column, so it must come back as the same text a person
    // looking at the sheet would see -- never null, never rejected.
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Data');
    ws.addRow(HEADERS);
    ws.addRow(['A', 'Male', '05-04-2016', D(2016, 4, 5)]);
    ws.addRow(['B', 'Male', '05-04-2016', 7]);
    const r = await read(Buffer.from(await wb.xlsx.writeBuffer()));
    expect(r.rows[0].values.remarks).toBe('05-04-2016');
    expect(r.rows[1].values.remarks).toBe('7');
  });
});

describe('readWorkbook - file-level rejections carry a clear message', () => {
  it('rejects a non-.xlsx file name', async () => {
    const e = await rejection(read(Buffer.from('a,b'), { fileName: 'data.csv' }));
    expect(e.statusCode).toBe(400);
    expect(e.message).toMatch(/Only \.xlsx/);
    expect(e.message).toMatch(/\.csv/);
  });

  it('rejects an empty file', async () => {
    expect((await rejection(read(Buffer.alloc(0)))).message).toMatch(/empty/i);
  });

  it('rejects an old .xls / password-protected (OLE) file', async () => {
    const ole = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]);
    expect((await rejection(read(ole))).message).toMatch(/old Excel|password/i);
  });

  it('rejects renamed non-Excel content', async () => {
    expect((await rejection(read(Buffer.from('this is plain text, not a zip')))).message).toMatch(/not a valid \.xlsx/);
  });

  it('rejects a damaged workbook', async () => {
    const damaged = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('garbage-garbage-garbage')]);
    expect((await rejection(read(damaged))).message).toMatch(/could not be read/);
  });

  it('rejects a file over the size limit and says how large it is', async () => {
    const buf = await makeXlsx({ headers: HEADERS, rows: [['A', 'Male', '05-04-2016', null]] });
    const e = await rejection(read(buf, { maxBytes: 100 }));
    expect(e.message).toMatch(/too large/);
    expect(e.message).toMatch(/MB/);
  });

  it('rejects wrong headings, lists what is missing and what is expected', async () => {
    const e = await rejection(read(await makeXlsx({ headers: ['Foo', 'Bar'], rows: [['1', '2']] })));
    expect(e.message).toMatch(/does not have the expected column headings/);
    expect(e.message).toMatch(/Missing required column\(s\): "Child's Christian Name", "Sex", "Date of Birth"/);
    expect(e.details.expectedHeadings).toEqual(["Child's Christian Name", 'Sex', 'Date of Birth', 'Remarks']);
    expect(e.details.foundHeadings).toEqual(['Foo', 'Bar']);

    const partial = await rejection(read(await makeXlsx({ headers: ["Child's Christian Name", 'Remarks'], rows: [['A', 'b']] })));
    expect(partial.message).toMatch(/Missing required column\(s\): "Sex", "Date of Birth"/);
  });

  it('rejects a heading that appears twice', async () => {
    const e = await rejection(read(await makeXlsx({ headers: [...HEADERS, 'Sex'], rows: [['A', 'Male', '05-04-2016', null, 'x']] })));
    expect(e.message).toMatch(/appears more than once/);
  });

  it('rejects a file with headings but no data rows, and one with too many rows', async () => {
    expect((await rejection(read(await makeXlsx({ headers: HEADERS, rows: [] })))).message).toMatch(/no data/i);
    const many = await rejection(read(await makeXlsx({ headers: HEADERS, rows: [['A', 'Male', '05-04-2016', null], ['B', 'Male', '05-04-2016', null]] }), { maxRows: 1 }));
    expect(many.message).toMatch(/more than 1 rows/);
  });
});

describe('normalizeHeading', () => {
  it('is case-, space-, asterisk- and (Name or ID)-insensitive', () => {
    expect(normalizeHeading('  Sex  (Name or ID) ')).toBe('sex');
    expect(normalizeHeading('Date   of Birth*')).toBe('date of birth');
    expect(normalizeHeading('SEX')).toBe('sex');
  });
});

describe('buildWorkbookBuffer - what an export actually writes', () => {
  const columns = [
    { header: 'Name', key: 'name' },
    { header: 'Born', key: 'born', type: 'date' },
    { header: 'Amount', key: 'amount', type: 'number' },
    { header: 'Phone', key: 'phone' },
  ];

  async function reload(buffer) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    return wb.worksheets[0];
  }

  it('writes dates as real date cells (UTC midnight) with the dd-mm-yyyy format, not text', async () => {
    const ws = await reload(await buildWorkbookBuffer({ columns, rows: [{ name: 'A', born: '2016-04-05', amount: 200, phone: '+91 98765' }] }));
    const cell = ws.getRow(2).getCell(2);
    expect(cell.value).toBeInstanceOf(Date);
    expect(cell.value.toISOString()).toBe('2016-04-05T00:00:00.000Z');
    expect(cell.numFmt).toBe('dd-mm-yyyy');
    expect(cell.type).toBe(ExcelJS.ValueType.Date);
  });

  it('stores dates as whole-number serials so Excel sorts and filters them as dates', async () => {
    const buf = await buildWorkbookBuffer({ columns, rows: [{ name: 'A', born: '2016-04-05' }] });
    const xml = await (await JSZip.loadAsync(buf)).file('xl/worksheets/sheet1.xml').async('string');
    expect(xml).toMatch(/<c r="B2"[^>]*><v>42465<\/v><\/c>/);
  });

  it('writes amounts as numbers with a fixed 2-decimal format', async () => {
    const ws = await reload(await buildWorkbookBuffer({ columns, rows: [{ name: 'A', amount: 200 }] }));
    const cell = ws.getRow(2).getCell(3);
    expect(cell.value).toBe(200);
    expect(cell.numFmt).toBe('0.00');
  });

  it('never writes formulas: text starting with = + - @ stays a string cell in Text format', async () => {
    const dangerous = ['=1+1', '+91 98765 43210', '-5', '@SUM(A1)', '=cmd|\' /C calc\'!A0', '\t=1'];
    const buf = await buildWorkbookBuffer({ columns: [{ header: 'Name', key: 'name' }], rows: dangerous.map((name) => ({ name })) });
    const zip = await JSZip.loadAsync(buf);
    const sheetXml = await zip.file('xl/worksheets/sheet1.xml').async('string');
    expect(sheetXml).not.toMatch(/<f[ >]/); // no formula element anywhere

    const ws = await reload(buf);
    dangerous.forEach((text, i) => {
      const cell = ws.getRow(i + 2).getCell(1);
      expect(cell.type).toBe(ExcelJS.ValueType.String);
      expect(cell.value).toBe(text); // value untouched => lossless
      expect(cell.numFmt).toBe('@');
    });
  });

  it('flags exactly the dangerous leading characters', () => {
    ['=A', '+1', '-1', '@x', '\tx', '\rx'].forEach((t) => expect(looksLikeFormula(t)).toBe(true));
    ['A=1', ' =1', 'Anna', '', '1+1'].forEach((t) => expect(looksLikeFormula(t)).toBe(false));
  });

  it('keeps Tamil, quotes, ampersands, angle brackets and 300-character text intact', async () => {
    const values = ['சாமுவேல்', "O'Brien & <Sons>", 'x'.repeat(300), 'line1\nline2'];
    const ws = await reload(await buildWorkbookBuffer({ columns: [{ header: 'Name', key: 'name' }], rows: values.map((name) => ({ name })) }));
    values.forEach((v, i) => expect(ws.getRow(i + 2).getCell(1).value).toBe(v));
  });

  it('leaves blanks as truly empty cells, not empty strings', async () => {
    const ws = await reload(await buildWorkbookBuffer({ columns, rows: [{ name: 'A', born: null, amount: undefined, phone: '' }] }));
    expect(ws.getRow(2).getCell(2).value).toBeNull();
    expect(ws.getRow(2).getCell(3).value).toBeNull();
    expect(ws.getRow(2).getCell(4).value).toBeNull();
  });

  it('adds a notes sheet after the data sheet, so the data sheet stays first', async () => {
    const buf = await buildWorkbookBuffer({ columns, rows: [], notes: { title: 'Notes', rows: [['Topic', 'Text'], ['Date format', 'DD-MM-YYYY']] } });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Data', 'Notes']);
  });

  it('round-trips through the reader: exported dates read back to the same ISO date', async () => {
    const spec = [
      { key: 'name', label: { en: 'Name' }, required: true },
      { key: 'born', label: { en: 'Born' } },
    ];
    const buf = await buildWorkbookBuffer({
      columns: [{ header: 'Name', key: 'name' }, { header: 'Born', key: 'born', type: 'date' }],
      rows: [{ name: 'A', born: '2019-12-31' }, { name: 'B', born: '2016-04-05' }],
    });
    const { rows, date1904 } = await readWorkbook(buf, { columns: spec, fileName: 'x.xlsx' });
    expect(rows.map((r) => parseDateCell(r.values.born, { date1904 }).iso)).toEqual(['2019-12-31', '2016-04-05']);
  });
});

describe('previewWorkbook + readWorkbook({ mapping }) - the match-columns step', () => {
  const preview = (buffer, extra = {}) => previewWorkbook(buffer, { columns: COLUMNS, fileName: 'data.xlsx', ...extra });
  const badRequest = async (promise) => {
    const err = await rejection(promise);
    expect(err).not.toBeNull();
    return err.message;
  };

  it('lists every file column with sample values and suggests the fields whose headings match', async () => {
    const result = await preview(
      await makeXlsx({ headers: ['Full name', 'Sex', 'Notes'], rows: [['Anna', 'Female', 'a'], ['Ben', 'Male', 'b'], ['Cy', 'Male', 'c'], ['Di', 'Female', 'd']] })
    );
    expect(result.rowCount).toBe(4);
    expect(result.sourceColumns).toEqual([
      { number: 1, heading: 'Full name', samples: ['Anna', 'Ben', 'Cy'] },
      { number: 2, heading: 'Sex', samples: ['Female', 'Male', 'Male'] },
      { number: 3, heading: 'Notes', samples: ['a', 'b', 'c'] },
    ]);
    const suggested = Object.fromEntries(result.fields.map((f) => [f.key, f.suggestedColumn]));
    expect(suggested).toEqual({ name: null, gender: 2, born: null, remarks: null }); // only "Sex" matches by heading
    expect(result.fields.filter((f) => f.required).map((f) => f.key)).toEqual(['name', 'gender', 'born']);
    expect(result.fields.map((f) => f.key)).not.toContain('receipt'); // system-assigned fields are never offered
  });

  it('does not reject a file whose headings match nothing - that is exactly when the user maps by hand', async () => {
    const result = await preview(await makeXlsx({ headers: ['A', 'B'], rows: [['x', 'y']] }));
    expect(result.fields.every((f) => f.suggestedColumn === null)).toBe(true);
    expect(result.sourceColumns).toHaveLength(2);
  });

  it('shows a column that has no heading (but has data) so it can still be chosen', async () => {
    const result = await preview(await makeXlsx({ headers: ['Name', null, 'Born'], rows: [['A', 'Male', '05-04-2016']] }));
    expect(result.sourceColumns.map((c) => [c.number, c.heading])).toEqual([[1, 'Name'], [2, ''], [3, 'Born']]);
  });

  it('reads the columns the user chose, whatever the headings say', async () => {
    const buffer = await makeXlsx({ headers: ['Col A', 'Col B', 'Col C'], rows: [['Anna', '05-04-2016', 'Female']] });
    const { rows, ignoredHeadings } = await read(buffer, { mapping: { name: 1, born: 2, gender: 3 } });
    expect(rows[0].values).toEqual({ name: 'Anna', born: '05-04-2016', gender: 'Female' });
    expect(ignoredHeadings).toEqual([]);
  });

  it('imports only the fields the user kept, and reports the columns left out as ignored', async () => {
    const buffer = await makeXlsx({ headers: HEADERS, rows: [['Anna', 'Female', '05-04-2016', 'secret note']] });
    const { rows, ignoredHeadings } = await read(buffer, { mapping: { name: 1, gender: 2, born: 3 } }); // remarks unchecked
    expect(Object.keys(rows[0].values)).toEqual(['name', 'gender', 'born']);
    expect(ignoredHeadings).toEqual(['Remarks']);
  });

  it('lets the user choose columns even when the file has two columns with the same heading', async () => {
    const buffer = await makeXlsx({ headers: ['Name', 'Name', 'Sex', 'Born'], rows: [['first', 'second', 'Male', '05-04-2016']] });
    const { rows } = await read(buffer, { mapping: { name: 2, gender: 3, born: 4 } });
    expect(rows[0].values.name).toBe('second');
  });

  it('rejects a mapping that leaves a required field out', async () => {
    const buffer = await makeXlsx({ headers: HEADERS, rows: [['A', 'Male', '05-04-2016', null]] });
    expect(await badRequest(read(buffer, { mapping: { name: 1, gender: 2 } }))).toMatch(/required field.*Date of Birth/);
  });

  it('lets one file column feed several fields (the popup only warns about it)', async () => {
    const buffer = await makeXlsx({ headers: ['Details', 'Born'], rows: [['Anna', '05-04-2016']] });
    const { rows, ignoredHeadings } = await read(buffer, { mapping: { name: 1, gender: 1, born: 2 } });
    expect(rows[0].values).toEqual({ name: 'Anna', gender: 'Anna', born: '05-04-2016' });
    expect(ignoredHeadings).toEqual([]);
  });

  it('rejects a column that does not exist and unknown fields', async () => {
    const buffer = await makeXlsx({ headers: HEADERS, rows: [['A', 'Male', '05-04-2016', null]] });
    expect(await badRequest(read(buffer, { mapping: { name: 1, gender: 2, born: 99 } }))).toMatch(/does not exist/);
    expect(await badRequest(read(buffer, { mapping: { name: 1, gender: 2, born: 0 } }))).toMatch(/does not exist/);
    expect(await badRequest(read(buffer, { mapping: { name: 1, gender: 2, born: 3, receipt: 4 } }))).toMatch(/unknown field "receipt"/);
    expect(await badRequest(read(buffer, { mapping: { name: '1', gender: 2, born: 3 } }))).toMatch(/does not exist/);
    expect(await badRequest(read(buffer, { mapping: 'name' }))).toMatch(/not valid/);
    expect(await badRequest(read(buffer, { mapping: [1, 2, 3] }))).toMatch(/not valid/);
  });

  it('without a mapping, behaves exactly as before (matches by heading)', async () => {
    const buffer = await makeXlsx({ headers: HEADERS, rows: [['A', 'Male', '05-04-2016', 'r']] });
    const { rows } = await read(buffer);
    expect(rows[0].values.remarks).toBe('r');
  });
});
