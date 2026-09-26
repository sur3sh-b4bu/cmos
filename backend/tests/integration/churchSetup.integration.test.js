'use strict';

/**
 * A church created under Masters > Churches starts with nothing: no receipt or certificate
 * numbering, no Masses. These tests cover the "Set up this church" step, the safety net that
 * stops a never-configured church failing on save, and the checks that keep one church's Masses
 * and priests out of another church's records. Run against the real test database.
 */

const helpers = require('./helpers');
const { pool } = helpers;
const setup = require('../../src/services/churchSetupService');
const receiptSeries = require('../../src/repositories/receiptSeriesRepository');
const massIntentionService = require('../../src/services/massIntentionService');
const certificateService = require('../../src/services/certificateService');
const contributionService = require('../../src/services/contributionService');
const defaults = require('../../src/config/churchDefaults');

let adminId;
let cash;
let healthIntention;

beforeAll(async () => {
  await helpers.beginSuite();
  adminId = await helpers.adminUserId();
  cash = await helpers.masterId('payment_methods', 'Cash');
  const [[health]] = await pool.query('SELECT id FROM prayer_intention_master WHERE is_custom = 0 AND is_deleted = 0 ORDER BY id LIMIT 1');
  healthIntention = health.id;
});

afterAll(() => helpers.endSuite());

const SERIES = { prefix: 'ZS', startNumber: 5, padding: 3 };
const FULL = () => ({
  receiptSeries: SERIES,
  certificateSeries: { Baptism: { ...SERIES, prefix: 'ZB' }, Marriage: { ...SERIES, prefix: 'ZM' }, Death: { ...SERIES, prefix: 'ZD' } },
  masses: [
    { name: 'Dawn Mass', nameTa: '', massTime: '05:30', dayType: 'Daily', defaultOfferingAmount: 50 },
    { name: 'Feast Mass', massTime: '10:00', dayType: 'Special' },
  ],
  branch: { name: 'Main Church' },
  priest: { name: 'Fr. Setup', title: '' },
});

