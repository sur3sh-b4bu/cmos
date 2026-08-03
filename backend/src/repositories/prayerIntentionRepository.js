const { pool } = require('../config/db');

const BASE_SELECT = `
  SELECT
    pi.*,
    m.name AS mass_name, m.mass_time, m.day_type,
    pim.name AS intention_master_name, pim.is_custom AS intention_is_custom,
    pm.name AS payment_method_name,
    s.code AS status_code, s.label AS status_label, s.color AS status_color,
    u.full_name AS created_by_name
  FROM prayer_intentions pi
  JOIN masses m ON m.id = pi.mass_id
  LEFT JOIN prayer_intention_master pim ON pim.id = pi.prayer_intention_master_id
  LEFT JOIN payment_methods pm ON pm.id = pi.payment_method_id
  JOIN statuses s ON s.id = pi.status_id
  LEFT JOIN users u ON u.id = pi.created_by
`;

async function list({ page = 1, pageSize = 25, search, prayerDate, prayerDateFrom, prayerDateTo, massId, statusId, churchId }) {
  const conditions = ['pi.is_deleted = 0'];
  const params = [];

  if (churchId) {
    conditions.push('pi.church_id = ?');
    params.push(churchId);
  }
  if (search) {
    conditions.push('(pi.name LIKE ? OR pi.phone LIKE ? OR pi.receipt_no LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
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
  if (statusId) {
    conditions.push('pi.status_id = ?');
    params.push(statusId);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const offset = (Number(page) - 1) * Number(pageSize);

  const [rows] = await pool.query(
    `${BASE_SELECT} ${where} ORDER BY pi.prayer_date DESC, m.sort_order ASC, pi.id DESC LIMIT ? OFFSET ?`,
    [...params, Number(pageSize), offset]
  );
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM prayer_intentions pi ${where}`,
    params
  );
  return { rows, total, page: Number(page), pageSize: Number(pageSize) };
}

async function getById(id) {
  const [rows] = await pool.query(`${BASE_SELECT} WHERE pi.id = ? AND pi.is_deleted = 0 LIMIT 1`, [id]);
  return rows[0] || null;
}

async function findPotentialDuplicate({ name, phone, prayerDate, massId, prayerIntentionMasterId, excludeId }) {
  const conditions = [
    'is_deleted = 0',
    'name = ?',
    'prayer_date = ?',
    'mass_id = ?',
  ];
  const params = [name, prayerDate, massId];
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
    `SELECT id, receipt_no FROM prayer_intentions WHERE ${conditions.join(' AND ')} LIMIT 1`,
    params
  );
  return rows[0] || null;
}

async function create(data, userId) {
  const columns = [
    'church_id', 'branch_id', 'receipt_no', 'name', 'phone', 'prayer_date', 'mass_id',
    'prayer_intention_master_id', 'custom_intention', 'offering_amount', 'payment_method_id',
    'remarks', 'status_id',
  ];
  const values = columns.map((c) => data[c] ?? null);
  const [result] = await pool.query(
    `INSERT INTO prayer_intentions (${columns.join(', ')}, created_by, updated_by)
     VALUES (${columns.map(() => '?').join(', ')}, ?, ?)`,
    [...values, userId, userId]
  );
  return getById(result.insertId);
}

async function update(id, data, userId) {
  const editable = [
    'name', 'phone', 'prayer_date', 'mass_id', 'prayer_intention_master_id',
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

async function markCompleted(id, userId, statusId) {
  await pool.query(
    `UPDATE prayer_intentions
     SET status_id = ?, completed_at = NOW(), completed_by = ?, updated_by = ?
     WHERE id = ? AND is_deleted = 0`,
    [statusId, userId, userId, id]
  );
  return getById(id);
}

async function markAllCompletedForDate(prayerDate, churchId, statusId, userId) {
  const [result] = await pool.query(
    `UPDATE prayer_intentions
     SET status_id = ?, completed_at = NOW(), completed_by = ?, updated_by = ?
     WHERE prayer_date = ? AND church_id = ? AND is_deleted = 0 AND status_id != ?`,
    [statusId, userId, userId, prayerDate, churchId, statusId]
  );
  return result.affectedRows;
}

/** Rows for the Daily Prayer Register, grouped by mass in the application layer. */
async function getRegisterData(prayerDate, churchId) {
  const [rows] = await pool.query(
    `${BASE_SELECT}
     WHERE pi.prayer_date = ? AND pi.church_id = ? AND pi.is_deleted = 0
     ORDER BY m.sort_order ASC, pi.id ASC`,
    [prayerDate, churchId]
  );
  return rows;
}

async function getDashboardStats(churchId) {
  const today = new Date().toISOString().slice(0, 10);
  const [[todayCount]] = await pool.query(
    'SELECT COUNT(*) AS c FROM prayer_intentions WHERE prayer_date = ? AND church_id = ? AND is_deleted = 0',
    [today, churchId]
  );
  const [[todayCollections]] = await pool.query(
    'SELECT COALESCE(SUM(offering_amount),0) AS total FROM prayer_intentions WHERE prayer_date = ? AND church_id = ? AND is_deleted = 0',
    [today, churchId]
  );
  const [[pendingCount]] = await pool.query(
    `SELECT COUNT(*) AS c FROM prayer_intentions pi
     JOIN statuses s ON s.id = pi.status_id
     WHERE s.code = 'PENDING' AND pi.church_id = ? AND pi.is_deleted = 0`,
    [churchId]
  );
  const [upcoming] = await pool.query(
    `${BASE_SELECT}
     WHERE pi.prayer_date >= ? AND pi.church_id = ? AND pi.is_deleted = 0
     ORDER BY pi.prayer_date ASC, m.sort_order ASC LIMIT 5`,
    [today, churchId]
  );
  const [[monthlyCollections]] = await pool.query(
    `SELECT COALESCE(SUM(offering_amount),0) AS total FROM prayer_intentions
     WHERE church_id = ? AND is_deleted = 0 AND YEAR(prayer_date) = YEAR(CURDATE()) AND MONTH(prayer_date) = MONTH(CURDATE())`,
    [churchId]
  );

  const [trendRows] = await pool.query(
    `SELECT prayer_date, COALESCE(SUM(offering_amount),0) AS total
     FROM prayer_intentions
     WHERE church_id = ? AND is_deleted = 0 AND prayer_date BETWEEN DATE_SUB(?, INTERVAL 6 DAY) AND ?
     GROUP BY prayer_date`,
    [churchId, today, today]
  );
  const trendByDate = new Map(trendRows.map((r) => [r.prayer_date, Number(r.total)]));
  const collectionsTrend = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    collectionsTrend.push({ date: iso, total: trendByDate.get(iso) ?? 0 });
  }

  const [intentionsByMass] = await pool.query(
    `SELECT m.name AS massName, COUNT(pi.id) AS count
     FROM masses m
     LEFT JOIN prayer_intentions pi ON pi.mass_id = m.id AND pi.is_deleted = 0 AND pi.church_id = ?
     WHERE m.church_id = ? AND m.is_deleted = 0
     GROUP BY m.id, m.name, m.sort_order
     ORDER BY m.sort_order ASC`,
    [churchId, churchId]
  );

  return {
    todayCount: todayCount.c,
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
  getById,
  findPotentialDuplicate,
  create,
  update,
  softDelete,
  markCompleted,
  markAllCompletedForDate,
  getRegisterData,
  getDashboardStats,
};
