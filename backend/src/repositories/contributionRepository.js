const { pool } = require('../config/db');
const { toLocalDateString } = require('../utils/dateFormat');
const { clampPageSize, clampPage } = require('../utils/pagination');

// The latest successful payment for a contribution, if any. "Paid" is defined
// purely by the existence of this row -- same convention as
// massIntentionRepository's PAYMENT_JOIN.
const PAYMENT_JOIN = `
  LEFT JOIN contribution_payment_transactions pay ON pay.id = (
    SELECT pt.id FROM contribution_payment_transactions pt
    WHERE pt.contribution_id = d.id AND pt.status = 'success'
    ORDER BY pt.payment_date DESC, pt.created_at DESC
    LIMIT 1
  )
`;

const BASE_SELECT = `
  SELECT
    d.id, d.church_id, d.branch_id, d.receipt_no, d.name, d.phone,
    d.contribution_type_id, d.custom_contribution_type,
    d.contribution_amount, d.payment_method_id, d.remarks,
    d.created_at, d.created_by, d.updated_at, d.updated_by,
    d.is_active, d.is_deleted, d.is_refunded, d.refunded_at, d.refunded_by, d.refund_reason, d.refund_amount,
    dt.name AS contribution_type_name, dt.name_ta AS contribution_type_name_ta, (dt.code = 'OTHERS') AS contribution_type_is_custom,
    pm.name AS payment_method_name,
    u.full_name AS created_by_name,
    (pay.id IS NOT NULL) AS is_paid,
    pay.method AS paid_via,
    pay.reference_number AS payment_reference_number,
    pay.payment_date AS payment_date,
    pay.remarks AS payment_remarks
  FROM contributions d
  LEFT JOIN contribution_types dt ON dt.id = d.contribution_type_id
  LEFT JOIN payment_methods pm ON pm.id = d.payment_method_id
  LEFT JOIN users u ON u.id = d.created_by
  ${PAYMENT_JOIN}
`;

/** WHERE/HAVING shared by list() and listAll(), so an Excel export honours
 * exactly the same scope, search and filters as the screen. */
