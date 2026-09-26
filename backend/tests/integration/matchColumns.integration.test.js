'use strict';

/**
 * The "match columns" step of an Excel import (see excel/workbookReader.js's
 * previewWorkbook and the `mapping` option): the user picks which file column
 * feeds which field. Run against the real test database for all three modules.
 */

const helpers = require('./helpers');
const { pool } = helpers;
const miTransfer = require('../../src/services/massIntentionTransferService');
const contribTransfer = require('../../src/services/contributionTransferService');
const certTransfer = require('../../src/services/certificateTransferService');
const { CONTRIBUTION_COLUMNS } = require('../../src/excel/specs/contributionSpec');
const { headingLabel } = require('../../src/excel/workbookReader');

const cHeader = (key) => headingLabel(CONTRIBUTION_COLUMNS.find((c) => c.key === key), 'en');

let church;
let req;
let healthIntention;

beforeAll(async () => {
  await helpers.beginSuite();
  const adminId = await helpers.adminUserId();
  church = await helpers.createChurch('MAP', { priests: ['Fr. Thomas'] });
  req = helpers.makeReq(church.churchId, { userId: adminId });
  const [[health]] = await pool.query('SELECT id, name FROM prayer_intention_master WHERE is_custom = 0 AND is_deleted = 0 ORDER BY id LIMIT 1');
  healthIntention = health;
});

afterAll(() => helpers.endSuite());

const clearMi = async () => {
  await pool.query('DELETE FROM prayer_intentions WHERE church_id = ?', [church.churchId]);
  await pool.query('UPDATE receipt_series SET next_number = 1 WHERE church_id = ?', [church.churchId]);
};
const clearContributions = async () => {
  await pool.query('DELETE FROM contributions WHERE church_id = ?', [church.churchId]);
  await pool.query('UPDATE receipt_series SET next_number = 1 WHERE church_id = ?', [church.churchId]);
};
const clearBaptisms = async () => {
  await pool.query('DELETE FROM baptism_certificates WHERE church_id = ?', [church.churchId]);
  await pool.query('UPDATE certificate_series SET next_number = 1 WHERE church_id = ?', [church.churchId]);
};

describe('Mass Intentions: preview + import with a chosen mapping', () => {
  // A register kept in someone's own words -- none of these headings is one the app knows.
  const ODD = ['Who', 'Tel', 'When', 'Service', 'Purpose', 'Money', 'How paid', 'Ledger no'];
  const oddRow = () => ['Anna Joseph', '9876500001', '15-01-2031', 'Morning Mass', healthIntention.name, 300, 'Cash', 'L-77'];
  const FULL = { name: 1, prayer_date: 3, mass_id: 4, prayer_intention_master_id: 5, offering_amount: 6, payment_method_id: 7 };

  it('the preview suggests nothing for foreign headings, then the chosen columns import', async () => {
    await clearMi();
    const buffer = await helpers.makeXlsx({ headers: ODD, rows: [oddRow()] });

    const preview = await miTransfer.previewMassIntentionImport({ buffer, fileName: 'odd.xlsx', lang: 'en' });
    expect(preview.rowCount).toBe(1);
    expect(preview.sourceColumns.map((c) => c.heading)).toEqual(ODD);
    expect(preview.fields.every((f) => f.suggestedColumn === null)).toBe(true);
    expect(preview.fields.filter((f) => f.required).map((f) => f.key)).toEqual(['name', 'prayer_date', 'mass_id', 'offering_amount', 'payment_method_id']);
    // The register number is offered (optional, with a hint that shows this church's prefix); the
    // truly system-assigned columns never are.
    const receiptField = preview.fields.find((f) => f.key === 'receipt_no');
    expect(receiptField).toMatchObject({ required: false, suggestedColumn: null });
    expect(receiptField.hint).toMatch(/12 becomes [A-Za-z0-9]+0012/);
    expect(preview.fields.map((f) => f.key)).not.toContain('created_at');
    expect(preview.fields.map((f) => f.key)).not.toContain('payment_status');

    // "Tel" and "Ledger no" are left out on purpose.
    const report = await miTransfer.importMassIntentions({ buffer, fileName: 'odd.xlsx', lang: 'en', mapping: FULL }, req);
    expect(report).toMatchObject({ total: 1, imported: 1, failed: 0, errors: [], ignoredColumns: ['Tel', 'Ledger no'] });
    const [[saved]] = await pool.query('SELECT name, phone, prayer_date, offering_amount FROM prayer_intentions WHERE church_id = ?', [church.churchId]);
    expect(saved).toMatchObject({ name: 'Anna Joseph', phone: null, prayer_date: '2031-01-15' }); // phone was not ticked, so it is not imported
    expect(Number(saved.offering_amount)).toBe(300);
  });

  it('without a mapping the same file is still rejected by heading, exactly as before', async () => {
    const buffer = await helpers.makeXlsx({ headers: ODD, rows: [oddRow()] });
    await expect(miTransfer.importMassIntentions({ buffer, fileName: 'odd.xlsx', lang: 'en' }, req)).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringMatching(/Missing required column/),
    });
  });

  it('a mapping that leaves out a required field, or names a missing column, is a 400 and saves nothing', async () => {
    await clearMi();
    const buffer = await helpers.makeXlsx({ headers: ODD, rows: [oddRow()] });
    const withoutAmount = { ...FULL };
    delete withoutAmount.offering_amount;
    await expect(miTransfer.importMassIntentions({ buffer, fileName: 'o.xlsx', lang: 'en', mapping: withoutAmount }, req)).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringMatching(/required field.*Offering/i),
    });
    await expect(miTransfer.importMassIntentions({ buffer, fileName: 'o.xlsx', lang: 'en', mapping: { ...FULL, name: 40 } }, req)).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringMatching(/does not exist/),
    });
    const [[{ n }]] = await pool.query('SELECT COUNT(*) n FROM prayer_intentions WHERE church_id = ?', [church.churchId]);
    expect(n).toBe(0);
  });

  it('a wrongly chosen column is reported row by row, not silently accepted (a name column chosen as the amount)', async () => {
    await clearMi();
    const buffer = await helpers.makeXlsx({ headers: ODD, rows: [oddRow()] });
    const report = await miTransfer.importMassIntentions({ buffer, fileName: 'o.xlsx', lang: 'en', mapping: { ...FULL, offering_amount: 1 } }, req);
    expect(report).toMatchObject({ imported: 0, failed: 1 });
    expect(report.errors[0]).toMatchObject({ row: 2, message: expect.stringMatching(/not a valid amount/) });
  });
});

