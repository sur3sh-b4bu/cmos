'use strict';

const registry = require('../config/certificateRegistry');
const certificateRepository = require('../repositories/certificateRepository');
const receiptSeriesRepository = require('../repositories/receiptSeriesRepository');
const auditService = require('./auditService');
const { pool } = require('../config/db');
const ApiError = require('../utils/ApiError');
const { emitToChurch } = require('../realtime/socketServer');
const { effectiveBranchId } = require('../utils/effectiveScope');
const { runImport } = require('../excel/importEngine');
const { buildWorkbookBuffer } = require('../excel/workbookWriter');
const { headingLabel, previewWorkbook } = require('../excel/workbookReader');
const { buildNotesRows, textFor } = require('../excel/notes');
const { buildIndex, findRow } = require('../excel/lookups');
const { serialResolver, serialHint, loadCertificateFormat } = require('../excel/serialNumber');
const { getCertificateColumns, validateCertificateRow, columnLabel, SAMPLE_ROWS } = require('../excel/specs/certificateSpec');

const CHUNK = 500;

function resolveConfig(type) {
  const config = registry[type];
  if (!config) throw ApiError.notFound(`Unknown certificate type: ${type}`);
  return config;
}

const normalizeLang = (lang) => (lang === 'ta' ? 'ta' : 'en');

// ------------------------------------------------------------------ lookups

async function loadLookups({ churchId }) {
  const [genders] = await pool.query('SELECT id, name, code FROM genders WHERE is_deleted = 0 ORDER BY id');
  const [priests] = await pool.query('SELECT id, name FROM priests WHERE church_id = ? AND is_deleted = 0 ORDER BY id', [churchId]);
  return {
    genders,
    priests,
    genderIndex: buildIndex(genders, (g) => [g.name, g.code]),
    priestIndex: buildIndex(priests, (p) => p.name),
  };
}

// Single letters people naturally type; mapped onto whatever the genders master calls them.
const GENDER_SYNONYMS = { m: 'male', f: 'female' };

const resolvers = {
  serial: serialResolver,
  gender(raw, lookups) {
    const found = findRow(raw, lookups.genderIndex, { synonyms: GENDER_SYNONYMS });
    if (found.row) return { value: found.row.id };
    const allowed = lookups.genders.map((g) => g.name).join(', ');
    const codes = lookups.genders.map((g) => g.code).filter(Boolean).join(', ');
    return { error: `"${raw}" is not an allowed value. Allowed values: ${allowed}${codes ? ` (or ${codes})` : ''}.` };
  },
  priest(raw, lookups) {
    const found = findRow(raw, lookups.priestIndex);
    if (found.row) return { value: found.row.id };
    // The imported priest is register text, not a required foreign-key
    // reference. Keep the value even when the priest is from another church
    // or when multiple local priests share the same name. A unique match is
    // linked opportunistically above; every other case is safely preserved
    // in the free-text column by importEngine.js.
    return { value: null, fallback: { key: 'custom_priest_name', value: raw } };
  },
};

// -------------------------------------------------------------- certificate no.

