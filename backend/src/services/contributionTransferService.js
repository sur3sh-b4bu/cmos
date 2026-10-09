'use strict';

const contributionRepository = require('../repositories/contributionRepository');
const auditService = require('./auditService');
const { pool } = require('../config/db');
const { effectiveBranchId } = require('../utils/effectiveScope');
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
const { CONTRIBUTION_COLUMNS, CONTRIBUTION_SAMPLE, validateContributionRow } = require('../excel/specs/contributionSpec');

const normalizeLang = (lang) => (lang === 'ta' ? 'ta' : 'en');

async function loadLookups({ churchId } = {}) {
  const [types] = await pool.query('SELECT id, name, name_ta, code FROM contribution_types WHERE is_deleted = 0 ORDER BY id');
  const [paymentMethods] = await pool.query('SELECT id, name, code FROM payment_methods WHERE is_deleted = 0 ORDER BY id');
  return {
    types,
    paymentMethods,
    typeIndex: buildIndex(types, (t) => [t.name, t.name_ta, t.code]),
    typeById: new Map(types.map((t) => [Number(t.id), t])),
    paymentIndex: buildIndex(paymentMethods, (p) => [p.name, p.code]),
    serialFormat: await loadReceiptFormat(churchId),
  };
}

const resolvers = {
  serial: serialResolver,
  contributionType(raw, lookups) {
    const found = findRow(raw, lookups.typeIndex);
    if (found.row) return { value: found.row.id };
    // Not one of the fixed types -- fall back to the free-text column
    // instead of blocking the row, same reasoning as
    // certificateTransferService.js's `priest` resolver.
    // validateContributionRow already requires either a matched type or a
    // non-blank custom_contribution_type, so this fallback is what makes an
    // unmatched-but-non-blank type import cleanly.
    return { value: null, fallback: { key: 'custom_contribution_type', value: raw } };
  },
  paymentMethod(raw, lookups) {
    const found = findRow(raw, lookups.paymentIndex);
    if (found.row) return { value: found.row.id };
    return { error: `"${raw}" is not a Payment Method. Allowed values: ${lookups.paymentMethods.map((p) => p.name).join(', ')}.` };
  },
};

