'use strict';

const crypto = require('crypto');
const massIntentionRepository = require('../repositories/massIntentionRepository');
const lookupRepository = require('../repositories/lookupRepository');
const auditService = require('./auditService');
const { pool } = require('../config/db');
const { emitToChurch } = require('../realtime/socketServer');
const { effectiveBranchId } = require('../utils/effectiveScope');
const { findMatch } = require('../utils/restrictedDates');
const { runImport } = require('../excel/importEngine');
const { buildWorkbookBuffer } = require('../excel/workbookWriter');
const { headingLabel, previewWorkbook } = require('../excel/workbookReader');
const { buildIndex, findRow } = require('../excel/lookups');
const {
  serialResolver,
  serialHint,
  loadReceiptFormat,
  findExistingReceiptNumbers,
  moveReceiptSeriesPast,
  claimUnusedReceiptNumber,
} = require('../excel/serialNumber');
const { buildNotesRows, textFor } = require('../excel/notes');
const { isoDatePart } = require('../excel/dateOnly');
const { MASS_INTENTION_COLUMNS, MASS_INTENTION_SAMPLE, validateMassIntentionRow } = require('../excel/specs/massIntentionSpec');

const normalizeLang = (lang) => (lang === 'ta' ? 'ta' : 'en');
const shortList = (names) => (names.length > 15 ? `${names.slice(0, 15).join(', ')}, ...` : names.join(', '));

async function loadLookups({ churchId, branchId }) {
  const massParams = [churchId];
  let branchClause = '';
  if (branchId) {
    branchClause = ' AND (branch_id = ? OR branch_id IS NULL)';
    massParams.push(branchId);
  }
  const [masses] = await pool.query(
    `SELECT id, name, name_ta, mass_time FROM masses WHERE church_id = ? AND is_deleted = 0${branchClause} ORDER BY id`,
    massParams
  );
  const [intentions] = await pool.query('SELECT id, name, name_ta, is_custom FROM prayer_intention_master WHERE is_deleted = 0 ORDER BY sort_order, id');
  const [paymentMethods] = await pool.query('SELECT id, name, code FROM payment_methods WHERE is_deleted = 0 ORDER BY id');
  const restrictedDates = await lookupRepository.getActiveRestrictedDates(churchId);
  return {
    masses,
    intentions,
    paymentMethods,
    restrictedDates,
    massIndex: buildIndex(masses, (m) => [m.name, m.name_ta]),
    intentionIndex: buildIndex(intentions, (i) => [i.name, i.name_ta]),
    intentionById: new Map(intentions.map((i) => [Number(i.id), i])),
    paymentIndex: buildIndex(paymentMethods, (p) => [p.name, p.code]),
    serialFormat: await loadReceiptFormat(churchId),
    seenInFile: new Map(),
  };
}

const resolvers = {
  serial: serialResolver,
  mass(raw, lookups) {
    const found = findRow(raw, lookups.massIndex);
    if (found.row) return { value: found.row.id };
    if (found.ambiguous) return { error: `More than one Mass is named "${raw}". Rename one under Masters > Masses so it can be told apart.` };
    return { error: `"${raw}" is not a Mass set up for this church. Available: ${shortList(lookups.masses.map((m) => m.name)) || 'none yet (add them under Masters > Masses)'}.` };
  },
  intention(raw, lookups) {
    const found = findRow(raw, lookups.intentionIndex);
    if (found.row) return { value: found.row.id };
    // Not one of the fixed presets -- fall back to the free-text column
    // instead of blocking the row, same reasoning as certificateTransferService.js's
    // `priest` resolver. validateMassIntentionRow already requires either a
    // matched preset or a non-blank custom_intention, so this fallback is
    // what makes an unmatched-but-non-blank intention import cleanly instead
    // of failing that check for a different reason.
    return { value: null, fallback: { key: 'custom_intention', value: raw } };
  },
  paymentMethod(raw, lookups) {
    const found = findRow(raw, lookups.paymentIndex);
    if (found.row) return { value: found.row.id };
    return { error: `"${raw}" is not a Payment Method. Allowed values: ${lookups.paymentMethods.map((p) => p.name).join(', ')}.` };
  },
};

/** Same restricted-date and duplicate protections the single create applies,
 * but scoped to this church and also checked against earlier rows of the file. */
