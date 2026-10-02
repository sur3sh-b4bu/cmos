const { pool } = require('../config/db');
const { toLocalDateString } = require('../utils/dateFormat');
const { clampPageSize, clampPage } = require('../utils/pagination');

// The latest successful payment for an intention, if any. "Paid" is defined
// purely by the existence of this row -- no separate manual status field.
const PAYMENT_JOIN = `
  LEFT JOIN payment_transactions pay ON pay.id = (
    SELECT pt.id FROM payment_transactions pt
    WHERE pt.prayer_intention_id = pi.id AND pt.status = 'success'
    ORDER BY pt.payment_date DESC, pt.created_at DESC
    LIMIT 1
  )
`;

const BASE_SELECT = `
  SELECT
    pi.*,
    m.name AS mass_name, m.name_ta AS mass_name_ta, m.mass_time, m.day_type,
    m.offering_description AS mass_offering_description,
    pim.name AS intention_master_name, pim.name_ta AS intention_master_name_ta, pim.is_custom AS intention_is_custom,
    pm.name AS payment_method_name,
    u.full_name AS created_by_name,
    (pay.id IS NOT NULL) AS is_paid,
    pay.method AS paid_via,
    pay.reference_number AS payment_reference_number,
    pay.payment_date AS payment_date,
    pay.remarks AS payment_remarks
  FROM prayer_intentions pi
  JOIN masses m ON m.id = pi.mass_id
  LEFT JOIN prayer_intention_master pim ON pim.id = pi.prayer_intention_master_id
  LEFT JOIN payment_methods pm ON pm.id = pi.payment_method_id
  LEFT JOIN users u ON u.id = pi.created_by
  ${PAYMENT_JOIN}
`;

/** WHERE/HAVING shared by list() and listAll(), so an Excel export honours
 * exactly the same scope, search and filters as the screen. */
