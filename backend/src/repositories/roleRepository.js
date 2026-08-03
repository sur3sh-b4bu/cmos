const { pool } = require('../config/db');

async function listRoles() {
  const [rows] = await pool.query(
    'SELECT id, name, code, description, is_system_role FROM roles WHERE is_deleted = 0 ORDER BY id ASC'
  );
  return rows;
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

module.exports = { listRoles, listPermissions, getPermissionIdsForRole, setRolePermissions };