async function validateRowAsync(values, lookups, ctx, { rowNumber }) {
  const errors = [];
  const restricted = findMatch(lookups.restrictedDates, values.prayer_date);
  if (restricted) {
    errors.push({
      field: 'prayer_date',
      message: `Mass Intentions cannot be booked on Restricted Dates. "${restricted.name}" falls on this date.`,
    });
    return errors;
  }

  const signature = [values.name, values.prayer_date, values.mass_id, values.phone || '', values.prayer_intention_master_id || ''].join('|').toLowerCase();
  const earlier = lookups.seenInFile.get(signature);
  if (earlier) {
    errors.push({ field: 'name', message: `Looks like a duplicate of row ${earlier} in this file (same name, date, Mass and intention).` });
    return errors;
  }

  const conditions = ['church_id = ?', 'is_deleted = 0', 'name = ?', 'prayer_date = ?', 'mass_id = ?'];
  const params = [ctx.churchId, values.name, values.prayer_date, values.mass_id];
  if (values.phone) {
    conditions.push('phone = ?');
    params.push(values.phone);
  }
  if (values.prayer_intention_master_id) {
    conditions.push('prayer_intention_master_id = ?');
    params.push(values.prayer_intention_master_id);
  }
  const [rows] = await pool.query(`SELECT receipt_no FROM prayer_intentions WHERE ${conditions.join(' AND ')} LIMIT 1`, params);
  if (rows.length) {
    errors.push({ field: 'name', message: `A mass intention for "${values.name}" on this date and Mass already exists (Receipt ${rows[0].receipt_no}).` });
    return errors;
  }

  lookups.seenInFile.set(signature, rowNumber);
  return errors;
}

function buildSpec() {
  return {
    columns: MASS_INTENTION_COLUMNS,
    resolvers,
    loadLookups,
    validateRow: (values, lookups) => validateMassIntentionRow(values, lookups),
    validateRowAsync,
    findExistingUnique: (ctx, key, numbers) => findExistingReceiptNumbers(ctx.churchId, numbers),
    async insertAll(conn, rows, ctx) {
      const explicit = rows.map((r) => r.values.receipt_no).filter(Boolean);
      const reserved = new Set(explicit.map((n) => n.toLowerCase()));
      await moveReceiptSeriesPast(conn, ctx.churchId, explicit);
      const created = [];
      for (const { values } of rows) {
        // The register's own number (prefix added) when the sheet has one, else the next automatic number.
        const receiptNo = values.receipt_no || (await claimUnusedReceiptNumber(conn, ctx.churchId, reserved));
        created.push(
          await massIntentionRepository.create(
            {
              church_id: ctx.churchId,
              branch_id: ctx.branchId,
              receipt_no: receiptNo,
              public_token: crypto.randomBytes(16).toString('hex'),
              bulk_batch_id: null,
              name: values.name,
              booked_by: values.booked_by,
              phone: values.phone,
              prayer_date: values.prayer_date,
              mass_id: values.mass_id,
              prayer_intention_master_id: values.prayer_intention_master_id,
              custom_intention: values.custom_intention,
              offering_amount: values.offering_amount,
              payment_method_id: values.payment_method_id,
              remarks: values.remarks,
            },
            ctx.userId,
            conn
          )
        );
      }
      return created;
    },
  };
}

/** Imports Mass Intentions. Imported rows are created unpaid. A row's receipt number is the register number in the file
 * with this church's prefix added, or the next automatic number when the file has none. */
async function importMassIntentions({ buffer, fileName, lang, mapping }, req) {
  const ctx = { churchId: req.user.churchId, branchId: req.user.branchId, userId: req.user.id };
  const { report, created } = await runImport({ buffer, fileName, lang: normalizeLang(lang), spec: buildSpec(), ctx, mapping });

  if (created.length) {
    for (const row of created) {
      await auditService.fromRequest(req, { action: 'CREATE', module: 'mass_intentions', entityType: 'mass_intentions', entityId: row.id, newValues: row });
    }
    await auditService.fromRequest(req, {
      action: 'IMPORT',
      module: 'mass_intentions',
      entityType: 'mass_intentions',
      newValues: { file: fileName, imported: report.imported, failed: report.failed },
    });
    emitToChurch(req.user.churchId, 'mass-intentions:changed', { action: 'imported' });
  }
  return report;
}

/** The file's columns and the suggested field matches, for the match-columns step. */
async function previewMassIntentionImport({ buffer, fileName, lang, churchId }) {
  const l = normalizeLang(lang);
  const hints = { receipt_no: serialHint(await loadReceiptFormat(churchId), l) };
  return previewWorkbook(buffer, { columns: MASS_INTENTION_COLUMNS, fileName, lang: l, hints });
}

function writerColumns(lang) {
  return MASS_INTENTION_COLUMNS.map((c) => ({
    header: headingLabel(c, lang),
    key: c.key,
    type: c.type === 'date' ? 'date' : c.type === 'number' ? 'number' : 'text',
  }));
}

/** Every Mass Intention matching the screen's search/filters, as an .xlsx. */
async function exportMassIntentions(query, req) {
  const lang = normalizeLang(query.lang);
  const filters = { ...query };
  ['lang', 'page', 'pageSize'].forEach((key) => delete filters[key]);
  const rows = await massIntentionRepository.listAll({ ...filters, churchId: req.user.churchId, branchId: effectiveBranchId(req) });
  const t = textFor(lang);

  const values = rows.map((row) => {
    const out = {};
    for (const c of MASS_INTENTION_COLUMNS) out[c.key] = row[c.exportKey || c.key];
    out.created_at = isoDatePart(row.created_at);
    out.payment_status = row.is_paid ? t.paid : t.unpaid;
    return out;
  });

  const buffer = await buildWorkbookBuffer({ columns: writerColumns(lang), rows: values });
  return { buffer, count: rows.length, fileName: 'mass-intentions.xlsx' };
}

