'use strict';

/**
 * Shared fixtures for the integration tests. Everything runs against the
 * dedicated test database (see scripts/prepare-test-db.js) and every church
 * these tests create is removed again afterwards.
 */

const crypto = require('crypto');
const ExcelJS = require('exceljs');
const { pool } = require('../../src/config/db');

const created = { churchIds: [], userIds: [] };
let auditFloor = 0;

/** Hard stop if the pool somehow points at a non-test database. */
async function assertTestDatabase() {
  const [[row]] = await pool.query('SELECT DATABASE() AS db');
  if (!/test/i.test(row.db)) {
    throw new Error(`Integration tests must run on a test database, but connected to "${row.db}". Aborting so real data is never touched.`);
  }
}

async function beginSuite() {
  await assertTestDatabase();
  const [[row]] = await pool.query('SELECT COALESCE(MAX(id), 0) AS maxId FROM audit_logs');
  auditFloor = row.maxId;
}

async function adminUserId() {
  const [[row]] = await pool.query("SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.code = 'ADMIN' ORDER BY u.id LIMIT 1");
  return row.id;
}

/** A church with its number series, two Masses and (optionally) priests. */
async function createChurch(label, { priests = [] } = {}) {
  const name = `ZZ IT ${label} ${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const [church] = await pool.query('INSERT INTO churches (name) VALUES (?)', [name]);
  const churchId = church.insertId;
  created.churchIds.push(churchId);

  for (const [type, prefix] of [['Baptism', 'BAP'], ['Marriage', 'MAR'], ['Death', 'DEA']]) {
    await pool.query('INSERT INTO certificate_series (church_id, certificate_type, prefix, next_number, number_padding) VALUES (?,?,?,1,4)', [churchId, type, prefix]);
  }
  await pool.query("INSERT INTO receipt_series (church_id, series_name, prefix, next_number, number_padding) VALUES (?, 'Main', 'RCT', 1, 4)", [churchId]);
  await pool.query("INSERT INTO masses (church_id, name, mass_time, day_type, default_offering_amount) VALUES (?, 'Morning Mass', '07:00:00', 'daily', 100), (?, 'Evening Mass', '18:00:00', 'daily', 100)", [churchId, churchId]);
  for (const priest of priests) await pool.query('INSERT INTO priests (church_id, name) VALUES (?, ?)', [churchId, priest]);
  return { churchId, name };
}

/** A church exactly as "Masters > Churches > New" leaves it: nothing set up at all. */
async function createBareChurch(label) {
  const name = `ZZ IT ${label} ${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const [church] = await pool.query('INSERT INTO churches (name) VALUES (?)', [name]);
  created.churchIds.push(church.insertId);
  return { churchId: church.insertId, name };
}

function makeReq(churchId, { branchId = null, userId = 1, roleCode = 'ADMIN' } = {}) {
  return {
    user: { id: userId, username: 'it-user', churchId, branchId, roleCode, permissions: [] },
    ip: '127.0.0.1',
    query: {},
    body: {},
    get: () => 'jest',
  };
}

async function masterId(table, name) {
  const [[row]] = await pool.query(`SELECT id FROM ${table} WHERE name = ? AND is_deleted = 0 LIMIT 1`, [name]);
  return row && row.id;
}

/** Removes everything the suite created. */
async function endSuite() {
  try {
    await cleanUp();
  } finally {
    await pool.end();
  }
}

async function cleanUp() {
  // Audit rows written by requests made as the suite's users point at those users.
  await pool.query('DELETE FROM audit_logs WHERE id > ?', [auditFloor]);
  for (const churchId of created.churchIds) {
    await pool.query('DELETE FROM payment_transactions WHERE prayer_intention_id IN (SELECT id FROM prayer_intentions WHERE church_id = ?)', [churchId]);
    await pool.query('DELETE FROM contribution_payment_transactions WHERE contribution_id IN (SELECT id FROM contributions WHERE church_id = ?)', [churchId]);
    for (const table of ['baptism_certificates', 'marriage_certificates', 'death_certificates', 'prayer_intentions', 'contributions']) {
      await pool.query(`DELETE FROM ${table} WHERE church_id = ?`, [churchId]);
    }
    await pool.query('DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE church_id = ?)', [churchId]);
    await pool.query('DELETE FROM users WHERE church_id = ?', [churchId]);
    for (const table of ['certificate_series', 'receipt_series', 'priests', 'masses', 'holidays', 'branches']) {
      await pool.query(`DELETE FROM ${table} WHERE church_id = ?`, [churchId]);
    }
    await pool.query('DELETE FROM churches WHERE id = ?', [churchId]);
  }
  created.churchIds.length = 0;
}

// --------------------------------------------------------------- Excel helpers

/** Builds an .xlsx the way Excel (or another tool) would save it. */
async function makeXlsx({ headers, rows, date1904 = false, dateColumns = [], sheetName = 'Data' }) {
  const wb = new ExcelJS.Workbook();
  if (date1904) wb.properties.date1904 = true;
  const ws = wb.addWorksheet(sheetName);
  ws.addRow(headers);
  rows.forEach((r) => ws.addRow(r));
  dateColumns.forEach((c) => {
    ws.getColumn(c).numFmt = 'dd-mm-yyyy';
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Every cell of the first sheet with its exact value, type and number format. */
async function readCells(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  const out = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const cells = [];
    for (let c = 1; c <= ws.columnCount; c += 1) {
      const cell = row.getCell(c);
      cells.push({ value: cell.value instanceof Date ? cell.value.getTime() : cell.value, type: cell.type, numFmt: cell.numFmt || null });
    }
    out.push(cells);
  });
  return out;
}

module.exports = { pool, beginSuite, endSuite, adminUserId, createChurch, createBareChurch, makeReq, masterId, makeXlsx, readCells };
