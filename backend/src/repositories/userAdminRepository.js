const { pool } = require('../config/db');
const { clampPageSize, clampPage } = require('../utils/pagination');

const BASE_SELECT = `
  SELECT u.id, u.church_id, u.branch_id, u.role_id, u.employee_code, u.full_name, u.username, u.email, u.phone,
         u.must_change_password, u.last_login_at, u.failed_login_attempts, u.locked_until,
         u.is_active, u.is_deleted, u.created_at, u.updated_at,
         r.name AS role_name, r.code AS role_code,
         c.name AS church_name
  FROM users u
  JOIN roles r ON r.id = u.role_id
  LEFT JOIN churches c ON c.id = u.church_id
`;

/** A plain admin only ever sees their own church's users -- unconditional.
 * Master Administrator's reads are otherwise unrestricted across every
 * church (same "reads are unrestricted for that role" reasoning as
 * genericMasterRepository's addChurchScope), so this is a no-op for it. */
function addChurchScope(conditions, params, { churchId, isMasterAdmin }) {
  if (isMasterAdmin) return;
  conditions.push('u.church_id = ?');
  params.push(churchId);
}

async function list({ page = 1, pageSize = 25, search }, churchScope) {
  page = clampPage(page);
  pageSize = clampPageSize(pageSize);
  const conditions = ['u.is_deleted = 0'];
  const params = [];
  addChurchScope(conditions, params, churchScope);
  if (search) {
    conditions.push('(u.full_name LIKE ? OR u.username LIKE ? OR u.email LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  const where = `WHERE ${conditions.join(' AND ')}`;
  const offset = (page - 1) * pageSize;

  const [rows] = await pool.query(
    `${BASE_SELECT} ${where} ORDER BY u.full_name ASC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM users u ${where}`, params);
  return { rows, total, page, pageSize };
}

async function getById(id, churchScope) {
  const conditions = ['u.id = ?', 'u.is_deleted = 0'];
  const params = [id];
  if (churchScope) {
    addChurchScope(conditions, params, churchScope);
  }
  const [rows] = await pool.query(`${BASE_SELECT} WHERE ${conditions.join(' AND ')} LIMIT 1`, params);
  return rows[0] || null;
}

async function findByUsernameOrEmail(username, email) {
  const [rows] = await pool.query(
    'SELECT id FROM users WHERE (username = ? OR (email IS NOT NULL AND email = ?)) AND is_deleted = 0 LIMIT 1',
    [username, email || '']
  );
  return rows[0] || null;
}

async function create(data, passwordHash, userId) {
  const [result] = await pool.query(
    `INSERT INTO users
      (church_id, branch_id, role_id, employee_code, full_name, username, email, phone, password_hash, must_change_password, created_by, updated_by)
     VALUES (?,?,?,?,?,?,?,?,?,1,?,?)`,
    [
      data.church_id,
      data.branch_id || null,
      data.role_id,
      data.employee_code || null,
      data.full_name,
      data.username,
      data.email || null,
      data.phone || null,
      passwordHash,
      userId,
      userId,
    ]
  );
  return getById(result.insertId);
}

async function update(id, data, userId) {
  const columns = ['church_id', 'branch_id', 'role_id', 'employee_code', 'full_name', 'email', 'phone'];
  const present = columns.filter((c) => c in data);
  if (!present.length) return getById(id);
  const setClause = present.map((c) => `${c} = ?`).join(', ');
  const values = present.map((c) => data[c]);
  await pool.query(`UPDATE users SET ${setClause}, updated_by = ? WHERE id = ? AND is_deleted = 0`, [
    ...values,
    userId,
    id,
  ]);
  return getById(id);
}

async function setActive(id, isActive, userId) {
  await pool.query('UPDATE users SET is_active = ?, updated_by = ? WHERE id = ?', [isActive ? 1 : 0, userId, id]);
}

async function resetPassword(id, passwordHash, userId) {
  await pool.query('UPDATE users SET password_hash = ?, must_change_password = 1, updated_by = ? WHERE id = ?', [
    passwordHash,
    userId,
    id,
  ]);
}

module.exports = { list, getById, findByUsernameOrEmail, create, update, setActive, resetPassword };