const NOTES = {
  en: {
    number: ['Receipt No. (S.No / No.)', 'Optional. Give the number from your register - 12, "No. 12" and "RCT0012" all work. Only the number is used and this church\'s prefix is added (12 becomes RCT0012). It must not already be used in this church. Leave it blank to number automatically.'],
    columns: ['Entered Date, Payment Status', 'Filled in by the system. They are shown in an export for reference and are ignored on import: every imported row starts as Unpaid (use Receive Payment afterwards).'],
    mass: ['Mass', 'Must match a Mass set up under Masters > Masses (name).'],
    intention: ['Mass Intention', 'Choose one of the standard intentions. For anything else pick "Others" (or leave it blank) and describe it in "Describe the intention".'],
    phone: ['Phone Number', '10 digits only.'],
    duplicates: ['Duplicates', 'A row that repeats an existing booking (same name, date, Mass and intention) or an earlier row of the file is skipped and reported. Restricted Dates cannot be booked.'],
  },
  ta: {
    number: ['ரசீது எண் (வ.எண் / எண்)', 'விருப்பம். உங்கள் பதிவேட்டில் உள்ள எண்ணைக் கொடுக்கவும் - 12, "எண் 12", "RCT0012" எதுவும் சரி. எண் மட்டுமே எடுத்துக்கொள்ளப்படும்; இந்த சபையின் முன்னொட்டு சேர்க்கப்படும் (12 → RCT0012). இந்த சபையில் ஏற்கனவே பயன்படுத்தப்படாததாக இருக்க வேண்டும். தானாக எண்ணிட காலியாக விடவும்.'],
    columns: ['பதிவு செய்த தேதி, கட்டண நிலை', 'இவை அமைப்பால் நிரப்பப்படுகின்றன. ஏற்றுமதியில் குறிப்புக்காக மட்டும் காட்டப்படும்; இறக்குமதியில் புறக்கணிக்கப்படும்: ஒவ்வொரு வரிசையும் "செலுத்தப்படவில்லை" நிலையில் தொடங்கும்.'],
    mass: ['திருப்பலி', 'Masters > Masses இல் அமைத்துள்ள திருப்பலியின் பெயருடன் பொருந்த வேண்டும்.'],
    intention: ['திருப்பலி நோக்கம்', 'நிலையான நோக்கங்களில் ஒன்றைத் தேர்ந்தெடுக்கவும். வேறு எதற்கும் "Others" தேர்ந்தெடுத்து (அல்லது காலியாக விட்டு) "நோக்கத்தை விவரிக்கவும்" இல் எழுதவும்.'],
    phone: ['தொலைபேசி எண்', '10 இலக்கங்கள் மட்டும்.'],
    duplicates: ['மறுபதிவுகள்', 'ஏற்கனவே உள்ள பதிவை (அதே பெயர், தேதி, திருப்பலி, நோக்கம்) அல்லது கோப்பில் முந்தைய வரிசையை மீண்டும் கொண்ட வரிசை தவிர்க்கப்பட்டு தெரிவிக்கப்படும். தடைசெய்யப்பட்ட தேதிகளில் பதிவு செய்ய முடியாது.'],
  },
};

async function buildMassIntentionTemplate(query, req) {
  const lang = normalizeLang(query.lang);
  const lookups = await loadLookups({ churchId: req.user.churchId, branchId: effectiveBranchId(req) });
  const example = {
    ...MASS_INTENTION_SAMPLE,
    mass_name: lookups.masses[0] ? lookups.masses[0].name : '',
    payment_method_name: (lookups.paymentMethods.find((p) => p.name === 'Cash') || lookups.paymentMethods[0] || {}).name || '',
  };
  example.mass_id = example.mass_name;
  example.payment_method_id = example.payment_method_name;

  const n = NOTES[lang];
  const moduleRows = [
    n.number,
    n.columns,
    n.mass,
    n.intention,
    n.phone,
    [lang === 'ta' ? 'கட்டண முறை' : 'Payment Method', lookups.paymentMethods.map((p) => p.name).join(', ')],
    n.duplicates,
  ];
  const requiredNames = MASS_INTENTION_COLUMNS.filter((c) => c.required && !c.info).map((c) => headingLabel(c, lang)).join(', ');
  const columns = writerColumns(lang);
  const buffer = await buildWorkbookBuffer({
    columns: columns.filter((c) => !MASS_INTENTION_COLUMNS.find((m) => m.key === c.key).info),
    rows: [example],
    notes: { title: textFor(lang).sheet, rows: buildNotesRows(lang, { requiredNames, moduleRows }) },
  });
  return { buffer, fileName: 'mass-intentions-import-template.xlsx' };
}

module.exports = { importMassIntentions, previewMassIntentionImport, exportMassIntentions, buildMassIntentionTemplate };
