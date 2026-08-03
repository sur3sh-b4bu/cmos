const { pool } = require('../config/db');

/**
 * Atomically claims the next receipt number for a church's active series.
 * Uses SELECT ... FOR UPDATE inside a transaction so concurrent requests
 * (two office staff saving at the same instant) can never receive the
 * same receipt number.
 */
async function claimNextReceiptNumber(churchId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      `SELECT * FROM receipt_series WHERE church_id = ? AND is_active = 1 AND is_deleted = 0
       ORDER BY id LIMIT 1 FOR UPDATE`,
      [churchId]
    );
    if (!rows.length) {
      throw new Error(`No active receipt series configured for church ${churchId}`);
    }
    const series = rows[0];
    const number = series.next_number;
    await conn.query('UPDATE receipt_series SET next_number = next_number + 1 WHERE id = ?', [series.id]);
    await conn.commit();
    const padded = String(number).padStart(series.number_padding, '0');
    return `${series.prefix}${padded}`;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** Same pattern for certificate numbers (Baptism/Marriage/Death). */
async function claimNextCertificateNumber(churchId, certificateType) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      `SELECT * FROM certificate_series
       WHERE church_id = ? AND certificate_type = ? AND is_active = 1 AND is_deleted = 0
       ORDER BY id LIMIT 1 FOR UPDATE`,
      [churchId, certificateType]
    );
    if (!rows.length) {
      throw new Error(`No active ${certificateType} certificate series configured for church ${churchId}`);
    }
    const series = rows[0];
    const number = series.next_number;
    await conn.query('UPDATE certificate_series SET next_number = next_number + 1 WHERE id = ?', [series.id]);
    await conn.commit();
    const padded = String(number).padStart(series.number_padding, '0');
    return `${series.prefix}${padded}`;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { claimNextReceiptNumber, claimNextCertificateNumber };
