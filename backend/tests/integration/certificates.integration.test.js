'use strict';

const helpers = require('./helpers');
const { pool } = helpers;
const certificateService = require('../../src/services/certificateService');
const certificateRepository = require('../../src/repositories/certificateRepository');
const registry = require('../../src/config/certificateRegistry');
const transfer = require('../../src/services/certificateTransferService');
const { getCertificateColumns } = require('../../src/excel/specs/certificateSpec');
const { headingLabel } = require('../../src/excel/workbookReader');

const D = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
const label = (type, key, lang = 'en') => headingLabel(getCertificateColumns(type).find((c) => c.key === key), lang);
const DB_KEYS = /child_name|gender_id|date_of_birth|date_of_baptism|priest_id|custom_priest_name|certificate_no|marriage_date|date_of_death|burial_date|groom_name/;

let adminId;
let churchA;
let churchB;
let reqA;
let reqB;

beforeAll(async () => {
  await helpers.beginSuite();
  adminId = await helpers.adminUserId();
  churchA = await helpers.createChurch('A', { priests: ['Fr. Thomas', 'Fr. Xavier'] });
  churchB = await helpers.createChurch('B', { priests: ['Fr. Thomas', 'Fr. Xavier'] });
  reqA = helpers.makeReq(churchA.churchId, { userId: adminId });
  reqB = helpers.makeReq(churchB.churchId, { userId: adminId });
});

afterAll(() => helpers.endSuite());

async function priestId(churchId, name) {
  const [[row]] = await pool.query('SELECT id FROM priests WHERE church_id = ? AND name = ?', [churchId, name]);
  return row.id;
}

async function clear(churchId) {
  for (const table of ['baptism_certificates', 'marriage_certificates', 'death_certificates']) {
    await pool.query(`DELETE FROM ${table} WHERE church_id = ?`, [churchId]);
  }
  await pool.query("UPDATE certificate_series SET next_number = 1 WHERE church_id = ?", [churchId]);
}

const baptismRows = (churchId) => pool.query('SELECT certificate_no, child_name, gender_id, date_of_birth, date_of_baptism, priest_id, custom_priest_name, remarks FROM baptism_certificates WHERE church_id = ? ORDER BY id', [churchId]).then(([r]) => r);

