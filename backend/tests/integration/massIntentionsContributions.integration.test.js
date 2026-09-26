'use strict';

const helpers = require('./helpers');
const { pool } = helpers;
const massIntentionService = require('../../src/services/massIntentionService');
const contributionService = require('../../src/services/contributionService');
const miTransfer = require('../../src/services/massIntentionTransferService');
const contribTransfer = require('../../src/services/contributionTransferService');
const { MASS_INTENTION_COLUMNS } = require('../../src/excel/specs/massIntentionSpec');
const { CONTRIBUTION_COLUMNS } = require('../../src/excel/specs/contributionSpec');
const { createSchema: miSchema } = require('../../src/validators/massIntentionValidators');
const { createSchema: contributionSchema } = require('../../src/validators/contributionValidators');
const { headingLabel } = require('../../src/excel/workbookReader');

const D = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
const miHeader = (key) => headingLabel(MASS_INTENTION_COLUMNS.find((c) => c.key === key), 'en');
const cHeader = (key) => headingLabel(CONTRIBUTION_COLUMNS.find((c) => c.key === key), 'en');

let adminId;
let churchA;
let churchB;
let reqA;
let reqB;
let cash;
let upi;
let morningA;
let othersIntention;
let healthIntention;

beforeAll(async () => {
  await helpers.beginSuite();
  adminId = await helpers.adminUserId();
  churchA = await helpers.createChurch('MI-A');
  churchB = await helpers.createChurch('MI-B');
  reqA = helpers.makeReq(churchA.churchId, { userId: adminId });
  reqB = helpers.makeReq(churchB.churchId, { userId: adminId });
  cash = await helpers.masterId('payment_methods', 'Cash');
  upi = await helpers.masterId('payment_methods', 'UPI');
  const [[a]] = await pool.query("SELECT id FROM masses WHERE church_id = ? AND name = 'Morning Mass'", [churchA.churchId]);
  morningA = a.id;
  const [[others]] = await pool.query('SELECT id FROM prayer_intention_master WHERE is_custom = 1 AND is_deleted = 0 LIMIT 1');
  othersIntention = others.id;
  const [[health]] = await pool.query('SELECT id, name FROM prayer_intention_master WHERE is_custom = 0 AND is_deleted = 0 ORDER BY id LIMIT 1');
  healthIntention = health;
});

afterAll(() => helpers.endSuite());

const clearMi = async (churchId) => {
  await pool.query('DELETE FROM prayer_intentions WHERE church_id = ?', [churchId]);
  await pool.query('UPDATE receipt_series SET next_number = 1 WHERE church_id = ?', [churchId]);
};

/** The user-entered columns only (receipt no. / entered date / status are system-assigned). */
async function entered(buffer, columns) {
  const cells = await helpers.readCells(buffer);
  const keep = columns.map((c, i) => (c.info ? -1 : i)).filter((i) => i >= 0);
  return cells.map((row) => keep.map((i) => row[i]));
}

