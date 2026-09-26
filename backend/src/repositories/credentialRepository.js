const { pool } = require('../config/db');

const CHALLENGE_TTL_MINUTES = 5;

async function listByUserId(userId) {
  const [rows] = await pool.query(
    `SELECT id, credential_id, public_key, counter, transports, device_label, created_at, last_used_at
     FROM user_credentials
     WHERE user_id = ? AND is_active = 1
     ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
}

async function findByCredentialId(credentialId) {
  const [rows] = await pool.query(
    `SELECT c.*, u.username
     FROM user_credentials c
     JOIN users u ON u.id = c.user_id
     WHERE c.credential_id = ? AND c.is_active = 1
     LIMIT 1`,
    [credentialId]
  );
  return rows[0] || null;
}

async function create({ userId, credentialId, publicKey, counter, transports, deviceLabel }) {
  const [result] = await pool.query(
    `INSERT INTO user_credentials (user_id, credential_id, public_key, counter, transports, device_label)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, credentialId, publicKey, counter, transports || null, deviceLabel || null]
  );
  return result.insertId;
}

/**
 * Counter must only ever move forward -- a replayed assertion carries a stale
 * value, which is the signal that a credential has been cloned.
 */
async function updateCounter(id, counter) {
  await pool.query(
    'UPDATE user_credentials SET counter = ?, last_used_at = NOW() WHERE id = ?',
    [counter, id]
  );
}

async function deactivate(id, userId) {
  const [result] = await pool.query(
    'UPDATE user_credentials SET is_active = 0 WHERE id = ? AND user_id = ?',
    [id, userId]
  );
  return result.affectedRows > 0;
}

async function saveChallenge(scopeKey, purpose, challenge) {
  // Abandoned ceremonies (user opens the prompt, then closes it) leave a row
  // behind that nothing else would ever delete. Sweeping expired rows here
  // keeps the table bounded without needing a scheduled job.
  await pool.query('DELETE FROM webauthn_challenges WHERE expires_at < NOW()');

  await pool.query(
    `INSERT INTO webauthn_challenges (scope_key, purpose, challenge, expires_at)
     VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))
     ON DUPLICATE KEY UPDATE
       challenge = VALUES(challenge),
       expires_at = VALUES(expires_at),
       created_at = NOW()`,
    [scopeKey, purpose, challenge, CHALLENGE_TTL_MINUTES]
  );
}

/** Reads and immediately consumes the challenge -- single use, by design. */
async function consumeChallenge(scopeKey, purpose) {
  const [rows] = await pool.query(
    'SELECT challenge FROM webauthn_challenges WHERE scope_key = ? AND purpose = ? AND expires_at > NOW() LIMIT 1',
    [scopeKey, purpose]
  );
  await pool.query('DELETE FROM webauthn_challenges WHERE scope_key = ? AND purpose = ?', [
    scopeKey,
    purpose,
  ]);
  return rows[0]?.challenge || null;
}

module.exports = {
  listByUserId,
  findByCredentialId,
  create,
  updateCounter,
  deactivate,
  saveChallenge,
  consumeChallenge,
};
