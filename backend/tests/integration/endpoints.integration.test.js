'use strict';

const request = require('supertest');
const ExcelJS = require('exceljs');
const helpers = require('./helpers');
const { pool } = helpers;
const app = require('../../src/app');
const { hashSessionToken } = require('../../src/utils/sessionToken');

let church;
const tokens = {};

async function loginAs(roleCode, label) {
  const [[role]] = await pool.query('SELECT id FROM roles WHERE code = ?', [roleCode]);
  const [user] = await pool.query(
    'INSERT INTO users (username, password_hash, full_name, role_id, church_id, is_active) VALUES (?, ?, ?, ?, ?, 1)',
    [`it_${label}_${Date.now()}`, 'not-a-real-hash', `IT ${label}`, role.id, church.churchId]
  );
  const token = `it-token-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await pool.query('INSERT INTO sessions (user_id, session_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY))', [user.insertId, hashSessionToken(token)]);
  return `sid=${token}`;
}

beforeAll(async () => {
  await helpers.beginSuite();
  church = await helpers.createChurch('HTTP', { priests: ['Fr. Thomas'] });
  tokens.admin = await loginAs('ADMIN', 'admin');
  tokens.accountant = await loginAs('ACCOUNTANT', 'accountant');
});

afterAll(() => helpers.endSuite());

const api = (method, path, token = tokens.admin) => request(app)[method](path).set('Cookie', token).set('Origin', 'http://localhost:4200');
const parse = async (buffer) => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  return wb;
};
const binary = (res, done) => {
  const chunks = [];
  res.on('data', (c) => chunks.push(c));
  res.on('end', () => done(null, Buffer.concat(chunks)));
};

const H = ["Child's Christian Name", 'Sex', 'Date of Birth', 'Date of Baptism'];

describe('certificate import / export / template endpoints', () => {
  it('require a session', async () => {
    expect((await request(app).get('/api/certificates/baptism/export')).status).toBe(401);
    expect((await request(app).post('/api/certificates/baptism/import')).status).toBe(401);
  });

  it('require the certificate permissions of the role', async () => {
    expect((await api('get', '/api/certificates/baptism/export', tokens.accountant)).status).toBe(403);
    expect((await api('get', '/api/certificates/baptism/import-template', tokens.accountant)).status).toBe(403);
    const buffer = await helpers.makeXlsx({ headers: H, rows: [['A', 'Male', '05-04-2016', '05-05-2016']] });
    expect((await api('post', '/api/certificates/baptism/import', tokens.accountant).attach('file', buffer, 'x.xlsx')).status).toBe(403);
  });

  it('import: a valid file saves the rows and returns a report', async () => {
    const buffer = await helpers.makeXlsx({ headers: H, rows: [['Http Child', 'f', '05-04-2016', '05-05-2016'], ['Bad', 'Male', 'nope', '05-05-2016']] });
    const res = await api('post', '/api/certificates/baptism/import').field('lang', 'en').attach('file', buffer, 'children.xlsx');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: { total: 2, imported: 1, failed: 1, errors: [{ row: 3, column: 'Date of Birth', message: expect.stringContaining('"nope" is not a valid date') }], ignoredColumns: [] },
    });
  });

  it('export: an .xlsx download with the record count in a header the browser is allowed to read', async () => {
    const res = await api('get', '/api/certificates/baptism/export').buffer(true).parse(binary);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/spreadsheetml\.sheet/);
    expect(res.headers['content-disposition']).toBe('attachment; filename="baptism-certificates.xlsx"');
    expect(res.headers['x-export-count']).toBe('1');
    expect(res.headers['access-control-expose-headers']).toMatch(/X-Export-Count/);
    const wb = await parse(res.body);
    expect(wb.worksheets[0].getRow(2).getCell(2).value).toBe('Http Child');
  });

  it('export: /export is not mistaken for a certificate id', async () => {
    expect((await api('get', '/api/certificates/baptism/export')).status).toBe(200);
    expect((await api('get', '/api/certificates/baptism/999999')).status).toBe(404);
  });

  it('template: an .xlsx with a Data and a Notes sheet', async () => {
    const res = await api('get', '/api/certificates/baptism/import-template?lang=ta').buffer(true).parse(binary);
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/baptism-certificates-import-template\.xlsx/);
    const wb = await parse(res.body);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Data', 'குறிப்புகள்']);
    expect(wb.worksheets[0].getRow(1).getCell(2).value).toBe('குழந்தையின் கிறிஸ்தவ பெயர்');
  });

  it('import rejects a CSV, an empty file, a missing file, wrong headings and an oversize file with a clear message', async () => {
    const send = (buffer, name) => api('post', '/api/certificates/baptism/import').attach('file', buffer, name);

    const csv = await send(Buffer.from('a,b\n1,2'), 'data.csv');
    expect([csv.status, csv.body.message]).toEqual([400, expect.stringMatching(/Only \.xlsx files can be imported \(this file is "\.csv"\)/)]);

    const empty = await send(Buffer.alloc(0), 'empty.xlsx');
    expect(empty.status).toBe(400);

    const none = await api('post', '/api/certificates/baptism/import');
    expect([none.status, none.body.message]).toEqual([400, expect.stringMatching(/No file was uploaded/)]);

    const wrong = await send(await helpers.makeXlsx({ headers: ['Foo', 'Bar'], rows: [['1', '2']] }), 'wrong.xlsx');
    expect(wrong.status).toBe(400);
    expect(wrong.body.message).toMatch(/Missing required column\(s\)/);
    expect(wrong.body.details.expectedHeadings).toContain("Child's Christian Name");

    const big = await send(Buffer.alloc(11 * 1024 * 1024, 1), 'huge.xlsx');
    expect([big.status, big.body.message]).toEqual([400, expect.stringMatching(/too large\. The maximum size is 10 MB/)]);

    const renamed = await send(Buffer.from('this is not a zip'), 'renamed.xlsx');
    expect([renamed.status, renamed.body.message]).toEqual([400, expect.stringMatching(/not a valid \.xlsx/)]);
  });

  it('the normal create endpoint enforces the business rules with a 400 (never a 500)', async () => {
    const [[male]] = await pool.query("SELECT id FROM genders WHERE name = 'Male'");
    const post = (body) => api('post', '/api/certificates/baptism').send({ child_name: 'R', gender_id: male.id, ...body });
    const beforeBirth = await post({ date_of_birth: '2020-05-05', date_of_baptism: '2019-01-01' });
    expect([beforeBirth.status, beforeBirth.body.message]).toEqual([400, 'Date of Baptism cannot be before Date of Birth.']);
    const future = await post({ date_of_birth: '2090-01-01', date_of_baptism: '2090-02-01' });
    expect([future.status, future.body.message]).toEqual([400, 'Date of Birth cannot be in the future.']);
    const garbage = await post({ date_of_birth: 'not-a-date', date_of_baptism: '2019-01-01' });
    expect(garbage.status).toBe(400);
  });
});

describe('Mass Intention and Contribution endpoints', () => {
  it('serve export, template and import, and reject bad phone numbers on create', async () => {
    const [[cash]] = await pool.query("SELECT id FROM payment_methods WHERE name = 'Cash'");
    const [[mass]] = await pool.query("SELECT id FROM masses WHERE church_id = ? AND name = 'Morning Mass'", [church.churchId]);

    const badMi = await api('post', '/api/mass-intentions').send({ name: 'P', phone: 'abc!!', prayerDate: '2030-01-01', massId: mass.id, customIntention: 'x', offeringAmount: 10, paymentMethodId: cash.id });
    expect(badMi.status).toBe(400);
    expect(JSON.stringify(badMi.body)).toMatch(/must be exactly 10 digits/);
    const badContribution = await api('post', '/api/contributions').send({ name: 'P', phone: 'abc!!', customContributionType: 'x', contributionAmount: 10, paymentMethodId: cash.id });
    expect(badContribution.status).toBe(400);

    for (const base of ['mass-intentions', 'contributions']) {
      const exported = await api('get', `/api/${base}/export`).buffer(true).parse(binary);
      expect([exported.status, exported.headers['x-export-count']]).toEqual([200, '0']);
      const template = await api('get', `/api/${base}/import-template`).buffer(true).parse(binary);
      expect(template.status).toBe(200);
      const imported = await api('post', `/api/${base}/import`).attach('file', template.body, 'template.xlsx');
      expect([imported.status, imported.body.data.imported, imported.body.data.failed]).toEqual([200, 1, 0]);
      // '/export' and '/import-template' are not swallowed by '/:id'.
      expect((await api('get', `/api/${base}/export`)).status).toBe(200);
    }
  });
});