function buildSpec() {
  return {
    columns: CONTRIBUTION_COLUMNS,
    resolvers,
    loadLookups,
    validateRow: (values, lookups) => validateContributionRow(values, lookups),
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
          await contributionRepository.create(
            {
              church_id: ctx.churchId,
              branch_id: ctx.branchId,
              receipt_no: receiptNo,
              name: values.name,
              phone: values.phone,
              contribution_type_id: values.contribution_type_id,
              custom_contribution_type: values.custom_contribution_type,
              contribution_amount: values.contribution_amount,
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

/** Imports Contributions. Imported rows are created unpaid. A row's receipt number is the register number in the file
 * with this church's prefix added, or the next automatic number when the file has none. */
async function importContributions({ buffer, fileName, lang, mapping }, req) {
  const ctx = { churchId: req.user.churchId, branchId: req.user.branchId, userId: req.user.id };
  const { report, created } = await runImport({ buffer, fileName, lang: normalizeLang(lang), spec: buildSpec(), ctx, mapping });

  if (created.length) {
    for (const row of created) {
      await auditService.fromRequest(req, { action: 'CREATE', module: 'contributions', entityType: 'contributions', entityId: row.id, newValues: row });
    }
    await auditService.fromRequest(req, {
      action: 'IMPORT',
      module: 'contributions',
      entityType: 'contributions',
      newValues: { file: fileName, imported: report.imported, failed: report.failed },
    });
  }
  return report;
}

/** The file's columns and the suggested field matches, for the match-columns step. */
async function previewContributionImport({ buffer, fileName, lang, churchId }) {
  const l = normalizeLang(lang);
  const hints = { receipt_no: serialHint(await loadReceiptFormat(churchId), l) };
  return previewWorkbook(buffer, { columns: CONTRIBUTION_COLUMNS, fileName, lang: l, hints });
}

function writerColumns(lang, { withInfo }) {
  return CONTRIBUTION_COLUMNS.filter((c) => withInfo || !c.info).map((c) => ({
    header: headingLabel(c, lang),
    key: c.key,
    type: c.type === 'date' ? 'date' : c.type === 'number' ? 'number' : 'text',
  }));
}

/** Every Contribution matching the screen's search/filters, as an .xlsx. */
async function exportContributions(query, req) {
  const lang = normalizeLang(query.lang);
  const filters = { ...query };
  ['lang', 'page', 'pageSize'].forEach((key) => delete filters[key]);
  const rows = await contributionRepository.listAll({ ...filters, churchId: req.user.churchId, branchId: effectiveBranchId(req) });
  const t = textFor(lang);

  const values = rows.map((row) => {
    const out = {};
    for (const c of CONTRIBUTION_COLUMNS) out[c.key] = row[c.exportKey || c.key];
    out.created_at = isoDatePart(row.created_at);
    out.payment_status = row.is_paid ? t.paid : t.unpaid;
    return out;
  });

  const buffer = await buildWorkbookBuffer({ columns: writerColumns(lang, { withInfo: true }), rows: values });
  return { buffer, count: rows.length, fileName: 'contributions.xlsx' };
}

const NOTES = {
  en: {
    number: ['Receipt No. (S.No / No.)', 'Optional. Give the number from your register - 12, "No. 12" and "RCT0012" all work. Only the number is used and this church\'s prefix is added (12 becomes RCT0012). It must not already be used in this church. Leave it blank to number automatically.'],
    columns: ['Entered Date, Payment Status', 'Filled in by the system. They are shown in an export for reference and are ignored on import: every imported row starts as Unpaid (use Receive Payment afterwards).'],
    type: ['Contribution Type', 'Choose one of the standard types. For anything else pick "Others" (or leave it blank) and describe it in "Describe the contribution purpose".'],
    phone: ['Phone Number', '10 digits only.'],
  },
  ta: {
    number: ['ரசீது எண் (வ.எண் / எண்)', 'விருப்பம். உங்கள் பதிவேட்டில் உள்ள எண்ணைக் கொடுக்கவும் - 12, "எண் 12", "RCT0012" எதுவும் சரி. எண் மட்டுமே எடுத்துக்கொள்ளப்படும்; இந்த சபையின் முன்னொட்டு சேர்க்கப்படும் (12 → RCT0012). இந்த சபையில் ஏற்கனவே பயன்படுத்தப்படாததாக இருக்க வேண்டும். தானாக எண்ணிட காலியாக விடவும்.'],
    columns: ['பதிவு செய்த தேதி, கட்டண நிலை', 'இவை அமைப்பால் நிரப்பப்படுகின்றன. ஏற்றுமதியில் குறிப்புக்காக மட்டும் காட்டப்படும்; இறக்குமதியில் புறக்கணிக்கப்படும்: ஒவ்வொரு வரிசையும் "செலுத்தப்படவில்லை" நிலையில் தொடங்கும்.'],
    type: ['பங்களிப்பு வகை', 'நிலையான வகைகளில் ஒன்றைத் தேர்ந்தெடுக்கவும். வேறு எதற்கும் "Others" தேர்ந்தெடுத்து (அல்லது காலியாக விட்டு) "பங்களிப்பின் நோக்கத்தை விவரிக்கவும்" இல் எழுதவும்.'],
    phone: ['தொலைபேசி எண்', '10 இலக்கங்கள் மட்டும்.'],
  },
};

async function buildContributionTemplate(query) {
  const lang = normalizeLang(query.lang);
  const lookups = await loadLookups();
  const example = {
    ...CONTRIBUTION_SAMPLE,
    contribution_type_id: '',
    payment_method_id: (lookups.paymentMethods.find((p) => p.name === 'Cash') || lookups.paymentMethods[0] || {}).name || '',
  };

  const n = NOTES[lang];
  const moduleRows = [
    n.number,
    n.columns,
    n.type,
    n.phone,
    [lang === 'ta' ? 'கட்டண முறை' : 'Payment Method', lookups.paymentMethods.map((p) => p.name).join(', ')],
  ];
  const requiredNames = CONTRIBUTION_COLUMNS.filter((c) => c.required && !c.info).map((c) => headingLabel(c, lang)).join(', ');
  const buffer = await buildWorkbookBuffer({
    columns: writerColumns(lang, { withInfo: false }),
    rows: [example],
    notes: { title: textFor(lang).sheet, rows: buildNotesRows(lang, { requiredNames, moduleRows }) },
  });
  return { buffer, fileName: 'contributions-import-template.xlsx' };
}

module.exports = { importContributions, previewContributionImport, exportContributions, buildContributionTemplate };
