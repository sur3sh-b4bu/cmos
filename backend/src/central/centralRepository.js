'use strict';

/**
 * Cross-church aggregation for Central Management. Every function answers one question with one
 * grouped query over a date range -- nothing is loaded row by row -- and follows the same
 * definitions as the existing Reports (reportRepository.js):
 *   - Mass Intentions and register activity count by the Mass DATE (prayer_date);
 *   - money is money RECEIVED: a successful payment, counted on its payment_date;
 *   - a certificate counts on the date of the event it records (baptism, marriage, death).
 * Optional church and branch scopes narrow every query the same way (a branch also includes rows
 * with no branch of their own, i.e. church-wide ones -- see utils/effectiveScope.js).
 */

const { pool } = require('../config/db');

// STRAIGHT_JOIN on the money sources: drive from the payments in the date range (an index range scan) and look
// each contribution/booking up by primary key. Left to itself the optimizer starts from ALL of a church's
// contributions instead, which is ~20x slower once one church has a couple of hundred thousand.
const SOURCES = {
  intentions: {
    from: 'prayer_intentions pi',
    church: 'pi.church_id',
    branch: 'pi.branch_id',
    date: 'pi.prayer_date',
    created: 'pi.created_at',
    where: ['pi.is_deleted = 0', 'COALESCE(pi.is_refunded, 0) = 0'],
  },
  offerings: {
    from: 'payment_transactions pt STRAIGHT_JOIN prayer_intentions pi ON pi.id = pt.prayer_intention_id',
    church: 'pi.church_id',
    branch: 'pi.branch_id',
    date: 'pt.payment_date',
    where: ['pi.is_deleted = 0', 'COALESCE(pi.is_refunded, 0) = 0', "pt.status = 'success'"],
    amount: 'pt.amount',
  },
  contributions: {
    from: 'contribution_payment_transactions cpt STRAIGHT_JOIN contributions d ON d.id = cpt.contribution_id',
    church: 'd.church_id',
    branch: 'd.branch_id',
    date: 'cpt.payment_date',
    where: ['d.is_deleted = 0', 'COALESCE(d.is_refunded, 0) = 0', "cpt.status = 'success'"],
    amount: 'cpt.amount',
  },
  baptism: {
    from: 'baptism_certificates c',
    church: 'c.church_id',
    branch: 'c.branch_id',
    date: 'c.date_of_baptism',
    created: 'c.created_at',
    where: ['c.is_deleted = 0'],
  },
  marriage: {
    from: 'marriage_certificates c',
    church: 'c.church_id',
    branch: 'c.branch_id',
    date: 'c.marriage_date',
    created: 'c.created_at',
    where: ['c.is_deleted = 0'],
  },
  death: {
    from: 'death_certificates c',
    church: 'c.church_id',
    branch: 'c.branch_id',
    date: 'c.date_of_death',
    created: 'c.created_at',
    where: ['c.is_deleted = 0'],
  },
};

const num = (v) => (v === null || v === undefined ? 0 : Number(v));

/** WHERE fragments and params for the church/branch scope on a source. */
function scopeClause(src, { churchId, branchId } = {}) {
  const where = [];
  const params = [];
  if (churchId) {
    where.push(`${src.church} = ?`);
    params.push(churchId);
    if (branchId) {
      where.push(`(${src.branch} = ? OR ${src.branch} IS NULL)`);
      params.push(branchId);
    }
  }
  return { where, params };
}

function bucketExpr(dateCol, granularity) {
  if (granularity === 'day') return `DATE_FORMAT(${dateCol}, '%Y-%m-%d')`;
  if (granularity === 'year') return `CAST(YEAR(${dateCol}) AS CHAR)`;
  return `DATE_FORMAT(${dateCol}, '%Y-%m')`;
}