describe('Contributions: preview + shared columns', () => {
  it('one file column may feed two fields', async () => {
    await clearContributions();
    const buffer = await helpers.makeXlsx({ headers: ['Donor', 'Sum', 'Mode'], rows: [['Shared Donor', 750, 'UPI']] });

    const preview = await contribTransfer.previewContributionImport({ buffer, fileName: 'c.xlsx', lang: 'en' });
    expect(preview.fields.find((f) => f.key === 'name').suggestedColumn).toBeNull();

    const mapping = { name: 1, custom_contribution_type: 1, contribution_amount: 2, payment_method_id: 3 };
    const report = await contribTransfer.importContributions({ buffer, fileName: 'c.xlsx', lang: 'en', mapping }, req);
    expect(report).toMatchObject({ imported: 1, failed: 0 });
    const [[saved]] = await pool.query('SELECT name, custom_contribution_type, contribution_amount FROM contributions WHERE church_id = ?', [church.churchId]);
    expect(saved).toMatchObject({ name: 'Shared Donor', custom_contribution_type: 'Shared Donor' });
    expect(Number(saved.contribution_amount)).toBe(750);
  });

  it('the preview suggests exactly the fields whose headings match', async () => {
    const buffer = await helpers.makeXlsx({
      headers: [cHeader('name'), cHeader('contribution_amount'), cHeader('payment_method_id')],
      rows: [['X', 1, 'Cash']],
    });
    const preview = await contribTransfer.previewContributionImport({ buffer, fileName: 'k.xlsx', lang: 'en' });
    const suggested = Object.fromEntries(preview.fields.filter((f) => f.suggestedColumn).map((f) => [f.key, f.suggestedColumn]));
    expect(suggested).toEqual({ name: 1, contribution_amount: 2, payment_method_id: 3 });
  });
});

describe('Baptism certificates: preview + import with a chosen mapping', () => {
  const ODD = ['Baby', 'Boy or girl', 'Born on', 'Baptised on', 'Dad', 'Register page'];
  const oddRow = () => ['Mapped Baby', 'Female', '05-04-2016', '10-05-2016', 'Should not be imported', 'p.12'];

  it('imports exactly the chosen columns and leaves an unchosen optional one empty', async () => {
    await clearBaptisms();
    const buffer = await helpers.makeXlsx({ headers: ODD, rows: [oddRow()] });

    const preview = await certTransfer.previewCertificateImport('baptism', { buffer, fileName: 'b.xlsx', lang: 'en' });
    expect(preview.sourceColumns).toHaveLength(6);
    expect(preview.fields.filter((f) => f.required).map((f) => f.key)).toEqual(['child_name', 'gender_id', 'date_of_birth', 'date_of_baptism']);
    expect(preview.fields.map((f) => f.key)).toContain('father_name');

    const mapping = { child_name: 1, gender_id: 2, date_of_birth: 3, date_of_baptism: 4 }; // "Dad" is not ticked for Father
    const report = await certTransfer.importCertificates('baptism', { buffer, fileName: 'b.xlsx', lang: 'en', mapping }, req);
    expect(report).toMatchObject({ total: 1, imported: 1, failed: 0, ignoredColumns: ['Dad', 'Register page'] });
    const [[saved]] = await pool.query('SELECT child_name, date_of_birth, date_of_baptism, father_name FROM baptism_certificates WHERE church_id = ?', [church.churchId]);
    expect(saved).toMatchObject({ child_name: 'Mapped Baby', date_of_birth: '2016-04-05', date_of_baptism: '2016-05-10', father_name: null });
  });

  it('an unknown certificate type is rejected by the preview, and an incomplete mapping is a 400', async () => {
    const buffer = await helpers.makeXlsx({ headers: ODD, rows: [oddRow()] });
    await expect(certTransfer.previewCertificateImport('bogus', { buffer, fileName: 'b.xlsx', lang: 'en' })).rejects.toBeTruthy();
    await expect(
      certTransfer.importCertificates('baptism', { buffer, fileName: 'b.xlsx', lang: 'en', mapping: { child_name: 1 } }, req)
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/required field/) });
  });
});
