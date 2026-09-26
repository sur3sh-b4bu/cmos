const { pool } = require('../config/db');

async function findByUsername(username) {
  const [rows] = await pool.query(
    `SELECT u.*, r.code AS role_code, r.name AS role_name, c.name AS church_name, c.name_ta AS church_name_ta, c.logo_url AS church_logo_url, c.theme_color AS church_theme_color, b.name AS branch_name
     FROM users u
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN churches c ON c.id = u.church_id
     LEFT JOIN branches b ON b.id = u.branch_id
     WHERE u.username = ? AND u.is_deleted = 0
     LIMIT 1`,
    [username]
  );
  return rows[0] || null;
}

async function findById(id) {
  const [rows] = await pool.query(
    `SELECT u.*, r.code AS role_code, r.name AS role_name, c.name AS church_name, c.name_ta AS church_name_ta, c.logo_url AS church_logo_url, c.theme_color AS church_theme_color, b.name AS branch_name
     FROM users u
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN churches c ON c.id = u.church_id
     LEFT JOIN branches b ON b.id = u.branch_id
     WHERE u.id = ? AND u.is_deleted = 0
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

/** A single indexed PK lookup (plus one cheap join to `roles`) -- deliberately
 * cheap since authenticate.js calls this on every authenticated request (see
 * its own comment) to make deactivating a user, changing their role or
 * reassigning that role's code, OR moving them to a different church/branch,
 * take effect immediately. Under session auth there's no token payload to
 * trust for ANY of this (unlike a JWT's baked-in claims), so username/
 * church_id/branch_id are re-fetched fresh here too, not just role_code. */
async function getAuthStatus(userId) {
  const [rows] = await pool.query(
    `SELECT u.is_active, u.username, u.role_id, r.code AS role_code, u.church_id, u.branch_id
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = ? AND u.is_deleted = 0
     LIMIT 1`,
    [userId]
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
  getAuthStatus,
  getPermissionCodes,
  resetLoginAttempts,
  updatePassword,
};
