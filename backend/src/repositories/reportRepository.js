const { pool } = require('../config/db');

// Same "paid = a successful payment_transactions row exists" definition used
// by massIntentionRepository -- kept in sync manually since reports queries
// don't share that module's SELECT builder.
const PAYMENT_JOIN = `
  LEFT JOIN payment_transactions pay ON pay.id = (
    SELECT pt.id FROM payment_transactions pt
    WHERE pt.prayer_intention_id = pi.id AND pt.status = 'success'
    ORDER BY pt.payment_date DESC, pt.created_at DESC
    LIMIT 1
  )
`;

async function massIntentionsReport({ churchId, branchId, dateFrom, dateTo, massId, paidOnly }) {
  const conditions = ['pi.church_id = ?', 'pi.is_deleted = 0'];
  const params = [churchId];
  // branchId is the requester's EFFECTIVE branch (see utils/effectiveScope.js)
  // -- null means "don't restrict by branch"; a branch-agnostic row
  // (branch_id IS NULL) stays visible to every branch.
  if (branchId) {
    conditions.push('(pi.branch_id = ? OR pi.branch_id IS NULL)');
    params.push(branchId);
  }
  if (dateFrom) {
    conditions.push('pi.prayer_date >= ?');
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push('pi.prayer_date <= ?');
    params.push(dateTo);
  }
  if (massId) {
    conditions.push('pi.mass_id = ?');
    params.push(massId);
  }
  const where = `WHERE ${conditions.join(' AND ')}`;
  const having = paidOnly !== undefined ? `HAVING is_paid = ${paidOnly ? 1 : 0}` : '';

  const [rows] = await pool.query(
    `SELECT pi.id, pi.receipt_no, pi.prayer_date, pi.name, pi.phone, pi.offering_amount,
            m.name AS mass_name, (pay.id IS NOT NULL) AS is_paid, pay.method AS paid_via,
            COALESCE(pim.name, pi.custom_intention) AS intention
     FROM prayer_intentions pi
     JOIN masses m ON m.id = pi.mass_id
     LEFT JOIN prayer_intention_master pim ON pim.id = pi.prayer_intention_master_id AND pim.is_custom = 0
     ${PAYMENT_JOIN}
     ${where} ${having}
     ORDER BY pi.prayer_date DESC, m.sort_order ASC`,
    params
  );

  const [[summary]] = await pool.query(
    `SELECT COUNT(*) AS totalCount, COALESCE(SUM(pi.offering_amount),0) AS totalOffering
     FROM prayer_intentions pi ${where}`,
    params
  );

  return {
    rows,
    summary: { totalCount: summary.totalCount, totalOffering: Number(summary.totalOffering) },
  };
}

// "Collections" means money actually received -- only rows with a successful
// payment count, dated and grouped by when the payment was recorded
// (pay.payment_date / pay.method), not the booking's prayer_date or its
// intended payment_method_id. Mirrors massIntentionRepository.getDashboardStats.
async function collectionsReport({ churchId, branchId, dateFrom, dateTo, method }) {
  const conditions = [
    "pi.church_id = ?",
    "pi.is_deleted = 0",
    "pt.status = 'success'",
  ];
  const params = [churchId];
  if (branchId) {
    conditions.push('(pi.branch_id = ? OR pi.branch_id IS NULL)');
    params.push(branchId);
  }
  if (dateFrom) {
    conditions.push('pt.payment_date >= ?');
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push('pt.payment_date <= ?');
    params.push(dateTo);
  }
  if (method) {
    conditions.push('pt.method = ?');
    params.push(method);
  }
  const where = `WHERE ${conditions.join(' AND ')}`;
  const fromPayments = `
    FROM payment_transactions pt
    JOIN prayer_intentions pi ON pi.id = pt.prayer_intention_id
  `;

  const [byDay] = await pool.query(
    `SELECT pt.payment_date AS date, COALESCE(SUM(pt.amount),0) AS total, COUNT(*) AS count
     ${fromPayments} ${where}
     GROUP BY pt.payment_date
     ORDER BY pt.payment_date ASC`,
    params
  );

  const [byPaymentMethod] = await pool.query(
    `SELECT COALESCE(pt.method, 'Not specified') AS method, COALESCE(SUM(pt.amount),0) AS total, COUNT(*) AS count
     ${fromPayments} ${where}
     GROUP BY pt.method
     ORDER BY total DESC`,
    params
  );

  const [[summary]] = await pool.query(
    `SELECT COUNT(*) AS totalCount, COALESCE(SUM(pt.amount),0) AS totalOffering
     ${fromPayments} ${where}`,
    params
  );

  return {
    byDay: byDay.map((r) => ({ date: r.date, total: Number(r.total), count: r.count })),
    byPaymentMethod: byPaymentMethod.map((r) => ({ method: r.method, total: Number(r.total), count: r.count })),
    summary: { totalCount: summary.totalCount, totalOffering: Number(summary.totalOffering) },
  };
}

