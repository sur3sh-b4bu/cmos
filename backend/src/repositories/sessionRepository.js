const { pool } = require('../config/db');

async function create({ userId, sessionHash, expiresAt, ipAddress, userAgent }) {
  const [result] = await pool.query(
    `INSERT INTO sessions (user_id, session_hash, expires_at, ip_address, user_agent)
     VALUES (?,?,?,?,?)`,
    [userId, sessionHash, expiresAt, ipAddress, userAgent]
  );
  return result.insertId;
}

async function findValidByHash(sessionHash) {
  const [rows] = await pool.query(
    `SELECT * FROM sessions WHERE session_hash = ? AND expires_at > NOW() LIMIT 1`,
    [sessionHash]
  );
  return rows[0] || null;
}

/** Sliding expiration -- called by authenticate.js on every authenticated
 * request so an active session never expires mid-use; a genuinely idle one
 * still does, once `newExpiresAt` (now + the configured session lifetime)
 * itself passes without another request. */
async function touch(id, newExpiresAt) {
  await pool.query('UPDATE sessions SET expires_at = ?, last_seen_at = NOW() WHERE id = ?', [newExpiresAt, id]);
}

async function revoke(id) {
  await pool.query('DELETE FROM sessions WHERE id = ?', [id]);
}

async function revokeAllForUser(userId) {
  await pool.query('DELETE FROM sessions WHERE user_id = ?', [userId]);
}

module.exports = { create, findValidByHash, touch, revoke, revokeAllForUser };
