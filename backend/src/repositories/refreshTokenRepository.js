const { pool } = require('../config/db');

async function create({ userId, tokenHash, expiresAt, ipAddress, userAgent }) {
  const [result] = await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent)
     VALUES (?,?,?,?,?)`,
    [userId, tokenHash, expiresAt, ipAddress, userAgent]
  );
  return result.insertId;
}

async function findValidByHash(tokenHash) {
  const [rows] = await pool.query(
    `SELECT * FROM refresh_tokens
     WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > NOW()
     LIMIT 1`,
    [tokenHash]
  );
  return rows[0] || null;
}

async function revoke(id, replacedByTokenId = null) {
  await pool.query('UPDATE refresh_tokens SET revoked_at = NOW(), replaced_by_token_id = ? WHERE id = ?', [
    replacedByTokenId,
    id,
  ]);
}

async function revokeAllForUser(userId) {
  await pool.query(
    'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL',
    [userId]
  );
}

module.exports = { create, findValidByHash, revoke, revokeAllForUser };
