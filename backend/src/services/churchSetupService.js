'use strict';

const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const ApiError = require('../utils/ApiError');
const defaults = require('../config/churchDefaults');
const userAdminRepository = require('../repositories/userAdminRepository');
const { generateTempPassword } = require('./userAdminService');

/**
 * "Is this church ready to use?" and "make it ready".
 *
 * A church needs, before staff can save anything:
 *   - a Receipt Number series  (Mass Intentions and Contributions take their receipt numbers from it)
 *   - a Baptism, a Marriage and a Death Certificate series
 *   - at least one Mass        (a Mass Intention is booked against a Mass)
 * and it is better off with a Branch, a Priest and its own Administrator login, though nothing stops
 * working without them (the Master Administrator can act as the church meanwhile).
 *
 * getStatus() reports what is missing. apply() creates only what is missing, in one
 * transaction, and never touches what is already configured -- so it is safe to
 * submit twice, or to run for a church that is half set up.
 */

async function getStatus(churchId, conn = pool) {
  const [[church]] = await conn.query('SELECT id, name FROM churches WHERE id = ? AND is_deleted = 0', [churchId]);
  if (!church) throw ApiError.notFound('Church not found');

  const [[{ receipt }]] = await conn.query(
    'SELECT COUNT(*) AS receipt FROM receipt_series WHERE church_id = ? AND is_active = 1 AND is_deleted = 0',
    [churchId]
  );
  const [certRows] = await conn.query(
    'SELECT certificate_type FROM certificate_series WHERE church_id = ? AND is_active = 1 AND is_deleted = 0',
    [churchId]
  );
  const [[{ masses }]] = await conn.query(
    'SELECT COUNT(*) AS masses FROM masses WHERE church_id = ? AND is_active = 1 AND is_deleted = 0',
    [churchId]
  );
  const [[{ branches }]] = await conn.query('SELECT COUNT(*) AS branches FROM branches WHERE church_id = ? AND is_active = 1 AND is_deleted = 0', [churchId]);
  const [[{ priests }]] = await conn.query('SELECT COUNT(*) AS priests FROM priests WHERE church_id = ? AND is_active = 1 AND is_deleted = 0', [churchId]);
  const [[{ admins }]] = await conn.query(
    `SELECT COUNT(*) AS admins FROM users u JOIN roles r ON r.id = u.role_id
     WHERE u.church_id = ? AND r.code = 'ADMIN' AND u.is_active = 1 AND u.is_deleted = 0`,
    [churchId]
  );

  const haveCertificates = new Set(certRows.map((r) => r.certificate_type));
  const missing = {
    receiptSeries: receipt === 0,
    certificateSeries: defaults.CERTIFICATE_TYPES.filter((t) => !haveCertificates.has(t)),
    masses: masses === 0,
    branch: branches === 0,
    priest: priests === 0,
    admin: admins === 0,
  };
  // Only these stop the office from working; branch and priest are recommendations.
  const complete = !missing.receiptSeries && missing.certificateSeries.length === 0 && !missing.masses;

  return {
    churchId: church.id,
    churchName: church.name,
    complete,
    missing,
    defaults: {
      receiptSeries: { prefix: defaults.RECEIPT_SERIES.prefix, startNumber: defaults.RECEIPT_SERIES.startNumber, padding: defaults.RECEIPT_SERIES.padding },
      certificateSeries: defaults.CERTIFICATE_SERIES,
      masses: defaults.MASSES,
    },
  };
}

/** Certificate series has a unique key on (church, type) that also counts a deleted or
 * deactivated row, so a missing series may need its old row brought back rather than a new one. */
async function upsertCertificateSeries(conn, churchId, type, s, userId) {
  const [existing] = await conn.query('SELECT id FROM certificate_series WHERE church_id = ? AND certificate_type = ? LIMIT 1', [churchId, type]);
  if (existing.length) {
    await conn.query(
      `UPDATE certificate_series
       SET prefix = ?, next_number = ?, number_padding = ?, is_active = 1, is_deleted = 0, updated_by = ?
       WHERE id = ?`,
      [s.prefix, s.startNumber, s.padding, userId, existing[0].id]
    );
  } else {
    await conn.query(
      'INSERT INTO certificate_series (church_id, certificate_type, prefix, next_number, number_padding, created_by) VALUES (?,?,?,?,?,?)',
      [churchId, type, s.prefix, s.startNumber, s.padding, userId]
    );
  }
}

/**
 * Creates what `payload` supplies AND the church is still missing (see the schema in
 * validators/churchSetupValidators.js). Returns the fresh status plus what was created and what
 * was skipped because it already existed.
 */
