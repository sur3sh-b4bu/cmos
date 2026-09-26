'use strict';

/**
 * Central Management analytics: exact numbers from data built by hand for three churches -- a busy one
 * (A), a small one (B) and an idle one (C) -- plus who may call the API. Every record is dated from the
 * period's own start dates, so the expected numbers are the same on any day of the month.
 */

const request = require('supertest');
const helpers = require('./helpers');
const { pool } = helpers;
const app = require('../../src/app');
const { hashSessionToken } = require('../../src/utils/sessionToken');
const service = require('../../src/central/centralService');
const { resolvePeriod, toKey } = require('../../src/central/period');

const P = resolvePeriod({ period: 'month' });
const CUR = P.from; // inside "this month"
const PREV = P.previous.from; // inside the previous period
const TODAY = toKey(new Date());
const OLD = '2019-03-15';

let A;
let B;
let C;
let branchA1;
let branchA2;
let cash;
let massMorning;
let massEvening;
let intentionMasterIds;
let charity;
let baptismCert;
let genderId;
let seq = 0;
const uniq = (p) => `${p}${Date.now().toString(36)}${(seq += 1)}`;
const sessions = { userIds: [] };

async function makeIntention(churchId, { date, branchId = null, massId, masterId = null, paid = 0 }) {
  const [r] = await pool.query(
    `INSERT INTO prayer_intentions (church_id, branch_id, receipt_no, name, prayer_date, mass_id, prayer_intention_master_id, offering_amount, payment_method_id)
     VALUES (?,?,?,?,?,?,?,100,?)`,
    [churchId, branchId, uniq('R'), 'Central Test', date, massId, masterId, cash]
  );
  if (paid) {
    await pool.query(
      "INSERT INTO payment_transactions (prayer_intention_id, provider, method, transaction_ref, amount, status, payment_date) VALUES (?, 'manual', 'cash', ?, ?, 'success', ?)",
      [r.insertId, uniq('T'), paid, date]
    );
  }
  return r.insertId;
}

async function makeContribution(churchId, { date, typeId, amount, paid = true }) {
  const [r] = await pool.query(
    'INSERT INTO contributions (church_id, receipt_no, name, contribution_type_id, contribution_amount, payment_method_id) VALUES (?,?,?,?,?,?)',
    [churchId, uniq('C'), 'Central Donor', typeId, amount, cash]
  );
  if (paid) {
    await pool.query(
      "INSERT INTO contribution_payment_transactions (contribution_id, provider, transaction_ref, amount, status, method, payment_date) VALUES (?, 'manual', ?, ?, 'success', 'cash', ?)",
      [r.insertId, uniq('CT'), amount, date]
    );
  }
  return r.insertId;
}

async function makeBaptism(churchId, { date, birth, enteredOn }) {
  await pool.query(
    'INSERT INTO baptism_certificates (church_id, certificate_no, child_name, gender_id, date_of_birth, date_of_baptism, created_at) VALUES (?,?,?,?,?,?,?)',
    [churchId, uniq('B'), 'Baby', genderId, birth, date, `${enteredOn} 10:00:00`]
  );
}

const addDaysKey = (key, n) => {
  const [y, m, d] = key.split('-').map(Number);
  return toKey(new Date(y, m - 1, d + n));
};
const monthsBefore = (key, n) => {
  const [y, m, d] = key.split('-').map(Number);
  return toKey(new Date(y, m - 1 - n, d));
};