/**
 * count (`n`) and money (`amount`, 0 for sources with no money) of a source over a range.
 * group: 'total' | 'church' | 'bucket' | 'churchBucket' | 'branch' | 'weekday'
 * basis: 'event' (the source's own date) | 'created' (when the record was entered)
 */
async function aggregate(name, { range, scope = {}, group = 'total', granularity = 'month', basis = 'event' }) {
  const src = SOURCES[name];
  const dateCol = basis === 'created' ? `DATE(${src.created})` : src.date;
  const sc = scopeClause(src, scope);
  const bucket = bucketExpr(dateCol, granularity);
  const groups = {
    total: { select: '', by: '' },
    church: { select: `${src.church} AS church_id,`, by: `GROUP BY ${src.church}` },
    bucket: { select: `${bucket} AS bucket,`, by: `GROUP BY ${bucket}` },
    churchBucket: { select: `${src.church} AS church_id, ${bucket} AS bucket,`, by: `GROUP BY ${src.church}, ${bucket}` },
    branch: { select: `${src.church} AS church_id, ${src.branch} AS branch_id,`, by: `GROUP BY ${src.church}, ${src.branch}` },
    weekday: { select: `DAYOFWEEK(${dateCol}) AS dow,`, by: `GROUP BY DAYOFWEEK(${dateCol})` },
  }[group];

  const [rows] = await pool.query(
    `SELECT ${groups.select} COUNT(*) AS n, ${src.amount ? `COALESCE(SUM(${src.amount}), 0)` : '0'} AS amount
     FROM ${src.from}
     WHERE ${[...src.where, `${dateCol} BETWEEN ? AND ?`, ...sc.where].join(' AND ')}
     ${groups.by}`,
    [range.from, range.to, ...sc.params]
  );
  return rows.map((r) => ({ ...r, n: num(r.n), amount: num(r.amount) }));
}

// ------------------------------------------------------------------- churches and branches

async function listChurches({ churchId } = {}) {
  const [rows] = await pool.query(
    `SELECT id, name, name_ta, created_at FROM churches WHERE is_deleted = 0 ${churchId ? 'AND id = ?' : ''} ORDER BY name`,
    churchId ? [churchId] : []
  );
  return rows;
}

async function branchCounts({ churchId } = {}) {
  const [rows] = await pool.query(
    `SELECT church_id, COUNT(*) AS n FROM branches WHERE is_deleted = 0 AND is_active = 1 ${churchId ? 'AND church_id = ?' : ''} GROUP BY church_id`,
    churchId ? [churchId] : []
  );
  return new Map(rows.map((r) => [r.church_id, num(r.n)]));
}

async function listBranches({ churchId } = {}) {
  const [rows] = await pool.query(
    `SELECT id, church_id, name FROM branches WHERE is_deleted = 0 AND is_active = 1 ${churchId ? 'AND church_id = ?' : ''} ORDER BY name`,
    churchId ? [churchId] : []
  );
  return rows;
}

async function newChurchesIn(range) {
  const [[row]] = await pool.query('SELECT COUNT(*) AS n FROM churches WHERE is_deleted = 0 AND DATE(created_at) BETWEEN ? AND ?', [range.from, range.to]);
  return num(row.n);
}

// ------------------------------------------------------------------- Mass Intentions

/** Bookings in the range and how many of them have a successful payment. */
async function intentionsPaidUnpaid({ range, scope, group = 'total' }) {
  const src = SOURCES.intentions;
  const sc = scopeClause(src, scope);
  const byChurch = group === 'church';
  const [rows] = await pool.query(
    `SELECT ${byChurch ? 'pi.church_id AS church_id,' : ''} COUNT(*) AS total,
            COALESCE(SUM(EXISTS(SELECT 1 FROM payment_transactions pt WHERE pt.prayer_intention_id = pi.id AND pt.status = 'success')), 0) AS paid
     FROM prayer_intentions pi
     WHERE ${[...src.where, 'pi.prayer_date BETWEEN ? AND ?', ...sc.where].join(' AND ')}
     ${byChurch ? 'GROUP BY pi.church_id' : ''}`,
    [range.from, range.to, ...sc.params]
  );
  return rows.map((r) => ({ church_id: r.church_id, total: num(r.total), paid: num(r.paid) }));
}