describe('Mass Intentions: export -> import -> export keeps every user-entered column', () => {
  beforeAll(async () => {
    await clearMi(churchA.churchId);
    await clearMi(churchB.churchId);
    const base = { massId: morningA, paymentMethodId: cash };
    await massIntentionService.create({ ...base, name: "O'Brien & <Sons>", bookedBy: 'சாமுவேல்', phone: '9876543210', prayerDate: '2030-01-15', prayerIntentionMasterId: healthIntention.id, offeringAmount: 250.5, remarks: 'r'.repeat(300) }, reqA);
    await massIntentionService.create({ ...base, name: 'Custom Intention', prayerDate: '2030-01-16', customIntention: '=1+1 for the family', offeringAmount: 100, paymentMethodId: upi }, reqA);
    await massIntentionService.create({ ...base, name: 'Others Chosen', prayerDate: '2030-12-31', prayerIntentionMasterId: othersIntention, customIntention: 'A special thanksgiving', offeringAmount: 75 }, reqA);
  });

  it('exports dates as real date cells and amounts as numbers, and marks system columns as such', async () => {
    const { buffer, count } = await miTransfer.exportMassIntentions({}, reqA);
    expect(count).toBe(3);
    const cells = await helpers.readCells(buffer);
    const headers = cells[0].map((c) => c.value);
    expect(headers).toEqual(MASS_INTENTION_COLUMNS.map((c) => headingLabel(c, 'en')));
    const at = (row, key) => cells[row][MASS_INTENTION_COLUMNS.findIndex((c) => c.key === key)];
    expect(at(1, 'prayer_date')).toMatchObject({ type: 4, numFmt: 'dd-mm-yyyy', value: D(2030, 1, 15).getTime() });
    expect(at(1, 'created_at').type).toBe(4); // Entered Date is a date too
    expect(at(1, 'offering_amount')).toMatchObject({ value: 250.5, type: 2, numFmt: '0.00' });
    expect(at(1, 'payment_status').value).toBe('Unpaid');
    expect(at(2, 'custom_intention')).toMatchObject({ value: '=1+1 for the family', type: 3 });
  });

  it('imports into another church and the second export matches on every entered column', async () => {
    const first = await miTransfer.exportMassIntentions({}, reqA);
    const report = await miTransfer.importMassIntentions({ buffer: first.buffer, fileName: 'mi.xlsx', lang: 'en' }, reqB);
    expect(report).toMatchObject({ total: 3, imported: 3, failed: 0, errors: [] });

    const second = await miTransfer.exportMassIntentions({}, reqB);
    expect(await entered(second.buffer, MASS_INTENTION_COLUMNS)).toEqual(await entered(first.buffer, MASS_INTENTION_COLUMNS));

    // System-assigned columns are NOT copied: fresh receipt numbers, still Unpaid.
    const [rows] = await pool.query('SELECT receipt_no FROM prayer_intentions WHERE church_id = ? ORDER BY id', [churchB.churchId]);
    expect(rows.map((r) => r.receipt_no)).toEqual(['RCT0001', 'RCT0002', 'RCT0003']);
    const cellsB = await helpers.readCells(second.buffer);
    expect(cellsB[1][MASS_INTENTION_COLUMNS.findIndex((c) => c.key === 'payment_status')].value).toBe('Unpaid');
  });

  it('stores the same values the create form would', async () => {
    const [rows] = await pool.query('SELECT name, booked_by, phone, prayer_date, offering_amount, custom_intention, prayer_intention_master_id, payment_method_id, remarks FROM prayer_intentions WHERE church_id = ? ORDER BY id', [churchB.churchId]);
    expect(rows[0]).toMatchObject({ name: "O'Brien & <Sons>", booked_by: 'சாமுவேல்', phone: '9876543210', prayer_date: '2030-01-15', custom_intention: null, prayer_intention_master_id: healthIntention.id, payment_method_id: cash });
    expect(Number(rows[0].offering_amount)).toBe(250.5);
    expect(rows[0].remarks).toHaveLength(300);
    expect(rows[1]).toMatchObject({ custom_intention: '=1+1 for the family', prayer_intention_master_id: null, payment_method_id: upi });
    expect(rows[2]).toMatchObject({ custom_intention: 'A special thanksgiving', prayer_intention_master_id: othersIntention });
  });

  it('re-importing the same file into the same church skips every row as a duplicate', async () => {
    const first = await miTransfer.exportMassIntentions({}, reqB);
    const report = await miTransfer.importMassIntentions({ buffer: first.buffer, fileName: 'mi.xlsx', lang: 'en' }, reqB);
    expect(report).toMatchObject({ imported: 0, failed: 3 });
    expect(report.errors[0]).toMatchObject({ row: 2, column: 'Name' });
    expect(report.errors[0].message).toMatch(/already exists \(Receipt RCT000\d\)/);
  });

  it('the export honours the list filters', async () => {
    expect((await miTransfer.exportMassIntentions({ search: 'Custom' }, reqA)).count).toBe(1);
    expect((await miTransfer.exportMassIntentions({ prayerDateFrom: '2030-01-16', prayerDateTo: '2030-01-31' }, reqA)).count).toBe(1);
    expect((await miTransfer.exportMassIntentions({ paymentMethodId: String(upi) }, reqA)).count).toBe(1);
    expect((await miTransfer.exportMassIntentions({ search: 'nothing-matches-this' }, reqA)).count).toBe(0);
  });
});

