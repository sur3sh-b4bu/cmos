const { pool } = require('../config/db');

async function findByUsername(username) {
  const [rows] = await pool.query(
    `SELECT u.*, r.code AS role_code, r.name AS role_name
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.username = ? AND u.is_deleted = 0
     LIMIT 1`,
    [username]
  );
  return rows[0] || null;
}

async function findById(id) {
  const [rows] = await pool.query(
    `SELECT u.*, r.code AS role_code, r.name AS role_name
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = ? AND u.is_deleted = 0
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function getPermissionCodes(roleId) {
  const [rows] = await pool.query(
    `SELECT p.code
     FROM role_permissions rp
     JOIN permissions p ON p.id = rp.permission_id AND p.is_active = 1
     WHERE rp.role_id = ? AND rp.is_active = 1`,
    [roleId]
  );
  return rows.map((r) => r.code);
}

async function recordFailedLogin(userId, attempts, lockedUntil) {
  await pool.query('UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?', [
    attempts,
    lockedUntil,
    userId,
  ]);
}

async function resetLoginAttempts(userId) {
  await pool.query(
    'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW() WHERE id = ?',
    [userId]
  );
}

async function updatePassword(userId, passwordHash) {
  await pool.query(
    'UPDATE users SET password_hash = ?, must_change_password = 0, updated_by = ? WHERE id = ?',
    [passwordHash, userId, userId]
  );
}

module.exports = {
  findByUsername,
  findById,
  getPermissionCodes,
  recordFailedLogin,
  resetLoginAttempts,
  updatePassword,
};
