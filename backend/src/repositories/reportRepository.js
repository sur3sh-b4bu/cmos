const { pool } = require('../config/db');

async function prayerIntentionsReport({ churchId, dateFrom, dateTo, massId, statusId }) {
  const conditions = ['pi.church_id = ?', 'pi.is_deleted = 0'];
  const params = [churchId];
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
  if (statusId) {
    conditions.push('pi.status_id = ?');
    params.push(statusId);
  }
  const where = `WHERE ${conditions.join(' AND ')}`;

  const [rows] = await pool.query(
    `SELECT pi.id, pi.receipt_no, pi.prayer_date, pi.name, pi.phone, pi.offering_amount,
            m.name AS mass_name, s.label AS status_label, s.color AS status_color,
            COALESCE(pim.name, pi.custom_intention) AS intention
     FROM prayer_intentions pi
     JOIN masses m ON m.id = pi.mass_id
     JOIN statuses s ON s.id = pi.status_id
     LEFT JOIN prayer_intention_master pim ON pim.id = pi.prayer_intention_master_id AND pim.is_custom = 0
     ${where}
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

async function collectionsReport({ churchId, dateFrom, dateTo, paymentMethodId }) {
  const conditions = ['pi.church_id = ?', 'pi.is_deleted = 0'];
  const params = [churchId];
  if (dateFrom) {
    conditions.push('pi.prayer_date >= ?');
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push('pi.prayer_date <= ?');
    params.push(dateTo);
  }
  if (paymentMethodId) {
    conditions.push('pi.payment_method_id = ?');
    params.push(paymentMethodId);
  }
  const where = `WHERE ${conditions.join(' AND ')}`;

  const [byDay] = await pool.query(
    `SELECT pi.prayer_date AS date, COALESCE(SUM(pi.offering_amount),0) AS total, COUNT(*) AS count
     FROM prayer_intentions pi ${where}
     GROUP BY pi.prayer_date
     ORDER BY pi.prayer_date ASC`,
    params
  );

  const [byPaymentMethod] = await pool.query(
    `SELECT COALESCE(pm.name, 'Not specified') AS method, COALESCE(SUM(pi.offering_amount),0) AS total, COUNT(*) AS count
     FROM prayer_intentions pi
     LEFT JOIN payment_methods pm ON pm.id = pi.payment_method_id
     ${where}
     GROUP BY pm.id, pm.name
     ORDER BY total DESC`,
    params
  );

  const [[summary]] = await pool.query(
    `SELECT COUNT(*) AS totalCount, COALESCE(SUM(pi.offering_amount),0) AS totalOffering
     FROM prayer_intentions pi ${where}`,
    params
  );

  return {
    byDay: byDay.map((r) => ({ date: r.date, total: Number(r.total), count: r.count })),
    byPaymentMethod: byPaymentMethod.map((r) => ({ method: r.method, total: Number(r.total), count: r.count })),
    summary: { totalCount: summary.totalCount, totalOffering: Number(summary.totalOffering) },
  };
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
};

async function certificatesReport({ churchId, type, dateFrom, dateTo }) {
  const types = type && type !== 'all' ? [type] : Object.keys(CERT_TABLES);
  const results = [];

  for (const t of types) {
    const cfg = CERT_TABLES[t];
    const conditions = ['church_id = ?', 'is_deleted = 0'];
    const params = [churchId];
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

module.exports = { prayerIntentionsReport, collectionsReport, certificatesReport };