/** Per-payment breakdown for a date range of the Collections report -- e.g.
 * clicking 08-08-2026 in Reports' "by day" table (dateFrom === dateTo), or
 * the Dashboard's Today's/Monthly Collections stat cards (dateFrom/dateTo
 * spanning the same range those totals are computed over -- see
 * massIntentionRepository.getDashboardStats, which this deliberately
 * mirrors so the two totals always agree). Same "paid = successful
 * payment_transactions row" join as collectionsReport, just returning the
 * individual rows instead of grouping/summing them.
 *
 * `dateBasis` picks which date the range/ordering is scoped to:
 *  - 'payment' (default) -- when the payment was recorded (pt.payment_date).
 *    Reports' per-day drill-down print keeps this, since it must agree with
 *    that same page's by-day totals (collectionsReport below), which are
 *    also payment_date-grouped.
 *  - 'entered' -- when the Mass Intention itself was booked (pi.created_at).
 *    Used by the Dashboard's stat-card popups, so a bulk save entered today
 *    shows up under "today" even if its payment_date was backdated/left at
 *    an earlier default -- see dashboard.ts's openTodayCollections. */
/**
 * `userId` scopes this to one user's own billed transactions -- the "print
 * my collections" button any user can reach (see reportController's
 * `mine` handling) as opposed to the all-users breakdown, which is gated to
 * reports.print_all and additionally shows who billed each row (billed_by
 * below) -- see collectionsDetailPdf.js.
 */
async function collectionsRangeDetail({ churchId, branchId, dateFrom, dateTo, userId, dateBasis = 'payment' }) {
  const dateColumn = dateBasis === 'entered' ? 'DATE(pi.created_at)' : 'pt.payment_date';
  const conditions = ["pi.church_id = ?", 'pi.is_deleted = 0', "pt.status = 'success'", `${dateColumn} BETWEEN ? AND ?`];
  const params = [churchId, dateFrom, dateTo];
  if (branchId) {
    conditions.push('(pi.branch_id = ? OR pi.branch_id IS NULL)');
    params.push(branchId);
  }
  if (userId) {
    conditions.push('pt.created_by = ?');
    params.push(userId);
  }
  const [rows] = await pool.query(
    `SELECT pi.booked_by, pi.receipt_no, m.name AS mass_name, m.name_ta AS mass_name_ta, pt.method, pt.amount,
            pt.payment_date, pi.created_at AS entered_date, u.username AS billed_by
     FROM payment_transactions pt
     JOIN prayer_intentions pi ON pi.id = pt.prayer_intention_id
     JOIN masses m ON m.id = pi.mass_id
     LEFT JOIN users u ON u.id = pt.created_by
     WHERE ${conditions.join(' AND ')}
     ORDER BY ${dateColumn} ASC, pi.booked_by ASC`,
    params
  );
  const mapped = rows.map((r) => ({ ...r, amount: Number(r.amount) }));
  const total = mapped.reduce((sum, r) => sum + r.amount, 0);
  return { dateFrom, dateTo, rows: mapped, total, count: mapped.length };
}

// Contributions' own equivalent of collectionsReport/collectionsRangeDetail
// above -- same "paid = successful payment row" shape, just sourced from
// contribution_payment_transactions/contributions instead of payment_transactions/
// prayer_intentions. Kept as separate functions/tables (see migration 022's
// comment) rather than folding into the Mass Intentions collections query,
// since a contribution has no mass/prayer_date to join against.
async function contributionCollectionsReport({ churchId, branchId, dateFrom, dateTo, method }) {
  const conditions = [
    'd.church_id = ?',
    'd.is_deleted = 0',
    "pt.status = 'success'",
  ];
  const params = [churchId];
  if (branchId) {
    conditions.push('(d.branch_id = ? OR d.branch_id IS NULL)');
    params.push(branchId);
  }
  if (dateFrom) {
    conditions.push('pt.payment_date >= ?');
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push('pt.payment_date <= ?');
    params.push(dateTo);
  }
  if (method) {
    conditions.push('pt.method = ?');
    params.push(method);
  }
  const where = `WHERE ${conditions.join(' AND ')}`;
  const fromPayments = `
    FROM contribution_payment_transactions pt
    JOIN contributions d ON d.id = pt.contribution_id
  `;

  const [byDay] = await pool.query(
    `SELECT pt.payment_date AS date, COALESCE(SUM(pt.amount),0) AS total, COUNT(*) AS count
     ${fromPayments} ${where}
     GROUP BY pt.payment_date
     ORDER BY pt.payment_date ASC`,
    params
  );

  const [byPaymentMethod] = await pool.query(
    `SELECT COALESCE(pt.method, 'Not specified') AS method, COALESCE(SUM(pt.amount),0) AS total, COUNT(*) AS count
     ${fromPayments} ${where}
     GROUP BY pt.method
     ORDER BY total DESC`,
    params
  );

  const [[summary]] = await pool.query(
    `SELECT COUNT(*) AS totalCount, COALESCE(SUM(pt.amount),0) AS totalOffering
     ${fromPayments} ${where}`,
    params
  );

  return {
    byDay: byDay.map((r) => ({ date: r.date, total: Number(r.total), count: r.count })),
    byPaymentMethod: byPaymentMethod.map((r) => ({ method: r.method, total: Number(r.total), count: r.count })),
    summary: { totalCount: summary.totalCount, totalOffering: Number(summary.totalOffering) },
  };
}

