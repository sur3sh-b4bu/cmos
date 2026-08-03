const { pool } = require('../config/db');

async function record({ userId, username, action, module, entityType, entityId, oldValues, newValues, ipAddress, userAgent }) {
  await pool.query(
    `INSERT INTO audit_logs
      (user_id, username_snapshot, action, module, entity_type, entity_id, old_values, new_values, ip_address, user_agent)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      userId || null,
      username || null,
      action,
      module,
      entityType || null,
      entityId || null,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      ipAddress || null,
      userAgent || null,
    ]
  );
}

async function list({ page = 1, pageSize = 25, userId, module, fromDate, toDate, search }) {
  const conditions = [];
  const params = [];
  if (userId) {
    conditions.push('user_id = ?');
    params.push(userId);
  }
  if (module) {
    conditions.push('module = ?');
    params.push(module);
  }
  if (fromDate) {
    conditions.push('created_at >= ?');
    params.push(fromDate);
  }
  if (toDate) {
    conditions.push('created_at <= ?');
    params.push(toDate);
  }
  if (search) {
    conditions.push('(username_snapshot LIKE ? OR action LIKE ? OR entity_type LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * pageSize;

  const [rows] = await pool.query(
    `SELECT * FROM audit_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM audit_logs ${where}`, params);
  return { rows, total, page, pageSize };
}

module.exports = { record, list };
