'use strict';

/**
 * Importing a register: the "S.No" / "No." / "Receipt No." / "Certificate No." column is read, only
 * its NUMBER is kept, and this church's own prefix is added (12 -> RCT0012). Run against the real
 * test database for Mass Intentions, Contributions and every certificate type.
 */

const helpers = require('./helpers');
const { pool } = helpers;
const miTransfer = require('../../src/services/massIntentionTransferService');
const contribTransfer = require('../../src/services/contributionTransferService');
const certTransfer = require('../../src/services/certificateTransferService');
const receiptSeries = require('../../src/repositories/receiptSeriesRepository');

let adminId;
let intentionName;

beforeAll(async () => {
  await helpers.beginSuite();
  adminId = await helpers.adminUserId();
  const [[health]] = await pool.query('SELECT name FROM prayer_intention_master WHERE is_custom = 0 AND is_deleted = 0 ORDER BY id LIMIT 1');
  intentionName = health.name;
});

afterAll(() => helpers.endSuite());

const MI_HEADERS = (numberHeading) => [numberHeading, 'Name', 'Mass Date', 'Mass', 'Mass Intention', 'Offering Amount', 'Payment Method'];
const miRow = (no, name, date = '15-01-2031') => [no, name, date, 'Morning Mass', intentionName, 100, 'Cash'];

async function newChurch(label, series = { prefix: 'RCT', padding: 4 }) {
  const church = await helpers.createChurch(label);
  await pool.query('UPDATE receipt_series SET prefix = ?, number_padding = ?, next_number = 1 WHERE church_id = ?', [series.prefix, series.padding, church.churchId]);
  return { ...church, req: helpers.makeReq(church.churchId, { userId: adminId }) };
}

const receipts = async (churchId, table = 'prayer_intentions') =>
  (await pool.query(`SELECT receipt_no, name FROM ${table} WHERE church_id = ? ORDER BY id`, [churchId]))[0].map((r) => [r.receipt_no, r.name]);
const nextNumber = async (churchId) => (await pool.query('SELECT next_number FROM receipt_series WHERE church_id = ?', [churchId]))[0][0].next_number;

