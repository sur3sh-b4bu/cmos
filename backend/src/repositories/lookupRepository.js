const { pool } = require('../config/db');

async function getStatusIdByCode(entityType, code) {
  const [rows] = await pool.query(
    'SELECT id FROM statuses WHERE entity_type = ? AND code = ? AND is_deleted = 0 LIMIT 1',
    [entityType, code]
  );
  if (!rows.length) throw new Error(`Status not found: ${entityType}.${code}`);
  return rows[0].id;
}

async function getChurchById(id) {
  const [rows] = await pool.query('SELECT * FROM churches WHERE id = ? AND is_deleted = 0 LIMIT 1', [id]);
  return rows[0] || null;
}

async function getMassById(id) {
  const [rows] = await pool.query('SELECT * FROM masses WHERE id = ? AND is_deleted = 0 LIMIT 1', [id]);
  return rows[0] || null;
}

async function getPrayerIntentionMasterById(id) {
  const [rows] = await pool.query(
    'SELECT * FROM prayer_intention_master WHERE id = ? AND is_deleted = 0 LIMIT 1',
    [id]
  );
  return rows[0] || null;
}

module.exports = { getStatusIdByCode, getChurchById, getMassById, getPrayerIntentionMasterById };
