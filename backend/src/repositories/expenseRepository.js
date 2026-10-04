const { pool } = require('../config/db');

function parseMonthYear(dateStr) {
  if (!dateStr) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }
  return String(dateStr).slice(0, 7);
}

function getPreviousMonthYear(monthYear) {
  const [yStr, mStr] = monthYear.split('-');
  let y = parseInt(yStr, 10);
  let m = parseInt(mStr, 10) - 1;
  if (m < 1) {
    m = 12;
    y -= 1;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}

async function listAccountHeads(churchId, type = null) {
  let sql = `
    SELECT * FROM account_heads
    WHERE (church_id IS NULL OR church_id = ?) AND is_active = 1
  `;
  const params = [churchId];
  if (type) {
    sql += ' AND type = ?';
    params.push(type);
  }
  sql += ' ORDER BY type ASC, order_index ASC, id ASC';
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function createAccountHead(data) {
  const [result] = await pool.query(
    `INSERT INTO account_heads (church_id, type, section, name, tamil_name, code, is_system, auto_source, order_index, is_active)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 1)`,
    [
      data.churchId || null,
      data.type,
      data.section,
      data.name,
      data.tamilName || null,
      data.code || null,
      data.autoSource || null,
      data.orderIndex || 0,
    ]
  );
  const [rows] = await pool.query('SELECT * FROM account_heads WHERE id = ?', [result.insertId]);
  return rows[0];
}

async function updateAccountHead(id, churchId, data) {
  const fields = [];
  const params = [];
  if (data.name !== undefined) { fields.push('name = ?'); params.push(data.name); }
  if (data.tamilName !== undefined) { fields.push('tamil_name = ?'); params.push(data.tamilName); }
  if (data.section !== undefined) { fields.push('section = ?'); params.push(data.section); }
  if (data.code !== undefined) { fields.push('code = ?'); params.push(data.code); }
  if (data.orderIndex !== undefined) { fields.push('order_index = ?'); params.push(data.orderIndex); }
  if (data.isActive !== undefined) { fields.push('is_active = ?'); params.push(data.isActive ? 1 : 0); }
  if (data.autoSource !== undefined) { fields.push('auto_source = ?'); params.push(data.autoSource); }

  if (!fields.length) return null;
  params.push(id);

  let sql = `UPDATE account_heads SET ${fields.join(', ')} WHERE id = ?`;
  if (churchId) {
    sql += ' AND (church_id = ? OR is_system = 1)';
    params.push(churchId);
  }
  await pool.query(sql, params);
  const [rows] = await pool.query('SELECT * FROM account_heads WHERE id = ?', [id]);
  return rows[0] || null;
}

async function deleteAccountHead(id, churchId) {
  let sql = 'UPDATE account_heads SET is_active = 0 WHERE id = ?';
  const params = [id];
  if (churchId) {
    sql += ' AND (church_id = ? OR is_system = 1)';
    params.push(churchId);
  }
  const [res] = await pool.query(sql, params);
  return res.affectedRows > 0;
}

async function getMonthlyAccountsData({ churchId, branchId = null, monthYear }) {
  const my = monthYear || parseMonthYear();
  const [yearStr, monthStr] = my.split('-');
  const y = parseInt(yearStr, 10);
  const m = parseInt(monthStr, 10);

  const startDate = `${my}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const endDate = `${my}-${String(lastDay).padStart(2, '0')}`;

  // 1. Fetch all active account heads
  const heads = await listAccountHeads(churchId);

  // 2. Fetch Mass Intentions offering total (auto-source: 'mass_intentions_people')
  let massSql = `
    SELECT COALESCE(SUM(offering_amount), 0) AS total_offering, COUNT(*) AS total_count
    FROM prayer_intentions
    WHERE church_id = ? AND is_deleted = 0 AND COALESCE(is_refunded, 0) = 0
      AND prayer_date >= ? AND prayer_date <= ?
  `;
  const massParams = [churchId, startDate, endDate];
  if (branchId) {
    massSql += ' AND branch_id = ?';
    massParams.push(branchId);
  }
  const [[massAgg]] = await pool.query(massSql, massParams);

  // 3. Fetch Contributions grouped by contribution type / name
  let contribSql = `
    SELECT ct.code, ct.name, COALESCE(SUM(COALESCE(c.amount, c.contribution_amount, 0)), 0) AS total_amount, COUNT(c.id) AS count
    FROM contributions c
    LEFT JOIN contribution_types ct ON ct.id = c.contribution_type_id
    WHERE c.church_id = ? AND c.is_deleted = 0 AND COALESCE(c.is_refunded, 0) = 0
      AND COALESCE(c.payment_date, DATE(c.created_at)) >= ? AND COALESCE(c.payment_date, DATE(c.created_at)) <= ?
  `;
  const contribParams = [churchId, startDate, endDate];
  if (branchId) {
    contribSql += ' AND c.branch_id = ?';
    contribParams.push(branchId);
  }
  contribSql += ' GROUP BY ct.id, ct.code, ct.name';
  const [contribAggs] = await pool.query(contribSql, contribParams);

  const contribMap = {};
  for (const c of contribAggs) {
    const key = (c.code || c.name || '').toLowerCase();
    contribMap[key] = parseFloat(c.total_amount || 0);
  }

  // 4. Fetch manual ledger expense / receipt entries for this month
  let entrySql = `
    SELECT e.*, ah.section, ah.code AS head_code, ah.auto_source
    FROM church_expenses e
    LEFT JOIN account_heads ah ON ah.id = e.head_id
    WHERE e.church_id = ? AND e.month_year = ? AND e.deleted_at IS NULL
  `;
  const entryParams = [churchId, my];
  if (branchId) {
    entrySql += ' AND (e.branch_id = ? OR e.branch_id IS NULL)';
    entryParams.push(branchId);
  }
  const [entries] = await pool.query(entrySql, entryParams);

  const entryByHeadId = {};
  const entryByHeadCode = {};
  for (const e of entries) {
    if (e.head_id) entryByHeadId[e.head_id] = (entryByHeadId[e.head_id] || 0) + parseFloat(e.amount || 0);
    if (e.head_code) entryByHeadCode[e.head_code] = (entryByHeadCode[e.head_code] || 0) + parseFloat(e.amount || 0);
  }

  // 5. Fetch Monthly Financial Abstract for this month
  let abstractSql = `
    SELECT * FROM monthly_financial_abstracts
    WHERE church_id = ? AND month_year = ?
  `;
  const abstractParams = [churchId, my];
  if (branchId) {
    abstractSql += ' AND branch_id = ?';
    abstractParams.push(branchId);
  } else {
    abstractSql += ' AND branch_id IS NULL';
  }
  const [abstractRows] = await pool.query(abstractSql, abstractParams);
  let abstractData = abstractRows[0] || null;

  // 6. If opening balances are not recorded yet, check previous month's closing balances
  let prevMonthClosing = { cashHand: 0, cashBank: 0, fixedDeposits: 0 };
  const prevMy = getPreviousMonthYear(my);
  const [prevRows] = await pool.query(
    'SELECT closing_cash_hand, closing_cash_bank, closing_fixed_deposits FROM monthly_financial_abstracts WHERE church_id = ? AND month_year = ? LIMIT 1',
    [churchId, prevMy]
  );
  if (prevRows[0]) {
    prevMonthClosing = {
      cashHand: parseFloat(prevRows[0].closing_cash_hand || 0),
      cashBank: parseFloat(prevRows[0].closing_cash_bank || 0),
      fixedDeposits: parseFloat(prevRows[0].closing_fixed_deposits || 0),
    };
  }

  // Opening balance resolution
  const openingCashHand = abstractData ? parseFloat(abstractData.opening_cash_hand || 0) : prevMonthClosing.cashHand;
  const openingCashBank = abstractData ? parseFloat(abstractData.opening_cash_bank || 0) : prevMonthClosing.cashBank;
  const openingFixedDeposits = abstractData ? parseFloat(abstractData.opening_fixed_deposits || 0) : prevMonthClosing.fixedDeposits;

  // Closing balance resolution
  const closingCashHand = abstractData ? parseFloat(abstractData.closing_cash_hand || 0) : 0;
  const closingCashBank = abstractData ? parseFloat(abstractData.closing_cash_bank || 0) : 0;
  const closingFixedDeposits = abstractData ? parseFloat(abstractData.closing_fixed_deposits || 0) : 0;

  // Assemble full receipt rows and payment rows
  const receiptItems = [];
  const paymentItems = [];

  for (const h of heads) {
    let computedAmount = 0;
    let isAuto = false;

    if (h.code === 'REC_OPEN_CASH') {
      computedAmount = openingCashHand;
      isAuto = true;
    } else if (h.code === 'REC_OPEN_BANK') {
      computedAmount = openingCashBank;
      isAuto = true;
    } else if (h.code === 'REC_OPEN_FD') {
      computedAmount = openingFixedDeposits;
      isAuto = true;
    } else if (h.code === 'PAY_CLOSE_CASH') {
      computedAmount = closingCashHand;
      isAuto = true;
    } else if (h.code === 'PAY_CLOSE_BANK') {
      computedAmount = closingCashBank;
      isAuto = true;
    } else if (h.code === 'PAY_CLOSE_FD') {
      computedAmount = closingFixedDeposits;
      isAuto = true;
    } else if (h.auto_source === 'mass_intentions_people') {
      computedAmount = parseFloat(massAgg.total_offering || 0);
      isAuto = true;
    } else if (h.auto_source && h.auto_source.startsWith('contributions_')) {
      const matchType = h.auto_source.replace('contributions_', '');
      const matchKey = Object.keys(contribMap).find((k) => k.includes(matchType));
      if (matchKey !== undefined) {
        computedAmount = contribMap[matchKey];
        isAuto = true;
      }
    }

    // Add manual entry amount if present
    const manualAmount = (entryByHeadId[h.id] || entryByHeadCode[h.code] || 0);
    const totalAmount = isAuto && computedAmount > 0 ? computedAmount + manualAmount : (manualAmount || computedAmount);

    const itemObj = {
      id: h.id,
      code: h.code,
      section: h.section,
      name: h.name,
      tamil_name: h.tamil_name,
      type: h.type,
      auto_source: h.auto_source,
      is_auto: isAuto,
      auto_amount: computedAmount,
      manual_amount: manualAmount,
      amount: totalAmount,
      order_index: h.order_index,
    };

    if (h.type === 'receipt') {
      receiptItems.push(itemObj);
    } else {
      paymentItems.push(itemObj);
    }
  }

  const totalReceipts = receiptItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const totalPayments = paymentItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  return {
    monthYear: my,
    churchId,
    branchId,
    startDate,
    endDate,
    receipts: receiptItems,
    payments: paymentItems,
    totalReceipts,
    totalPayments,
    abstract: abstractData || {
      month_year: my,
      opening_cash_hand: openingCashHand,
      opening_cash_bank: openingCashBank,
      opening_fixed_deposits: openingFixedDeposits,
      closing_cash_hand: closingCashHand,
      closing_cash_bank: closingCashBank,
      closing_fixed_deposits: closingFixedDeposits,
      receipts_specific_project: 0,
      payments_specific_project: 0,
      remit_stole_fees: 0,
      remit_mass_intentions: 0,
      remit_parish_contribution: 0,
      remit_diocesan_collection: 0,
      recv_monthly_allowance: 0,
      recv_medical_allowance: 0,
      recv_mission_conveyance: 0,
      recv_any_other: 0,
      priest_name: '',
      designation: '',
      unit_no: '',
      notes: '',
    },
    autoAggregates: {
      massIntentionsOffering: parseFloat(massAgg.total_offering || 0),
      massIntentionsCount: parseInt(massAgg.total_count || 0, 10),
      contributionsByType: contribMap,
    },
    prevMonthClosing,
  };
}

async function saveMonthlyLedger(churchId, branchId, monthYear, { entries = [], abstract = {} }, userId = null) {
  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    const my = monthYear || parseMonthYear();

    // 1. Upsert / update entries
    for (const e of entries) {
      if (!e.headId && !e.headName) continue;
      const amount = parseFloat(e.amount || 0);

      // Check if entry already exists for this head in this month
      const [existing] = await conn.query(
        'SELECT id FROM church_expenses WHERE church_id = ? AND month_year = ? AND head_id = ? AND deleted_at IS NULL LIMIT 1',
        [churchId, my, e.headId]
      );

      if (existing.length > 0) {
        await conn.query(
          `UPDATE church_expenses
           SET amount = ?, notes = ?, paid_to = ?, voucher_no = ?, updated_at = NOW()
           WHERE id = ?`,
          [amount, e.notes || null, e.paidTo || null, e.voucherNo || null, existing[0].id]
        );
      } else {
        await conn.query(
          `INSERT INTO church_expenses
           (church_id, branch_id, entry_date, month_year, type, head_id, head_name, amount, voucher_no, paid_to, notes, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            churchId,
            branchId || null,
            e.entryDate || `${my}-01`,
            my,
            e.type || 'payment',
            e.headId || null,
            e.headName || 'General Expense',
            amount,
            e.voucherNo || null,
            e.paidTo || null,
            e.notes || null,
            userId || null,
          ]
        );
      }
    }

    // 2. Upsert Monthly Financial Abstract
    if (abstract) {
      await conn.query(
        `INSERT INTO monthly_financial_abstracts
         (church_id, branch_id, month_year, opening_cash_hand, opening_cash_bank, opening_fixed_deposits,
          closing_cash_hand, closing_cash_bank, closing_fixed_deposits,
          receipts_specific_project, payments_specific_project,
          remit_stole_fees, remit_mass_intentions, remit_parish_contribution, remit_diocesan_collection,
          recv_monthly_allowance, recv_medical_allowance, recv_mission_conveyance, recv_any_other,
          priest_name, designation, unit_no, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
          opening_cash_hand = VALUES(opening_cash_hand),
          opening_cash_bank = VALUES(opening_cash_bank),
          opening_fixed_deposits = VALUES(opening_fixed_deposits),
          closing_cash_hand = VALUES(closing_cash_hand),
          closing_cash_bank = VALUES(closing_cash_bank),
          closing_fixed_deposits = VALUES(closing_fixed_deposits),
          receipts_specific_project = VALUES(receipts_specific_project),
          payments_specific_project = VALUES(payments_specific_project),
          remit_stole_fees = VALUES(remit_stole_fees),
          remit_mass_intentions = VALUES(remit_mass_intentions),
          remit_parish_contribution = VALUES(remit_parish_contribution),
          remit_diocesan_collection = VALUES(remit_diocesan_collection),
          recv_monthly_allowance = VALUES(recv_monthly_allowance),
          recv_medical_allowance = VALUES(recv_medical_allowance),
          recv_mission_conveyance = VALUES(recv_mission_conveyance),
          recv_any_other = VALUES(recv_any_other),
          priest_name = VALUES(priest_name),
          designation = VALUES(designation),
          unit_no = VALUES(unit_no),
          notes = VALUES(notes),
          updated_at = NOW()`,
        [
          churchId,
          branchId || null,
          my,
          parseFloat(abstract.opening_cash_hand || 0),
          parseFloat(abstract.opening_cash_bank || 0),
          parseFloat(abstract.opening_fixed_deposits || 0),
          parseFloat(abstract.closing_cash_hand || 0),
          parseFloat(abstract.closing_cash_bank || 0),
          parseFloat(abstract.closing_fixed_deposits || 0),
          parseFloat(abstract.receipts_specific_project || 0),
          parseFloat(abstract.payments_specific_project || 0),
          parseFloat(abstract.remit_stole_fees || 0),
          parseFloat(abstract.remit_mass_intentions || 0),
          parseFloat(abstract.remit_parish_contribution || 0),
          parseFloat(abstract.remit_diocesan_collection || 0),
          parseFloat(abstract.recv_monthly_allowance || 0),
          parseFloat(abstract.recv_medical_allowance || 0),
          parseFloat(abstract.recv_mission_conveyance || 0),
          parseFloat(abstract.recv_any_other || 0),
          abstract.priest_name || null,
          abstract.designation || null,
          abstract.unit_no || null,
          abstract.notes || null,
          userId || null,
        ]
      );
    }

    await conn.commit();
    return true;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function listTransactions({ churchId, branchId, dateFrom, dateTo, type, headId, page = 1, limit = 50 }) {
  let where = 'WHERE e.church_id = ? AND e.deleted_at IS NULL';
  const params = [churchId];

  if (branchId) {
    where += ' AND (e.branch_id = ? OR e.branch_id IS NULL)';
    params.push(branchId);
  }
  if (dateFrom) {
    where += ' AND e.entry_date >= ?';
    params.push(dateFrom);
  }
  if (dateTo) {
    where += ' AND e.entry_date <= ?';
    params.push(dateTo);
  }
  if (type) {
    where += ' AND e.type = ?';
    params.push(type);
  }
  if (headId) {
    where += ' AND e.head_id = ?';
    params.push(headId);
  }

  const offset = (page - 1) * limit;

  const countSql = `SELECT COUNT(*) AS total FROM church_expenses e ${where}`;
  const [countRes] = await pool.query(countSql, params);
  const total = countRes[0].total;

  const listSql = `
    SELECT e.*, ah.name AS account_head_name, ah.section, pm.name AS payment_method_name, u.display_name AS created_by_name
    FROM church_expenses e
    LEFT JOIN account_heads ah ON ah.id = e.head_id
    LEFT JOIN payment_methods pm ON pm.id = e.payment_method_id
    LEFT JOIN users u ON u.id = e.created_by
    ${where}
    ORDER BY e.entry_date DESC, e.id DESC
    LIMIT ? OFFSET ?
  `;
  const [rows] = await pool.query(listSql, [...params, limit, offset]);

  return { rows, total, page, limit };
}

async function createTransaction(churchId, branchId, data, userId) {
  const [res] = await pool.query(
    `INSERT INTO church_expenses
     (church_id, branch_id, entry_date, month_year, type, head_id, head_name, amount, payment_method_id, voucher_no, paid_to, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      churchId,
      branchId || null,
      data.entryDate,
      parseMonthYear(data.entryDate),
      data.type,
      data.headId || null,
      data.headName,
      data.amount,
      data.paymentMethodId || null,
      data.voucherNo || null,
      data.paidTo || null,
      data.notes || null,
      userId || null,
    ]
  );
  const [rows] = await pool.query('SELECT * FROM church_expenses WHERE id = ?', [res.insertId]);
  return rows[0];
}

async function deleteTransaction(id, churchId) {
  const [res] = await pool.query(
    'UPDATE church_expenses SET deleted_at = NOW() WHERE id = ? AND church_id = ?',
    [id, churchId]
  );
  return res.affectedRows > 0;
}

module.exports = {
  listAccountHeads,
  createAccountHead,
  updateAccountHead,
  deleteAccountHead,
  getMonthlyAccountsData,
  saveMonthlyLedger,
  listTransactions,
  createTransaction,
  deleteTransaction,
};
