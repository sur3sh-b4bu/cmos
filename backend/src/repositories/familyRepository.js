'use strict';

const { pool } = require('../config/db');
const { clampPage, clampPageSize } = require('../utils/pagination');

const BASE_SELECT = `
  SELECT
    f.id,
    f.church_id,
    f.branch_id,
    f.family_code,
    f.family_name,
    f.family_name_ta,
    f.ward_id,
    w.name AS ward_name,
    w.name_ta AS ward_name_ta,
    f.head_member_id,
    hm.first_name AS head_first_name,
    hm.last_name AS head_last_name,
    hm.phone AS head_phone,
    hm.gender AS head_gender,
    f.parent_family_id,
    pf.family_code AS parent_family_code,
    pf.family_name AS parent_family_name,
    f.address_line1,
    f.address_line2,
    f.address_ta,
    f.city,
    f.pincode,
    f.phone,
    f.email,
    f.marriage_date,
    f.status,
    f.migration_date,
    f.migration_reason,
    f.migrated_to_parish,
    f.migrated_from_parish,
    f.remarks,
    f.created_at,
    f.created_by,
    f.updated_at,
    f.updated_by,
    f.is_active,
    f.is_deleted,
    (SELECT COUNT(*) FROM family_members m WHERE m.family_id = f.id AND m.is_deleted = 0) AS total_members,
    (SELECT COUNT(*) FROM family_members m WHERE m.family_id = f.id AND m.is_deleted = 0 AND m.gender = 'M') AS male_members,
    (SELECT COUNT(*) FROM family_members m WHERE m.family_id = f.id AND m.is_deleted = 0 AND m.gender = 'F') AS female_members
  FROM families f
  LEFT JOIN wards w ON w.id = f.ward_id
  LEFT JOIN family_members hm ON hm.id = f.head_member_id
  LEFT JOIN families pf ON pf.id = f.parent_family_id
`;

function buildListQuery({ churchId, branchId, wardId, status, search }) {
  const conditions = ['f.is_deleted = 0'];
  const params = [];

  if (churchId) {
    conditions.push('f.church_id = ?');
    params.push(churchId);
  }
  if (branchId) {
    conditions.push('(f.branch_id = ? OR f.branch_id IS NULL)');
    params.push(branchId);
  }
  if (wardId) {
    conditions.push('f.ward_id = ?');
    params.push(wardId);
  }
  if (status) {
    conditions.push('f.status = ?');
    params.push(status);
  }
  if (search) {
    conditions.push('(f.family_code LIKE ? OR f.family_name LIKE ? OR f.phone LIKE ? OR hm.first_name LIKE ? OR hm.last_name LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  return {
    where: `WHERE ${conditions.join(' AND ')}`,
    params,
  };
}

async function list({ page = 1, pageSize = 25, sortBy = 'family_code', sortDir = 'ASC', ...query }) {
  page = clampPage(page);
  pageSize = clampPageSize(pageSize);
  const offset = (Number(page) - 1) * Number(pageSize);
  const { where, params } = buildListQuery(query);

  const allowedSorts = {
    id: 'f.id',
    family_code: 'f.family_code',
    family_name: 'f.family_name',
    ward_name: 'w.name',
    status: 'f.status',
    created_at: 'f.created_at',
  };
  const sortCol = allowedSorts[sortBy] || 'f.family_code';
  const orderDir = String(sortDir).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

  const [rows] = await pool.query(
    `${BASE_SELECT} ${where} ORDER BY ${sortCol} ${orderDir} LIMIT ? OFFSET ?`,
    [...params, Number(pageSize), offset]
  );

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM families f
     LEFT JOIN family_members hm ON hm.id = f.head_member_id
     ${where}`,
    params
  );

  return { rows, total, page: Number(page), pageSize: Number(pageSize) };
}

async function findById(id, scope = {}) {
  const conditions = ['f.id = ?', 'f.is_deleted = 0'];
  const params = [id];

  if (scope.churchId) {
    conditions.push('f.church_id = ?');
    params.push(scope.churchId);
  }
  if (scope.branchId) {
    conditions.push('(f.branch_id = ? OR f.branch_id IS NULL)');
    params.push(scope.branchId);
  }

  const [rows] = await pool.query(`${BASE_SELECT} WHERE ${conditions.join(' AND ')}`, params);
  return rows[0] || null;
}

async function getNextFamilyCode(churchId, conn = pool) {
  const [[result]] = await conn.query(
    `SELECT family_code FROM families
     WHERE church_id = ?
     ORDER BY id DESC LIMIT 1`,
    [churchId]
  );
  if (!result || !result.family_code) {
    return 'FAM-0001';
  }
  const match = result.family_code.match(/FAM-(\d+)/i);
  if (match) {
    const nextNum = parseInt(match[1], 10) + 1;
    return `FAM-${String(nextNum).padStart(4, '0')}`;
  }
  return `FAM-${Date.now().toString().slice(-4)}`;
}

async function create(data, conn = pool) {
  const [result] = await conn.query(
    `INSERT INTO families (
      church_id, branch_id, family_code, family_name, family_name_ta,
      ward_id, head_member_id, parent_family_id,
      address_line1, address_line2, address_ta, city, pincode,
      phone, email, marriage_date, status, migration_date,
      migration_reason, migrated_to_parish, migrated_from_parish, remarks, created_by
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      data.church_id,
      data.branch_id || null,
      data.family_code,
      data.family_name,
      data.family_name_ta || null,
      data.ward_id || null,
      data.head_member_id || null,
      data.parent_family_id || null,
      data.address_line1 || null,
      data.address_line2 || null,
      data.address_ta || null,
      data.city || null,
      data.pincode || null,
      data.phone || null,
      data.email || null,
      data.marriage_date || null,
      data.status || 'ACTIVE',
      data.migration_date || null,
      data.migration_reason || null,
      data.migrated_to_parish || null,
      data.migrated_from_parish || null,
      data.remarks || null,
      data.created_by || null,
    ]
  );
  return result.insertId;
}

