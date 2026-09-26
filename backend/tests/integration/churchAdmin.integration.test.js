'use strict';

/**
 * A new church starts with no users. Its Administrator login can be created in the same "set up this
 * church" step, and a Master Administrator working inside a church sees only that church's users and
 * roles. Run against the real test database.
 */

const bcrypt = require('bcryptjs');
const helpers = require('./helpers');
const { pool } = helpers;
const setup = require('../../src/services/churchSetupService');
const userAdminService = require('../../src/services/userAdminService');
const setupController = require('../../src/controllers/churchSetupController');
const roleController = require('../../src/controllers/roleController');

let adminId;
const createdRoleIds = [];
const createdUsernames = [];

beforeAll(async () => {
  await helpers.beginSuite();
  adminId = await helpers.adminUserId();
});

afterAll(async () => {
  if (createdRoleIds.length) await pool.query('DELETE FROM roles WHERE id IN (?)', [createdRoleIds]);
  if (createdUsernames.length) await pool.query('DELETE FROM users WHERE username IN (?)', [createdUsernames]);
  await helpers.endSuite();
});

const uname = (label) => {
  const name = `it_${label}_${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
  createdUsernames.push(name);
  return name;
};
const asMasterAdminIn = (churchId) => helpers.makeReq(churchId, { userId: adminId, roleCode: 'MASTER_ADMIN' });
const ADMIN = (label) => ({ fullName: 'Church Admin', username: uname(label), email: '', phone: '' });

describe('a new church has no users', () => {
  it('lists none for a Master Administrator working inside it, while Central Management still sees everyone', async () => {
    const { churchId } = await helpers.createBareChurch('nousers');
    const inside = await userAdminService.list({}, asMasterAdminIn(churchId));
    expect(inside.total).toBe(0);
    expect(inside.rows).toEqual([]);

    const central = await userAdminService.list({ pageSize: 100 }, asMasterAdminIn(null));
    expect(central.total).toBeGreaterThan(0); // the seeded church's users (and the master admin) are there
    expect(central.rows.some((u) => u.church_id !== churchId)).toBe(true);
  });

  it('once it has an Administrator, that is the only user listed inside it', async () => {
    const { churchId } = await helpers.createBareChurch('oneuser');
    const { admin } = await setup.apply(churchId, { admin: ADMIN('one') }, adminId);
    const inside = await userAdminService.list({}, asMasterAdminIn(churchId));
    expect(inside.rows.map((u) => u.username)).toEqual([admin.username]);
    expect(inside.rows[0]).toMatchObject({ church_id: churchId, role_code: 'ADMIN' });
  });
});

describe('creating the Administrator during setup', () => {
  it('reports that a bare church has no admin yet, and creates one with a temporary password that must be changed', async () => {
    const { churchId } = await helpers.createBareChurch('admin');
    expect((await setup.getStatus(churchId)).missing.admin).toBe(true);

    const details = { ...ADMIN('made'), fullName: 'Fr. Paul Secretary', email: 'paul@example.org', phone: '9876543210' };
    const result = await setup.apply(churchId, { admin: details }, adminId);
    expect(result.created.admin).toBe(true);
    expect(result.admin).toMatchObject({ username: details.username });
    expect(result.admin.tempPassword).toMatch(/^[A-Za-z]+-[A-Za-z]+-\d{3}$/);
    expect(result.status.missing.admin).toBe(false);

    const [[user]] = await pool.query(
      `SELECT u.*, r.code AS role_code FROM users u JOIN roles r ON r.id = u.role_id WHERE u.username = ?`,
      [details.username]
    );
    expect(user).toMatchObject({ church_id: churchId, role_code: 'ADMIN', full_name: 'Fr. Paul Secretary', email: 'paul@example.org', phone: '9876543210', must_change_password: 1, is_active: 1, is_deleted: 0 });
    expect(await bcrypt.compare(result.admin.tempPassword, user.password_hash)).toBe(true);
    expect(user.password_hash).not.toContain(result.admin.tempPassword); // only the hash is stored
  });

  it('is created together with the rest of the setup, in the same transaction', async () => {
    const { churchId } = await helpers.createBareChurch('together');
    const details = ADMIN('together');
    const result = await setup.apply(churchId, { receiptSeries: { prefix: 'ZA', startNumber: 1, padding: 4 }, masses: [{ name: 'Only Mass', massTime: '07:00', dayType: 'Daily' }], admin: details }, adminId);
    expect(result.created).toMatchObject({ receiptSeries: true, masses: 1, admin: true });
    expect(result.status.missing).toMatchObject({ receiptSeries: false, masses: false, admin: false });
  });

  it('a username that is already taken stops the whole setup with a clear 409 and saves nothing', async () => {
    const other = await helpers.createBareChurch('taken-a');
    const taken = ADMIN('taken');
    await setup.apply(other.churchId, { admin: taken }, adminId);

    const { churchId } = await helpers.createBareChurch('taken-b');
    await expect(
      setup.apply(churchId, { receiptSeries: { prefix: 'ZT', startNumber: 1, padding: 4 }, admin: taken }, adminId)
    ).rejects.toMatchObject({ statusCode: 409, message: expect.stringMatching(/already exists/) });
    const [[{ n }]] = await pool.query('SELECT COUNT(*) n FROM receipt_series WHERE church_id = ?', [churchId]);
    expect(n).toBe(0); // the series was not created either
    expect((await setup.getStatus(churchId)).missing.admin).toBe(true);
  });

  it('a taken email is refused too', async () => {
    const a = await helpers.createBareChurch('mail-a');
    const email = `it-${Date.now()}@example.org`;
    await setup.apply(a.churchId, { admin: { ...ADMIN('mail1'), email } }, adminId);
    const b = await helpers.createBareChurch('mail-b');
    await expect(setup.apply(b.churchId, { admin: { ...ADMIN('mail2'), email } }, adminId)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('never creates a second administrator: submitting again reports it as skipped', async () => {
    const { churchId } = await helpers.createBareChurch('again');
    await setup.apply(churchId, { admin: ADMIN('again1') }, adminId);
    const again = await setup.apply(churchId, { admin: ADMIN('again2') }, adminId);
    expect(again.created.admin).toBe(false);
    expect(again.admin).toBeUndefined(); // no credentials handed out
    expect(again.skipped).toContain('admin');
    const [[{ n }]] = await pool.query('SELECT COUNT(*) n FROM users WHERE church_id = ?', [churchId]);
    expect(n).toBe(1);
  });

  it('a church that already has an Administrator is not asked for one', async () => {
    const { churchId } = await helpers.createBareChurch('has');
    await setup.apply(churchId, { admin: ADMIN('has') }, adminId);
    expect((await setup.getStatus(churchId)).missing.admin).toBe(false);
  });

  it('a deactivated Administrator does not count: the church is offered a new one', async () => {
    const { churchId } = await helpers.createBareChurch('inactive');
    await setup.apply(churchId, { admin: ADMIN('inactive') }, adminId);
    await pool.query('UPDATE users SET is_active = 0 WHERE church_id = ?', [churchId]);
    expect((await setup.getStatus(churchId)).missing.admin).toBe(true);
  });
});

describe('who may create a login through the setup step', () => {
  const run = (req) =>
    new Promise((resolve) => {
      const res = { json: (body) => resolve({ body }) };
      setupController.apply(req, res, (err) => resolve({ err }));
    });
  const reqFor = (churchId, roleCode, permissions, body) => ({ ...helpers.makeReq(churchId, { userId: adminId, roleCode }), params: { churchId: String(churchId) }, body, user: { ...helpers.makeReq(churchId, { userId: adminId, roleCode }).user, permissions } });

  it('someone with masters.create but not users.create is refused when the request includes an admin', async () => {
    const { churchId } = await helpers.createBareChurch('perm');
    const { err } = await run(reqFor(churchId, 'ADMIN', ['masters.create'], { admin: ADMIN('perm') }));
    expect(err).toMatchObject({ statusCode: 403, message: expect.stringMatching(/users\.create/) });
    const [[{ n }]] = await pool.query('SELECT COUNT(*) n FROM users WHERE church_id = ?', [churchId]);
    expect(n).toBe(0);
  });

  it('but may still do the rest of the setup without one', async () => {
    const { churchId } = await helpers.createBareChurch('perm-ok');
    const { err, body } = await run(reqFor(churchId, 'ADMIN', ['masters.create'], { receiptSeries: { prefix: 'ZP', startNumber: 1, padding: 4 } }));
    expect(err).toBeUndefined();
    expect(body.success).toBe(true);
  });
});

describe('roles: a Master Administrator inside a church sees that church\'s roles only', () => {
  const listFor = (churchId) =>
    new Promise((resolve, reject) => {
      const req = { user: helpers.makeReq(churchId, { userId: adminId, roleCode: 'MASTER_ADMIN' }).user, query: {}, body: {}, params: {} };
      roleController.listRoles(req, { json: (body) => resolve(body.data) }, reject);
    });

  it('shows the shared system roles plus its own custom roles, not another church\'s', async () => {
    const a = await helpers.createBareChurch('roles-a');
    const b = await helpers.createBareChurch('roles-b');
    const insert = async (churchId, name) => {
      const [r] = await pool.query(
        "INSERT INTO roles (name, code, description, church_id, is_system_role, created_by, updated_by) VALUES (?, ?, 'test', ?, 0, ?, ?)",
        [name, `CUSTOM_IT_${churchId}_${Date.now()}`, churchId, adminId, adminId]
      );
      createdRoleIds.push(r.insertId);
    };
    await insert(a.churchId, 'Role of A');
    await insert(b.churchId, 'Role of B');

    const inA = (await listFor(a.churchId)).map((r) => r.name);
    expect(inA).toContain('Role of A');
    expect(inA).not.toContain('Role of B');
    expect(inA).toContain('Administrator'); // the shared system roles stay

    const central = (await listFor(null)).map((r) => r.name);
    expect(central).toEqual(expect.arrayContaining(['Role of A', 'Role of B']));
  });
});