describe('Mass Intentions: the register number gets the church\'s prefix', () => {
  it('finds an "S.No" column by itself, and turns every style of number into prefix + padded number', async () => {
    const { churchId, req } = await newChurch('mi-styles');
    const buffer = await helpers.makeXlsx({
      headers: MI_HEADERS('S.No'),
      rows: [miRow(12, 'Plain number'), miRow('No. 13', 'With a label'), miRow('RCT-0014', 'Already prefixed'), miRow('015', 'Leading zeros'), miRow('16.0', 'Decimal')],
    });
    const preview = await miTransfer.previewMassIntentionImport({ buffer, fileName: 'r.xlsx', lang: 'en', churchId });
    expect(preview.fields.find((f) => f.key === 'receipt_no').suggestedColumn).toBe(1); // matched from the heading "S.No"

    const report = await miTransfer.importMassIntentions({ buffer, fileName: 'r.xlsx', lang: 'en' }, req);
    expect(report).toMatchObject({ total: 5, imported: 5, failed: 0, errors: [] });
    expect(await receipts(churchId)).toEqual([
      ['RCT0012', 'Plain number'], ['RCT0013', 'With a label'], ['RCT0014', 'Already prefixed'], ['RCT0015', 'Leading zeros'], ['RCT0016', 'Decimal'],
    ]);
  });

  it('uses THIS church\'s prefix and padding, and moves the series past the imported numbers', async () => {
    const { churchId, req } = await newChurch('mi-prefix', { prefix: 'STM', padding: 3 });
    const buffer = await helpers.makeXlsx({ headers: MI_HEADERS('No.'), rows: [miRow(7, 'Seven'), miRow(41, 'Forty-one')] });
    await miTransfer.importMassIntentions({ buffer, fileName: 'r.xlsx', lang: 'en' }, req);
    expect((await receipts(churchId)).map(([n]) => n)).toEqual(['STM007', 'STM041']);
    expect(await nextNumber(churchId)).toBe(42);
    expect(await receiptSeries.claimNextReceiptNumber(churchId)).toBe('STM042'); // the next one made in the app carries on from there
  });

  it('rows with no number still get the next automatic one, never a number the file itself uses', async () => {
    const { churchId, req } = await newChurch('mi-blank');
    const buffer = await helpers.makeXlsx({
      headers: MI_HEADERS('Receipt No.'),
      rows: [miRow('', 'Auto A'), miRow(2, 'Explicit 2'), miRow('', 'Auto B'), miRow(4, 'Explicit 4'), miRow(null, 'Auto C')],
    });
    const report = await miTransfer.importMassIntentions({ buffer, fileName: 'r.xlsx', lang: 'en' }, req);
    expect(report).toMatchObject({ imported: 5, failed: 0 });
    const numbers = (await receipts(churchId)).map(([n]) => n);
    expect(new Set(numbers).size).toBe(5);
    expect(numbers).toEqual(expect.arrayContaining(['RCT0002', 'RCT0004']));
    for (const auto of ['Auto A', 'Auto B', 'Auto C']) {
      const [n] = (await receipts(churchId)).find(([, name]) => name === auto);
      expect(['RCT0002', 'RCT0004']).not.toContain(n);
      expect(Number(n.slice(3))).toBeGreaterThan(4); // handed out after the highest imported number
    }
  });

  it('reports a number repeated in the file, a number already used in the church, and a number that is not a number', async () => {
    const { churchId, req } = await newChurch('mi-errors');
    await miTransfer.importMassIntentions({ buffer: await helpers.makeXlsx({ headers: MI_HEADERS('No'), rows: [miRow(5, 'Existing')] }), fileName: 'a.xlsx', lang: 'en' }, req);

    const buffer = await helpers.makeXlsx({
      headers: MI_HEADERS('No'),
      rows: [miRow(5, 'Clashes with existing', '16-01-2031'), miRow(6, 'First six', '17-01-2031'), miRow('RCT0006', 'Repeats six', '18-01-2031'), miRow('abc', 'Not a number', '19-01-2031'), miRow(8, 'Good eight', '20-01-2031')],
    });
    const report = await miTransfer.importMassIntentions({ buffer, fileName: 'b.xlsx', lang: 'en' }, req);
    expect(report).toMatchObject({ total: 5, imported: 2, failed: 3 });
    const byRow = Object.fromEntries(report.errors.map((e) => [e.row, e.message]));
    expect(byRow[2]).toMatch(/"RCT0005" already exists in this church/);
    expect(byRow[4]).toMatch(/"RCT0006" appears more than once in this file \(also in row 3\)/);
    expect(byRow[5]).toMatch(/No number found in "abc"/);
    expect((await receipts(churchId)).map(([n]) => n)).toEqual(['RCT0005', 'RCT0006', 'RCT0008']);
    expect(report.errors.every((e) => e.column === 'Receipt No.')).toBe(true);
  });

  it('a receipt number is one sequence across Mass Intentions and Contributions: a Contribution\'s number cannot be reused', async () => {
    const { churchId, req } = await newChurch('mi-shared');
    const contribHeaders = ['No', 'Name', 'Amount', 'Payment Method', 'Describe the contribution purpose'];
    await contribTransfer.importContributions({ buffer: await helpers.makeXlsx({ headers: contribHeaders, rows: [[20, 'Donor', 100, 'Cash', 'Roof']] }), fileName: 'c.xlsx', lang: 'en' }, req);
    expect(await receipts(churchId, 'contributions')).toEqual([['RCT0020', 'Donor']]);

    const report = await miTransfer.importMassIntentions({ buffer: await helpers.makeXlsx({ headers: MI_HEADERS('No'), rows: [miRow(20, 'Wants twenty')] }), fileName: 'm.xlsx', lang: 'en' }, req);
    expect(report).toMatchObject({ imported: 0, failed: 1 });
    expect(report.errors[0].message).toMatch(/"RCT0020" already exists in this church/);
  });

  it('a church nobody set up gets the default series, numbered from the sheet', async () => {
    const { churchId } = await helpers.createBareChurch('mi-bare');
    const req = helpers.makeReq(churchId, { userId: adminId });
    // A bare church has no Masses; give it one so the row is valid.
    await pool.query("INSERT INTO masses (church_id, name, mass_time, day_type) VALUES (?, 'Morning Mass', '06:00:00', 'Daily')", [churchId]);
    const report = await miTransfer.importMassIntentions({ buffer: await helpers.makeXlsx({ headers: MI_HEADERS('S.No'), rows: [miRow(5, 'Bare church')] }), fileName: 'r.xlsx', lang: 'en' }, req);
    expect(report).toMatchObject({ imported: 1, failed: 0 });
    expect(await receipts(churchId)).toEqual([['RCT0005', 'Bare church']]);
    expect(await nextNumber(churchId)).toBe(6);
  });

  it('works with a hand-picked column too (the "Match columns" step)', async () => {
    const { churchId, req } = await newChurch('mi-mapped');
    const buffer = await helpers.makeXlsx({ headers: ['Who', 'Ledger folio', 'When', 'Service', 'Why', 'Money', 'Paid by'], rows: [['Mapped', 'F-33', '15-01-2031', 'Morning Mass', intentionName, 100, 'Cash']] });
    const mapping = { name: 1, receipt_no: 2, prayer_date: 3, mass_id: 4, prayer_intention_master_id: 5, offering_amount: 6, payment_method_id: 7 };
    const report = await miTransfer.importMassIntentions({ buffer, fileName: 'r.xlsx', lang: 'en', mapping }, req);
    expect(report).toMatchObject({ imported: 1, failed: 0 });
    expect(await receipts(churchId)).toEqual([['RCT0033', 'Mapped']]); // "F-33" -> 33 -> RCT0033
  });
});

