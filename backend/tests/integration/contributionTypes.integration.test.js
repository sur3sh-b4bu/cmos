'use strict';

/**
 * The Contribution Type dropdown: "Mass Offering" is retired (a Mass offering is recorded by a Mass
 * Intention) and Baptism / Marriage / Death Certificate are offered instead (migration 040).
 * Run against the real test database.
 */

const helpers = require('./helpers');
const { pool } = helpers;
const genericMasterRepository = require('../../src/repositories/genericMasterRepository');
const registry = require('../../src/config/masterRegistry');
const contributionService = require('../../src/services/contributionService');

beforeAll(() => helpers.beginSuite());
afterAll(() => helpers.endSuite());

/** What the app's dropdown gets: the masters list, which hides deleted rows. */
const dropdown = async () => (await genericMasterRepository.list(registry.contribution_types, { pageSize: 500, filters: {}, churchScope: {} })).rows;

describe('Contribution Types', () => {
  it('offers the three certificate types, in English and Tamil', async () => {
    const rows = await dropdown();
    const byCode = Object.fromEntries(rows.map((r) => [r.code, r]));
    expect(byCode.BAPTISM_CERTIFICATE).toMatchObject({ name: 'Baptism Certificate', is_active: 1 });
    expect(byCode.MARRIAGE_CERTIFICATE).toMatchObject({ name: 'Marriage Certificate', is_active: 1 });
    expect(byCode.DEATH_CERTIFICATE).toMatchObject({ name: 'Death Certificate', is_active: 1 });
    for (const code of ['BAPTISM_CERTIFICATE', 'MARRIAGE_CERTIFICATE', 'DEATH_CERTIFICATE']) {
      expect(byCode[code].name_ta).toBeTruthy();
    }
  });

  it('no longer offers "Mass Offering"', async () => {
    const codes = (await dropdown()).map((r) => r.code);
    expect(codes).not.toContain('MASS_OFFERING');
    expect(codes).toEqual(expect.arrayContaining(['GENERAL', 'BUILDING_FUND', 'CHARITY', 'CHURCH_MAINTENANCE', 'OTHERS']));
  });

  it('keeps each code once (the migration never duplicates a type)', async () => {
    const [rows] = await pool.query('SELECT code, COUNT(*) n FROM contribution_types GROUP BY code HAVING n > 1');
    expect(rows).toEqual([]);
  });

  it('a Contribution can be recorded against a certificate type', async () => {
    const church = await helpers.createChurch('ctype');
    const req = helpers.makeReq(church.churchId, { userId: await helpers.adminUserId() });
    const [[type]] = await pool.query("SELECT id FROM contribution_types WHERE code = 'BAPTISM_CERTIFICATE'");
    const cash = await helpers.masterId('payment_methods', 'Cash');
    const saved = await contributionService.create({ name: 'Certificate Donor', contributionAmount: 200, paymentMethodId: cash, contributionTypeId: type.id }, req);
    expect(saved).toMatchObject({ contribution_type_id: type.id, contribution_type_name: 'Baptism Certificate' });
  });

  it('a contribution saved earlier with the retired "Mass Offering" still shows that name', async () => {
    const church = await helpers.createChurch('ctype-old');
    const [[retired]] = await pool.query("SELECT id FROM contribution_types WHERE code = 'MASS_OFFERING'");
    if (!retired) return; // a database that never had it has nothing to keep
    await pool.query(
      "INSERT INTO contributions (church_id, receipt_no, name, contribution_type_id, contribution_amount, payment_method_id) VALUES (?, 'ZZOLD0001', 'Old donor', ?, 10, 1)",
      [church.churchId, retired.id]
    );
    const [[row]] = await pool.query(
      'SELECT dt.name AS type_shown FROM contributions c LEFT JOIN contribution_types dt ON dt.id = c.contribution_type_id WHERE c.church_id = ? AND c.receipt_no = ?',
      [church.churchId, 'ZZOLD0001']
    );
    expect(row.type_shown).toBe('Mass Offering');
  });
});