async function intentionTypes({ range, scope }) {
  const src = SOURCES.intentions;
  const sc = scopeClause(src, scope);
  const [rows] = await pool.query(
    `SELECT pim.id AS id, pim.name AS name, pim.name_ta AS name_ta, COUNT(*) AS n
     FROM prayer_intentions pi
     LEFT JOIN prayer_intention_master pim ON pim.id = pi.prayer_intention_master_id
     WHERE ${[...src.where, 'pi.prayer_date BETWEEN ? AND ?', ...sc.where].join(' AND ')}
     GROUP BY pim.id, pim.name, pim.name_ta
     ORDER BY n DESC`,
    [range.from, range.to, ...sc.params]
  );
  return rows.map((r) => ({ id: r.id, name: r.name, name_ta: r.name_ta, n: num(r.n) }));
}

// ------------------------------------------------------------------- Daily Prayer Register

/** Bookings by weekday and time of day of the Mass (morning < 12:00 <= afternoon < 16:00 <= evening). */
async function registerHeat({ range, scope }) {
  const src = SOURCES.intentions;
  const sc = scopeClause(src, scope);
  const [rows] = await pool.query(
    `SELECT DAYOFWEEK(pi.prayer_date) AS dow,
            CASE WHEN m.mass_time < '12:00:00' THEN 'morning' WHEN m.mass_time < '16:00:00' THEN 'afternoon' ELSE 'evening' END AS slot,
            COUNT(*) AS n
     FROM prayer_intentions pi JOIN masses m ON m.id = pi.mass_id
     WHERE ${[...src.where, 'pi.prayer_date BETWEEN ? AND ?', ...sc.where].join(' AND ')}
     GROUP BY DAYOFWEEK(pi.prayer_date), slot`,
    [range.from, range.to, ...sc.params]
  );
  return rows.map((r) => ({ dow: r.dow, slot: r.slot, n: num(r.n) }));
}

async function registerDays({ range, scope }) {
  const src = SOURCES.intentions;
  const sc = scopeClause(src, scope);
  const [[row]] = await pool.query(
    `SELECT COUNT(DISTINCT pi.prayer_date) AS activeDays FROM prayer_intentions pi
     WHERE ${[...src.where, 'pi.prayer_date BETWEEN ? AND ?', ...sc.where].join(' AND ')}`,
    [range.from, range.to, ...sc.params]
  );
  const [peak] = await pool.query(
    `SELECT pi.prayer_date AS date, COUNT(*) AS n FROM prayer_intentions pi
     WHERE ${[...src.where, 'pi.prayer_date BETWEEN ? AND ?', ...sc.where].join(' AND ')}
     GROUP BY pi.prayer_date ORDER BY n DESC, pi.prayer_date DESC LIMIT 1`,
    [range.from, range.to, ...sc.params]
  );
  return { activeDays: num(row.activeDays), peak: peak[0] ? { date: peak[0].date, n: num(peak[0].n) } : null };
}

// ------------------------------------------------------------------- certificates

/** Of the certificates whose event falls in the range, how many were entered within 30 days of it. */
async function certificateTimeliness(name, { range, scope }) {
  const src = SOURCES[name];
  const sc = scopeClause(src, scope);
  const [[row]] = await pool.query(
    `SELECT COUNT(*) AS total, COALESCE(SUM(DATEDIFF(DATE(c.created_at), ${src.date}) <= 30), 0) AS onTime
     FROM ${src.from} WHERE ${[...src.where, `${src.date} BETWEEN ? AND ?`, ...sc.where].join(' AND ')}`,
    [range.from, range.to, ...sc.params]
  );
  return { total: num(row.total), onTime: num(row.onTime) };
}