function buildListQuery({ search, paidOnly, isRefunded, refundStatus, churchId, branchId }) {
  const conditions = ['d.is_deleted = 0'];
  const params = [];

  if (paidOnly === 'refunded' || isRefunded === '1' || isRefunded === 1 || isRefunded === true || refundStatus === '1') {
    conditions.push('d.is_refunded = 1');
  } else if (
    paidOnly === '1' ||
    paidOnly === '0' ||
    paidOnly === 1 ||
    paidOnly === 0 ||
    paidOnly === true ||
    paidOnly === false ||
    paidOnly === 'true' ||
    paidOnly === 'false' ||
    isRefunded === '0' ||
    isRefunded === 0 ||
    isRefunded === false ||
    refundStatus === '0'
  ) {
    conditions.push('d.is_refunded = 0');
  }

  if (churchId) {
    conditions.push('d.church_id = ?');
    params.push(churchId);
  }
  // branchId is the requester's EFFECTIVE branch (see utils/effectiveScope.js)
  // -- null means "don't restrict by branch". A row with no branch of its
  // own (branch_id IS NULL) is shared/church-wide and stays visible to
  // every branch, same convention as massIntentionRepository.
  if (branchId) {
    conditions.push('(d.branch_id = ? OR d.branch_id IS NULL)');
    params.push(branchId);
  }
  if (search) {
    conditions.push('(d.name LIKE ? OR d.phone LIKE ? OR d.receipt_no LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  // paidOnly needs the payment join in scope, so it's applied as a HAVING
  // clause against the joined alias rather than folded into `where` above.
  const paidOnlyRequested = paidOnly !== undefined && paidOnly !== '' && paidOnly !== 'refunded';
  const isPaidValue = paidOnly === true || paidOnly === 'true' || paidOnly === '1' || paidOnly === 1;
  const having = paidOnlyRequested ? `HAVING is_paid = ${isPaidValue ? 1 : 0}` : '';
  return { where, having, params };
}

const SORT_COLUMNS = {
  receipt_no: 'd.receipt_no',
  created_at: 'd.created_at',
  name: 'd.name',
  phone: 'd.phone',
  contribution_type: 'dt.name',
  contribution_amount: 'd.contribution_amount',
  amount: 'd.contribution_amount',
  is_paid: 'is_paid',
  payment_method: 'pm.name',
};

function buildOrderBy(sortBy, sortDir) {
  const col = SORT_COLUMNS[sortBy];
  if (!col) {
    return 'ORDER BY d.id DESC';
  }
  const dir = String(sortDir).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  return `ORDER BY ${col} ${dir}, d.id DESC`;
}

async function list({ page = 1, pageSize = 25, sortBy, sortDir, ...query }) {
  page = clampPage(page);
  pageSize = clampPageSize(pageSize);
  const { where, having, params } = buildListQuery(query);
  const offset = (Number(page) - 1) * Number(pageSize);
  const orderBy = buildOrderBy(sortBy || query.sortBy, sortDir || query.sortDir);

  const [rows] = await pool.query(
    `${BASE_SELECT} ${where} ${having} ${orderBy} LIMIT ? OFFSET ?`,
    [...params, Number(pageSize), offset]
  );
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM (${BASE_SELECT} ${where} ${having}) t`,
    params
  );
  return { rows, total, page: Number(page), pageSize: Number(pageSize) };
}

/** Every row matching the same scope/search/filters as list(), oldest first
 * (id ASC) so an Excel export has a stable, repeatable order. */
async function listAll(query) {
  const { where, having, params } = buildListQuery(query);
  const [rows] = await pool.query(`${BASE_SELECT} ${where} ${having} ORDER BY d.id ASC`, params);
  return rows;
}

/** `scope` (`{ churchId, branchId }`) is optional -- omit it for the
 * trusted internal case of re-reading a row this same request just wrote.
 * Every call from a controller/service on a client-supplied id MUST pass
 * it -- without it, any authenticated user could read/edit/delete/print
 * any OTHER church's contribution by guessing its numeric id.
 *
 * `conn` is optional -- pass the connection of an in-progress transaction
 * to read a row that isn't visible to any other connection yet; omit it to
 * read already-committed data via the pool. */
async function getById(id, scope = {}, conn = pool) {
  const conditions = ['d.id = ?', 'd.is_deleted = 0'];
  const params = [id];
  if (scope.churchId) {
    conditions.push('d.church_id = ?');
    params.push(scope.churchId);
  }
  if (scope.branchId) {
    conditions.push('(d.branch_id = ? OR d.branch_id IS NULL)');
    params.push(scope.branchId);
  }
  const [rows] = await conn.query(`${BASE_SELECT} WHERE ${conditions.join(' AND ')} LIMIT 1`, params);
  return rows[0] || null;
}

/** `conn` is optional -- pass the connection of a transaction the caller
 * already began (e.g. one that also just claimed this row's receipt number
 * on the same connection -- see contributionService.create) so the insert
 * commits/rolls back together with whatever else the caller is doing. */
async function create(data, userId, conn = pool) {
  const columns = [
    'church_id', 'branch_id', 'receipt_no', 'name', 'phone',
    'contribution_type_id', 'custom_contribution_type', 'contribution_amount', 'payment_method_id',
    'remarks',
  ];
  const values = columns.map((c) => data[c] ?? null);
  const [result] = await conn.query(
    `INSERT INTO contributions (${columns.join(', ')}, created_by, updated_by)
     VALUES (${columns.map(() => '?').join(', ')}, ?, ?)`,
    [...values, userId, userId]
  );
  return getById(result.insertId, {}, conn);
}

async function update(id, data, userId) {
  const editable = [
    'name', 'phone', 'contribution_type_id', 'custom_contribution_type',
    'contribution_amount', 'payment_method_id', 'remarks',
  ];
  const columns = editable.filter((c) => c in data);
  if (!columns.length) return getById(id, {});
  const setClause = columns.map((c) => `${c} = ?`).join(', ');
  const values = columns.map((c) => data[c]);
  await pool.query(
    `UPDATE contributions SET ${setClause}, updated_by = ? WHERE id = ? AND is_deleted = 0`,
    [...values, userId, id]
  );
  return getById(id, {});
}

async function softDelete(id, userId) {
  await pool.query(
    'UPDATE contributions SET is_deleted = 1, is_active = 0, updated_by = ? WHERE id = ?',
    [userId, id]
  );
}

async function refund(id, { reason, amount } = {}, userId) {
  const row = await getById(id, {});
  if (!row) return null;
  const refundAmount = amount !== undefined && amount !== null ? Number(amount) : Number(row.contribution_amount);
  await pool.query(
    `UPDATE contributions
     SET is_refunded = 1,
         refunded_at = CURRENT_TIMESTAMP,
         refunded_by = ?,
         refund_reason = ?,
         refund_amount = ?,
         updated_by = ?
     WHERE id = ?`,
    [userId, reason || 'Refund issued by church office', refundAmount, userId, id]
  );
  return getById(id, {});
}

async function unrefund(id, userId) {
  await pool.query(
    `UPDATE contributions
     SET is_refunded = 0,
         refunded_at = NULL,
         refunded_by = NULL,
         refund_reason = NULL,
         refund_amount = NULL,
         updated_by = ?
     WHERE id = ?`,
    [userId, id]
  );
  return getById(id, {});
}

/** Dashboard's Contributions stat card -- same "money actually received, dated
 * by payment_date" definition as massIntentionRepository.getDashboardStats'
 * own todayCollections/monthlyCollections, just sourced from
 * contribution_payment_transactions/contributions instead. `branchId` is the
 * requester's EFFECTIVE branch (see utils/effectiveScope.js) -- null leaves
 * both totals unfiltered. */
async function getDashboardTotals(churchId, branchId) {
  const today = toLocalDateString();
  const branchClause = branchId ? ' AND (d.branch_id = ? OR d.branch_id IS NULL)' : '';
  const branchParam = branchId ? [branchId] : [];
  const [[todayRow]] = await pool.query(
    `SELECT COALESCE(SUM(pt.amount), 0) AS total
     FROM contribution_payment_transactions pt
     JOIN contributions d ON d.id = pt.contribution_id
     WHERE pt.status = 'success' AND pt.payment_date = ? AND d.church_id = ? AND d.is_deleted = 0${branchClause}`,
    [today, churchId, ...branchParam]
  );
  const [[monthlyRow]] = await pool.query(
    `SELECT COALESCE(SUM(pt.amount), 0) AS total
     FROM contribution_payment_transactions pt
     JOIN contributions d ON d.id = pt.contribution_id
     WHERE pt.status = 'success' AND d.church_id = ? AND d.is_deleted = 0${branchClause}
        AND YEAR(pt.payment_date) = YEAR(CURDATE()) AND MONTH(pt.payment_date) = MONTH(CURDATE())`,
    [churchId, ...branchParam]
  );
  return { todayContributions: Number(todayRow.total), monthlyContributions: Number(monthlyRow.total) };
}

module.exports = { list, listAll, getById, create, update, softDelete, refund, unrefund, getDashboardTotals };