function buildListQuery({
  search,
  prayerDate,
  prayerDateFrom,
  prayerDateTo,
  massId,
  paymentMethodId,
  paidOnly,
  churchId,
  branchId,
  bulkBatchId,
}) {
  const conditions = ['pi.is_deleted = 0'];
  const params = [];

  if (churchId) {
    conditions.push('pi.church_id = ?');
    params.push(churchId);
  }
  // branchId is the requester's EFFECTIVE branch (see utils/effectiveScope.js)
  // -- null means "don't restrict by branch" (ADMIN, or anyone with no
  // branch of their own). A row with no branch of its own (branch_id IS
  // NULL) is a shared/church-wide one, same "NULL row is global" convention
  // used for holidays/announcements -- it stays visible to every branch.
  if (branchId) {
    conditions.push('(pi.branch_id = ? OR pi.branch_id IS NULL)');
    params.push(branchId);
  }
  // Backs the expandable "Show Bulk Mass Intentions" row -- the individual
  // intentions belonging to one Bulk save (see mass-intentions-list.ts /
  // bulk-batches-dialog.ts).
  if (bulkBatchId) {
    conditions.push('pi.bulk_batch_id = ?');
    params.push(bulkBatchId);
  }
  if (search) {
    // Matches every field the list actually displays (see
    // mass-intentions-list.ts's `columns`), not just name/phone/receipt --
    // otherwise typing a booked-by name, a Mass, or an intention text into
    // the one search box silently found nothing.
    conditions.push(`(
      pi.name LIKE ? OR pi.phone LIKE ? OR pi.receipt_no LIKE ? OR pi.booked_by LIKE ?
      OR pi.custom_intention LIKE ?
      OR m.name LIKE ? OR m.name_ta LIKE ?
      OR pim.name LIKE ? OR pim.name_ta LIKE ?
    )`);
    params.push(...Array(9).fill(`%${search}%`));
  }
  if (prayerDate) {
    conditions.push('pi.prayer_date = ?');
    params.push(prayerDate);
  }
  if (prayerDateFrom) {
    conditions.push('pi.prayer_date >= ?');
    params.push(prayerDateFrom);
  }
  if (prayerDateTo) {
    conditions.push('pi.prayer_date <= ?');
    params.push(prayerDateTo);
  }
  if (massId) {
    conditions.push('pi.mass_id = ?');
    params.push(massId);
  }
  if (paymentMethodId) {
    conditions.push('pi.payment_method_id = ?');
    params.push(paymentMethodId);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  // paidOnly needs the payment join in scope, so it's applied as a HAVING
  // clause against the joined alias rather than folded into `where` above.
  // Arrives as a query-string value (a real HTTP request always sends
  // strings), so the truthiness check below is explicit rather than a bare
  // `paidOnly ? 1 : 0` -- the string 'false' is itself truthy in JS, which
  // would otherwise silently flip "show only Unpaid" into "show only Paid".
  const paidOnlyRequested = paidOnly !== undefined && paidOnly !== '';
  const isPaidValue = paidOnly === true || paidOnly === 'true' || paidOnly === '1' || paidOnly === 1;
  const having = paidOnlyRequested ? `HAVING is_paid = ${isPaidValue ? 1 : 0}` : '';
  return { where, having, params };
}

const SORT_COLUMNS = {
  receipt_no: 'pi.receipt_no',
  created_at: 'pi.created_at',
  prayer_date: 'pi.prayer_date',
  name: 'pi.name',
  offering_amount: 'pi.offering_amount',
  booked_by: 'pi.booked_by',
  phone: 'pi.phone',
  mass_name: 'm.name',
  intention: 'COALESCE(pim.name, pi.custom_intention)',
};

function buildOrderBy(sortBy, sortDir) {
  const col = SORT_COLUMNS[sortBy];
  if (!col) {
    return 'ORDER BY pi.prayer_date DESC, m.sort_order ASC, pi.id DESC';
  }
  const dir = String(sortDir).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  return `ORDER BY ${col} ${dir}, pi.id DESC`;
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
  const countQuery = having
    ? `SELECT COUNT(*) AS total FROM (
        SELECT pi.id, (pay.id IS NOT NULL OR pi.is_paid = 1) AS is_paid
        FROM prayer_intentions pi
        JOIN masses m ON m.id = pi.mass_id
        LEFT JOIN prayer_intention_master pim ON pim.id = pi.prayer_intention_master_id
        LEFT JOIN payment_methods pm ON pm.id = pi.payment_method_id
        LEFT JOIN users u ON u.id = pi.created_by
        ${PAYMENT_JOIN}
        ${where}
        ${having}
      ) t`
    : `SELECT COUNT(*) AS total
       FROM prayer_intentions pi
       JOIN masses m ON m.id = pi.mass_id
       LEFT JOIN prayer_intention_master pim ON pim.id = pi.prayer_intention_master_id
       LEFT JOIN payment_methods pm ON pm.id = pi.payment_method_id
       LEFT JOIN users u ON u.id = pi.created_by
       ${where}`;
  const [[{ total }]] = await pool.query(countQuery, params);
  return { rows, total, page: Number(page), pageSize: Number(pageSize) };
}

/** Every row matching the same scope/search/filters as list(), oldest first
 * (id ASC) so an Excel export has a stable, repeatable order. */
async function listAll(query) {
  const { where, having, params } = buildListQuery(query);
  const [rows] = await pool.query(`${BASE_SELECT} ${where} ${having} ORDER BY pi.id ASC`, params);
  return rows;
}

/** `scope` (`{ churchId, branchId }`) is optional -- omit it for the
 * trusted internal case of re-reading a row this same request just wrote
 * (church()/branch() are already known-correct then, see create() below).
 * Every call from a controller/service on a client-supplied id MUST pass
 * it -- without it, any authenticated user could read/edit/delete/print
 * any OTHER church's mass intention by guessing its numeric id, since
 * nothing else here ever checked church or branch.
 *
 * `conn` is optional -- pass the connection of an in-progress transaction
 * (e.g. create()'s own, still uncommitted) to read a row that isn't visible
 * to any other connection yet; omit it for the normal case of reading
 * already-committed data via the pool. */
async function getById(id, scope = {}, conn = pool) {
  const conditions = ['pi.id = ?', 'pi.is_deleted = 0'];
  const params = [id];
  if (scope.churchId) {
    conditions.push('pi.church_id = ?');
    params.push(scope.churchId);
  }
  if (scope.branchId) {
    conditions.push('(pi.branch_id = ? OR pi.branch_id IS NULL)');
    params.push(scope.branchId);
  }
  const [rows] = await conn.query(`${BASE_SELECT} WHERE ${conditions.join(' AND ')} LIMIT 1`, params);
  return rows[0] || null;
}

/** For the Bulk Mass Intention form's combined receipt -- one PDF covering
 * every row just created/paid together (see bulkReceiptPdf.js), scoped to
 * the caller's own church (and effective branch, see utils/effectiveScope.js)
 * so one office/branch can't print another's receipt by guessing ids. */
async function getByIds(ids, churchId, branchId) {
  if (!ids.length) return [];
  const conditions = ['pi.id IN (?)', 'pi.church_id = ?', 'pi.is_deleted = 0'];
  const params = [ids, churchId];
  if (branchId) {
    conditions.push('(pi.branch_id = ? OR pi.branch_id IS NULL)');
    params.push(branchId);
  }
  const [rows] = await pool.query(
    `${BASE_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY pi.prayer_date ASC, pi.id ASC`,
    params
  );
  return rows;
}

/** Same role as getByIds, keyed by a Bulk Mass Intention batch instead of
 * explicit ids -- lets "Show Bulk Mass Intentions" reprint a batch's
 * combined receipt without the caller needing to already know its ids. */
async function getByBatchId(batchId, churchId, branchId) {
  const conditions = ['pi.bulk_batch_id = ?', 'pi.church_id = ?', 'pi.is_deleted = 0'];
  const params = [batchId, churchId];
  if (branchId) {
    conditions.push('(pi.branch_id = ? OR pi.branch_id IS NULL)');
    params.push(branchId);
  }
  const [rows] = await pool.query(
    `${BASE_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY pi.prayer_date ASC, pi.id ASC`,
    params
  );
  return rows;
}

/** One row per Bulk Mass Intention save -- backs "Show Bulk Mass
 * Intentions" (see mass-intentions-list.ts). booked_by/phone are identical
 * across every row of a batch by construction (the Bulk form applies them
 * once to the whole save), so MIN() just reads that shared value rather
 * than aggregating anything meaningful. A batch whose rows have all since
 * been individually deleted simply stops appearing, same as any other
 * is_deleted-filtered list. */
async function listBulkBatches({ churchId, branchId, page = 1, pageSize = 25 }) {
  page = clampPage(page);
  pageSize = clampPageSize(pageSize);
  const offset = (Number(page) - 1) * Number(pageSize);
  const conditions = ['pi.church_id = ?', 'pi.bulk_batch_id IS NOT NULL', 'pi.is_deleted = 0'];
  const params = [churchId];
  if (branchId) {
    conditions.push('(pi.branch_id = ? OR pi.branch_id IS NULL)');
    params.push(branchId);
  }
  const where = `WHERE ${conditions.join(' AND ')}`;
  const [rows] = await pool.query(
    `SELECT
       pi.bulk_batch_id AS batchId,
       MIN(pi.created_at) AS createdAt,
       MIN(pi.booked_by) AS bookedBy,
       MIN(pi.phone) AS phone,
       COUNT(*) AS count,
       SUM(pi.offering_amount) AS total,
       SUM(pay.id IS NOT NULL) AS paidCount
     FROM prayer_intentions pi
     ${PAYMENT_JOIN}
     ${where}
     GROUP BY pi.bulk_batch_id
     ORDER BY MIN(pi.created_at) DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(pageSize), offset]
  );
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(DISTINCT pi.bulk_batch_id) AS total FROM prayer_intentions pi ${where}`,
    params
  );
  return {
    rows: rows.map((r) => ({ ...r, total: Number(r.total), count: Number(r.count), paidCount: Number(r.paidCount) })),
    total,
    page: Number(page),
    pageSize: Number(pageSize),
  };
}

/** Lookup for the public receipt-QR page -- keyed by the unguessable token, never the id. */
async function getByPublicToken(token) {
  const [rows] = await pool.query(
    `${BASE_SELECT} WHERE pi.public_token = ? AND pi.is_deleted = 0 LIMIT 1`,
    [token]
  );
  return rows[0] || null;
}

async function findPotentialDuplicate({ name, phone, prayerDate, massId, prayerIntentionMasterId, excludeId, churchId }) {
  const conditions = [
    'is_deleted = 0',
    'name = ?',
    'prayer_date = ?',
    'mass_id = ?',
  ];
  const params = [name, prayerDate, massId];
  // One church's booking is never a duplicate of another church's.
  if (churchId) {
    conditions.push('church_id = ?');
    params.push(churchId);
  }
  if (phone) {
    conditions.push('phone = ?');
    params.push(phone);
  }
  if (prayerIntentionMasterId) {
    conditions.push('prayer_intention_master_id = ?');
    params.push(prayerIntentionMasterId);
  }
  if (excludeId) {
    conditions.push('id != ?');
    params.push(excludeId);
  }
  const [rows] = await pool.query(
    `SELECT id, receipt_no, name, booked_by, phone, prayer_date, offering_amount, created_at FROM prayer_intentions WHERE ${conditions.join(' AND ')} LIMIT 1`,
    params
  );
  return rows[0] || null;
}

/** `conn` is optional -- pass the connection of a transaction the caller
 * already began (e.g. one that also just claimed this row's receipt number
 * on the same connection -- see massIntentionService.create) so the insert
 * commits/rolls back together with whatever else the caller is doing;
 * omit it to run standalone against the pool as before. */
async function create(data, userId, conn = pool) {
  // status_id is deliberately omitted -- the Pending/Completed workflow it
  // drove is retired in favour of the payment-existence check (see
  // PAYMENT_JOIN above). The column stays nullable in the schema so old
  // rows/audit history keep their original values.
  const columns = [
    'church_id', 'branch_id', 'receipt_no', 'public_token', 'bulk_batch_id', 'name', 'booked_by', 'phone', 'prayer_date', 'mass_id',
    'prayer_intention_master_id', 'custom_intention', 'offering_amount', 'payment_method_id',
    'remarks',
  ];
  const values = columns.map((c) => data[c] ?? null);
  const [result] = await conn.query(
    `INSERT INTO prayer_intentions (${columns.join(', ')}, created_by, updated_by)
     VALUES (${columns.map(() => '?').join(', ')}, ?, ?)`,
    [...values, userId, userId]
  );
  return getById(result.insertId, {}, conn);
}

async function update(id, data, userId) {
  const editable = [
    'name', 'booked_by', 'phone', 'prayer_date', 'mass_id', 'prayer_intention_master_id',
    'custom_intention', 'offering_amount', 'payment_method_id', 'remarks',
  ];
  const columns = editable.filter((c) => c in data);
  if (!columns.length) return getById(id);
  const setClause = columns.map((c) => `${c} = ?`).join(', ');
  const values = columns.map((c) => data[c]);
  await pool.query(
    `UPDATE prayer_intentions SET ${setClause}, updated_by = ? WHERE id = ? AND is_deleted = 0`,
    [...values, userId, id]
  );
  return getById(id);
}

async function softDelete(id, userId) {
  await pool.query(
    'UPDATE prayer_intentions SET is_deleted = 1, is_active = 0, updated_by = ? WHERE id = ?',
    [userId, id]
  );
}

/** Rows for the Daily Prayer Register, grouped by mass in the application layer. */
async function getRegisterData(prayerDate, churchId, branchId) {
  const conditions = ['pi.prayer_date = ?', 'pi.church_id = ?', 'pi.is_deleted = 0'];
  const params = [prayerDate, churchId];
  if (branchId) {
    conditions.push('(pi.branch_id = ? OR pi.branch_id IS NULL)');
    params.push(branchId);
  }
  const [rows] = await pool.query(
    `${BASE_SELECT}
     WHERE ${conditions.join(' AND ')}
     ORDER BY m.sort_order ASC, pi.id ASC`,
    params
  );
  return rows;
}

/** `branchId` is the requester's EFFECTIVE branch (see
 * utils/effectiveScope.js) -- appended to every one of these queries so a
 * branch-restricted user's Dashboard only ever totals their own branch
 * (plus any branch-agnostic rows), not the whole church. `null` (ADMIN, or
 * anyone with no branch of their own) leaves every query unfiltered, same
 * as before this parameter existed. */
async function getDashboardStats(churchId, branchId) {
  const today = toLocalDateString();
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = toLocalDateString(tomorrowDate);

  // Appended (in this exact form) to every WHERE below that already
  // filters by pi.church_id -- '' when unrestricted.
  const branchClause = branchId ? ' AND (pi.branch_id = ? OR pi.branch_id IS NULL)' : '';
  const branchParam = branchId ? [branchId] : [];

  const [[todayCount]] = await pool.query(
    `SELECT COUNT(*) AS c FROM prayer_intentions pi WHERE prayer_date = ? AND church_id = ? AND is_deleted = 0${branchClause}`,
    [today, churchId, ...branchParam]
  );
  const [[tomorrowCount]] = await pool.query(
    `SELECT COUNT(*) AS c FROM prayer_intentions pi WHERE prayer_date = ? AND church_id = ? AND is_deleted = 0${branchClause}`,
    [tomorrow, churchId, ...branchParam]
  );
  // "Collections" is money actually received, dated by when the payment was
  // recorded (payment_date) -- not the offering_amount of every booking
  // regardless of whether anyone has paid yet.
  const [[todayCollections]] = await pool.query(
    `SELECT COALESCE(SUM(pt.amount), 0) AS total
     FROM payment_transactions pt
     JOIN prayer_intentions pi ON pi.id = pt.prayer_intention_id
     WHERE pt.status = 'success' AND pt.payment_date = ? AND pi.church_id = ? AND pi.is_deleted = 0${branchClause}`,
    [today, churchId, ...branchParam]
  );
  const [[pendingCount]] = await pool.query(
    `SELECT COUNT(*) AS c FROM prayer_intentions pi
     WHERE pi.church_id = ? AND pi.is_deleted = 0${branchClause}
       AND NOT EXISTS (
         SELECT 1 FROM payment_transactions pt WHERE pt.prayer_intention_id = pi.id AND pt.status = 'success'
       )`,
    [churchId, ...branchParam]
  );
  const [upcoming] = await pool.query(
    `${BASE_SELECT}
     WHERE pi.prayer_date >= ? AND pi.church_id = ? AND pi.is_deleted = 0${branchClause}
     ORDER BY pi.prayer_date ASC, m.sort_order ASC LIMIT 5`,
    [today, churchId, ...branchParam]
  );
  const [[monthlyCollections]] = await pool.query(
    `SELECT COALESCE(SUM(pt.amount), 0) AS total
     FROM payment_transactions pt
     JOIN prayer_intentions pi ON pi.id = pt.prayer_intention_id
     WHERE pt.status = 'success' AND pi.church_id = ? AND pi.is_deleted = 0${branchClause}
       AND YEAR(pt.payment_date) = YEAR(CURDATE()) AND MONTH(pt.payment_date) = MONTH(CURDATE())`,
    [churchId, ...branchParam]
  );

  const [trendRows] = await pool.query(
    `SELECT pt.payment_date AS date, COALESCE(SUM(pt.amount), 0) AS total
     FROM payment_transactions pt
     JOIN prayer_intentions pi ON pi.id = pt.prayer_intention_id
     WHERE pt.status = 'success' AND pi.church_id = ? AND pi.is_deleted = 0${branchClause}
       AND pt.payment_date BETWEEN DATE_SUB(?, INTERVAL 6 DAY) AND ?
     GROUP BY pt.payment_date`,
    [churchId, ...branchParam, today, today]
  );
  const trendByDate = new Map(trendRows.map((r) => [r.date, Number(r.total)]));
  const collectionsTrend = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = toLocalDateString(d);
    collectionsTrend.push({ date: iso, total: trendByDate.get(iso) ?? 0 });
  }

  // Masses themselves aren't branch-restricted here (a Mass's own
  // branch_id is which branch it's offered at, not a filter on who may
  // view it -- see genericMasterRepository's addBranchScope for that side)
  // -- only the prayer_intentions being counted per Mass are.
  const [intentionsByMass] = await pool.query(
    `SELECT m.name AS massName, COUNT(pi.id) AS count
     FROM masses m
     LEFT JOIN prayer_intentions pi ON pi.mass_id = m.id AND pi.is_deleted = 0 AND pi.church_id = ?${branchClause}
     WHERE m.church_id = ? AND m.is_deleted = 0
     GROUP BY m.id, m.name, m.sort_order
     ORDER BY m.sort_order ASC`,
    [churchId, ...branchParam, churchId]
  );

  return {
    todayCount: todayCount.c,
    tomorrowCount: tomorrowCount.c,
    todayCollections: Number(todayCollections.total),
    pendingCount: pendingCount.c,
    monthlyCollections: Number(monthlyCollections.total),
    upcoming,
    collectionsTrend,
    intentionsByMass: intentionsByMass.map((r) => ({ massName: r.massName, count: Number(r.count) })),
  };
}

module.exports = {
  list,
  listAll,
  getById,
  getByIds,
  getByBatchId,
  listBulkBatches,
  getByPublicToken,
  findPotentialDuplicate,
  create,
  update,
  softDelete,
  getRegisterData,
  getDashboardStats,
};
