const { pool } = require('../config/db');
const { clampPageSize, clampPage } = require('../utils/pagination');

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

/** Builds the free-text search WHERE fragment for `config.searchable`.
 * Entries can name either a plain column on the base table (`t.col`) or a
 * joined lookup's alias (e.g. 'church_name') -- matched against the actual
 * joined column via that join's `j_<fk column>` table alias, so a search box
 * can match what a list column actually *displays* (a church/priest/gender
 * name) rather than only the raw base-table columns behind it. Shared by
 * this module's own list() and certificateRepository.list(), which mirrors
 * this same join/search shape scoped by church_id. */
function buildSearchClause(config, search) {
  if (!search || !config.searchable?.length) return { clause: '', params: [] };
  const joinsByAlias = new Map((config.joins || []).map((j) => [j.alias, j]));
  const likeClauses = config.searchable.map((col) => {
    const join = joinsByAlias.get(col);
    if (join) {
      assertSafeIdentifier(join.column);
      assertSafeIdentifier(join.labelColumn);
      return `j_${join.column}.${join.labelColumn} LIKE ?`;
    }
    assertSafeIdentifier(col);
    return `t.${col} LIKE ?`;
  });
  return { clause: `(${likeClauses.join(' OR ')})`, params: config.searchable.map(() => `%${search}%`) };
}

/** Builds AND-combined structured filter conditions from `config.filters`
 * (declarative: [{ key, type: 'select' | 'dateRange' }]) against a query
 * object -- lets a list combine several specific fields at once (e.g.
 * Priest + Gender + a date range, all applied together), layered on top of
 * buildSearchClause's single free-text box rather than replacing it.
 * 'select' matches a column exactly; 'dateRange' reads `<key>From`/`<key>To`
 * off the same query object. Currently used by certificateRepository.list;
 * kept here alongside buildSearchClause since both shapes are generic
 * enough to serve any config-driven list, not just certificates. */
function buildStructuredFilters(config, query) {
  const conditions = [];
  const params = [];
  for (const filter of config.filters || []) {
    assertSafeIdentifier(filter.key);
    if (filter.type === 'dateRange') {
      const from = query[`${filter.key}From`];
      const to = query[`${filter.key}To`];
      if (from) {
        conditions.push(`t.${filter.key} >= ?`);
        params.push(from);
      }
      if (to) {
        conditions.push(`t.${filter.key} <= ?`);
        params.push(to);
      }
    } else {
      const value = query[filter.key];
      if (value !== undefined && value !== null && value !== '') {
        conditions.push(`t.${filter.key} = ?`);
        params.push(value);
      }
    }
  }
  return { conditions, params };
}

/** Appends the church-scoping WHERE fragment for `config.churchScope` (see
 * masterRegistry.js) in place, or does nothing for a table with no scope
 * marker (the 17 truly global lookup tables). `churchId` is the requester's
 * EFFECTIVE church -- their own home church for every ordinary role.
 *
 * Master Administrator is deliberately exempt from this filter entirely for
 * READS (list/getById use this; create/update/delete do not -- see below):
 * it can read every church's masters unconditionally, same as it can read
 * every church's `churches` row to populate the switcher. Scoping reads by
 * the *current* selection instead would leave master admin unable to browse
 * OTHER churches' data to pick one in the first place (a chicken-and-egg
 * problem for both the `churches` and `branches` dropdowns), and read access
 * across the whole system is exactly what "all privileges of all churches"
 * calls for anyway. What *does* still follow the current selection is where
 * writes land -- see create()/update()'s own church_id forcing below. */
function addChurchScope(config, conditions, params, { churchId, isMasterAdmin } = {}) {
  if (!config.churchScope || isMasterAdmin) return;
  if (config.churchScope === 'self') {
    conditions.push('t.id = ?');
    params.push(churchId);
  } else if (config.churchScope === 'nullable') {
    conditions.push('(t.church_id = ? OR t.church_id IS NULL)');
    params.push(churchId);
  } else {
    conditions.push('t.church_id = ?');
    params.push(churchId);
  }
}

/** Appends the branch-scoping WHERE fragment for `config.branchScope` (see
 * masterRegistry.js) -- currently only `masses`. `branchId` is the
 * requester's EFFECTIVE branch (see utils/effectiveScope.js): null for
 * ADMIN (and for Master Administrator with no branch picked in its
 * switcher), meaning "don't restrict by branch" -- same convention as
 * addChurchScope, one dimension deeper. A row with no branch of its own
 * (branch_id IS NULL) is church-wide and stays visible regardless. */
