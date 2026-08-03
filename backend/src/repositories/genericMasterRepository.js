const { pool } = require('../config/db');

/** Whitelists identifiers (table/column names) — these only ever come from
 * our own registry config, never from user input, but this keeps the
 * interpolation below provably safe against injection regardless. */
function assertSafeIdentifier(name) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`Unsafe SQL identifier: ${name}`);
  }
  return name;
}

function buildSelectClause(config) {
  assertSafeIdentifier(config.table);
  const base = `t.*`;
  const joinSelects = (config.joins || [])
    .map((j) => `j_${j.column}.${assertSafeIdentifier(j.labelColumn)} AS ${assertSafeIdentifier(j.alias)}`)
    .join(', ');
  return joinSelects ? `${base}, ${joinSelects}` : base;
}

function buildJoinClause(config) {
  return (config.joins || [])
    .map((j) => {
      assertSafeIdentifier(j.table);
      assertSafeIdentifier(j.column);
      return `LEFT JOIN ${j.table} AS j_${j.column} ON j_${j.column}.id = t.${j.column}`;
    })
    .join(' ');
}

async function list(config, { page = 1, pageSize = 25, search, includeInactive = false, filters = {} }) {
  const conditions = includeInactive ? [] : ['t.is_deleted = 0'];
  const params = [];

  if (search && config.searchable?.length) {
    const likeClauses = config.searchable.map((col) => {
      assertSafeIdentifier(col);
      return `t.${col} LIKE ?`;
    });
    conditions.push(`(${likeClauses.join(' OR ')})`);
    config.searchable.forEach(() => params.push(`%${search}%`));
  }

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue;
    if (!config.columns.includes(key)) continue; // ignore unknown filter keys
    assertSafeIdentifier(key);
    conditions.push(`t.${key} = ?`);
    params.push(value);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const orderBy = config.hasSortOrder ? 'ORDER BY t.sort_order ASC, t.id ASC' : 'ORDER BY t.id DESC';
  const offset = (Number(page) - 1) * Number(pageSize);

  const sql = `
    SELECT ${buildSelectClause(config)}
    FROM ${config.table} t
    ${buildJoinClause(config)}
    ${where}
    ${orderBy}
    LIMIT ? OFFSET ?
  `;
  const [rows] = await pool.query(sql, [...params, Number(pageSize), offset]);

  const countSql = `SELECT COUNT(*) AS total FROM ${config.table} t ${where}`;
  const [[{ total }]] = await pool.query(countSql, params);

  return { rows, total, page: Number(page), pageSize: Number(pageSize) };
}

async function getById(config, id) {
  const sql = `
    SELECT ${buildSelectClause(config)}
    FROM ${config.table} t
    ${buildJoinClause(config)}
    WHERE t.id = ? AND t.is_deleted = 0
    LIMIT 1
  `;
  const [rows] = await pool.query(sql, [id]);
  return rows[0] || null;
}

async function create(config, data, userId) {
  const columns = config.columns.filter((c) => c in data);
  columns.forEach(assertSafeIdentifier);
  const values = columns.map((c) => data[c]);
  const sql = `
    INSERT INTO ${config.table} (${columns.join(', ')}, created_by, updated_by)
    VALUES (${columns.map(() => '?').join(', ')}, ?, ?)
  `;
  const [result] = await pool.query(sql, [...values, userId, userId]);
  return getById(config, result.insertId);
}

async function update(config, id, data, userId) {
  const columns = config.columns.filter((c) => c in data);
  columns.forEach(assertSafeIdentifier);
  if (!columns.length) return getById(config, id);
  const setClause = columns.map((c) => `${c} = ?`).join(', ');
  const values = columns.map((c) => data[c]);
  const sql = `
    UPDATE ${config.table}
    SET ${setClause}, updated_by = ?
    WHERE id = ? AND is_deleted = 0
  `;
  await pool.query(sql, [...values, userId, id]);
  return getById(config, id);
}

async function softDelete(config, id, userId) {
  const sql = `
    UPDATE ${config.table}
    SET is_deleted = 1, is_active = 0, updated_by = ?
    WHERE id = ?
  `;
  await pool.query(sql, [userId, id]);
}

async function reorder(config, orderedIds, userId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (let i = 0; i < orderedIds.length; i += 1) {
      await conn.query(
        `UPDATE ${config.table} SET sort_order = ?, updated_by = ? WHERE id = ?`,
        [i + 1, userId, orderedIds[i]]
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

module.exports = {
  list,
  getById,
  create,
  update,
  softDelete,
  reorder,
  assertSafeIdentifier,
  buildSelectClause,
  buildJoinClause,
};