async function loginAs(roleCode, label, churchId) {
  const [[role]] = await pool.query('SELECT id FROM roles WHERE code = ?', [roleCode]);
  const [user] = await pool.query(
    'INSERT INTO users (username, password_hash, full_name, role_id, church_id, is_active) VALUES (?, ?, ?, ?, ?, 1)',
    [`it_central_${label}_${Date.now()}`, 'not-a-real-hash', `IT ${label}`, role.id, churchId]
  );
  sessions.userIds.push(user.insertId);
  const token = `it-central-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await pool.query('INSERT INTO sessions (user_id, session_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY))', [user.insertId, hashSessionToken(token)]);
  return `sid=${token}`;
}

beforeAll(async () => {
  await helpers.beginSuite();
  A = await helpers.createChurch('central-a');
  B = await helpers.createChurch('central-b');
  C = await helpers.createChurch('central-c'); // no records at all
  cash = await helpers.masterId('payment_methods', 'Cash');
  charity = await helpers.masterId('contribution_types', 'Charity');
  baptismCert = await helpers.masterId('contribution_types', 'Baptism Certificate');
  [[{ id: genderId }]] = await pool.query('SELECT id FROM genders WHERE is_deleted = 0 ORDER BY id LIMIT 1');
  [intentionMasterIds] = [(await pool.query('SELECT id FROM prayer_intention_master WHERE is_deleted = 0 AND is_custom = 0 ORDER BY id LIMIT 2'))[0].map((r) => r.id)];
  [[massMorning]] = await pool.query("SELECT id FROM masses WHERE church_id = ? AND name = 'Morning Mass'", [A.churchId]);
  [[massEvening]] = await pool.query("SELECT id FROM masses WHERE church_id = ? AND name = 'Evening Mass'", [A.churchId]);
  massMorning = massMorning.id;
  massEvening = massEvening.id;
  const [[mB]] = await pool.query("SELECT id FROM masses WHERE church_id = ? AND name = 'Morning Mass'", [B.churchId]);
  branchA1 = (await pool.query("INSERT INTO branches (church_id, name) VALUES (?, 'A One')", [A.churchId]))[0].insertId;
  branchA2 = (await pool.query("INSERT INTO branches (church_id, name) VALUES (?, 'A Two')", [A.churchId]))[0].insertId;

  // ---- Church A. This period: 3 bookings (2 morning, 1 evening; 2 paid), one per branch situation.
  await makeIntention(A.churchId, { date: CUR, branchId: branchA1, massId: massMorning, masterId: intentionMasterIds[0], paid: 100 });
  await makeIntention(A.churchId, { date: CUR, branchId: branchA2, massId: massMorning, masterId: intentionMasterIds[1], paid: 50 });
  await makeIntention(A.churchId, { date: CUR, branchId: null, massId: massEvening, masterId: null }); // custom intention, unpaid
  // previous period: 2 bookings; and one long ago (must be ignored by both)
  await makeIntention(A.churchId, { date: PREV, massId: massMorning, masterId: intentionMasterIds[0], paid: 10 });
  await makeIntention(A.churchId, { date: PREV, massId: massMorning, masterId: intentionMasterIds[0] });
  await makeIntention(A.churchId, { date: OLD, massId: massMorning, masterId: intentionMasterIds[0], paid: 999 });
  // contributions: 100 + 250 received now (+ 999 never paid), 200 received before
  await makeContribution(A.churchId, { date: CUR, typeId: charity, amount: 100 });
  await makeContribution(A.churchId, { date: CUR, typeId: baptismCert, amount: 250 });
  await makeContribution(A.churchId, { date: CUR, typeId: charity, amount: 999, paid: false });
  await makeContribution(A.churchId, { date: PREV, typeId: charity, amount: 200 });
  // certificates: 2 baptisms now (an infant entered on time, an 8-year-old entered 100 days late), 1 before; 1 marriage now
  await makeBaptism(A.churchId, { date: CUR, birth: monthsBefore(CUR, 2), enteredOn: CUR });
  await makeBaptism(A.churchId, { date: CUR, birth: monthsBefore(CUR, 96), enteredOn: addDaysKey(CUR, 100) });
  await makeBaptism(A.churchId, { date: PREV, birth: monthsBefore(PREV, 12), enteredOn: PREV });
  await pool.query('INSERT INTO marriage_certificates (church_id, certificate_no, bride_name, groom_name, marriage_date) VALUES (?,?,?,?,?)', [A.churchId, uniq('M'), 'Bride', 'Groom', CUR]);

  // ---- Church B: one unpaid booking and one 500 contribution, this period only.
  await makeIntention(B.churchId, { date: CUR, massId: mB.id, masterId: intentionMasterIds[0] });
  await makeContribution(B.churchId, { date: CUR, typeId: charity, amount: 500 });
});

afterAll(async () => {
  if (sessions.userIds.length) {
    await pool.query('DELETE FROM sessions WHERE user_id IN (?)', [sessions.userIds]);
    await pool.query('DELETE FROM users WHERE id IN (?)', [sessions.userIds]);
  }
  await helpers.endSuite();
});

const q = (extra = {}) => ({ period: 'month', ...extra });
const row = (rows, id) => rows.find((r) => r.id === id);

describe('overview', () => {
  it('gives every church its own numbers, compared with the previous period', async () => {
    const { churches } = await service.getOverview(q());
    const a = row(churches, A.churchId);
    expect(a.intentions).toEqual({ value: 3, previous: 2, changePct: 50 });
    expect(a.certificates).toMatchObject({ value: 3, previous: 1, changePct: 200, baptism: 2, marriage: 1, death: 0 });
    expect(a.contributions).toMatchObject({ value: 350, previous: 200, changePct: 75, count: 2 }); // the 999 that was never paid is not money received
    expect(a.activity).toEqual({ value: 8, previous: 4, changePct: 100 });
    expect(a.branches).toBe(2);
    expect(a.spark).toHaveLength(P.buckets.length);
    expect(a.spark.reduce((t, n) => t + n, 0)).toBe(8);

    const b = row(churches, B.churchId);
    expect(b.intentions).toEqual({ value: 1, previous: 0, changePct: null }); // nothing to compare with -> no percentage
    expect(b.contributions).toMatchObject({ value: 500, previous: 0, changePct: null });
    expect(b.activity.value).toBe(2);
  });

  it('grades activity against the busiest church, and an idle one is "none"', async () => {
    const { churches } = await service.getOverview(q());
    const level = (id) => row(churches, id).level;
    expect(level(A.churchId)).toBe('high');
    expect(level(B.churchId)).toBe('low');
    expect(level(C.churchId)).toBe('none');
    expect(churches.findIndex((r) => r.id === A.churchId)).toBeLessThan(churches.findIndex((r) => r.id === B.churchId)); // busiest first
  });

  it('totals its KPIs from what the churches show', async () => {
    const { kpis, churches } = await service.getOverview(q());
    expect(kpis.churches.value).toBe(churches.length);
    expect(kpis.intentions.value).toBe(churches.reduce((t, r) => t + r.intentions.value, 0));
    expect(kpis.contributions.value).toBe(churches.reduce((t, r) => t + r.contributions.value, 0));
    expect(kpis.contributions.value).toBeGreaterThanOrEqual(850);
    expect(kpis.intentions.spark).toHaveLength(P.buckets.length);
  });

  it('narrows to one church, or to one branch (which also includes the church\'s branch-less rows)', async () => {
    const one = await service.getOverview(q({ churchId: A.churchId }));
    expect(one.churches.map((r) => r.id)).toEqual([A.churchId]);
    expect(one.kpis.intentions.value).toBe(3);

    const branch = await service.getOverview(q({ churchId: A.churchId, branchId: branchA1 }));
    expect(branch.churches[0].intentions.value).toBe(2); // the A One booking + the one with no branch, not A Two's
  });
});

describe('Mass Intentions', () => {
  it('counts bookings, paid vs unpaid, and compares with before', async () => {
    const r = await service.getMassIntentions(q({ churchId: A.churchId }));
    expect(r.kpis.total).toEqual({ value: 3, previous: 2, changePct: 50 });
    expect(r.kpis.paid).toEqual({ value: 2, ofTotalPct: 66.7 });
    expect(r.kpis.unpaid).toEqual({ value: 1, ofTotalPct: 33.3 });
    expect(r.kpis.busiestChurch).toMatchObject({ id: A.churchId, value: 3 });
    expect(r.byChurch).toHaveLength(1);
    expect(r.byChurch[0]).toMatchObject({ id: A.churchId, value: 3, previous: 2, paid: 2, unpaid: 1, share: 100 });
  });

  it('has one trend point per day of the period, adding up to the total', async () => {
    const r = await service.getMassIntentions(q({ churchId: A.churchId }));
    expect(r.trend.map((p) => p.key)).toEqual(P.buckets);
    expect(r.trend.reduce((t, p) => t + p.value, 0)).toBe(3);
    expect(r.trend.find((p) => p.key === CUR).value).toBe(3);
  });

  it('breaks bookings down by intention type, with custom ones grouped together', async () => {
    const r = await service.getMassIntentions(q({ churchId: A.churchId }));
    expect(r.types.reduce((t, x) => t + x.value, 0)).toBe(3);
    expect(r.types.find((t) => t.key === 'custom').value).toBe(1);
    expect(r.types.reduce((t, x) => t + x.share, 0)).toBeGreaterThan(99);
  });

  it('compares churches: each one\'s share of all bookings', async () => {
    const r = await service.getMassIntentions(q());
    const a = row(r.byChurch, A.churchId);
    const b = row(r.byChurch, B.churchId);
    expect(a.value).toBe(3);
    expect(b.value).toBe(1);
    expect(a.share).toBeGreaterThan(b.share);
  });
});

describe('Daily Register', () => {
  it('measures registrations: total, daily average, active days, and today', async () => {
    const r = await service.getRegister(q({ churchId: A.churchId }));
    const elapsed = Math.round((new Date(P.to.replace(/-/g, '/')) - new Date(P.from.replace(/-/g, '/'))) / 86400000) + 1;
    expect(r.kpis.registrations).toEqual({ value: 3, previous: 2, changePct: 50 });
    expect(r.kpis.dailyAverage.value).toBe(Math.round((3 / elapsed) * 10) / 10);
    expect(r.kpis.activeDaysPct.value).toBe(Math.round((1 / elapsed) * 1000) / 10);
    expect(r.kpis.activeDays).toEqual({ active: 1, total: elapsed });
    expect(r.kpis.peakDay).toEqual({ date: CUR, n: 3 });
    expect(r.kpis.today.value).toBe(TODAY === CUR ? 3 : 0);
    expect(r.kpis.mostActiveChurch).toMatchObject({ id: A.churchId });
  });

  it('builds a weekday x time-of-day heat grid, Monday first, that adds up to the total', async () => {
    const r = await service.getRegister(q({ churchId: A.churchId }));
    expect(r.heat.rows.map((x) => x.dow)).toEqual([2, 3, 4, 5, 6, 7, 1]);
    expect(r.heat.slots).toEqual(['morning', 'afternoon', 'evening']);
    const [y, m, d] = CUR.split('-').map(Number);
    const dow = new Date(y, m - 1, d).getDay() + 1; // MySQL: 1 = Sunday
    const cell = r.heat.rows.find((x) => x.dow === dow);
    expect(cell).toMatchObject({ morning: 2, afternoon: 0, evening: 1 });
    expect(r.heat.rows.reduce((t, x) => t + x.morning + x.afternoon + x.evening, 0)).toBe(3);
    expect(r.heat.max).toBe(2);
  });
});

describe('Baptism, Marriage and Death', () => {
  it('baptisms: counts, age at baptism, entry timeliness', async () => {
    const r = await service.getCertificates('baptism', q({ churchId: A.churchId }));
    expect(r.kpis.inPeriod).toEqual({ value: 2, previous: 1, changePct: 100 });
    expect(r.kpis.recorded.value).toBe(1); // entered in this period: the other was entered 100 days later
    const ages = Object.fromEntries(r.distributions.find((d) => d.key === 'ageBands').items.map((i) => [i.key, i.value]));
    expect(ages).toEqual({ under1: 1, '1to5': 0, '6to12': 1, '13to17': 0, '18plus': 0 });
    expect(r.timeliness).toEqual({ onTime: 1, late: 1, total: 2 });
    expect(r.kpis.onTimePct.value).toBe(50);
    expect(r.distributions.find((d) => d.key === 'gender').items.reduce((t, i) => t + i.value, 0)).toBe(2);
    expect(r.trend.reduce((t, p) => t + p.value, 0)).toBe(2);
  });

  it('marriages: seasonality puts the event in its month, and other types have their own data', async () => {
    const r = await service.getCertificates('marriage', q({ churchId: A.churchId }));
    expect(r.kpis.inPeriod.value).toBe(1);
    const season = r.distributions.find((d) => d.key === 'seasonality').items;
    expect(season).toHaveLength(12);
    expect(season.find((i) => i.key === String(Number(CUR.slice(5, 7)))).value).toBe(1);
    const death = await service.getCertificates('death', q({ churchId: A.churchId }));
    expect(death.kpis.inPeriod).toEqual({ value: 0, previous: 0, changePct: null });
    expect(death.kpis.mostActiveChurch).toBeNull();
  });

  it('an unknown certificate type is a 404', async () => {
    await expect(service.getCertificates('confirmation', q())).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('Contributions', () => {
  it('counts only money received, compares with before, and composes by type', async () => {
    const r = await service.getContributions(q({ churchId: A.churchId }));
    expect(r.kpis.received).toEqual({ value: 350, previous: 200, changePct: 75 });
    expect(r.kpis.count).toMatchObject({ value: 2, previous: 1 });
    expect(r.kpis.avgPerChurch.value).toBe(350);
    expect(r.kpis.topChurch).toMatchObject({ id: A.churchId, value: 350 });
    const parts = Object.fromEntries(r.composition.map((c) => [c.key, c]));
    expect(parts.CHARITY).toMatchObject({ value: 100, share: 28.6 });
    expect(parts.BAPTISM_CERTIFICATE).toMatchObject({ value: 250, share: 71.4 });
    expect(r.trend.find((p) => p.key === CUR).value).toBe(350);
  });

  it('ranks churches by money received, with each one\'s change and share', async () => {
    const r = await service.getContributions(q());
    const a = row(r.byChurch, A.churchId);
    const b = row(r.byChurch, B.churchId);
    expect(a).toMatchObject({ value: 350, previous: 200, changePct: 75, count: 2 });
    expect(b).toMatchObject({ value: 500, previous: 0, changePct: null });
    expect(r.byChurch.findIndex((x) => x.id === B.churchId)).toBeLessThan(r.byChurch.findIndex((x) => x.id === A.churchId));
    expect(r.kpis.yearToDate.value).toBeGreaterThanOrEqual(850);
  });

  it('a church with nothing received shows zero and no percentage', async () => {
    const r = await service.getContributions(q({ churchId: C.churchId }));
    expect(r.kpis.received).toEqual({ value: 0, previous: 0, changePct: null });
    expect(r.kpis.topChurch).toBeNull();
    expect(r.composition).toEqual([]);
  });
});

describe('insights and one church', () => {
  it('states what changed, from the numbers', async () => {
    const { items } = await service.getInsights(q({ churchId: A.churchId }));
    const byKey = Object.fromEntries(items.map((i) => [i.key, i]));
    expect(byKey.contributions).toMatchObject({ tone: 'up', params: { changePct: 75, amount: 350 } });
    expect(byKey.intentions).toMatchObject({ tone: 'up', params: { changePct: 50 } });
    expect(byKey.certificatesTop.params).toMatchObject({ count: 3, church: { id: A.churchId } });
    expect(byKey.inactive).toBeUndefined(); // A is active
  });

  it('flags churches with no activity at all', async () => {
    const { items } = await service.getInsights(q());
    const idle = items.find((i) => i.key === 'inactive');
    expect(idle.tone).toBe('attention');
    expect(idle.params.count).toBeGreaterThanOrEqual(1);
  });

  it('summarises one church for the drawer: metrics, last 7 days and branches', async () => {
    const r = await service.getChurch(A.churchId, q());
    expect(r.church).toMatchObject({ id: A.churchId, branches: 2 });
    expect(r.metrics.intentions).toEqual({ value: 3, previous: 2, changePct: 50 });
    expect(r.metrics.certificates).toMatchObject({ value: 3, baptism: 2, marriage: 1, death: 0 });
    expect(r.metrics.contributions).toMatchObject({ value: 350, count: 2 });
    expect(r.recent).toHaveLength(7);
    expect(r.recent[0].date).toBe(TODAY); // newest first
    if (TODAY === CUR) expect(r.recent[0]).toMatchObject({ intentions: 3, contributions: 2 });
    expect(r.branches.map((b) => (b.branch ? b.branch.name : 'church-wide')).sort()).toEqual(['A One', 'A Two', 'church-wide']);
    expect(r.branches.find((b) => b.branch && b.branch.name === 'A One').intentions.value).toBe(1);
    expect(r.branches.find((b) => !b.branch).intentions.value).toBe(1);
  });

  it('an unknown church is a 404', async () => {
    await expect(service.getChurch(999999999, q())).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('bad requests are refused clearly', () => {
  it.each([
    [{ period: 'decade' }, /Unknown period/],
    [{ period: 'custom', from: '2026-13-01', to: '2026-13-05' }, /valid from and to/],
    [{ branchId: 5 }, /Choose a church before choosing a branch/],
    [{ churchId: 'abc' }, /Invalid church/],
  ])('%j', async (extra, message) => {
    await expect(service.getOverview({ ...extra })).rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(message) });
  });

  it('a branch of another church is refused, an unknown church is a 404', async () => {
    await expect(service.getOverview(q({ churchId: B.churchId, branchId: branchA1 }))).rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/does not belong/) });
    await expect(service.getOverview(q({ churchId: 999999999 }))).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('who may use it (over HTTP)', () => {
  let masterToken;
  let adminToken;

  beforeAll(async () => {
    masterToken = await loginAs('MASTER_ADMIN', 'master', null);
    adminToken = await loginAs('ADMIN', 'admin', A.churchId);
  });

  const get = (path, token) => {
    const r = request(app).get(path).set('Origin', 'http://localhost:4200');
    return token ? r.set('Cookie', token) : r;
  };

  it('needs a session', async () => {
    expect((await get('/api/central/overview')).status).toBe(401);
  });

  it('is refused to a church administrator, whatever their permissions', async () => {
    for (const path of ['/api/central/overview', '/api/central/contributions', '/api/central/certificates/baptism', '/api/central/church/1', '/api/central/insights']) {
      const res = await get(path, adminToken);
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Master Administrator only/);
    }
  });

  it('is open to the Master Administrator, and never cached', async () => {
    const res = await get(`/api/central/overview?period=month&churchId=${A.churchId}`, masterToken);
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.data.churches[0].intentions.value).toBe(3);
    const bad = await get('/api/central/overview?period=nope', masterToken);
    expect(bad.status).toBe(400);
  });
});

describe('levelFor', () => {
  it('grades against the maximum', () => {
    expect(service.levelFor(10, 10)).toBe('high');
    expect(service.levelFor(7, 10)).toBe('high');
    expect(service.levelFor(5, 10)).toBe('medium');
    expect(service.levelFor(2, 10)).toBe('low');
    expect(service.levelFor(0, 10)).toBe('none');
    expect(service.levelFor(0, 0)).toBe('none');
  });
});