describe('Baptism export -> import -> export is lossless', () => {
  beforeAll(async () => {
    await clear(churchA.churchId);
    await clear(churchB.churchId);
    const thomas = await priestId(churchA.churchId, 'Fr. Thomas');
    const male = await helpers.masterId('genders', 'Male');
    const female = await helpers.masterId('genders', 'Female');
    const records = [
      {
        child_name: 'சாமுவேல் ஜோசப்',
        gender_id: male,
        date_of_birth: '2016-04-05',
        date_of_baptism: '2016-05-05',
        place_of_baptism: 'St. Thomas Church',
        father_name: "Patrick O'Brien",
        mother_name: 'Anna & Maria',
        parent_residence: '<Sons> Street, "Old Town", Chennai',
        godfather_name: 'சிலுவை முத்து',
        godmother_name: 'Mary',
        priest_id: thomas,
        remarks: 'r'.repeat(300),
      },
      { child_name: 'Visitor Child', gender_id: female, date_of_birth: '2019-01-01', date_of_baptism: '2019-12-31', custom_priest_name: 'Fr. Visiting Someone', remarks: '=1+1' },
      { child_name: 'Both Priests', gender_id: male, date_of_birth: '2020-02-29', date_of_baptism: '2020-03-01', priest_id: thomas, custom_priest_name: 'Fr. Also Present', remarks: '+91 98765 43210' },
      { child_name: '-Starts With Dash', gender_id: female, date_of_birth: '2000-12-31', date_of_baptism: '2001-01-01', remarks: '@mention' },
      { child_name: 'Minimal', gender_id: male, date_of_birth: '2021-06-15', date_of_baptism: '2021-06-15' },
    ];
    for (const record of records) await certificateService.create('baptism', record, reqA);
  });

  it('exports dates as real date cells, priest columns separately, and formulas as text', async () => {
    const { buffer, count } = await transfer.exportCertificates('baptism', {}, reqA);
    expect(count).toBe(5);
    const cells = await helpers.readCells(buffer);
    const headers = cells[0].map((c) => c.value);

    const col = (name) => headers.indexOf(name);
    const dob = col('Date of Birth');
    expect(cells[1][dob].type).toBe(4); // ExcelJS ValueType.Date
    expect(cells[1][dob].numFmt).toBe('dd-mm-yyyy');
    expect(cells[1][dob].value).toBe(D(2016, 4, 5).getTime());

    const priest = col('Priest who Baptised');
    const custom = col('Priest Name (if not in list above)');
    expect(headers[priest]).toBe('Priest who Baptised');
    expect(cells[1][priest].value).toBe('Fr. Thomas'); // linked priest
    expect(cells[1][custom].value).toBeNull();
    expect(cells[2][priest].value).toBeNull(); // custom-only row: NOT copied into the linked column
    expect(cells[2][custom].value).toBe('Fr. Visiting Someone');
    expect(cells[3][priest].value).toBe('Fr. Thomas');
    expect(cells[3][custom].value).toBe('Fr. Also Present'); // both kept, side by side

    const remarks = col('Remarks');
    expect(cells[2][remarks]).toMatchObject({ value: '=1+1', type: 3, numFmt: '@' });
    expect(cells[3][remarks]).toMatchObject({ value: '+91 98765 43210', type: 3, numFmt: '@' });
  });

  it('imports into an empty church and a second export is identical cell by cell', async () => {
    const first = await transfer.exportCertificates('baptism', {}, reqA);
    const report = await transfer.importCertificates('baptism', { buffer: first.buffer, fileName: 'export.xlsx', lang: 'en' }, reqB);
    expect(report).toMatchObject({ total: 5, imported: 5, failed: 0, errors: [] });

    const second = await transfer.exportCertificates('baptism', {}, reqB);
    const cellsA = await helpers.readCells(first.buffer);
    const cellsB = await helpers.readCells(second.buffer);
    expect(cellsB).toEqual(cellsA); // every value, cell type and number format

    // The data itself survived byte for byte.
    const [a, b] = [await baptismRows(churchA.churchId), await baptismRows(churchB.churchId)];
    expect(b.map((r) => ({ ...r, priest_id: null }))).toEqual(a.map((r) => ({ ...r, priest_id: null })));
    expect(b[0].child_name).toBe('சாமுவேல் ஜோசப்');
    expect(b[0].remarks).toHaveLength(300);
    expect(b.map((r) => r.certificate_no)).toEqual(a.map((r) => r.certificate_no));
  });

  it('moves the church\'s number series past the imported numbers', async () => {
    const [[series]] = await pool.query("SELECT next_number FROM certificate_series WHERE church_id = ? AND certificate_type = 'Baptism'", [churchB.churchId]);
    expect(series.next_number).toBe(6);
    const created = await certificateService.create('baptism', { child_name: 'Next', gender_id: await helpers.masterId('genders', 'Male'), date_of_birth: '2022-01-01', date_of_baptism: '2022-02-01' }, reqB);
    expect(created.certificate_no).toBe('BAP0006');
  });

  it('does not touch the source church', async () => {
    const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM baptism_certificates WHERE church_id = ?', [churchA.churchId]);
    expect(n).toBe(5);
  });
});

