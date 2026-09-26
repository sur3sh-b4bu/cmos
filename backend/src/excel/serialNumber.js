'use strict';

/**
 * The register number of an imported row -- the "S.No" / "No." / "Receipt No." / "Certificate No."
 * column that counts the church's intentions, receipts or certificates.
 *
 * A sheet writes that number in every style: 12, "12", "No. 12", "RCT-0012", 12.0. Only the NUMBER
 * matters. It is taken out of the cell and rebuilt as this church's own prefix + the number,
 * zero-padded the way its numbering series pads (12 -> "RCT0012"), so imported records line up
 * with the ones created in the app.
 */

const { pool } = require('../config/db');
const ApiError = require('../utils/ApiError');
const defaults = require('../config/churchDefaults');
const receiptSeriesRepository = require('../repositories/receiptSeriesRepository');

const MAX_SERIAL = 999999999;
const CHUNK = 500;

const { SERIAL_ALIASES } = require('./serialAliases');

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The number inside a cell.
 * @returns {{blank: true} | {number: number} | {error: string}}
 */
function extractSerial(raw, prefix) {
  const text = raw === null || raw === undefined ? '' : String(raw).trim();
  if (!text) return { blank: true };

  // The reader turns a cell Excel auto-detected as a date into DD-MM-YYYY text (see workbookReader.cellToText).
  if (/^\d{2}-\d{2}-\d{4}$/.test(text)) {
    return { error: `"${text}" looks like a date, not a number. Format that column as Number or Text in Excel and try again.` };
  }

  let digits = null;
  if (/^\d+$/.test(text)) digits = text;
  else if (/^\d+\.0+$/.test(text)) digits = text.split('.')[0]; // 12.0
  else if (/^\d+[.,]\d+$/.test(text)) return { error: `"${text}" is not a whole number.` };
  else {
    if (prefix) {
      const m = new RegExp(`^${escapeRegExp(prefix)}[\\s._/-]*(\\d+)$`, 'i').exec(text); // RCT0012, RCT-12
      if (m) digits = m[1];
    }
    if (!digits) {
      const m = /\d+/.exec(text); // "No. 12", "S.No-5", "BAP/0012/2020" -> the first number
      if (m) digits = m[0];
    }
  }
  if (!digits) return { error: `No number found in "${text}". Write the number, for example 12 (the prefix is added automatically).` };

  const number = Number(digits);
  if (number < 1) return { error: `The number must be 1 or more (found "${text}").` };
  if (number > MAX_SERIAL) return { error: `The number "${text}" is too large (the most allowed is ${MAX_SERIAL}).` };
  return { number };
}

/** 12 with prefix "RCT" and padding 4 -> "RCT0012". */
function formatSerial(prefix, padding, number) {
  return `${prefix}${String(number).padStart(padding, '0')}`;
}

// ------------------------------------------------------------ the church's format

/** The prefix and padding the church's active series would give -- or the defaults if it never had one. */
async function loadReceiptFormat(churchId) {
  if (churchId) {
    const [rows] = await pool.query(
      'SELECT prefix, number_padding FROM receipt_series WHERE church_id = ? AND is_active = 1 AND is_deleted = 0 ORDER BY id LIMIT 1',
      [churchId]
    );
    if (rows.length) return { prefix: rows[0].prefix, padding: rows[0].number_padding };
  }
  return { prefix: defaults.RECEIPT_SERIES.prefix, padding: defaults.RECEIPT_SERIES.padding };
}

async function loadCertificateFormat(churchId, certificateType) {
  if (churchId) {
    const [rows] = await pool.query(
      `SELECT prefix, number_padding FROM certificate_series
       WHERE church_id = ? AND certificate_type = ? AND is_active = 1 AND is_deleted = 0 ORDER BY id LIMIT 1`,
      [churchId, certificateType]
    );
    if (rows.length) return { prefix: rows[0].prefix, padding: rows[0].number_padding };
  }
  const d = defaults.CERTIFICATE_SERIES[certificateType] || { prefix: '', padding: 4 };
  return { prefix: d.prefix, padding: d.padding };
}

/**
 * Column resolver for `type: 'serial'` (see importEngine.parseValue). Needs `lookups.serialFormat`
 * = { prefix, padding }. A blank cell never gets here (the engine turns it into null).
 */
