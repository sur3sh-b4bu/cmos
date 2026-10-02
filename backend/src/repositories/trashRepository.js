const { pool } = require('../config/db');
const { clampPageSize, clampPage } = require('../utils/pagination');

const MODULE_CONFIGS = {
  mass_intentions: {
    table: 'prayer_intentions',
    titleExpr: 't.name',
    refExpr: 't.receipt_no',
    detailExpr: "CONCAT('Date: ', DATE_FORMAT(t.prayer_date, '%d/%m/%Y'), ' | Amount: ₹', t.offering_amount)",
  },
  contributions: {
    table: 'contributions',
    titleExpr: 't.name',
    refExpr: 't.receipt_no',
    detailExpr: "CONCAT('Amount: ₹', t.contribution_amount)",
  },
  baptism_certificates: {
    table: 'baptism_certificates',
    titleExpr: 't.child_name',
    refExpr: 't.certificate_no',
    detailExpr: "CONCAT('DOB: ', DATE_FORMAT(t.date_of_birth, '%d/%m/%Y'), ' | Baptism: ', DATE_FORMAT(t.date_of_baptism, '%d/%m/%Y'))",
  },
  marriage_certificates: {
    table: 'marriage_certificates',
    titleExpr: "CONCAT(t.groom_name, ' & ', t.bride_name)",
    refExpr: 't.certificate_no',
    detailExpr: "CONCAT('Marriage Date: ', DATE_FORMAT(t.marriage_date, '%d/%m/%Y'))",
  },
  death_certificates: {
    table: 'death_certificates',
    titleExpr: 't.deceased_name',
    refExpr: 't.certificate_no',
    detailExpr: "CONCAT('DOD: ', DATE_FORMAT(t.date_of_death, '%d/%m/%Y'))",
  },
  confirmation_certificates: {
    table: 'confirmation_certificates',
    titleExpr: 't.name',
    refExpr: 't.certificate_no',
    detailExpr: "CONCAT('Confirmation Date: ', DATE_FORMAT(t.date_of_confirmation, '%d/%m/%Y'))",
  },
  priests: {
    table: 'priests',
    titleExpr: 't.name',
    refExpr: 't.title',
    detailExpr: 't.phone',
  },
  masses: {
    table: 'masses',
    titleExpr: 't.name',
    refExpr: 't.day_type',
    detailExpr: "CONCAT('Time: ', TIME_FORMAT(t.mass_time, '%h:%i %p'))",
  },
  branches: {
    table: 'branches',
    titleExpr: 't.name',
    refExpr: 't.code',
    detailExpr: 't.address',
  },
  prayer_intention_master: {
    table: 'prayer_intention_master',
    titleExpr: 't.name',
    refExpr: "CONCAT('ID #', t.id)",
    detailExpr: 't.name_ta',
  },
  donation_types: {
    table: 'contribution_types',
    titleExpr: 't.name',
    refExpr: 't.code',
    detailExpr: 't.name_ta',
  },
  users: {
    table: 'users',
    titleExpr: 't.full_name',
    refExpr: 't.username',
    detailExpr: 't.email',
  },
};

const GLOBAL_TABLES = new Set([
  'prayer_intention_master',
  'contribution_types',
  'donation_types',
  'payment_methods',
  'genders',
  'languages',
  'currencies',
  'countries',
  'states',
  'districts',
]);

async function listTrash({ moduleKey, page = 1, pageSize = 25, search, churchId }) {
  page = clampPage(page);
  pageSize = clampPageSize(pageSize);

  const config = MODULE_CONFIGS[moduleKey];
  if (!config) {
    throw new Error(`Unsupported moduleKey: ${moduleKey}`);
  }

  const conditions = ['t.is_deleted = 1'];
  const params = [];

  // Scoping: church tables use church_id, global lookups do not
  if (churchId && !GLOBAL_TABLES.has(config.table)) {
    conditions.push('t.church_id = ?');
    params.push(churchId);
  }

  if (search && search.trim()) {
    conditions.push(`(${config.titleExpr} LIKE ? OR ${config.refExpr} LIKE ?)`);
    const q = `%${search.trim()}%`;
    params.push(q, q);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const offset = (page - 1) * pageSize;

  const sql = `
    SELECT 
      t.id,
      ${config.refExpr} AS reference_no,
      ${config.titleExpr} AS record_title,
      ${config.detailExpr} AS record_detail,
      t.updated_at AS deleted_at,
      u.full_name AS deleted_by_name
    FROM ${config.table} t
    LEFT JOIN users u ON u.id = t.updated_by
    ${where}
    ORDER BY t.updated_at DESC
    LIMIT ? OFFSET ?
  `;

  const [rows] = await pool.query(sql, [...params, pageSize, offset]);
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM ${config.table} t ${where}`,
    params
  );

  return { rows, total, page, pageSize, moduleKey };
}

async function restoreRecord({ moduleKey, id, churchId, userId }) {
  const config = MODULE_CONFIGS[moduleKey];
  if (!config) {
    throw new Error(`Unsupported moduleKey: ${moduleKey}`);
  }

  const conditions = ['id = ?', 'is_deleted = 1'];
  const params = [userId, id];

  if (churchId && !GLOBAL_TABLES.has(config.table)) {
    conditions.push('church_id = ?');
    params.push(churchId);
  }

  const sql = `
    UPDATE ${config.table}
    SET is_deleted = 0, is_active = 1, updated_by = ?
    WHERE ${conditions.join(' AND ')}
  `;

  const [result] = await pool.query(sql, params);
  return result.affectedRows > 0;
}

module.exports = { MODULE_CONFIGS, listTrash, restoreRecord };