function addBranchScope(config, conditions, params, { branchId } = {}) {
  if (!config.branchScope || !branchId) return;
  conditions.push('(t.branch_id = ? OR t.branch_id IS NULL)');
  params.push(branchId);
}

async function list(config, { page = 1, pageSize = 25, search, includeInactive = false, filters = {}, churchScope }) {
  page = clampPage(page);
  pageSize = clampPageSize(pageSize);
  const conditions = includeInactive ? [] : ['t.is_deleted = 0'];
  const params = [];
  addChurchScope(config, conditions, params, churchScope);
  addBranchScope(config, conditions, params, churchScope);

  const { clause: searchClause, params: searchParams } = buildSearchClause(config, search);
  if (searchClause) {
    conditions.push(searchClause);
    params.push(...searchParams);
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

  // Needs the same joins as the row query above whenever a search term
  // matches a joined lookup's alias (see buildSearchClause) -- every join
  // here is a LEFT JOIN on a FK's own `id`, so it's at most one row per `t`
  // row and never changes the count.
  const countSql = `SELECT COUNT(*) AS total FROM ${config.table} t ${buildJoinClause(config)} ${where}`;
  const [[{ total }]] = await pool.query(countSql, params);

  return { rows, total, page: Number(page), pageSize: Number(pageSize) };
}

async function getById(config, id, churchScope) {
  const conditions = ['t.id = ?', 't.is_deleted = 0'];
  const params = [id];
  addChurchScope(config, conditions, params, churchScope);
  addBranchScope(config, conditions, params, churchScope);
  const sql = `
    SELECT ${buildSelectClause(config)}
    FROM ${config.table} t
    ${buildJoinClause(config)}
    WHERE ${conditions.join(' AND ')}
    LIMIT 1
  `;
  const [rows] = await pool.query(sql, params);
  return rows[0] || null;
}

/** Whether `data.church_id` should be overridden rather than trusted as
 * sent. A plain admin's Masters forms only ever offer their own single
 * church in the `church_id` dropdown (its `churches` list is scoped -- see
 * addChurchScope), so this is really just defense against a tampered
 * request; forcing it to their own effective church keeps that guaranteed
 * regardless. Master Administrator's `churches` dropdown deliberately lists
 * every church (see addChurchScope's comment above), so *for that role* the
 * form's own explicit choice is what should land -- overriding it to
 * whichever church happens to be the current switcher selection would
 * silently fight the value visibly selected on the form. */
function forceChurchId(config, isMasterAdmin) {
  return (config.churchScope === 'strict' || config.churchScope === 'nullable') && !isMasterAdmin;
}

async function create(config, data, userId, churchScope) {
  const scopedData = forceChurchId(config, churchScope?.isMasterAdmin)
    ? { ...data, church_id: churchScope?.churchId }
    : // Master Administrator gets no override, but still a sane default
      // (the current switcher selection) if its form/payload omitted
      // church_id entirely.
      { ...data, church_id: data.church_id ?? churchScope?.churchId };
  const columns = config.columns.filter((c) => c in scopedData);
  columns.forEach(assertSafeIdentifier);
  const values = columns.map((c) => scopedData[c]);
  const sql = `
    INSERT INTO ${config.table} (${columns.join(', ')}, created_by, updated_by)
    VALUES (${columns.map(() => '?').join(', ')}, ?, ?)
  `;
  const [result] = await pool.query(sql, [...values, userId, userId]);
  return getById(config, result.insertId, churchScope);
}

async function update(config, id, data, userId, churchScope) {
  // Same forcing as create() -- for a plain admin, church_id can never be
  // changed by the client on a church-scoped row. Master Administrator can
  // deliberately move a row to a different church by sending a different
  // church_id (its form lets it pick one); omitting church_id from the
  // payload here (not touching that column at all) leaves the row's
  // existing church unchanged either way.
  const scopedData = forceChurchId(config, churchScope?.isMasterAdmin) ? { ...data, church_id: churchScope?.churchId } : data;
  const columns = config.columns.filter((c) => c in scopedData);
  columns.forEach(assertSafeIdentifier);
  if (!columns.length) return getById(config, id, churchScope);
  const setClause = columns.map((c) => `${c} = ?`).join(', ');
  const values = columns.map((c) => scopedData[c]);
  // Callers (mastersController) always load the row via getById first, so
  // an out-of-scope id already 404s before reaching here for a plain admin
  // (whose reads stay church-filtered). This WHERE-level church condition
  // is defense in depth on top of that -- and deliberately skipped for
  // Master Administrator, whose reads (and therefore edits) are meant to
  // reach any church's row regardless of the current switcher selection.
  const whereConditions = ['id = ?', 'is_deleted = 0'];
  const whereParams = [id];
  if (forceChurchId(config, churchScope?.isMasterAdmin)) {
    whereConditions.push(config.churchScope === 'nullable' ? '(church_id = ? OR church_id IS NULL)' : 'church_id = ?');
    whereParams.push(churchScope?.churchId);
  }
  const sql = `
    UPDATE ${config.table}
    SET ${setClause}, updated_by = ?
    WHERE ${whereConditions.join(' AND ')}
  `;
  await pool.query(sql, [...values, userId, ...whereParams]);
  return getById(config, id, churchScope);
}

async function softDelete(config, id, userId, churchScope) {
  const conditions = ['id = ?'];
  const params = [id];
  if (forceChurchId(config, churchScope?.isMasterAdmin)) {
    conditions.push(config.churchScope === 'nullable' ? '(church_id = ? OR church_id IS NULL)' : 'church_id = ?');
    params.push(churchScope?.churchId);
  }
  const sql = `
    UPDATE ${config.table}
    SET is_deleted = 1, is_active = 0, updated_by = ?
    WHERE ${conditions.join(' AND ')}
  `;
  await pool.query(sql, [userId, ...params]);

  // If this table has a "default" row (Languages, Currencies) and the one
  // just deleted was it, promote the next-oldest surviving row so the app
  // never ends up with zero defaults -- e.g. deleting the default Language
  // automatically makes the next one (by id) the new default, cascading
  // correctly even if that one is deleted next in turn.
  if (config.hasDefaultFlag) {
    await reassignDefaultIfOrphaned(config, userId);
  }
}

async function reassignDefaultIfOrphaned(config, userId) {
  const [[{ count }]] = await pool.query(
    `SELECT COUNT(*) AS count FROM ${config.table} WHERE is_default = 1 AND is_deleted = 0`
  );
  if (count > 0) return;

  const [[next]] = await pool.query(
    `SELECT id FROM ${config.table} WHERE is_deleted = 0 ORDER BY id ASC LIMIT 1`
  );
  if (!next) return; // nothing left at all -- no default to assign

  await pool.query(`UPDATE ${config.table} SET is_default = 1, updated_by = ? WHERE id = ?`, [userId, next.id]);
}

/** Makes `id` the table's sole default, unsetting whichever row held it
 * before. Transactional so there's never a moment with zero or two defaults
 * visible to a concurrent read. */
async function setDefault(config, id, userId, churchScope) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(`UPDATE ${config.table} SET is_default = 0 WHERE is_default = 1`);
    await conn.query(
      `UPDATE ${config.table} SET is_default = 1, updated_by = ? WHERE id = ? AND is_deleted = 0`,
      [userId, id]
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  return getById(config, id, churchScope);
}

async function reorder(config, orderedIds, userId, churchScope) {
  // Only masses (among the sortable tables) is church-scoped -- for a plain
  // admin this stops a request from smuggling in another church's row id to
  // scramble its sort order, without needing a separate ownership check per
  // id. Skipped for Master Administrator, same reasoning as update() above.
  const churchClause = forceChurchId(config, churchScope?.isMasterAdmin)
    ? config.churchScope === 'nullable'
      ? ' AND (church_id = ? OR church_id IS NULL)'
      : ' AND church_id = ?'
    : '';
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (let i = 0; i < orderedIds.length; i += 1) {
      const params = churchClause ? [i + 1, userId, orderedIds[i], churchScope?.churchId] : [i + 1, userId, orderedIds[i]];
      await conn.query(
        `UPDATE ${config.table} SET sort_order = ?, updated_by = ? WHERE id = ?${churchClause}`,
        params
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
  setDefault,
  assertSafeIdentifier,
  buildSelectClause,
  buildJoinClause,
  buildSearchClause,
  buildStructuredFilters,
};