function serialResolver(raw, lookups) {
  const { prefix, padding } = lookups.serialFormat;
  const found = extractSerial(raw, prefix);
  if (found.error) return { error: found.error };
  if (found.blank) return { value: null };
  return { value: formatSerial(prefix, padding, found.number) };
}

/** The line shown beside the field in the "Match columns" popup, using the church's real prefix. */
function serialHint(format, lang) {
  const example = formatSerial(format.prefix, format.padding, 12);
  return lang === 'ta'
    ? `எண் மட்டுமே எடுத்துக்கொள்ளப்படும்; சபையின் முன்னொட்டு சேர்க்கப்படும்: 12 → ${example}. காலியாக விட்டால் தானாக எண் இடப்படும்.`
    : `Only the number is used and this church's prefix is added: 12 becomes ${example}. Leave it empty to number automatically.`;
}

// ------------------------------------------------- receipt numbers (Mass Intentions + Contributions)

/**
 * Mass Intentions and Contributions share ONE receipt sequence per church, so a number is "taken"
 * if either table has it. Soft-deleted rows count too: the unique key still holds their number.
 */
async function findExistingReceiptNumbers(churchId, numbers) {
  const existing = new Set();
  for (let i = 0; i < numbers.length; i += CHUNK) {
    const chunk = numbers.slice(i, i + CHUNK);
    const [rows] = await pool.query(
      `SELECT receipt_no FROM prayer_intentions WHERE church_id = ? AND receipt_no IN (?)
       UNION SELECT receipt_no FROM contributions WHERE church_id = ? AND receipt_no IN (?)`,
      [churchId, chunk, churchId, chunk]
    );
    rows.forEach((r) => existing.add(String(r.receipt_no).toLowerCase()));
  }
  return existing;
}

/**
 * Moves the church's receipt series past every imported number, so a number handed out
 * later can never collide with an imported one. Creates the default series first for a church
 * that never had one, so this works for a church nobody set up.
 */
async function moveReceiptSeriesPast(conn, churchId, explicitNumbers) {
  if (!explicitNumbers.length) return;
  const [existing] = await conn.query('SELECT id FROM receipt_series WHERE church_id = ? LIMIT 1', [churchId]);
  if (!existing.length) await receiptSeriesRepository.provisionDefaultReceiptSeriesIfNeverConfigured(conn, churchId);
  const [series] = await conn.query(
    `SELECT id, prefix, next_number FROM receipt_series
     WHERE church_id = ? AND is_active = 1 AND is_deleted = 0 ORDER BY id LIMIT 1 FOR UPDATE`,
    [churchId]
  );
  if (!series.length) return;
  const { id, prefix, next_number: next } = series[0];
  const pattern = new RegExp(`^${escapeRegExp(prefix)}(\\d+)$`, 'i');
  let highest = 0;
  for (const number of explicitNumbers) {
    const m = pattern.exec(number);
    if (m) highest = Math.max(highest, Number(m[1]));
  }
  if (highest >= next) await conn.query('UPDATE receipt_series SET next_number = ? WHERE id = ?', [highest + 1, id]);
}

/** The next automatic receipt number that no imported row and no existing record already uses. */
async function claimUnusedReceiptNumber(conn, churchId, reserved) {
  for (let attempt = 0; attempt < 100000; attempt += 1) {
    const number = await receiptSeriesRepository.claimNextReceiptNumberOnConn(conn, churchId);
    if (reserved.has(number.toLowerCase())) continue;
    const [taken] = await conn.query(
      `SELECT 1 FROM prayer_intentions WHERE church_id = ? AND receipt_no = ?
       UNION SELECT 1 FROM contributions WHERE church_id = ? AND receipt_no = ? LIMIT 1`,
      [churchId, number, churchId, number]
    );
    if (!taken.length) return number;
  }
  throw ApiError.badRequest("Could not find a free receipt number in this church's series. Check Masters > Receipt Series.");
}

module.exports = {
  SERIAL_ALIASES,
  extractSerial,
  formatSerial,
  loadReceiptFormat,
  loadCertificateFormat,
  serialResolver,
  serialHint,
  findExistingReceiptNumbers,
  moveReceiptSeriesPast,
  claimUnusedReceiptNumber,
};