describe('Mass Intention import: every date source, the phone rule and row-level reporting', () => {
  const H = () => [miHeader('name'), miHeader('phone'), miHeader('prayer_date'), miHeader('mass_id'), miHeader('prayer_intention_master_id'), miHeader('custom_intention'), miHeader('offering_amount'), miHeader('payment_method_id')];
  const row = (over = {}) => ({ name: 'Rita', phone: '9876543210', date: '15-01-2031', mass: 'Morning Mass', intention: healthIntention.name, custom: '', amount: 100, pay: 'Cash', ...over });
  const cells = (r) => [r.name, r.phone, r.date, r.mass, r.intention, r.custom, r.amount, r.pay];

  it.each([
    ['text DD-MM-YYYY', '15-01-2031', {}],
    ['text ISO', '2031-01-15', {}],
    ['real Excel date cell', D(2031, 1, 15), { dateColumns: [3] }],
    ['numeric serial', 47863, {}],
    ['1904 date cell', D(2031, 1, 15), { dateColumns: [3], date1904: true }],
  ])('a Mass Date as %s', async (_name, value, options) => {
    await clearMi(churchA.churchId);
    const buffer = await helpers.makeXlsx({ headers: H(), rows: [cells(row({ date: value }))], ...options });
    const report = await miTransfer.importMassIntentions({ buffer, fileName: 'f.xlsx', lang: 'en' }, reqA);
    expect(report).toMatchObject({ imported: 1, failed: 0 });
    const [[r]] = await pool.query('SELECT prayer_date FROM prayer_intentions WHERE church_id = ?', [churchA.churchId]);
    expect(r.prayer_date).toBe('2031-01-15');
  });

  it('accepts the currency-formatted amounts older exports wrote', async () => {
    await clearMi(churchA.churchId);
    const buffer = await helpers.makeXlsx({ headers: H(), rows: [cells(row({ amount: '₹1,250.50' }))] });
    const report = await miTransfer.importMassIntentions({ buffer, fileName: 'f.xlsx', lang: 'en' }, reqA);
    expect(report.imported).toBe(1);
    const [[r]] = await pool.query('SELECT offering_amount FROM prayer_intentions WHERE church_id = ?', [churchA.churchId]);
    expect(Number(r.offering_amount)).toBe(1250.5);
  });

  it('imports the good rows and reports each bad row by row number and column heading', async () => {
    await clearMi(churchA.churchId);
    await pool.query("INSERT INTO holidays (church_id, name, holiday_date, is_recurring_yearly) VALUES (?, 'IT Restricted Day', '2031-03-03', 0)", [churchA.churchId]);
    const buffer = await helpers.makeXlsx({
      headers: H(),
      rows: [
        cells(row({ name: 'Good One' })),
        cells(row({ name: 'Bad Phone', phone: 'call me!' })),
        cells(row({ name: 'Bad Date', date: '31-02-2031' })),
        cells(row({ name: 'Bad Mass', mass: 'Midnight Mass' })),
        cells(row({ name: 'Bad Amount', amount: 'lots' })),
        cells(row({ name: 'Zero Amount', amount: 0 })),
        cells(row({ name: 'Bad Payment', pay: 'Barter' })),
        cells(row({ name: 'No Intention', intention: '', custom: '' })),
        cells(row({ name: 'Restricted Day', date: '03-03-2031' })),
        cells(row({ name: 'Good One' })), // repeats row 2
        cells(row({ name: 'Good Two', phone: '9876543210', date: '16-01-2031' })),
      ],
    });
    const report = await miTransfer.importMassIntentions({ buffer, fileName: 'f.xlsx', lang: 'en' }, reqA);
    expect(report).toMatchObject({ total: 11, imported: 2, failed: 9 });

    const at = (n) => report.errors.filter((e) => e.row === n).map((e) => `${e.column}: ${e.message}`);
    expect(at(3)).toEqual(['Phone Number: Phone number must be exactly 10 digits.']);
    expect(at(4)[0]).toMatch(/^Mass Date: "31-02-2031" is not a real calendar date/);
    expect(at(5)[0]).toMatch(/^Mass: "Midnight Mass" is not a Mass set up for this church\. Available: Morning Mass, Evening Mass/);
    expect(at(6)[0]).toMatch(/^Offering Amount: "lots" is not a valid amount/);
    expect(at(7)).toEqual(['Offering Amount: The amount must be greater than 0.']);
    expect(at(8)[0]).toMatch(/^Payment Method: "Barter" is not a Payment Method\. Allowed values: Cash, Card, UPI/);
    expect(at(9)[0]).toMatch(/^Mass Intention: Choose a Mass Intention or describe one/);
    expect(at(10)[0]).toMatch(/^Mass Date: Mass Intentions cannot be booked on Restricted Dates\. "IT Restricted Day"/);
    expect(at(11)[0]).toMatch(/^Name: Looks like a duplicate of row 2 in this file/);
    expect(JSON.stringify(report)).not.toMatch(/mass_id|payment_method_id|prayer_date|offering_amount|custom_intention|prayer_intention_master_id/);
    expect((await pool.query('SELECT COUNT(*) AS n FROM prayer_intentions WHERE church_id = ?', [churchA.churchId]))[0][0].n).toBe(2);
    await pool.query('DELETE FROM holidays WHERE church_id = ?', [churchA.churchId]);
  });

  it('is scoped to the signed-in church: another church\'s Masses are not visible', async () => {
    await clearMi(churchB.churchId);
    // "Evening Mass" exists in both churches; rename it in B so the name only exists in A.
    await pool.query("UPDATE masses SET name = 'B Only Mass' WHERE church_id = ? AND name = 'Evening Mass'", [churchB.churchId]);
    const buffer = await helpers.makeXlsx({ headers: H(), rows: [cells(row({ mass: 'Evening Mass' }))] });
    const report = await miTransfer.importMassIntentions({ buffer, fileName: 'f.xlsx', lang: 'en' }, reqB);
    expect(report.imported).toBe(0);
    expect(report.errors[0].message).toMatch(/Available: Morning Mass, B Only Mass/);
  });

  it('rolls back every valid row (and the receipt numbers) if the database fails part-way', async () => {
    await clearMi(churchA.churchId);
    const repo = require('../../src/repositories/massIntentionRepository');
    const buffer = await helpers.makeXlsx({ headers: H(), rows: [cells(row({ name: 'One' })), cells(row({ name: 'Two' })), cells(row({ name: 'Three' }))] });
    const original = repo.create;
    let calls = 0;
    const spy = jest.spyOn(repo, 'create').mockImplementation((...args) => {
      calls += 1;
      return calls === 3 ? Promise.reject(new Error('simulated failure')) : original(...args);
    });
    try {
      await expect(miTransfer.importMassIntentions({ buffer, fileName: 'f.xlsx', lang: 'en' }, reqA)).rejects.toMatchObject({ statusCode: 500, message: expect.stringMatching(/rolled back/) });
    } finally {
      spy.mockRestore();
    }
    expect((await pool.query('SELECT COUNT(*) AS n FROM prayer_intentions WHERE church_id = ?', [churchA.churchId]))[0][0].n).toBe(0);
    expect((await pool.query('SELECT next_number FROM receipt_series WHERE church_id = ?', [churchA.churchId]))[0][0].next_number).toBe(1);
  });

  it('template: exact headings, one example row, notes sheet; and it imports as-is', async () => {
    await clearMi(churchA.churchId);
    const { buffer } = await miTransfer.buildMassIntentionTemplate({ lang: 'en' }, reqA);
    const cells2 = await helpers.readCells(buffer);
    expect(cells2[0].map((c) => c.value)).toEqual(MASS_INTENTION_COLUMNS.filter((c) => !c.info).map((c) => headingLabel(c, 'en')));
    expect(cells2).toHaveLength(2);
    const report = await miTransfer.importMassIntentions({ buffer, fileName: 'template.xlsx', lang: 'en' }, reqA);
    expect(report).toMatchObject({ imported: 1, failed: 0 });
  });

  it('a real export can be imported again: the receipt / entered-date / paid columns are ignored and the record is re-created', async () => {
    await clearMi(churchA.churchId);
    const seed = await miTransfer.buildMassIntentionTemplate({ lang: 'en' }, reqA);
    expect(await miTransfer.importMassIntentions({ buffer: seed.buffer, fileName: 'seed.xlsx', lang: 'en' }, reqA)).toMatchObject({ imported: 1, failed: 0 });

    const exported = await miTransfer.exportMassIntentions({ lang: 'en' }, reqA);
    expect(exported.count).toBe(1);

    await clearMi(churchA.churchId);
    const report = await miTransfer.importMassIntentions({ buffer: exported.buffer, fileName: 'export.xlsx', lang: 'en' }, reqA);
    expect(report).toMatchObject({ imported: 1, failed: 0 });
  });
});