async function apply(churchId, payload, userId) {
  // The Administrator login: checked and hashed BEFORE anything is written, so a taken username stops the
  // whole setup cleanly, and the slow password hash is not done while the church row is locked.
  let adminAccount = null;
  if (payload.admin) {
    const taken = await userAdminRepository.findByUsernameOrEmail(payload.admin.username, payload.admin.email);
    if (taken) throw ApiError.conflict('A user with this username or email already exists.');
    const tempPassword = generateTempPassword();
    adminAccount = { ...payload.admin, tempPassword, passwordHash: await bcrypt.hash(tempPassword, 12) };
  }

  const conn = await pool.getConnection();
  const created = { receiptSeries: false, certificateSeries: [], masses: 0, branch: false, priest: false, admin: false };
  const skipped = [];
  let adminCredentials = null;
  try {
    await conn.beginTransaction();
    // Serialises two people submitting setup for the same church at once.
    const [[locked]] = await conn.query('SELECT id FROM churches WHERE id = ? AND is_deleted = 0 FOR UPDATE', [churchId]);
    if (!locked) throw ApiError.notFound('Church not found');
    const status = await getStatus(churchId, conn);

    if (payload.receiptSeries) {
      if (status.missing.receiptSeries) {
        const s = payload.receiptSeries;
        await conn.query(
          'INSERT INTO receipt_series (church_id, series_name, prefix, next_number, number_padding, created_by) VALUES (?,?,?,?,?,?)',
          [churchId, defaults.RECEIPT_SERIES.seriesName, s.prefix, s.startNumber, s.padding, userId]
        );
        created.receiptSeries = true;
      } else skipped.push('receiptSeries');
    }

    for (const [type, s] of Object.entries(payload.certificateSeries || {})) {
      if (!s) continue;
      if (status.missing.certificateSeries.includes(type)) {
        await upsertCertificateSeries(conn, churchId, type, s, userId);
        created.certificateSeries.push(type);
      } else skipped.push(`certificateSeries.${type}`);
    }

    if (payload.masses && payload.masses.length) {
      if (status.missing.masses) {
        let order = 1;
        for (const m of payload.masses) {
          await conn.query(
            `INSERT INTO masses (church_id, name, name_ta, mass_time, day_type, default_offering_amount, sort_order, created_by)
             VALUES (?,?,?,?,?,?,?,?)`,
            [churchId, m.name, m.nameTa || null, m.massTime.length === 5 ? `${m.massTime}:00` : m.massTime, m.dayType, m.defaultOfferingAmount || 0, order, userId]
          );
          order += 1;
        }
        created.masses = payload.masses.length;
      } else skipped.push('masses');
    }

    if (payload.branch) {
      if (status.missing.branch) {
        await conn.query('INSERT INTO branches (church_id, name, created_by) VALUES (?,?,?)', [churchId, payload.branch.name, userId]);
        created.branch = true;
      } else skipped.push('branch');
    }

    if (payload.priest) {
      if (status.missing.priest) {
        await conn.query('INSERT INTO priests (church_id, name, title, is_parish_priest, created_by) VALUES (?,?,?,1,?)', [
          churchId,
          payload.priest.name,
          payload.priest.title || 'Rev. Fr.',
          userId,
        ]);
        created.priest = true;
      } else skipped.push('priest');
    }

    if (adminAccount) {
      if (status.missing.admin) {
        const [[role]] = await conn.query("SELECT id FROM roles WHERE code = 'ADMIN' AND is_deleted = 0 ORDER BY id LIMIT 1");
        if (!role) throw ApiError.internal('The Administrator role is missing. Run the database seed.');
        const [result] = await conn.query(
          `INSERT INTO users (church_id, role_id, full_name, username, email, phone, password_hash, must_change_password, created_by, updated_by)
           VALUES (?,?,?,?,?,?,?,1,?,?)`,
          [churchId, role.id, adminAccount.fullName, adminAccount.username, adminAccount.email || null, adminAccount.phone || null, adminAccount.passwordHash, userId, userId]
        );
        created.admin = true;
        adminCredentials = { id: result.insertId, username: adminAccount.username, tempPassword: adminAccount.tempPassword };
      } else skipped.push('admin');
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    if (err && err.code === 'ER_DUP_ENTRY') throw ApiError.conflict('A user with this username or email already exists.');
    throw err;
  } finally {
    conn.release();
  }
  // The temporary password is returned ONCE, to whoever is setting the church up; it is never stored or audited in clear.
  return { status: await getStatus(churchId), created, skipped, ...(adminCredentials ? { admin: adminCredentials } : {}) };
}

module.exports = { getStatus, apply };