describe('every way a date can arrive gives identical database rows', () => {
  const H = () => ['Certificate No.', label('baptism', 'child_name'), label('baptism', 'gender_id'), label('baptism', 'date_of_birth'), label('baptism', 'date_of_baptism')];
  const variants = {
    'text DD-MM-YYYY': () => ({ rows: [['', 'Same Child', 'Male', '05-04-2016', '05-05-2016']] }),
    'text D/M/YYYY with spaces': () => ({ rows: [['', 'Same Child', 'Male', '  5/4/2016 ', ' 5/5/2016']] }),
    'text ISO YYYY-MM-DD': () => ({ rows: [['', 'Same Child', 'Male', '2016-04-05', '2016-05-05']] }),
    'real Excel date cells': () => ({ rows: [['', 'Same Child', 'Male', D(2016, 4, 5), D(2016, 5, 5)]], dateColumns: [4, 5] }),
    'numeric serials (General format)': () => ({ rows: [['', 'Same Child', 'Male', 42465, 42495]] }),
    'date cells in a 1904-system workbook': () => ({ rows: [['', 'Same Child', 'Male', D(2016, 4, 5), D(2016, 5, 5)]], dateColumns: [4, 5], date1904: true }),
    'numeric serials in a 1904-system workbook': () => ({ rows: [['', 'Same Child', 'Male', 42465 - 1462, 42495 - 1462]], date1904: true }),
  };

  it.each(Object.keys(variants))('%s', async (name) => {
    await clear(churchA.churchId);
    const { rows, ...options } = variants[name]();
    const buffer = await helpers.makeXlsx({ headers: H(), rows, ...options });
    const report = await transfer.importCertificates('baptism', { buffer, fileName: 'file.xlsx', lang: 'en' }, reqA);
    expect(report).toMatchObject({ imported: 1, failed: 0 });
    const [row] = await baptismRows(churchA.churchId);
    expect({ name: row.child_name, born: row.date_of_birth, baptised: row.date_of_baptism }).toEqual({ name: 'Same Child', born: '2016-04-05', baptised: '2016-05-05' });
  });

  it('a date on a year boundary is never shifted by a day', async () => {
    await clear(churchA.churchId);
    const buffer = await helpers.makeXlsx({ headers: H(), rows: [['', 'New Year', 'Female', D(2019, 1, 1), D(2019, 12, 31)]], dateColumns: [4, 5] });
    await transfer.importCertificates('baptism', { buffer, fileName: 'f.xlsx', lang: 'en' }, reqA);
    const [row] = await baptismRows(churchA.churchId);
    expect([row.date_of_birth, row.date_of_baptism]).toEqual(['2019-01-01', '2019-12-31']);
  });
});

describe('sex / gender values', () => {
  const H = () => [label('baptism', 'child_name'), label('baptism', 'gender_id'), label('baptism', 'date_of_birth'), label('baptism', 'date_of_baptism')];

  it.each([['f', 'Female'], ['F', 'Female'], ['female', 'Female'], [' FEMALE ', 'Female'], ['m', 'Male'], ['M', 'Male'], ['Male', 'Male'], ['mAlE', 'Male']])('accepts %j', async (value, expected) => {
    await clear(churchA.churchId);
    const buffer = await helpers.makeXlsx({ headers: H(), rows: [['Child', value, '05-04-2016', '05-05-2016']] });
    const report = await transfer.importCertificates('baptism', { buffer, fileName: 'f.xlsx', lang: 'en' }, reqA);
    expect(report.imported).toBe(1);
    const [row] = await baptismRows(churchA.churchId);
    expect(row.gender_id).toBe(await helpers.masterId('genders', expected));
  });

  it('follows the genders master: a newly added value is accepted, an unknown one lists what is allowed', async () => {
    await clear(churchA.churchId);
    await pool.query("DELETE FROM genders WHERE code = 'ITX'"); // leftover from an aborted earlier run
    await pool.query("INSERT INTO genders (name, code) VALUES ('IT Other Value', 'ITX')");
    try {
      const buffer = await helpers.makeXlsx({
        headers: H(),
        rows: [['New Gender', 'it other value', '05-04-2016', '05-05-2016'], ['Bad', 'robot', '05-04-2016', '05-05-2016']],
      });
      const report = await transfer.importCertificates('baptism', { buffer, fileName: 'f.xlsx', lang: 'en' }, reqA);
      expect(report.imported).toBe(1);
      expect(report.errors).toHaveLength(1);
      expect(report.errors[0]).toMatchObject({ row: 3, column: 'Sex' });
      expect(report.errors[0].message).toMatch(/"robot" is not an allowed value\. Allowed values: Male, Female, IT Other Value/);
    } finally {
      await clear(churchA.churchId); // the imported row references the gender
      await pool.query("DELETE FROM genders WHERE code = 'ITX'");
    }
  });
});