async function findExistingNumbers({ churchId, config }, numbers) {
  const existing = new Set();
  for (let i = 0; i < numbers.length; i += CHUNK) {
    const chunk = numbers.slice(i, i + CHUNK);
    // Deliberately includes soft-deleted rows: the UNIQUE(church_id, certificate_no)
    // key still counts them, so a deleted certificate still owns its number.
    const [rows] = await pool.query(`SELECT certificate_no FROM ${config.table} WHERE church_id = ? AND certificate_no IN (?)`, [churchId, chunk]);
    rows.forEach((r) => existing.add(String(r.certificate_no).toLowerCase()));
  }
  return existing;
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Moves the church's series past every number imported with the series' own
 * prefix, so numbers generated later can never collide with imported ones. */
async function moveSeriesPast(conn, { churchId, config }, explicitNumbers) {
  if (!explicitNumbers.length) return;
  const [any] = await conn.query('SELECT id FROM certificate_series WHERE church_id = ? AND certificate_type = ? LIMIT 1', [churchId, config.certificateType]);
  if (!any.length) await receiptSeriesRepository.provisionDefaultCertificateSeriesIfNeverConfigured(conn, churchId, config.certificateType);
  const [series] = await conn.query(
    `SELECT id, prefix, next_number FROM certificate_series
     WHERE church_id = ? AND certificate_type = ? AND is_active = 1 AND is_deleted = 0
     ORDER BY id LIMIT 1 FOR UPDATE`,
    [churchId, config.certificateType]
  );
  if (!series.length) return;
  const { id, prefix, next_number: next } = series[0];
  const pattern = new RegExp(`^${escapeRegExp(prefix)}(\\d+)$`, 'i');
  let highest = 0;
  for (const number of explicitNumbers) {
    const m = pattern.exec(number);
    if (m) highest = Math.max(highest, Number(m[1]));
  }
  if (highest >= next) await conn.query('UPDATE certificate_series SET next_number = ? WHERE id = ?', [highest + 1, id]);
}

async function claimUnusedNumber(conn, { churchId, config }, reserved) {
  for (let attempt = 0; attempt < 100000; attempt += 1) {
    const number = await receiptSeriesRepository.claimNextCertificateNumberOnConn(conn, churchId, config.certificateType);
    if (reserved.has(number.toLowerCase())) continue;
    const [taken] = await conn.query(`SELECT 1 FROM ${config.table} WHERE church_id = ? AND certificate_no = ? LIMIT 1`, [churchId, number]);
    if (!taken.length) return number;
  }
  throw ApiError.badRequest('Could not find a free certificate number in this church\'s series. Check Masters > Certificate Series.');
}

// -------------------------------------------------------------------- import

function buildSpec(type, config, columns) {
  return {
    columns,
    resolvers,
    // The church's own prefix and padding for this certificate type, used to turn the sheet's number into a certificate number.
    loadLookups: async (ctx) => ({ ...(await loadLookups(ctx)), serialFormat: await loadCertificateFormat(ctx.churchId, config.certificateType) }),
    validateRow: (values, lookups, { lang, nowMs }) => validateCertificateRow(type, values, columns, lang, nowMs),
    findExistingUnique: (ctx, key, numbers) => findExistingNumbers({ churchId: ctx.churchId, config }, numbers),
    async insertAll(conn, rows, ctx) {
      const scope = { churchId: ctx.churchId, config };
      const explicit = rows.map((r) => r.values.certificate_no).filter(Boolean);
      const reserved = new Set(explicit.map((n) => n.toLowerCase()));
      await moveSeriesPast(conn, scope, explicit);

      const created = [];
      for (const { values } of rows) {
        const number = values.certificate_no || (await claimUnusedNumber(conn, scope, reserved));
        const data = { ...values };
        delete data.certificate_no;
        created.push(await certificateRepository.create(config, data, ctx.churchId, ctx.branchId, number, ctx.userId, conn));
      }
      return created;
    },
  };
}

/**
 * Imports certificates from an uploaded .xlsx (see importEngine.runImport for
 * the row-by-row / one-transaction behaviour). Church and branch come from
 * the signed-in user, never from the file.
 */
async function importCertificates(type, { buffer, fileName, lang, mapping }, req) {
  const config = resolveConfig(type);
  const columns = getCertificateColumns(type);
  const ctx = { churchId: req.user.churchId, branchId: req.user.branchId, userId: req.user.id };

  const { report, created } = await runImport({ buffer, fileName, lang: normalizeLang(lang), spec: buildSpec(type, config, columns), ctx, mapping });

  if (created.length) {
    for (const row of created) {
      await auditService.fromRequest(req, {
        action: 'CREATE',
        module: `${type}_certificates`,
        entityType: config.table,
        entityId: row.id,
        newValues: row,
      });
    }
    await auditService.fromRequest(req, {
      action: 'IMPORT',
      module: `${type}_certificates`,
      entityType: config.table,
      newValues: { file: fileName, imported: report.imported, failed: report.failed },
    });
    emitToChurch(req.user.churchId, 'certificates:changed', { type, action: 'imported' });
  }
  return report;
}

// -------------------------------------------------------------------- export

function writerColumns(columns, lang) {
  return columns.map((c) => ({
    header: headingLabel(c, lang),
    key: c.key,
    type: c.type === 'date' ? 'date' : 'text',
  }));
}

/** Every certificate matching the screen's search/filters, as an .xlsx. */
async function exportCertificates(type, query, req) {
  const config = resolveConfig(type);
  const columns = getCertificateColumns(type);
  const lang = normalizeLang(query.lang);
  // Everything except paging/language is a list filter (search, gender_id, date ranges...).
  const filters = { ...query };
  ['lang', 'page', 'pageSize'].forEach((key) => delete filters[key]);

  const rows = await certificateRepository.listAll(config, {
    ...filters,
    churchId: req.user.churchId,
    branchId: effectiveBranchId(req),
  });

  const values = rows.map((row) => {
    const out = {};
    for (const c of columns) out[c.key] = row[c.exportKey || c.key];
    return out;
  });

  const buffer = await buildWorkbookBuffer({ columns: writerColumns(columns, lang), rows: values });
  return { buffer, count: rows.length, fileName: `${type}-certificates.xlsx` };
}

// ------------------------------------------------------------------ template

const CERTIFICATE_NOTES = {
  en: {
    number: ['Certificate No. (S.No / No.)', "Optional. Give the number from your register - 12, \"No. 12\" and \"BAP0012\" all work. Only the number is used and this church's prefix is added (12 becomes BAP0012). It must not already be used in this church. Leave it blank to number automatically."],
    priest: ['Priest', 'This is a text field. Any priest name is accepted, even if the priest is not listed under this church. A unique match may be linked automatically; unmatched or duplicate names are kept as entered.'],
    rules: ['Rules', 'A date of birth cannot be in the future, and a baptism cannot be before the birth. A marriage or death date cannot be in the future, and a burial cannot be before the death.'],
  },
  ta: {
    number: ['சான்றிதழ் எண் (வ.எண் / எண்)', 'விருப்பம். உங்கள் பதிவேட்டில் உள்ள எண்ணைக் கொடுக்கவும் - 12, "எண் 12", "BAP0012" எதுவும் சரி. எண் மட்டுமே எடுத்துக்கொள்ளப்படும்; இந்த சபையின் முன்னொட்டு சேர்க்கப்படும் (12 → BAP0012). இந்த சபையில் ஏற்கனவே பயன்படுத்தப்படாததாக இருக்க வேண்டும். தானாக எண்ணிட காலியாக விடவும்.'],
    priest: ['குரு', 'Masters > Priests இல் உள்ளபடியே பெயரை எழுதவும். பட்டியலில் இல்லாத குருவுக்கு இதை காலியாக விட்டு "குரு பெயர் (பட்டியலில் இல்லையெனில்)" நெடுவரிசையைப் பயன்படுத்தவும்.'],
    rules: ['விதிகள்', 'பிறந்த தேதி எதிர்காலத்தில் இருக்கக்கூடாது; ஞானஸ்நானம் பிறப்புக்கு முன் இருக்கக்கூடாது. திருமண/இறப்பு தேதி எதிர்காலத்தில் இருக்கக்கூடாது; அடக்கம் இறப்புக்கு முன் இருக்கக்கூடாது.'],
  },
};

async function buildCertificateTemplate(type, query, req) {
  resolveConfig(type);
  const lang = normalizeLang(query.lang);
  const columns = getCertificateColumns(type);
  const lookups = await loadLookups({ churchId: req.user.churchId });
  const notes = CERTIFICATE_NOTES[lang];
  const also = textFor(lang).alsoAccepted;

  const example = { ...SAMPLE_ROWS[type] };
  if (example.gender_id && lookups.genders.length) {
    example.gender_id = (lookups.genders.find((g) => g.name === 'Female') || lookups.genders[0]).name;
  }

  const moduleRows = [notes.number, notes.priest, notes.rules];
  const genderColumn = columns.find((c) => c.type === 'gender');
  if (genderColumn) {
    moduleRows.unshift([columnLabel(columns, genderColumn.key, lang), `${lookups.genders.map((g) => g.name).join(', ')} (M / F ${also})`]);
  }

  const requiredNames = columns.filter((c) => c.required).map((c) => headingLabel(c, lang)).join(', ');
  const buffer = await buildWorkbookBuffer({
    columns: writerColumns(columns, lang),
    rows: [example],
    notes: { title: textFor(lang).sheet, rows: buildNotesRows(lang, { requiredNames, moduleRows }) },
  });
  return { buffer, fileName: `${type}-certificates-import-template.xlsx` };
}

/** The file's columns and the suggested field matches, for the match-columns step. */
async function previewCertificateImport(type, { buffer, fileName, lang, churchId }) {
  const config = resolveConfig(type); // rejects an unknown certificate type
  const l = normalizeLang(lang);
  const hints = { certificate_no: serialHint(await loadCertificateFormat(churchId, config.certificateType), l) };
  return previewWorkbook(buffer, { columns: getCertificateColumns(type), fileName, lang: l, hints });
}

module.exports = { importCertificates, previewCertificateImport, exportCertificates, buildCertificateTemplate };
