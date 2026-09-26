const { pool } = require('../config/db');
const ApiError = require('../utils/ApiError');
const defaults = require('../config/churchDefaults');

/**
 * Safety net for a church nobody has set up yet (see services/churchSetupService.js for the
 * "Set up this church" step that normally does this): if a church has NEVER had a series of the
 * kind being claimed -- no row at all, not even a deactivated one -- give it the default series
 * instead of failing the save. A series an administrator deliberately deactivated or deleted is
 * left alone, so that case still reports the error below.
 *
 * Runs on the caller's transaction, after locking the church row, so two simultaneous first
 * saves can't each create one.
 */
async function provisionDefaultReceiptSeriesIfNeverConfigured(conn, churchId) {
  await conn.query('SELECT id FROM churches WHERE id = ? FOR UPDATE', [churchId]);
  // A LOCKING read: after waiting for the church lock this must see what another transaction just committed.
  const [any] = await conn.query('SELECT id FROM receipt_series WHERE church_id = ? LIMIT 1 FOR UPDATE', [churchId]);
  if (any.length) return;
  const d = defaults.RECEIPT_SERIES;
  await conn.query('INSERT INTO receipt_series (church_id, series_name, prefix, next_number, number_padding) VALUES (?,?,?,?,?)', [
    churchId,
    d.seriesName,
    d.prefix,
    d.startNumber,
    d.padding,
  ]);
}

async function provisionDefaultCertificateSeriesIfNeverConfigured(conn, churchId, certificateType) {
  const d = defaults.CERTIFICATE_SERIES[certificateType];
  if (!d) return; // not one of the three we have defaults for -- fall through to the error
  await conn.query('SELECT id FROM churches WHERE id = ? FOR UPDATE', [churchId]);
  const [any] = await conn.query('SELECT id FROM certificate_series WHERE church_id = ? AND certificate_type = ? LIMIT 1 FOR UPDATE', [churchId, certificateType]);
  if (any.length) return;
  await conn.query('INSERT INTO certificate_series (church_id, certificate_type, prefix, next_number, number_padding) VALUES (?,?,?,?,?)', [
    churchId,
    certificateType,
    d.prefix,
    d.startNumber,
    d.padding,
  ]);
}

/**
 * Claims the next receipt number for a church's active series, on a
 * connection the CALLER already has an open transaction on -- SELECT ...
 * FOR UPDATE inside that same transaction, so concurrent requests (two
 * office staff saving at the same instant) can never receive the same
 * number. Deliberately does not begin/commit/rollback anything itself: the
 * caller wraps this together with the actual record INSERT in one
 * transaction (see massIntentionService.create et al) so that if the insert
 * fails, the claim rolls back too -- claiming a number and then failing to
 * save the record it was for no longer permanently skips that number.
 */
async function claimNextReceiptNumberOnConn(conn, churchId) {
  const selectActive = () =>
    conn.query(
      `SELECT * FROM receipt_series WHERE church_id = ? AND is_active = 1 AND is_deleted = 0
       ORDER BY id LIMIT 1 FOR UPDATE`,
      [churchId]
    );
  // Check for ANY series row with a plain, lock-free read first: a locking read of an empty range
  // takes a gap lock, and several first-ever saves doing that at once deadlock when they insert.
  const [existing] = await conn.query('SELECT id FROM receipt_series WHERE church_id = ? LIMIT 1', [churchId]);
  if (!existing.length) await provisionDefaultReceiptSeriesIfNeverConfigured(conn, churchId);
  const [rows] = await selectActive();
  if (!rows.length) {
    // A plain Error here would otherwise reach errorHandler.js as an
    // unhandled 500 and get masked down to a generic "unexpected error"
    // for the user, hiding the one thing they'd actually need to know
    // (and the one thing an admin can fix themselves, with no code
    // change, via Masters -> Receipt Series) -- see collections'/mass
    // intentions' own badRequest()s for the same "safe to show" reasoning.
    throw ApiError.badRequest(
      'No active Receipt Number series is configured for this church yet. Ask an administrator to set one up under Masters -> Receipt Series before saving.'
    );
  }
  const series = rows[0];
  const number = series.next_number;
  await conn.query('UPDATE receipt_series SET next_number = next_number + 1 WHERE id = ?', [series.id]);
  return `${series.prefix}${String(number).padStart(series.number_padding, '0')}`;
}

/** Same pattern for certificate numbers (Baptism/Marriage/Death). */
async function claimNextCertificateNumberOnConn(conn, churchId, certificateType) {
  const selectActive = () =>
    conn.query(
      `SELECT * FROM certificate_series
       WHERE church_id = ? AND certificate_type = ? AND is_active = 1 AND is_deleted = 0
       ORDER BY id LIMIT 1 FOR UPDATE`,
      [churchId, certificateType]
    );
  const [existing] = await conn.query('SELECT id FROM certificate_series WHERE church_id = ? AND certificate_type = ? LIMIT 1', [churchId, certificateType]);
  if (!existing.length) await provisionDefaultCertificateSeriesIfNeverConfigured(conn, churchId, certificateType);
  const [rows] = await selectActive();
  if (!rows.length) {
    throw ApiError.badRequest(
      `No active ${certificateType} Certificate series is configured for this church yet. Ask an administrator to set one up under Masters -> Certificate Series before saving.`
    );
  }
  const series = rows[0];
  const number = series.next_number;
  await conn.query('UPDATE certificate_series SET next_number = next_number + 1 WHERE id = ?', [series.id]);
  return `${series.prefix}${String(number).padStart(series.number_padding, '0')}`;
}

/**
 * Standalone (self-transacting) variant for a caller that isn't already
 * running its own transaction -- opens a connection, claims via the *OnConn
 * helper above, commits, and releases. Kept for callers that only need the
 * number itself with nothing else to make atomic with it.
 */
async function claimNextReceiptNumber(churchId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const receiptNo = await claimNextReceiptNumberOnConn(conn, churchId);
    await conn.commit();
    return receiptNo;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** Standalone variant of claimNextCertificateNumberOnConn -- see claimNextReceiptNumber's own comment. */
async function claimNextCertificateNumber(churchId, certificateType) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const certificateNo = await claimNextCertificateNumberOnConn(conn, churchId, certificateType);
    await conn.commit();
    return certificateNo;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  provisionDefaultReceiptSeriesIfNeverConfigured,
  provisionDefaultCertificateSeriesIfNeverConfigured,
  claimNextReceiptNumber,
  claimNextCertificateNumber,
  claimNextReceiptNumberOnConn,
  claimNextCertificateNumberOnConn,
};