describe('row-level problems: valid rows import, invalid rows are reported by row and column label', () => {
  const H = () => ['Certificate No.', label('baptism', 'child_name'), label('baptism', 'gender_id'), label('baptism', 'date_of_birth'), label('baptism', 'date_of_baptism'), label('baptism', 'priest_id')];

  it('imports the valid row and reports the invalid one', async () => {
    await clear(churchA.churchId);
    const buffer = await helpers.makeXlsx({
      headers: H(),
      rows: [
        ['', 'Good Child', 'Male', '05-04-2016', '05-05-2016', 'Fr. Thomas'],
        ['', 'Bad Date Child', 'Male', 'not-a-date', '05-05-2016', ''],
      ],
    });
    const report = await transfer.importCertificates('baptism', { buffer, fileName: 'f.xlsx', lang: 'en' }, reqA);
    expect(report).toMatchObject({ total: 2, imported: 1, failed: 1 });
    expect(report.errors).toEqual([{ row: 3, column: 'Date of Birth', message: expect.stringMatching(/"not-a-date" is not a valid date/) }]);
    expect(await baptismRows(churchA.churchId)).toHaveLength(1);
  });

  it('reports every problem with the visible heading, never a database column name', async () => {
    await clear(churchA.churchId);
    const buffer = await helpers.makeXlsx({
      headers: H(),
      rows: [
        ['', '', 'Male', '05-04-2016', '05-05-2016', ''], // missing name
        ['', 'X', 'robot', '31-02-2020', '05-05-2020', ''], // bad sex AND impossible date
        ['', 'Time Traveller', 'Male', '05-05-2019', '01-01-2019', ''], // baptised before birth
        ['', 'Future', 'Male', '01-01-2090', '01-01-2090', ''], // born in the future
        // Not an error: a priest not (yet) in this church's Priests list
        // falls back to the free-text column instead of blocking the row --
        // see certificateTransferService.js's `priest` resolver.
        ['', 'Stranger Priest', 'Male', '05-04-2016', '05-05-2016', 'Fr. Nobody'],
        ['', 'y'.repeat(200), 'Male', '05-04-2016', '05-05-2016', ''],
      ],
    });
    const report = await transfer.importCertificates('baptism', { buffer, fileName: 'f.xlsx', lang: 'en' }, reqA);
    expect(report.imported).toBe(1);
    expect(report.failed).toBe(5);

    const byRow = (n) => report.errors.filter((e) => e.row === n).map((e) => `${e.column}: ${e.message}`);
    expect(byRow(2)).toEqual([expect.stringMatching(/^Child's Christian Name: This value is required/)]);
    expect(byRow(3)).toEqual(
      expect.arrayContaining([expect.stringMatching(/^Sex: "robot" is not an allowed value/), expect.stringMatching(/^Date of Birth: "31-02-2020" is not a real calendar date/)])
    );
    expect(byRow(4)).toEqual(['Date of Baptism: Date of Baptism cannot be before Date of Birth.']);
    expect(byRow(5)).toEqual(['Date of Birth: Date of Birth cannot be in the future.']);
    expect(byRow(6)).toEqual([]); // "Stranger Priest" -- imported via the fallback, not an error
    expect(byRow(7)[0]).toMatch(/^Child's Christian Name: Too long: 200 characters, the limit is 150\./);

    // No column/table names leak anywhere in the report.
    expect(JSON.stringify(report)).not.toMatch(DB_KEYS);

    const [stranger] = await baptismRows(churchA.churchId);
    expect(stranger).toMatchObject({ child_name: 'Stranger Priest', priest_id: null, custom_priest_name: 'Fr. Nobody' });
  });

  it('reports headings in Tamil when the file/UI is Tamil', async () => {
    await clear(churchA.churchId);
    const headers = ['குழந்தையின் கிறிஸ்தவ பெயர்', 'பாலினம்', 'பிறந்த தேதி', 'ஞானஸ்நான தேதி'];
    const buffer = await helpers.makeXlsx({ headers, rows: [['X', 'Male', 'bad', '05-05-2016']] });
    const report = await transfer.importCertificates('baptism', { buffer, fileName: 'f.xlsx', lang: 'ta' }, reqA);
    expect(report.errors[0].column).toBe('பிறந்த தேதி');
  });

  it('ignores blank rows, trims whitespace and reports ignored columns', async () => {
    await clear(churchA.churchId);
    const buffer = await helpers.makeXlsx({
      headers: [...H(), 'Unrelated Column'],
      rows: [['', '  Spaced Child  ', ' male ', ' 05-04-2016 ', '05-05-2016', '', 'x'], [null, null, null, null, null, null, null], ['', '   ', '', '', '', '', 'only-in-ignored-column']],
    });
    const report = await transfer.importCertificates('baptism', { buffer, fileName: 'f.xlsx', lang: 'en' }, reqA);
    expect(report).toMatchObject({ total: 1, imported: 1, failed: 0, ignoredColumns: ['Unrelated Column'] });
    expect((await baptismRows(churchA.churchId))[0].child_name).toBe('Spaced Child');
  });
});

describe('certificate numbers', () => {
  const H = () => ['Certificate No.', label('baptism', 'child_name'), label('baptism', 'gender_id'), label('baptism', 'date_of_birth'), label('baptism', 'date_of_baptism')];
  const ok = (no, name) => [no, name, 'Male', '05-04-2016', '05-05-2016'];

  it('rejects a number repeated inside the file, naming the other row', async () => {
    await clear(churchA.churchId);
    const buffer = await helpers.makeXlsx({ headers: H(), rows: [ok('BAP0100', 'One'), ok('bap0100', 'Two'), ok('BAP0101', 'Three')] });
    const report = await transfer.importCertificates('baptism', { buffer, fileName: 'f.xlsx', lang: 'en' }, reqA);
    expect(report).toMatchObject({ imported: 2, failed: 1 });
    // Both rows are the same certificate number once it is normalised, whatever case the sheet used.
    expect(report.errors).toEqual([{ row: 3, column: 'Certificate No.', message: '"BAP0100" appears more than once in this file (also in row 2).' }]);
  });

  it('rejects a number that already exists in the church', async () => {
    await clear(churchA.churchId);
    await transfer.importCertificates('baptism', { buffer: await helpers.makeXlsx({ headers: H(), rows: [ok('BAP0200', 'Existing')] }), fileName: 'a.xlsx', lang: 'en' }, reqA);
    const report = await transfer.importCertificates(
      'baptism',
      { buffer: await helpers.makeXlsx({ headers: H(), rows: [ok('BAP0200', 'Again'), ok('BAP0201', 'Fresh')] }), fileName: 'b.xlsx', lang: 'en' },
      reqA
    );
    expect(report).toMatchObject({ imported: 1, failed: 1 });
    expect(report.errors).toEqual([{ row: 2, column: 'Certificate No.', message: '"BAP0200" already exists in this church.' }]);
  });

  it('assigns fresh numbers to blank cells without colliding with numbers imported in the same file', async () => {
    await clear(churchA.churchId);
    const buffer = await helpers.makeXlsx({ headers: H(), rows: [ok('', 'Auto 1'), ok('BAP0002', 'Explicit 2'), ok('', 'Auto 2'), ok('BAP0004', 'Explicit 4'), ok('', 'Auto 3')] });
    const report = await transfer.importCertificates('baptism', { buffer, fileName: 'f.xlsx', lang: 'en' }, reqA);
    expect(report).toMatchObject({ imported: 5, failed: 0 });
    const numbers = (await baptismRows(churchA.churchId)).map((r) => r.certificate_no);
    expect(new Set(numbers).size).toBe(5);
    expect(numbers).toEqual(expect.arrayContaining(['BAP0002', 'BAP0004']));
  });

  it('a number typed as a number in Excel gets the church\'s prefix and padding: 1022 -> BAP1022', async () => {
    await clear(churchA.churchId);
    const buffer = await helpers.makeXlsx({ headers: H(), rows: [[1022, 'Old Register Entry', 'Male', '05-04-2016', '05-05-2016']] });
    await transfer.importCertificates('baptism', { buffer, fileName: 'f.xlsx', lang: 'en' }, reqA);
    expect((await baptismRows(churchA.churchId))[0].certificate_no).toBe('BAP1022');
  });
});

describe('the import is all-or-nothing for the valid rows (one transaction)', () => {
  it('rolls back every row and the number series if the database fails part-way', async () => {
    await clear(churchA.churchId);
    const [[before]] = await pool.query("SELECT next_number FROM certificate_series WHERE church_id = ? AND certificate_type = 'Baptism'", [churchA.churchId]);
    const H = [label('baptism', 'child_name'), label('baptism', 'gender_id'), label('baptism', 'date_of_birth'), label('baptism', 'date_of_baptism')];
    const buffer = await helpers.makeXlsx({ headers: H, rows: [['One', 'Male', '05-04-2016', '05-05-2016'], ['Two', 'Male', '05-04-2016', '05-05-2016'], ['Three', 'Male', '05-04-2016', '05-05-2016']] });

    const original = certificateRepository.create;
    let calls = 0;
    const spy = jest.spyOn(certificateRepository, 'create').mockImplementation((...args) => {
      calls += 1;
      if (calls === 3) return Promise.reject(new Error('simulated database failure'));
      return original(...args);
    });
    try {
      await expect(transfer.importCertificates('baptism', { buffer, fileName: 'f.xlsx', lang: 'en' }, reqA)).rejects.toMatchObject({
        statusCode: 500,
        message: expect.stringMatching(/rolled back\. Nothing was saved/),
      });
    } finally {
      spy.mockRestore();
    }
    expect(await baptismRows(churchA.churchId)).toHaveLength(0);
    const [[after]] = await pool.query("SELECT next_number FROM certificate_series WHERE church_id = ? AND certificate_type = 'Baptism'", [churchA.churchId]);
    expect(after.next_number).toBe(before.next_number);
  });
});

describe('business rules are enforced by the server, not only the UI', () => {
  const base = async () => ({ child_name: 'Rule Child', gender_id: await helpers.masterId('genders', 'Male') });

  it('rejects baptism before birth, a future birth date and an unparsable date with a 400', async () => {
    await expect(certificateService.create('baptism', { ...(await base()), date_of_birth: '2020-05-05', date_of_baptism: '2019-01-01' }, reqA)).rejects.toMatchObject({
      statusCode: 400,
      message: 'Date of Baptism cannot be before Date of Birth.',
    });
    await expect(certificateService.create('baptism', { ...(await base()), date_of_birth: '2090-01-01', date_of_baptism: '2090-02-01' }, reqA)).rejects.toMatchObject({
      statusCode: 400,
      message: 'Date of Birth cannot be in the future.',
    });
    await expect(certificateService.create('baptism', { ...(await base()), date_of_birth: 'not-a-date', date_of_baptism: '2019-01-01' }, reqA)).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringMatching(/^Date of Birth: "not-a-date" is not a valid date/),
    });
    await expect(certificateService.create('baptism', { ...(await base()), date_of_birth: '2020-02-31', date_of_baptism: '2021-01-01' }, reqA)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('accepts a birth date of "today" anywhere on Earth and a baptism on the birth date', async () => {
    const today = new Date(Date.now() + 14 * 3600 * 1000).toISOString().slice(0, 10); // latest date that exists on Earth
    const record = await certificateService.create('baptism', { ...(await base()), date_of_birth: today, date_of_baptism: today }, reqA);
    expect(record.date_of_birth).toBe(today);
  });

  it('enforces the rules on update too, but only for fields the request changes', async () => {
    await clear(churchA.churchId);
    // A legacy record that already breaks a rule (inserted directly, as old data would be).
    const male = await helpers.masterId('genders', 'Male');
    const [legacy] = await pool.query(
      "INSERT INTO baptism_certificates (church_id, certificate_no, child_name, gender_id, date_of_birth, date_of_baptism) VALUES (?, 'OLD1', 'Legacy', ?, '2020-05-05', '2019-01-01')",
      [churchA.churchId, male]
    );
    // Fixing an unrelated field is not blocked by the old bad dates...
    const updated = await certificateService.update('baptism', legacy.insertId, { remarks: 'fixed a typo' }, reqA);
    expect(updated.remarks).toBe('fixed a typo');
    // ...but touching a date re-checks the rule.
    await expect(certificateService.update('baptism', legacy.insertId, { date_of_baptism: '2010-01-01' }, reqA)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('applies the same rules to Marriage and Death', async () => {
    // The marriage date's visible heading on the form is "When Married".
    await expect(certificateService.create('marriage', { groom_name: 'G', bride_name: 'B', marriage_date: '2090-01-01' }, reqA)).rejects.toMatchObject({
      statusCode: 400,
      message: 'When Married cannot be in the future.',
    });
    await expect(certificateService.create('death', { deceased_name: 'D', date_of_death: '2020-05-05', burial_date: '2020-05-01' }, reqA)).rejects.toMatchObject({
      statusCode: 400,
      message: 'Date of Burial cannot be before Date of Death.',
    });
    await expect(certificateService.create('death', { deceased_name: 'D', date_of_death: '2090-05-05' }, reqA)).rejects.toMatchObject({ statusCode: 400, message: 'Date of Death cannot be in the future.' });
  });
});

describe('Marriage and Death use the same engine (round trip)', () => {
  it.each([
    [
      'marriage',
      () => [
        { marriage_date: '2018-11-24', where_married: "St. Mary's & St. Joseph's", groom_name: 'சாமுவேல்', bride_name: 'Anna <Bride>', groom_age: '28', bride_age: '25', witness1_name: "O'Neil", remarks: '=SUM(A1)' },
        { marriage_date: '2019-01-01', groom_name: 'G2', bride_name: 'B2', custom_priest_name: 'Fr. Guest' },
      ],
    ],
    [
      'death',
      () => [
        { deceased_name: 'பீட்டர்', age: '78', date_of_death: '2019-12-31', burial_date: '2020-01-01', cemetery: "St. Peter's", family_contact: '+91 98765-43210', remarks: 'x'.repeat(300) },
        { deceased_name: 'D2', date_of_death: '2021-03-03', custom_priest_name: 'Fr. Guest' },
      ],
    ],
  ])('%s', async (type, records) => {
    await clear(churchA.churchId);
    await clear(churchB.churchId);
    const thomas = await priestId(churchA.churchId, 'Fr. Thomas');
    const list = records();
    list[0].priest_id = thomas;
    for (const record of list) await certificateService.create(type, record, reqA);

    const first = await transfer.exportCertificates(type, {}, reqA);
    expect(first.count).toBe(2);
    const report = await transfer.importCertificates(type, { buffer: first.buffer, fileName: 'x.xlsx', lang: 'en' }, reqB);
    expect(report).toMatchObject({ total: 2, imported: 2, failed: 0 });
    const second = await transfer.exportCertificates(type, {}, reqB);
    expect(await helpers.readCells(second.buffer)).toEqual(await helpers.readCells(first.buffer));
  });

  it('the export honours the same search/filters as the list', async () => {
    await clear(churchA.churchId);
    await certificateService.create('marriage', { marriage_date: '2018-11-24', groom_name: 'Sam', bride_name: 'Anna Bride' }, reqA);
    await certificateService.create('marriage', { marriage_date: '2019-06-01', groom_name: 'Raj', bride_name: 'Mary' }, reqA);
    const all = await transfer.exportCertificates('marriage', {}, reqA);
    const filtered = await transfer.exportCertificates('marriage', { search: 'Anna' }, reqA);
    const dated = await transfer.exportCertificates('marriage', { marriage_dateFrom: '2019-01-01' }, reqA);
    expect([all.count, filtered.count, dated.count]).toEqual([2, 1, 1]);
  });
});

describe('templates and file-level errors', () => {
  it('builds a template with the exact headings, one example row and a notes sheet', async () => {
    const { buffer } = await transfer.buildCertificateTemplate('baptism', { lang: 'en' }, reqA);
    const cells = await helpers.readCells(buffer);
    expect(cells[0].map((c) => c.value)).toEqual(getCertificateColumns('baptism').map((c) => headingLabel(c, 'en')));
    expect(cells).toHaveLength(2); // heading + one example row

    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Data', 'Notes']);
    const notes = [];
    wb.worksheets[1].eachRow((row) => notes.push(String(row.getCell(2).value)));
    expect(notes.join('\n')).toMatch(/Male, Female/);
    expect(notes.join('\n')).toMatch(/DD-MM-YYYY/);
  });

  it('the template imports cleanly as-is (the example row is valid)', async () => {
    await clear(churchA.churchId);
    const { buffer } = await transfer.buildCertificateTemplate('baptism', { lang: 'en' }, reqA);
    const report = await transfer.importCertificates('baptism', { buffer, fileName: 'template.xlsx', lang: 'en' }, reqA);
    expect(report).toMatchObject({ imported: 1, failed: 0 });
  });

  it('the Tamil template uses Tamil headings and still imports', async () => {
    await clear(churchA.churchId);
    const { buffer } = await transfer.buildCertificateTemplate('baptism', { lang: 'ta' }, reqA);
    const report = await transfer.importCertificates('baptism', { buffer, fileName: 'template.xlsx', lang: 'ta' }, reqA);
    expect(report).toMatchObject({ imported: 1, failed: 0 });
  });

  it('rejects a wrong-type file, an empty file and wrong headings before touching the database', async () => {
    const run = (buffer, fileName) => transfer.importCertificates('baptism', { buffer, fileName, lang: 'en' }, reqA);
    await expect(run(Buffer.from('a,b'), 'data.csv')).rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/Only \.xlsx/) });
    await expect(run(Buffer.alloc(0), 'data.xlsx')).rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/empty/) });
    const wrong = await helpers.makeXlsx({ headers: ['Foo', 'Bar'], rows: [['1', '2']] });
    await expect(run(wrong, 'data.xlsx')).rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/Missing required column\(s\)/) });
  });

  it('every certificate type registers the columns the import can write', () => {
    for (const type of Object.keys(registry)) {
      const importable = getCertificateColumns(type).filter((c) => c.key !== 'certificate_no').map((c) => c.key);
      expect(importable.sort()).toEqual([...registry[type].columns].sort());
    }
  });
});
