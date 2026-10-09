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
  const conditions = ['pi.church_id = ?', 'pi.is_deleted = 0', 'COALESCE(pi.is_refunded, 0) = 0'];
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
    "COALESCE(pi.is_refunded, 0) = 0",
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
     ORDER BY pt.payment_date DESC`,
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
  const conditions = [
    "pi.church_id = ?",
    'pi.is_deleted = 0',
    'COALESCE(pi.is_refunded, 0) = 0',
    "pt.status = 'success'",
    `${dateColumn} BETWEEN ? AND ?`,
  ];
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
     ORDER BY ${dateColumn} DESC, pi.id DESC`,
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
    'COALESCE(d.is_refunded, 0) = 0',
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
     ORDER BY pt.payment_date DESC`,
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
  const conditions = [
    'd.church_id = ?',
    'd.is_deleted = 0',
    'COALESCE(d.is_refunded, 0) = 0',
    "pt.status = 'success'",
    'pt.payment_date BETWEEN ? AND ?',
  ];
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
     ORDER BY pt.payment_date DESC, d.id DESC`,
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

async function overallFinancialReport({ churchId, branchId, dateFrom, dateTo }) {
  const from = dateFrom || '1970-01-01';
  const to = dateTo || '2099-12-31';

  // 1. Mass Intentions Summary & Payment Methods
  const massParams = [churchId, from, to];
  let massBranchFilter = '';
  if (branchId) {
    massBranchFilter = ' AND (pi.branch_id = ? OR pi.branch_id IS NULL)';
    massParams.push(branchId);
  }

  const [[massAgg]] = await pool.query(
    `SELECT COALESCE(SUM(pt.amount), 0) AS total_amount, COUNT(DISTINCT pi.id) AS total_count
     FROM prayer_intentions pi
     JOIN payment_transactions pt ON pt.prayer_intention_id = pi.id AND pt.status = 'success'
     WHERE pi.church_id = ? AND pi.is_deleted = 0 AND COALESCE(pi.is_refunded, 0) = 0
       AND pt.payment_date BETWEEN ? AND ?
       ${massBranchFilter}`,
    massParams
  );

  const [massMethods] = await pool.query(
    `SELECT LOWER(COALESCE(pt.method, 'cash')) AS method, COALESCE(SUM(pt.amount), 0) AS total, COUNT(DISTINCT pi.id) AS count
     FROM prayer_intentions pi
     JOIN payment_transactions pt ON pt.prayer_intention_id = pi.id AND pt.status = 'success'
     WHERE pi.church_id = ? AND pi.is_deleted = 0 AND COALESCE(pi.is_refunded, 0) = 0
       AND pt.payment_date BETWEEN ? AND ?
       ${massBranchFilter}
     GROUP BY LOWER(COALESCE(pt.method, 'cash'))`,
    massParams
  );

  // 2. Contributions Summary, Types & Payment Methods
  const contribParams = [churchId, from, to];
  let contribBranchFilter = '';
  if (branchId) {
    contribBranchFilter = ' AND (c.branch_id = ? OR c.branch_id IS NULL)';
    contribParams.push(branchId);
  }

  const [[contribAgg]] = await pool.query(
    `SELECT COALESCE(SUM(pt.amount), 0) AS total_amount, COUNT(DISTINCT c.id) AS total_count
     FROM contributions c
     JOIN contribution_payment_transactions pt ON pt.contribution_id = c.id AND pt.status = 'success'
     WHERE c.church_id = ? AND c.is_deleted = 0 AND COALESCE(c.is_refunded, 0) = 0
       AND pt.payment_date BETWEEN ? AND ?
       ${contribBranchFilter}`,
    contribParams
  );

  const [contribTypes] = await pool.query(
    `SELECT COALESCE(ct.name, c.custom_contribution_type, 'General Contribution') AS type_name,
            ct.name_ta AS type_name_ta,
            COALESCE(SUM(pt.amount), 0) AS total,
            COUNT(DISTINCT c.id) AS count
     FROM contributions c
     JOIN contribution_payment_transactions pt ON pt.contribution_id = c.id AND pt.status = 'success'
     LEFT JOIN contribution_types ct ON ct.id = c.contribution_type_id
     WHERE c.church_id = ? AND c.is_deleted = 0 AND COALESCE(c.is_refunded, 0) = 0
       AND pt.payment_date BETWEEN ? AND ?
       ${contribBranchFilter}
     GROUP BY ct.id, ct.name, ct.name_ta, c.custom_contribution_type
     ORDER BY total DESC`,
    contribParams
  );

  const [contribMethods] = await pool.query(
    `SELECT LOWER(COALESCE(pt.method, 'cash')) AS method, COALESCE(SUM(pt.amount), 0) AS total, COUNT(DISTINCT c.id) AS count
     FROM contributions c
     JOIN contribution_payment_transactions pt ON pt.contribution_id = c.id AND pt.status = 'success'
     WHERE c.church_id = ? AND c.is_deleted = 0 AND COALESCE(c.is_refunded, 0) = 0
       AND pt.payment_date BETWEEN ? AND ?
       ${contribBranchFilter}
     GROUP BY LOWER(COALESCE(pt.method, 'cash'))`,
    contribParams
  );

  // 3. Church Receipts (Other Income)
  const receiptParams = [churchId, from, to];
  let receiptBranchFilter = '';
  if (branchId) {
    receiptBranchFilter = ' AND (e.branch_id = ? OR e.branch_id IS NULL)';
    receiptParams.push(branchId);
  }

  const [[receiptAgg]] = await pool.query(
    `SELECT COALESCE(SUM(e.amount), 0) AS total_amount, COUNT(e.id) AS total_count
     FROM church_expenses e
     WHERE e.church_id = ? AND e.type = 'receipt' AND e.deleted_at IS NULL
       AND e.entry_date BETWEEN ? AND ?
       ${receiptBranchFilter}`,
    receiptParams
  );

  const [receiptHeads] = await pool.query(
    `SELECT COALESCE(ah.name, e.head_name, 'Other Receipt') AS head_name,
            ah.tamil_name AS head_tamil_name,
            ah.section,
            COALESCE(SUM(e.amount), 0) AS total,
            COUNT(e.id) AS count
     FROM church_expenses e
     LEFT JOIN account_heads ah ON ah.id = e.head_id
     WHERE e.church_id = ? AND e.type = 'receipt' AND e.deleted_at IS NULL
       AND e.entry_date BETWEEN ? AND ?
       ${receiptBranchFilter}
     GROUP BY e.head_id, ah.name, ah.tamil_name, ah.section, e.head_name
     ORDER BY total DESC`,
    receiptParams
  );

  const [receiptMethods] = await pool.query(
    `SELECT LOWER(COALESCE(pm.code, pm.name, 'cash')) AS method, COALESCE(SUM(e.amount), 0) AS total, COUNT(e.id) AS count
     FROM church_expenses e
     LEFT JOIN payment_methods pm ON pm.id = e.payment_method_id
     WHERE e.church_id = ? AND e.type = 'receipt' AND e.deleted_at IS NULL
       AND e.entry_date BETWEEN ? AND ?
       ${receiptBranchFilter}
     GROUP BY LOWER(COALESCE(pm.code, pm.name, 'cash'))`,
    receiptParams
  );

  // 4. Church Payments / Operating Expenses
  const paymentParams = [churchId, from, to];
  let paymentBranchFilter = '';
  if (branchId) {
    paymentBranchFilter = ' AND (e.branch_id = ? OR e.branch_id IS NULL)';
    paymentParams.push(branchId);
  }

  const [[paymentAgg]] = await pool.query(
    `SELECT COALESCE(SUM(e.amount), 0) AS total_amount, COUNT(e.id) AS total_count
     FROM church_expenses e
     WHERE e.church_id = ? AND e.type = 'payment' AND e.deleted_at IS NULL
       AND e.entry_date BETWEEN ? AND ?
       ${paymentBranchFilter}`,
    paymentParams
  );

  const [paymentHeads] = await pool.query(
    `SELECT COALESCE(ah.name, e.head_name, 'General Expense') AS head_name,
            ah.tamil_name AS head_tamil_name,
            ah.section,
            COALESCE(SUM(e.amount), 0) AS total,
            COUNT(e.id) AS count
     FROM church_expenses e
     LEFT JOIN account_heads ah ON ah.id = e.head_id
     WHERE e.church_id = ? AND e.type = 'payment' AND e.deleted_at IS NULL
       AND e.entry_date BETWEEN ? AND ?
       ${paymentBranchFilter}
     GROUP BY e.head_id, ah.name, ah.tamil_name, ah.section, e.head_name
     ORDER BY total DESC`,
    paymentParams
  );

  const [paymentMethods] = await pool.query(
    `SELECT LOWER(COALESCE(pm.code, pm.name, 'cash')) AS method, COALESCE(SUM(e.amount), 0) AS total, COUNT(e.id) AS count
     FROM church_expenses e
     LEFT JOIN payment_methods pm ON pm.id = e.payment_method_id
     WHERE e.church_id = ? AND e.type = 'payment' AND e.deleted_at IS NULL
       AND e.entry_date BETWEEN ? AND ?
       ${paymentBranchFilter}
     GROUP BY LOWER(COALESCE(pm.code, pm.name, 'cash'))`,
    paymentParams
  );

  // 5. Consolidated Calculations
  const massTotal = Number(massAgg.total_amount || 0);
  const massCount = Number(massAgg.total_count || 0);

  const contribTotal = Number(contribAgg.total_amount || 0);
  const contribCount = Number(contribAgg.total_count || 0);

  const otherReceiptsTotal = Number(receiptAgg.total_amount || 0);
  const otherReceiptsCount = Number(receiptAgg.total_count || 0);

  const paymentsTotal = Number(paymentAgg.total_amount || 0);
  const paymentsCount = Number(paymentAgg.total_count || 0);

  const totalIncome = massTotal + contribTotal + otherReceiptsTotal;
  const totalExpense = paymentsTotal;
  const netBalance = totalIncome - totalExpense;

  // Aggregate Payment Modes Map
  const normalizeMethod = (m) => {
    const lower = (m || '').toLowerCase();
    if (lower.includes('cash')) return 'cash';
    if (lower.includes('upi') || lower.includes('gpay') || lower.includes('phonepe') || lower.includes('paytm') || lower.includes('qr')) return 'upi';
    if (lower.includes('bank') || lower.includes('transfer') || lower.includes('neft') || lower.includes('rtgs') || lower.includes('imps') || lower.includes('cheque') || lower.includes('card')) return 'bank';
    return 'other';
  };

  const modeTotals = {
    cash: { income: 0, expense: 0, balance: 0 },
    bank: { income: 0, expense: 0, balance: 0 },
    upi: { income: 0, expense: 0, balance: 0 },
    other: { income: 0, expense: 0, balance: 0 },
  };

  // Add Mass Intention methods to mode totals
  for (const m of massMethods) {
    const mode = normalizeMethod(m.method);
    modeTotals[mode].income += Number(m.total || 0);
  }
  // Add Contribution methods to mode totals
  for (const m of contribMethods) {
    const mode = normalizeMethod(m.method);
    modeTotals[mode].income += Number(m.total || 0);
  }
  // Add Church Receipts methods to mode totals
  for (const m of receiptMethods) {
    const mode = normalizeMethod(m.method);
    modeTotals[mode].income += Number(m.total || 0);
  }
  // Add Church Payments methods to mode totals
  for (const m of paymentMethods) {
    const mode = normalizeMethod(m.method);
    modeTotals[mode].expense += Number(m.total || 0);
  }

  for (const key of Object.keys(modeTotals)) {
    modeTotals[key].balance = modeTotals[key].income - modeTotals[key].expense;
  }

  return {
    dateFrom,
    dateTo,
    summary: {
      totalIncome,
      totalExpense,
      netBalance,
      massTotal,
      massCount,
      contribTotal,
      contribCount,
      otherReceiptsTotal,
      otherReceiptsCount,
      paymentsTotal,
      paymentsCount,
      totalEntries: massCount + contribCount + otherReceiptsCount + paymentsCount,
    },
    modeTotals,
    massIntentions: {
      total: massTotal,
      count: massCount,
      methods: massMethods.map((m) => ({ method: m.method, total: Number(m.total), count: m.count })),
    },
    contributions: {
      total: contribTotal,
      count: contribCount,
      types: contribTypes.map((t) => ({ typeName: t.type_name, typeNameTa: t.type_name_ta, total: Number(t.total), count: t.count })),
      methods: contribMethods.map((m) => ({ method: m.method, total: Number(m.total), count: m.count })),
    },
    otherReceipts: {
      total: otherReceiptsTotal,
      count: otherReceiptsCount,
      heads: receiptHeads.map((h) => ({ headName: h.head_name, headTamilName: h.head_tamil_name, section: h.section, total: Number(h.total), count: h.count })),
      methods: receiptMethods.map((m) => ({ method: m.method, total: Number(m.total), count: m.count })),
    },
    expenses: {
      total: paymentsTotal,
      count: paymentsCount,
      heads: paymentHeads.map((h) => ({ headName: h.head_name, headTamilName: h.head_tamil_name, section: h.section, total: Number(h.total), count: h.count })),
      methods: paymentMethods.map((m) => ({ method: m.method, total: Number(m.total), count: m.count })),
    },
  };
}

module.exports = {
  massIntentionsReport,
  collectionsReport,
  certificatesReport,
  collectionsRangeDetail,
  contributionCollectionsReport,
  contributionCollectionsRangeDetail,
  overallFinancialReport,
};
