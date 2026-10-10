'use strict';

const { pool } = require('../config/db');

const BASE_SELECT = `
  SELECT
    m.id,
    m.church_id,
    m.family_id,
    m.first_name,
    m.last_name,
    m.name_ta,
    m.relationship_to_head,
    m.gender,
    m.dob,
    TIMESTAMPDIFF(YEAR, m.dob, CURDATE()) AS age,
    m.phone,
    m.email,
    m.blood_group,
    m.occupation,
    m.education,
    m.marital_status,
    m.is_baptised,
    m.baptism_date,
    m.baptism_certificate_no,
    m.is_communion_received,
    m.communion_date,
    m.is_confirmed,
    m.confirmation_date,
    m.marriage_date,
    m.marriage_certificate_no,
    m.is_alive,
    m.deceased_date,
    m.is_head,
    m.notes,
    m.created_at,
    m.created_by,
    m.updated_at,
    m.updated_by,
    m.is_active,
    m.is_deleted
  FROM family_members m
`;

async function listByFamilyId(familyId, conn = pool) {
  const [rows] = await conn.query(
    `${BASE_SELECT}
     WHERE m.family_id = ? AND m.is_deleted = 0
     ORDER BY m.is_head DESC,
       FIELD(m.relationship_to_head, 'HEAD', 'SPOUSE', 'SON', 'DAUGHTER', 'FATHER', 'MOTHER', 'BROTHER', 'SISTER', 'GRANDFATHER', 'GRANDMOTHER', 'SON_IN_LAW', 'DAUGHTER_IN_LAW', 'GRANDSON', 'GRANDDAUGHTER', 'OTHER'),
       m.dob ASC`,
    [familyId]
  );
  return rows;
}

async function findById(id, conn = pool) {
  const [rows] = await conn.query(`${BASE_SELECT} WHERE m.id = ? AND m.is_deleted = 0`, [id]);
  return rows[0] || null;
}

async function create(data, conn = pool) {
  const [result] = await conn.query(
    `INSERT INTO family_members (
      church_id, family_id, first_name, last_name, name_ta,
      relationship_to_head, gender, dob, phone, email,
      blood_group, occupation, education, marital_status,
      is_baptised, baptism_date, baptism_certificate_no,
      is_communion_received, communion_date,
      is_confirmed, confirmation_date,
      marriage_date, marriage_certificate_no,
      is_alive, deceased_date, is_head, notes, created_by
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      data.church_id,
      data.family_id,
      data.first_name,
      data.last_name || null,
      data.name_ta || null,
      data.relationship_to_head || 'OTHER',
      data.gender || 'M',
      data.dob || null,
      data.phone || null,
      data.email || null,
      data.blood_group || null,
      data.occupation || null,
      data.education || null,
      data.marital_status || 'SINGLE',
      data.is_baptised ? 1 : 0,
      data.baptism_date || null,
      data.baptism_certificate_no || null,
      data.is_communion_received ? 1 : 0,
      data.communion_date || null,
      data.is_confirmed ? 1 : 0,
      data.confirmation_date || null,
      data.marriage_date || null,
      data.marriage_certificate_no || null,
      data.is_alive !== undefined ? (data.is_alive ? 1 : 0) : 1,
      data.deceased_date || null,
      data.is_head ? 1 : 0,
      data.notes || null,
      data.created_by || null,
    ]
  );
  return result.insertId;
}

async function update(id, data, conn = pool) {
  await conn.query(
    `UPDATE family_members SET
      first_name = COALESCE(?, first_name),
      last_name = ?,
      name_ta = ?,
      relationship_to_head = COALESCE(?, relationship_to_head),
      gender = COALESCE(?, gender),
      dob = ?,
      phone = ?,
      email = ?,
      blood_group = ?,
      occupation = ?,
      education = ?,
      marital_status = COALESCE(?, marital_status),
      is_baptised = ?,
      baptism_date = ?,
      baptism_certificate_no = ?,
      is_communion_received = ?,
      communion_date = ?,
      is_confirmed = ?,
      confirmation_date = ?,
      marriage_date = ?,
      marriage_certificate_no = ?,
      is_alive = ?,
      deceased_date = ?,
      is_head = ?,
      notes = ?,
      updated_by = ?
    WHERE id = ? AND is_deleted = 0`,
    [
      data.first_name,
      data.last_name !== undefined ? data.last_name : null,
      data.name_ta !== undefined ? data.name_ta : null,
      data.relationship_to_head,
      data.gender,
      data.dob || null,
      data.phone || null,
      data.email || null,
      data.blood_group || null,
      data.occupation || null,
      data.education || null,
      data.marital_status,
      data.is_baptised ? 1 : 0,
      data.baptism_date || null,
      data.baptism_certificate_no || null,
      data.is_communion_received ? 1 : 0,
      data.communion_date || null,
      data.is_confirmed ? 1 : 0,
      data.confirmation_date || null,
      data.marriage_date || null,
      data.marriage_certificate_no || null,
      data.is_alive !== undefined ? (data.is_alive ? 1 : 0) : 1,
      data.deceased_date || null,
      data.is_head ? 1 : 0,
      data.notes || null,
      data.updated_by || null,
      id,
    ]
  );
}

async function moveToFamily(memberId, targetFamilyId, newRelationship, isHead = 0, conn = pool) {
  await conn.query(
    `UPDATE family_members SET
      family_id = ?,
      relationship_to_head = ?,
      is_head = ?
    WHERE id = ?`,
    [targetFamilyId, newRelationship, isHead ? 1 : 0, memberId]
  );
}

async function softDelete(id, userId, conn = pool) {
  await conn.query(
    'UPDATE family_members SET is_deleted = 1, updated_by = ? WHERE id = ?',
    [userId, id]
  );
}

async function logEvent(churchId, familyId, memberId, eventType, description, detailsJson = null, userId = null, conn = pool) {
  await conn.query(
    `INSERT INTO family_events_history (
      church_id, family_id, member_id, event_type, description, details_json, created_by
    ) VALUES (?,?,?,?,?,?,?)`,
    [churchId, familyId, memberId || null, eventType, description, detailsJson ? JSON.stringify(detailsJson) : null, userId || null]
  );
}

async function getFamilyEvents(familyId, conn = pool) {
  const [rows] = await conn.query(
    `SELECT
      h.id, h.family_id, h.member_id, h.event_type, h.description, h.details_json, h.created_at,
      u.full_name AS created_by_name
    FROM family_events_history h
    LEFT JOIN users u ON u.id = h.created_by
    WHERE h.family_id = ?
    ORDER BY h.created_at DESC`,
    [familyId]
  );
  return rows;
}

module.exports = {
  listByFamilyId,
  findById,
  create,
  update,
  moveToFamily,
  softDelete,
  logEvent,
  getFamilyEvents,
};