describe('Contributions: the register number gets the church\'s prefix', () => {
  it('reads the number column and applies the prefix, leaving blanks to the series', async () => {
    const { churchId, req } = await newChurch('c-basic', { prefix: 'CON', padding: 5 });
    const headers = ['Sl.No', 'Name', 'Amount', 'Payment Method', 'Describe the contribution purpose'];
    const buffer = await helpers.makeXlsx({ headers, rows: [[3, 'Three', 100, 'Cash', 'Roof'], ['', 'No number', 200, 'UPI', 'Roof'], ['No. 10', 'Ten', 300, 'Cash', 'Roof']] });
    const report = await contribTransfer.importContributions({ buffer, fileName: 'c.xlsx', lang: 'en' }, req);
    expect(report).toMatchObject({ imported: 3, failed: 0 });
    const numbers = Object.fromEntries((await receipts(churchId, 'contributions')).map(([n, name]) => [name, n]));
    expect(numbers.Three).toBe('CON00003');
    expect(numbers.Ten).toBe('CON00010');
    expect(numbers['No number']).toBe('CON00011'); // after the highest imported number
  });
});

describe('Certificates: the register number gets the church\'s prefix for each type', () => {
  it.each([
    ['baptism', ['S.No', 'Child\'s Christian Name', 'Sex', 'Date of Birth', 'Date of Baptism'], ['Baby', 'Male', '05-04-2016', '05-05-2016'], 'BAP'],
    ['marriage', ['S.No', 'Name of the Bride', 'Name of the Bridegroom', 'When Married'], ['Bride', 'Groom', '05-04-2016'], 'MAR'],
    ['death', ['S.No', 'Name', 'Date of Death'], ['Person', '05-04-2016'], 'DEA'],
  ])('%s', async (type, headers, rest, prefix) => {
    const church = await helpers.createChurch('cert-' + type);
    const req = helpers.makeReq(church.churchId, { userId: adminId });
    const table = `${type}_certificates`;
    const preview = await certTransfer.previewCertificateImport(type, { buffer: await helpers.makeXlsx({ headers, rows: [[42, ...rest]] }), fileName: 'x.xlsx', lang: 'en', churchId: church.churchId });
    expect(preview.fields.find((f) => f.key === 'certificate_no')).toMatchObject({ suggestedColumn: 1 });
    expect(preview.fields.find((f) => f.key === 'certificate_no').hint).toContain(`12 becomes ${prefix}0012`);

    const buffer = await helpers.makeXlsx({ headers, rows: [[42, ...rest], ['No. 7', ...rest.map((v, i) => (i === 0 ? v + ' 2' : v))]] });
    const report = await certTransfer.importCertificates(type, { buffer, fileName: 'x.xlsx', lang: 'en' }, req);
    expect(report).toMatchObject({ imported: 2, failed: 0 });
    const [rows] = await pool.query(`SELECT certificate_no FROM ${table} WHERE church_id = ? ORDER BY id`, [church.churchId]);
    expect(rows.map((r) => r.certificate_no)).toEqual([`${prefix}0042`, `${prefix}0007`]);
    const [[series]] = await pool.query('SELECT next_number FROM certificate_series WHERE church_id = ? AND certificate_type = ?', [church.churchId, { baptism: 'Baptism', marriage: 'Marriage', death: 'Death' }[type]]);
    expect(series.next_number).toBe(43);
  });
});
