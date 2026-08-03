const { pool } = require('../config/db');
const { assertSafeIdentifier, buildSelectClause, buildJoinClause } = require('./genericMasterRepository');

async function list(config, { page = 1, pageSize = 25, search, churchId, includeInactive = false }) {
  const conditions = includeInactive ? ['t.church_id = ?'] : ['t.church_id = ?', 't.is_deleted = 0'];
  const params = [churchId];

  if (search && config.searchable?.length) {
    const likeClauses = config.searchable.map((col) => {
      assertSafeIdentifier(col);
      return `t.${col} LIKE ?`;
    });
    conditions.push(`(${likeClauses.join(' OR ')})`);
    config.searchable.forEach(() => params.push(`%${search}%`));
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const offset = (Number(page) - 1) * Number(pageSize);

  const sql = `
    SELECT ${buildSelectClause(config)}
    FROM ${config.table} t
    ${buildJoinClause(config)}
    ${where}
    ORDER BY t.id DESC
    LIMIT ? OFFSET ?
  `;
  const [rows] = await pool.query(sql, [...params, Number(pageSize), offset]);
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM ${config.table} t ${where}`, params);

  return { rows, total, page: Number(page), pageSize: Number(pageSize) };
}

async function getById(config, id, churchId) {
  const sql = `
    SELECT ${buildSelectClause(config)}
    FROM ${config.table} t
    ${buildJoinClause(config)}
    WHERE t.id = ? AND t.church_id = ? AND t.is_deleted = 0
    LIMIT 1
  `;
  const [rows] = await pool.query(sql, [id, churchId]);
  return rows[0] || null;
}

async function create(config, data, churchId, certificateNo, userId) {
  const columns = config.columns.filter((c) => c in data);
  columns.forEach(assertSafeIdentifier);
  const values = columns.map((c) => data[c]);
  const sql = `
    INSERT INTO ${config.table} (church_id, certificate_no, ${columns.join(', ')}, created_by, updated_by)
    VALUES (?, ?, ${columns.map(() => '?').join(', ')}, ?, ?)
  `;
  const [result] = await pool.query(sql, [churchId, certificateNo, ...values, userId, userId]);
  return getById(config, result.insertId, churchId);
}

async function update(config, id, data, churchId, userId) {
  const columns = config.columns.filter((c) => c in data);
  columns.forEach(assertSafeIdentifier);
  if (!columns.length) return getById(config, id, churchId);
  const setClause = columns.map((c) => `${c} = ?`).join(', ');
  const values = columns.map((c) => data[c]);
  await pool.query(
    `UPDATE ${config.table} SET ${setClause}, updated_by = ? WHERE id = ? AND church_id = ? AND is_deleted = 0`,
    [...values, userId, id, churchId]
  );
  return getById(config, id, churchId);
}

async function softDelete(config, id, churchId, userId) {
  await pool.query(
    `UPDATE ${config.table} SET is_deleted = 1, is_active = 0, updated_by = ? WHERE id = ? AND church_id = ?`,
    [userId, id, churchId]
  );
}

module.exports = { list, getById, create, update, softDelete };