async function update(id, data, conn = pool) {
  await conn.query(
    `UPDATE families SET
      branch_id = COALESCE(?, branch_id),
      family_code = COALESCE(?, family_code),
      family_name = COALESCE(?, family_name),
      family_name_ta = ?,
      ward_id = ?,
      head_member_id = ?,
      address_line1 = ?,
      address_line2 = ?,
      address_ta = ?,
      city = ?,
      pincode = ?,
      phone = ?,
      email = ?,
      marriage_date = ?,
      status = COALESCE(?, status),
      migration_date = ?,
      migration_reason = ?,
      migrated_to_parish = ?,
      migrated_from_parish = ?,
      remarks = ?,
      updated_by = ?
    WHERE id = ? AND is_deleted = 0`,
    [
      data.branch_id,
      data.family_code,
      data.family_name,
      data.family_name_ta,
      data.ward_id || null,
      data.head_member_id || null,
      data.address_line1 || null,
      data.address_line2 || null,
      data.address_ta || null,
      data.city || null,
      data.pincode || null,
      data.phone || null,
      data.email || null,
      data.marriage_date || null,
      data.status,
      data.migration_date || null,
      data.migration_reason || null,
      data.migrated_to_parish || null,
      data.migrated_from_parish || null,
      data.remarks || null,
      data.updated_by || null,
      id,
    ]
  );
}

async function softDelete(id, userId, conn = pool) {
  await conn.query(
    'UPDATE families SET is_deleted = 1, updated_by = ? WHERE id = ?',
    [userId, id]
  );
}

async function getCensusStats(churchId, branchId) {
  const params = [];
  let scope = 'f.is_deleted = 0';
  if (churchId) {
    scope += ' AND f.church_id = ?';
    params.push(churchId);
  }
  if (branchId) {
    scope += ' AND (f.branch_id = ? OR f.branch_id IS NULL)';
    params.push(branchId);
  }

  const [[familyCounts]] = await pool.query(
    `SELECT
      COUNT(*) AS total_families,
      SUM(CASE WHEN f.status = 'ACTIVE' THEN 1 ELSE 0 END) AS active_families,
      SUM(CASE WHEN f.status = 'MIGRATED_OUT' THEN 1 ELSE 0 END) AS migrated_families,
      SUM(CASE WHEN f.status = 'DIVIDED' THEN 1 ELSE 0 END) AS divided_families
    FROM families f WHERE ${scope}`,
    params
  );

  const [[memberCounts]] = await pool.query(
    `SELECT
      COUNT(*) AS total_souls,
      SUM(CASE WHEN m.gender = 'M' THEN 1 ELSE 0 END) AS male_count,
      SUM(CASE WHEN m.gender = 'F' THEN 1 ELSE 0 END) AS female_count,
      SUM(CASE WHEN m.dob IS NOT NULL AND TIMESTAMPDIFF(YEAR, m.dob, CURDATE()) < 18 THEN 1 ELSE 0 END) AS children_count,
      SUM(CASE WHEN m.marital_status = 'MARRIED' THEN 1 ELSE 0 END) AS married_count,
      SUM(CASE WHEN m.marital_status = 'SINGLE' THEN 1 ELSE 0 END) AS single_count,
      SUM(CASE WHEN m.is_baptised = 1 THEN 1 ELSE 0 END) AS baptised_count,
      SUM(CASE WHEN m.is_confirmed = 1 THEN 1 ELSE 0 END) AS confirmed_count
    FROM family_members m
    JOIN families f ON f.id = m.family_id
    WHERE m.is_deleted = 0 AND ${scope}`,
    params
  );

  const [wardBreakdown] = await pool.query(
    `SELECT
      w.id AS ward_id,
      w.name AS ward_name,
      w.name_ta AS ward_name_ta,
      COUNT(DISTINCT f.id) AS family_count,
      COUNT(DISTINCT m.id) AS member_count
    FROM wards w
    LEFT JOIN families f ON f.ward_id = w.id AND f.is_deleted = 0 AND f.status = 'ACTIVE'
    LEFT JOIN family_members m ON m.family_id = f.id AND m.is_deleted = 0
    WHERE w.is_deleted = 0 ${churchId ? 'AND w.church_id = ?' : ''}
    GROUP BY w.id, w.name, w.name_ta, w.sort_order
    ORDER BY w.sort_order ASC, w.name ASC`,
    churchId ? [churchId] : []
  );

  return {
    families: familyCounts,
    members: memberCounts,
    wards: wardBreakdown,
  };
}

module.exports = {
  list,
  findById,
  getNextFamilyCode,
  create,
  update,
  softDelete,
  getCensusStats,
};