/** Per-payment breakdown for a date range of the Contributions collections
 * report -- same role as collectionsRangeDetail above, for Contributions --
 * including its own `userId`/billed_by handling for the same "mine" vs
 * "all users" print split. */
async function contributionCollectionsRangeDetail({ churchId, branchId, dateFrom, dateTo, userId }) {
  const conditions = ['d.church_id = ?', 'd.is_deleted = 0', "pt.status = 'success'", 'pt.payment_date BETWEEN ? AND ?'];
  const params = [churchId, dateFrom, dateTo];
  if (branchId) {
    conditions.push('(d.branch_id = ? OR d.branch_id IS NULL)');
    params.push(branchId);
  }
  if (userId) {
    conditions.push('pt.created_by = ?');
    params.push(userId);
  }
  const [rows] = await pool.query(
    `SELECT d.name, d.receipt_no, dt.name AS contribution_type_name, dt.name_ta AS contribution_type_name_ta, (dt.code = 'OTHERS') AS contribution_type_is_custom,
            d.custom_contribution_type, pt.method, pt.amount, pt.payment_date, u.username AS billed_by
     FROM contribution_payment_transactions pt
     JOIN contributions d ON d.id = pt.contribution_id
     LEFT JOIN contribution_types dt ON dt.id = d.contribution_type_id
     LEFT JOIN users u ON u.id = pt.created_by
     WHERE ${conditions.join(' AND ')}
     ORDER BY pt.payment_date ASC, d.name ASC`,
    params
  );
  const mapped = rows.map((r) => ({ ...r, amount: Number(r.amount) }));
  const total = mapped.reduce((sum, r) => sum + r.amount, 0);
  return { dateFrom, dateTo, rows: mapped, total, count: mapped.length };
}

const CERT_TABLES = {
  baptism: {
    table: 'baptism_certificates',
    dateColumn: 'date_of_baptism',
    nameColumn: 'child_name',
    select: 'certificate_no, child_name AS name, date_of_baptism AS date, father_name, mother_name',
  },
  marriage: {
    table: 'marriage_certificates',
    dateColumn: 'marriage_date',
    nameColumn: 'bride_name',
    select: "certificate_no, CONCAT(groom_name, ' & ', bride_name) AS name, marriage_date AS date, NULL AS father_name, NULL AS mother_name",
  },
  death: {
    table: 'death_certificates',
    dateColumn: 'date_of_death',
    nameColumn: 'deceased_name',
    select: 'certificate_no, deceased_name AS name, date_of_death AS date, NULL AS father_name, NULL AS mother_name',
  },
  confirmation: {
    table: 'confirmation_certificates',
    dateColumn: 'date_of_confirmation',
    nameColumn: 'name',
    select: 'certificate_no, name AS name, date_of_confirmation AS date, NULL AS father_name, NULL AS mother_name',
  },
};

async function certificatesReport({ churchId, branchId, type, dateFrom, dateTo }) {
  const types = type && type !== 'all' ? [type] : Object.keys(CERT_TABLES);
  const results = [];

  for (const t of types) {
    const cfg = CERT_TABLES[t];
    const conditions = ['church_id = ?', 'is_deleted = 0'];
    const params = [churchId];
    if (branchId) {
      conditions.push('(branch_id = ? OR branch_id IS NULL)');
      params.push(branchId);
    }
    if (dateFrom) {
      conditions.push(`${cfg.dateColumn} >= ?`);
      params.push(dateFrom);
    }
    if (dateTo) {
      conditions.push(`${cfg.dateColumn} <= ?`);
      params.push(dateTo);
    }
    const where = `WHERE ${conditions.join(' AND ')}`;
    const [rows] = await pool.query(
      `SELECT '${t}' AS certificate_type, ${cfg.select} FROM ${cfg.table} ${where} ORDER BY ${cfg.dateColumn} DESC`,
      params
    );
    results.push(...rows);
  }

  results.sort((a, b) => (a.date < b.date ? 1 : -1));

  const summary = types.reduce((acc, t) => {
    acc[t] = results.filter((r) => r.certificate_type === t).length;
    return acc;
  }, {});

  return { rows: results, summary: { ...summary, total: results.length } };
}

module.exports = {
  massIntentionsReport,
  collectionsReport,
  certificatesReport,
  collectionsRangeDetail,
  contributionCollectionsReport,
  contributionCollectionsRangeDetail,
};