/** Which month of the year the events fall in (1-12), for seasonality. */
async function certificateSeasonality(name, { range, scope }) {
  const src = SOURCES[name];
  const sc = scopeClause(src, scope);
  const [rows] = await pool.query(
    `SELECT MONTH(${src.date}) AS month, COUNT(*) AS n FROM ${src.from}
     WHERE ${[...src.where, `${src.date} BETWEEN ? AND ?`, ...sc.where].join(' AND ')} GROUP BY MONTH(${src.date})`,
    [range.from, range.to, ...sc.params]
  );
  return rows.map((r) => ({ month: r.month, n: num(r.n) }));
}

/** Age at baptism, in bands. A birth date after the baptism (bad data) counts as under 1. */
async function baptismAgeBands({ range, scope }) {
  const src = SOURCES.baptism;
  const sc = scopeClause(src, scope);
  const [rows] = await pool.query(
    `SELECT band, COUNT(*) AS n FROM (
       SELECT CASE
                WHEN TIMESTAMPDIFF(YEAR, c.date_of_birth, c.date_of_baptism) < 1 THEN 'under1'
                WHEN TIMESTAMPDIFF(YEAR, c.date_of_birth, c.date_of_baptism) <= 5 THEN '1to5'
                WHEN TIMESTAMPDIFF(YEAR, c.date_of_birth, c.date_of_baptism) <= 12 THEN '6to12'
                WHEN TIMESTAMPDIFF(YEAR, c.date_of_birth, c.date_of_baptism) <= 17 THEN '13to17'
                ELSE '18plus' END AS band
       FROM baptism_certificates c
       WHERE ${[...src.where, `${src.date} BETWEEN ? AND ?`, ...sc.where].join(' AND ')}
     ) t GROUP BY band`,
    [range.from, range.to, ...sc.params]
  );
  return rows.map((r) => ({ band: r.band, n: num(r.n) }));
}

async function baptismByGender({ range, scope }) {
  const src = SOURCES.baptism;
  const sc = scopeClause(src, scope);
  const [rows] = await pool.query(
    `SELECT g.name AS name, COUNT(*) AS n FROM baptism_certificates c JOIN genders g ON g.id = c.gender_id
     WHERE ${[...src.where, `${src.date} BETWEEN ? AND ?`, ...sc.where].join(' AND ')} GROUP BY g.id, g.name`,
    [range.from, range.to, ...sc.params]
  );
  return rows.map((r) => ({ name: r.name, n: num(r.n) }));
}

// ------------------------------------------------------------------- Contributions

async function contributionTypes({ range, scope }) {
  const src = SOURCES.contributions;
  const sc = scopeClause(src, scope);
  const [rows] = await pool.query(
    `SELECT dt.code AS code, dt.name AS name, dt.name_ta AS name_ta, COUNT(*) AS n, COALESCE(SUM(cpt.amount), 0) AS amount
     FROM contribution_payment_transactions cpt
     STRAIGHT_JOIN contributions d ON d.id = cpt.contribution_id
     LEFT JOIN contribution_types dt ON dt.id = d.contribution_type_id
     WHERE ${[...src.where, 'cpt.payment_date BETWEEN ? AND ?', ...sc.where].join(' AND ')}
     GROUP BY dt.id, dt.code, dt.name, dt.name_ta
     ORDER BY amount DESC`,
    [range.from, range.to, ...sc.params]
  );
  return rows.map((r) => ({ code: r.code, name: r.name, name_ta: r.name_ta, n: num(r.n), amount: num(r.amount) }));
}

module.exports = {
  aggregate,
  listChurches,
  branchCounts,
  listBranches,
  newChurchesIn,
  intentionsPaidUnpaid,
  intentionTypes,
  registerHeat,
  registerDays,
  certificateTimeliness,
  certificateSeasonality,
  baptismAgeBands,
  baptismByGender,
  contributionTypes,
};