describe('status: what a brand-new church is missing', () => {
  it('reports everything missing, with the defaults the popup pre-fills', async () => {
    const { churchId, name } = await helpers.createBareChurch('bare');
    const status = await setup.getStatus(churchId);
    expect(status).toMatchObject({ churchId, churchName: name, complete: false });
    expect(status.missing).toEqual({ receiptSeries: true, certificateSeries: ['Baptism', 'Marriage', 'Death'], masses: true, branch: true, priest: true, admin: true });
    expect(status.defaults.receiptSeries.prefix).toBe('RCT');
    expect(Object.keys(status.defaults.certificateSeries)).toEqual(defaults.CERTIFICATE_TYPES);
    expect(status.defaults.masses.length).toBeGreaterThan(0);
  });

  it('a church with numbering and Masses is complete even without a branch or priest', async () => {
    const { churchId } = await helpers.createChurch('ready');
    const status = await setup.getStatus(churchId);
    expect(status).toMatchObject({ complete: true, missing: { receiptSeries: false, certificateSeries: [], masses: false, branch: true, priest: true, admin: true } });
  });

  it('is a 404 for a church that does not exist', async () => {
    await expect(setup.getStatus(999999999)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('apply: creating what is missing', () => {
  it('creates numbering, Masses, branch and priest exactly as entered, and the church is then complete', async () => {
    const { churchId } = await helpers.createBareChurch('apply');
    const result = await setup.apply(churchId, FULL(), adminId);
    expect(result.created).toEqual({ receiptSeries: true, certificateSeries: ['Baptism', 'Marriage', 'Death'], masses: 2, branch: true, priest: true, admin: false });
    expect(result.status.complete).toBe(true);

    const [[receipt]] = await pool.query('SELECT prefix, next_number, number_padding FROM receipt_series WHERE church_id = ?', [churchId]);
    expect(receipt).toMatchObject({ prefix: 'ZS', next_number: 5, number_padding: 3 });
    const [certs] = await pool.query('SELECT certificate_type, prefix FROM certificate_series WHERE church_id = ? ORDER BY prefix', [churchId]);
    expect(certs).toEqual([{ certificate_type: 'Baptism', prefix: 'ZB' }, { certificate_type: 'Death', prefix: 'ZD' }, { certificate_type: 'Marriage', prefix: 'ZM' }]);
    const [masses] = await pool.query('SELECT name, mass_time, day_type, default_offering_amount, sort_order FROM masses WHERE church_id = ? ORDER BY sort_order', [churchId]);
    expect(masses.map((m) => [m.name, m.mass_time, m.day_type, Number(m.default_offering_amount), m.sort_order])).toEqual([
      ['Dawn Mass', '05:30:00', 'Daily', 50, 1],
      ['Feast Mass', '10:00:00', 'Special', 0, 2],
    ]);
    const [[priest]] = await pool.query('SELECT name, title, is_parish_priest FROM priests WHERE church_id = ?', [churchId]);
    expect(priest).toMatchObject({ name: 'Fr. Setup', title: 'Rev. Fr.', is_parish_priest: 1 }); // blank title falls back to the default

    // ...and numbering starts where the person said it should.
    expect(await receiptSeries.claimNextReceiptNumber(churchId)).toBe('ZS005');
    expect(await receiptSeries.claimNextCertificateNumber(churchId, 'Baptism')).toBe('ZB005');
  });

  it('is safe to submit twice: what already exists is left alone and reported as skipped', async () => {
    const { churchId } = await helpers.createBareChurch('twice');
    await setup.apply(churchId, FULL(), adminId);
    const again = await setup.apply(churchId, { ...FULL(), receiptSeries: { ...SERIES, prefix: 'OTHER' } }, adminId);
    expect(again.created).toEqual({ receiptSeries: false, certificateSeries: [], masses: 0, branch: false, priest: false, admin: false });
    expect(again.skipped).toEqual(expect.arrayContaining(['receiptSeries', 'certificateSeries.Baptism', 'masses', 'branch', 'priest']));
    const [[{ n }]] = await pool.query('SELECT COUNT(*) n FROM masses WHERE church_id = ?', [churchId]);
    expect(n).toBe(2);
    const [[receipt]] = await pool.query('SELECT prefix FROM receipt_series WHERE church_id = ?', [churchId]);
    expect(receipt.prefix).toBe('ZS');
  });

  it('completes a half-set-up church without touching what it has', async () => {
    const { churchId } = await helpers.createBareChurch('half');
    await setup.apply(churchId, { receiptSeries: SERIES }, adminId);
    const status = await setup.getStatus(churchId);
    expect(status.missing).toMatchObject({ receiptSeries: false, masses: true });
    const result = await setup.apply(churchId, FULL(), adminId);
    expect(result.created).toMatchObject({ receiptSeries: false, masses: 2 });
    const [[{ n }]] = await pool.query('SELECT COUNT(*) n FROM receipt_series WHERE church_id = ?', [churchId]);
    expect(n).toBe(1);
  });

  it('brings back a certificate series that was deleted, instead of failing on the unique key', async () => {
    const { churchId } = await helpers.createBareChurch('revive');
    await setup.apply(churchId, FULL(), adminId);
    await pool.query("UPDATE certificate_series SET is_deleted = 1 WHERE church_id = ? AND certificate_type = 'Death'", [churchId]);
    expect((await setup.getStatus(churchId)).missing.certificateSeries).toEqual(['Death']);

    const result = await setup.apply(churchId, { certificateSeries: { Death: { prefix: 'NEWD', startNumber: 1, padding: 4 } } }, adminId);
    expect(result.created.certificateSeries).toEqual(['Death']);
    const [rows] = await pool.query("SELECT prefix, is_deleted, is_active FROM certificate_series WHERE church_id = ? AND certificate_type = 'Death'", [churchId]);
    expect(rows).toEqual([{ prefix: 'NEWD', is_deleted: 0, is_active: 1 }]);
  });

  it('is all-or-nothing: a failure part-way through saves nothing', async () => {
    const { churchId } = await helpers.createBareChurch('rollback');
    const tooLong = 'x'.repeat(200); // longer than masses.name allows -> the insert fails after the series were written
    await expect(setup.apply(churchId, { ...FULL(), masses: [{ name: tooLong, massTime: '05:30', dayType: 'Daily' }] }, adminId)).rejects.toBeTruthy();
    for (const table of ['receipt_series', 'certificate_series', 'masses', 'branches', 'priests']) {
      const [[{ n }]] = await pool.query(`SELECT COUNT(*) n FROM ${table} WHERE church_id = ?`, [churchId]);
      expect([table, n]).toEqual([table, 0]);
    }
  });
});

describe('safety net: a church nobody set up can still save', () => {
  it('a never-configured church gets the default receipt and certificate numbering on first use', async () => {
    const { churchId } = await helpers.createBareChurch('net');
    expect(await receiptSeries.claimNextReceiptNumber(churchId)).toBe('RCT0001');
    expect(await receiptSeries.claimNextReceiptNumber(churchId)).toBe('RCT0002');
    expect(await receiptSeries.claimNextCertificateNumber(churchId, 'Baptism')).toBe('BAP0001');
    expect(await receiptSeries.claimNextCertificateNumber(churchId, 'Marriage')).toBe('MAR0001');
    expect(await receiptSeries.claimNextCertificateNumber(churchId, 'Death')).toBe('DTH0001');
    const [[{ n }]] = await pool.query('SELECT COUNT(*) n FROM receipt_series WHERE church_id = ?', [churchId]);
    expect(n).toBe(1);
  });

  it('simultaneous first saves still create just one series and hand out distinct numbers', async () => {
    const { churchId } = await helpers.createBareChurch('race');
    const numbers = await Promise.all(Array.from({ length: 8 }, () => receiptSeries.claimNextReceiptNumber(churchId)));
    expect(new Set(numbers).size).toBe(8);
    const [[{ n }]] = await pool.query('SELECT COUNT(*) n FROM receipt_series WHERE church_id = ?', [churchId]);
    expect(n).toBe(1);
  });

  it('the same holds for simultaneous first certificate saves of every type at once', async () => {
    const { churchId } = await helpers.createBareChurch('race-cert');
    const types = ['Baptism', 'Marriage', 'Death'];
    const claims = types.flatMap((t) => Array.from({ length: 4 }, () => receiptSeries.claimNextCertificateNumber(churchId, t).then((n) => [t, n])));
    const numbers = await Promise.all(claims);
    for (const t of types) {
      const mine = numbers.filter(([type]) => type === t).map(([, n]) => n);
      expect(new Set(mine).size).toBe(4);
    }
    const [[{ n }]] = await pool.query('SELECT COUNT(*) n FROM certificate_series WHERE church_id = ?', [churchId]);
    expect(n).toBe(3);
  });

  it('a series an administrator deliberately switched off is NOT quietly replaced: the clear error stays', async () => {
    const { churchId } = await helpers.createBareChurch('off');
    await receiptSeries.claimNextReceiptNumber(churchId); // creates the default
    await pool.query('UPDATE receipt_series SET is_active = 0 WHERE church_id = ?', [churchId]);
    await expect(receiptSeries.claimNextReceiptNumber(churchId)).rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/No active Receipt Number series/) });
    const [[{ n }]] = await pool.query('SELECT COUNT(*) n FROM receipt_series WHERE church_id = ?', [churchId]);
    expect(n).toBe(1);
  });

  it('a Contribution and a Baptism certificate save in a bare church', async () => {
    const { churchId } = await helpers.createBareChurch('saves');
    const req = helpers.makeReq(churchId, { userId: adminId });
    const contribution = await contributionService.create({ name: 'Donor', contributionAmount: 100, paymentMethodId: cash, customContributionType: 'General' }, req);
    expect(contribution.receipt_no).toBe('RCT0001');
    const [[gender]] = await pool.query('SELECT id FROM genders WHERE is_deleted = 0 ORDER BY id LIMIT 1');
    const cert = await certificateService.create('baptism', { child_name: 'Baby', gender_id: gender.id, date_of_birth: '2020-01-01', date_of_baptism: '2020-02-01' }, req);
    expect(cert.certificate_no).toBe('BAP0001');
  });
});

describe("one church's Masses stay out of another church's bookings; a certificate's priest is free text", () => {
  it('a Mass Intention cannot be booked against another church\'s Mass, on create or update', async () => {
    const a = await helpers.createChurch('mass-a');
    const b = await helpers.createChurch('mass-b');
    const [[massOfB]] = await pool.query('SELECT id FROM masses WHERE church_id = ? LIMIT 1', [b.churchId]);
    const [[massOfA]] = await pool.query('SELECT id FROM masses WHERE church_id = ? LIMIT 1', [a.churchId]);
    const reqA = helpers.makeReq(a.churchId, { userId: adminId });
    const body = (massId) => ({ name: 'Ann', prayerDate: '2031-05-05', massId, prayerIntentionMasterId: healthIntention, offeringAmount: 100, paymentMethodId: cash });

    await expect(massIntentionService.create(body(massOfB.id), reqA)).rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/does not belong to this church/) });
    const own = await massIntentionService.create(body(massOfA.id), reqA);
    await expect(massIntentionService.update(own.id, { massId: massOfB.id }, reqA)).rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/does not belong to this church/) });
  });

  it('the same person, date and Mass booked in two churches is not a duplicate of each other', async () => {
    const a = await helpers.createChurch('dup-a');
    const [[massOfA]] = await pool.query('SELECT id FROM masses WHERE church_id = ? LIMIT 1', [a.churchId]);
    const repo = require('../../src/repositories/massIntentionRepository');
    const reqA = helpers.makeReq(a.churchId, { userId: adminId });
    await massIntentionService.create({ name: 'Ann', prayerDate: '2031-06-06', massId: massOfA.id, prayerIntentionMasterId: healthIntention, offeringAmount: 100, paymentMethodId: cash }, reqA);
    const probe = { name: 'Ann', phone: null, prayerDate: '2031-06-06', massId: massOfA.id, prayerIntentionMasterId: healthIntention };
    expect(await repo.findPotentialDuplicate({ ...probe, churchId: a.churchId })).toBeTruthy();
    expect(await repo.findPotentialDuplicate({ ...probe, churchId: a.churchId + 1000000 })).toBeNull();
  });

  it('a certificate\'s priest is free text: any name is kept exactly as typed, whichever church the priest belongs to', async () => {
    const a = await helpers.createChurch('pr-a', { priests: ['Fr. Own'] });
    const b = await helpers.createChurch('pr-b', { priests: ['Fr. Other'] });
    const [[other]] = await pool.query('SELECT id FROM priests WHERE church_id = ?', [b.churchId]);
    const [[gender]] = await pool.query('SELECT id FROM genders WHERE is_deleted = 0 ORDER BY id LIMIT 1');
    const reqA = helpers.makeReq(a.churchId, { userId: adminId });
    const base = { child_name: 'Baby', gender_id: gender.id, date_of_birth: '2020-01-01', date_of_baptism: '2020-02-01' };

    const typed = await certificateService.create('baptism', { ...base, custom_priest_name: 'Rev. Fr. Visiting Priest' }, reqA);
    expect(typed.custom_priest_name).toBe('Rev. Fr. Visiting Priest');
    const fromList = await certificateService.create('baptism', { ...base, priest_id: other.id }, reqA);
    expect(fromList.priest_id).toBe(other.id); // not policed: the priest is register text, not a church-owned record
  });
});
