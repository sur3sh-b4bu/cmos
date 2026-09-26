const { pool } = require('../config/db');

const BASE_SELECT = `
  SELECT r.id, r.name, r.code, r.description, r.is_system_role, r.church_id, c.name AS church_name
  FROM roles r
  LEFT JOIN churches c ON c.id = r.church_id
`;

/** A system role (church_id NULL) is visible to every church. A plain
 * admin additionally sees only their own church's custom roles; Master
 * Administrator is left unfiltered (see genericMasterRepository's
 * addChurchScope for the same "reads are unrestricted for that role"
 * reasoning), so it can see every church's custom roles regardless of
 * which one it currently has selected. */
async function listRoles({ churchId, isMasterAdmin } = {}) {
  if (isMasterAdmin) {
    const [rows] = await pool.query(`${BASE_SELECT} WHERE r.is_deleted = 0 ORDER BY r.id ASC`);
    return rows;
  }
  const [rows] = await pool.query(
    `${BASE_SELECT} WHERE r.is_deleted = 0 AND (r.church_id IS NULL OR r.church_id = ?) ORDER BY r.id ASC`,
    [churchId]
  );
  return rows;
}

async function getRoleById(id) {
  const [rows] = await pool.query(`${BASE_SELECT} WHERE r.id = ? AND r.is_deleted = 0 LIMIT 1`, [id]);
  return rows[0] || null;
}

async function createRole({ name, code, description, churchId }, userId) {
  const [result] = await pool.query(
    `INSERT INTO roles (name, code, description, church_id, is_system_role, created_by, updated_by)
     VALUES (?, ?, ?, ?, 0, ?, ?)`,
    [name, code, description || null, churchId, userId, userId]
  );
  return getRoleById(result.insertId);
}

async function listPermissions() {
  const [rows] = await pool.query(
    'SELECT id, module, action, code, description FROM permissions WHERE is_deleted = 0 ORDER BY module ASC, action ASC'
  );
  return rows;
}

async function getPermissionIdsForRole(roleId) {
  const [rows] = await pool.query(
    'SELECT permission_id FROM role_permissions WHERE role_id = ? AND is_active = 1',
    [roleId]
  );
  return rows.map((r) => r.permission_id);
}

async function setRolePermissions(roleId, permissionIds, userId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM role_permissions WHERE role_id = ?', [roleId]);
    if (permissionIds.length) {
      const values = permissionIds.map((permissionId) => [roleId, permissionId, userId, userId]);
      await conn.query(
        'INSERT INTO role_permissions (role_id, permission_id, created_by, updated_by) VALUES ?',
        [values]
      );
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { listRoles, getRoleById, createRole, listPermissions, getPermissionIdsForRole, setRolePermissions };
