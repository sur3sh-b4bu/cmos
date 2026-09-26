const { pool } = require('../config/db');
const {
  assertSafeIdentifier,
  buildSelectClause,
  buildJoinClause,
  buildSearchClause,
  buildStructuredFilters,
} = require('./genericMasterRepository');
const { clampPageSize, clampPage } = require('../utils/pagination');

/** `priest_name` is the LEFT JOIN on priest_id (see certificateRegistry.js's
 * `joins`) and is NULL whenever no priest is linked -- including when the
 * officiant was typed into the free-text `custom_priest_name` fallback
 * instead (migration 039) for a priest not in this church's Priests list.
 *
 * The two are deliberately kept as separate fields: `priest_name` and
 * `custom_priest_name` are the raw data (what Excel export writes into its
 * two separate columns, so a re-import is lossless), while
 * `priest_display_name` is the one resolved name for screens and the printed
 * certificate. A no-op for a certificate type with no custom_priest_name. */
function withPriestDisplayName(row) {
  if (row) row.priest_display_name = row.priest_name || row.custom_priest_name || null;
  return row;
}

/** WHERE clause shared by list() and listAll(), so an Excel export honours
 * exactly the same church/branch scope, search and filters as the screen. */
function buildListWhere(config, { search, churchId, branchId, includeInactive = false, ...rest }) {
  const conditions = includeInactive ? ['t.church_id = ?'] : ['t.church_id = ?', 't.is_deleted = 0'];
  const params = [churchId];
  // branchId is the requester's EFFECTIVE branch (see utils/effectiveScope.js)
  // -- null means "don't restrict by branch". A row with no branch of its
  // own (branch_id IS NULL) is church-wide and stays visible to every
  // branch, same convention as massIntentionRepository/contributionRepository.
  if (branchId) {
    conditions.push('(t.branch_id = ? OR t.branch_id IS NULL)');
    params.push(branchId);
  }

  const { clause: searchClause, params: searchParams } = buildSearchClause(config, search);
  if (searchClause) {
    conditions.push(searchClause);
    params.push(...searchParams);
  }

  // Structured filters (Priest, Gender, a date range, ...) -- combined via
  // AND with each other AND the free-text search above, so someone tracking
  // down a certificate can narrow by several fields at once rather than
  // being limited to whatever the one search box happens to match (see
  // config.filters in certificateRegistry.js).
  const { conditions: filterConditions, params: filterParams } = buildStructuredFilters(config, rest);
  conditions.push(...filterConditions);
  params.push(...filterParams);

  return { where: `WHERE ${conditions.join(' AND ')}`, params };
}

async function list(config, { page = 1, pageSize = 25, ...query }) {
  page = clampPage(page);
  pageSize = clampPageSize(pageSize);
  const { where, params } = buildListWhere(config, query);
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
  rows.forEach(withPriestDisplayName);
  // Needs the same joins as the row query above whenever a search term
  // matches a joined lookup's alias (e.g. priest_name) -- see
  // buildSearchClause/genericMasterRepository's own list() for why this is
  // still count-safe (every join here is a LEFT JOIN on a FK's own `id`).
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM ${config.table} t ${buildJoinClause(config)} ${where}`,
    params
  );

  return { rows, total, page: Number(page), pageSize: Number(pageSize) };
}

/** Every row matching the same scope/search/filters as list(), oldest first
 * (id ASC) so an Excel export has a stable, repeatable order regardless of
 * how the screen is sorted. */
async function listAll(config, query) {
  const { where, params } = buildListWhere(config, query);
  const [rows] = await pool.query(
    `SELECT ${buildSelectClause(config)}
     FROM ${config.table} t
     ${buildJoinClause(config)}
     ${where}
     ORDER BY t.id ASC`,
    params
  );
  return rows.map(withPriestDisplayName);
}

/** `scope` (`{ churchId, branchId }`) is optional -- omit it for the
 * trusted internal case of re-reading a row this same request just wrote.
 * Every call from a controller/service on a client-supplied id MUST pass
 * it -- without a churchId at least, any authenticated user could read/edit
 * /delete/print any OTHER church's certificate by guessing its numeric id.
 *
 * `conn` is optional -- pass the connection of an in-progress transaction
 * to read a row that isn't visible to any other connection yet; omit it to
 * read already-committed data via the pool. */
async function getById(config, id, scope = {}, conn = pool) {
  const conditions = ['t.id = ?', 't.church_id = ?', 't.is_deleted = 0'];
  const params = [id, scope.churchId];
  if (scope.branchId) {
    conditions.push('(t.branch_id = ? OR t.branch_id IS NULL)');
    params.push(scope.branchId);
  }
  const sql = `
    SELECT ${buildSelectClause(config)}
    FROM ${config.table} t
    ${buildJoinClause(config)}
    WHERE ${conditions.join(' AND ')}
    LIMIT 1
  `;
  const [rows] = await conn.query(sql, params);
  return withPriestDisplayName(rows[0] || null);
}

/** `conn` is optional -- pass the connection of a transaction the caller
 * already began (e.g. one that also just claimed this certificate's number
 * on the same connection -- see certificateService.create) so the insert
 * commits/rolls back together with whatever else the caller is doing. */
async function create(config, data, churchId, branchId, certificateNo, userId, conn = pool) {
  const columns = config.columns.filter((c) => c in data);
  columns.forEach(assertSafeIdentifier);
  const values = columns.map((c) => data[c]);
  const sql = `
    INSERT INTO ${config.table} (church_id, branch_id, certificate_no, ${columns.join(', ')}, created_by, updated_by)
    VALUES (?, ?, ?, ${columns.map(() => '?').join(', ')}, ?, ?)
  `;
  const [result] = await conn.query(sql, [churchId, branchId, certificateNo, ...values, userId, userId]);
  return getById(config, result.insertId, { churchId }, conn);
}

async function update(config, id, data, churchId, userId) {
  const columns = config.columns.filter((c) => c in data);
  columns.forEach(assertSafeIdentifier);
  if (!columns.length) return getById(config, id, { churchId });
  const setClause = columns.map((c) => `${c} = ?`).join(', ');
  const values = columns.map((c) => data[c]);
  await pool.query(
    `UPDATE ${config.table} SET ${setClause}, updated_by = ? WHERE id = ? AND church_id = ? AND is_deleted = 0`,
    [...values, userId, id, churchId]
  );
  return getById(config, id, { churchId });
}

async function softDelete(config, id, churchId, userId) {
  await pool.query(
    `UPDATE ${config.table} SET is_deleted = 1, is_active = 0, updated_by = ? WHERE id = ? AND church_id = ?`,
    [userId, id, churchId]
  );
}

module.exports = { list, listAll, getById, create, update, softDelete };