describe('the server also rejects a bad phone number on the normal create endpoints', () => {
  it.each(['abc', '12345#', '(044) 2345', '98765.43210', '+91 98765 43210', '12345', '12345678901'])('%j is rejected', (phone) => {
    const mi = miSchema.safeParse({ name: 'N', phone, prayerDate: '2030-01-01', massId: 1, customIntention: 'x', offeringAmount: 1, paymentMethodId: 1 });
    expect(mi.success).toBe(false);
    expect(JSON.stringify(mi.error.issues)).toMatch(/must be exactly 10 digits/);
    const contribution = contributionSchema.safeParse({ name: 'N', phone, customContributionType: 'x', contributionAmount: 1, paymentMethodId: 1 });
    expect(contribution.success).toBe(false);
  });

  it.each(['', '9876543210', '8765432109'])('%j is accepted', (phone) => {
    expect(miSchema.safeParse({ name: 'N', phone, prayerDate: '2030-01-01', massId: 1, customIntention: 'x', offeringAmount: 1, paymentMethodId: 1 }).success).toBe(true);
    expect(contributionSchema.safeParse({ name: 'N', phone, customContributionType: 'x', contributionAmount: 1, paymentMethodId: 1 }).success).toBe(true);
  });
});

describe('Contributions use the same engine', () => {
  const clearC = async (churchId) => {
    await pool.query('DELETE FROM contributions WHERE church_id = ?', [churchId]);
    await pool.query('UPDATE receipt_series SET next_number = 1 WHERE church_id = ?', [churchId]);
  };

  beforeAll(async () => {
    await clearC(churchA.churchId);
    await clearC(churchB.churchId);
    const [[type]] = await pool.query("SELECT id FROM contribution_types WHERE code <> 'OTHERS' AND is_deleted = 0 ORDER BY id LIMIT 1");
    const [[others]] = await pool.query("SELECT id FROM contribution_types WHERE code = 'OTHERS' AND is_deleted = 0 LIMIT 1");
    await contributionService.create({ name: "O'Brien & <Sons>", phone: '9876543210', contributionTypeId: type.id, contributionAmount: 500.25, paymentMethodId: cash, remarks: 'r'.repeat(300) }, reqA);
    await contributionService.create({ name: 'சாமுவேல்', customContributionType: '=HYPERLINK("x")', contributionAmount: 10, paymentMethodId: upi }, reqA);
    await contributionService.create({ name: 'Others', contributionTypeId: others.id, customContributionType: 'Roof repair', contributionAmount: 1250, paymentMethodId: cash }, reqA);
  });

  it('exports and re-imports losslessly on every entered column', async () => {
    const first = await contribTransfer.exportContributions({}, reqA);
    expect(first.count).toBe(3);
    const cells = await helpers.readCells(first.buffer);
    const amountCol = CONTRIBUTION_COLUMNS.findIndex((c) => c.key === 'contribution_amount');
    expect(cells[1][amountCol]).toMatchObject({ value: 500.25, type: 2, numFmt: '0.00' });
    expect(cells[2][CONTRIBUTION_COLUMNS.findIndex((c) => c.key === 'custom_contribution_type')]).toMatchObject({ value: '=HYPERLINK("x")', type: 3, numFmt: '@' });

    const report = await contribTransfer.importContributions({ buffer: first.buffer, fileName: 'c.xlsx', lang: 'en' }, reqB);
    expect(report).toMatchObject({ total: 3, imported: 3, failed: 0 });
    const second = await contribTransfer.exportContributions({}, reqB);
    expect(await entered(second.buffer, CONTRIBUTION_COLUMNS)).toEqual(await entered(first.buffer, CONTRIBUTION_COLUMNS));
  });

  it('reports bad rows by row number and heading while importing the rest', async () => {
    await clearC(churchA.churchId);
    const H = [cHeader('name'), cHeader('phone'), cHeader('contribution_type_id'), cHeader('custom_contribution_type'), cHeader('contribution_amount'), cHeader('payment_method_id')];
    const buffer = await helpers.makeXlsx({
      headers: H,
      rows: [
        ['Good', '9876543210', '', 'Building fund', 100, 'Cash'],
        ['Bad Phone', 'x!', '', 'Building fund', 100, 'Cash'],
        ['Bad Amount', '9876543210', '', 'Building fund', -5, 'Cash'],
        ['No Type', '9876543210', '', '', 100, 'Cash'],
        // Not an error: a type not in the Contribution Types master falls
        // back to the free-text column instead of blocking the row -- see
        // contributionTransferService.js's `contributionType` resolver.
        ['Unlisted Type', '9876543210', 'Nonexistent Type', '', 100, 'Cash'],
        ['Bad Pay', '9876543210', '', 'Building fund', 100, 'Barter'],
      ],
    });
    const report = await contribTransfer.importContributions({ buffer, fileName: 'c.xlsx', lang: 'en' }, reqA);
    expect(report).toMatchObject({ total: 6, imported: 2, failed: 4 });
    const at = (n) => report.errors.filter((e) => e.row === n).map((e) => e.column);
    expect([at(3), at(4), at(5), at(6), at(7)]).toEqual([['Phone Number'], ['Amount'], ['Contribution Type'], [], ['Payment Method']]);
    expect(JSON.stringify(report)).not.toMatch(/contribution_type_id|payment_method_id|contribution_amount|custom_contribution_type/);

    const [unlisted] = await pool.query('SELECT name, contribution_type_id, custom_contribution_type FROM contributions WHERE church_id = ? AND name = ?', [churchA.churchId, 'Unlisted Type']).then(([r]) => r);
    expect(unlisted).toMatchObject({ contribution_type_id: null, custom_contribution_type: 'Nonexistent Type' });
  });

  it('template imports as-is and lists the allowed payment methods', async () => {
    await clearC(churchA.churchId);
    const { buffer } = await contribTransfer.buildContributionTemplate({ lang: 'en' }, reqA);
    const report = await contribTransfer.importContributions({ buffer, fileName: 'template.xlsx', lang: 'en' }, reqA);
    expect(report).toMatchObject({ imported: 1, failed: 0 });
  });
});
