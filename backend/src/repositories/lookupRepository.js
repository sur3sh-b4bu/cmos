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

async function getBranchById(id) {
  const [rows] = await pool.query('SELECT * FROM branches WHERE id = ? AND is_deleted = 0 LIMIT 1', [id]);
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

/** contribution_types has no is_custom column (unlike prayer_intention_master) --
 * the 'Others' row is identified by its fixed code instead; see
 * contributionService.resolveContributionType(). */
async function getContributionTypeById(id) {
  const [rows] = await pool.query(
    'SELECT * FROM contribution_types WHERE id = ? AND is_deleted = 0 LIMIT 1',
    [id]
  );
  return rows[0] || null;
}

/**
 * Restricted Dates (table name stays `holidays` -- see masterRegistry.js)
 * for a church, including church-agnostic rows (church_id IS NULL). Small,
 * infrequently-changed table, so callers just filter/match in JS rather than
 * pushing recurring-date logic into SQL -- see utils/restrictedDates.js.
 */
async function getActiveRestrictedDates(churchId) {
  const [rows] = await pool.query(
    `SELECT id, name, holiday_date, reason, is_recurring_yearly
     FROM holidays
     WHERE is_deleted = 0 AND is_active = 1 AND (church_id = ? OR church_id IS NULL)`,
    [churchId]
  );
  return rows;
}

/** The application's current default currency (Masters -> Currencies ->
 * Set Default) -- falls back to a plain INR/₹ if, somehow, no row is
 * flagged default (shouldn't happen; see genericMasterRepository's
 * auto-reassignment on delete). Used everywhere a receipt, report, or
 * dashboard needs to format money without hardcoding a symbol. */
async function getDefaultCurrency() {
  const [rows] = await pool.query(
    'SELECT code, symbol, name FROM currencies WHERE is_default = 1 AND is_deleted = 0 LIMIT 1'
  );
  return rows[0] || { code: 'INR', symbol: '₹', name: 'Indian Rupee' };
}

async function getActiveAnnouncements(churchId, { upcomingOnly = true, limit = 5 } = {}) {
  const conditions = ['is_deleted = 0', 'is_active = 1', '(church_id = ? OR church_id IS NULL)'];
  const params = [churchId];
  if (upcomingOnly) {
    // An announcement with no end_date is treated as open-ended (still
    // current), same as always for a 'permanent' one regardless of
    // end_date -- see migration 028; only 'temporary' rows actually expire.
    conditions.push("(status = 'permanent' OR end_date IS NULL OR end_date >= CURDATE())");
  }
  const [rows] = await pool.query(
    `SELECT id, title, body, start_date, end_date, status
     FROM announcements
     WHERE ${conditions.join(' AND ')}
     ORDER BY (start_date IS NULL) ASC, start_date ASC
     LIMIT ?`,
    [...params, limit]
  );
  return rows;
}

module.exports = {
  getStatusIdByCode,
  getChurchById,
  getBranchById,
  getMassById,
  getPrayerIntentionMasterById,
  getContributionTypeById,
  getActiveRestrictedDates,
  getActiveAnnouncements,
  getDefaultCurrency,
};
