const registry = require('../config/certificateRegistry');
const certificateRepository = require('../repositories/certificateRepository');
const receiptSeriesRepository = require('../repositories/receiptSeriesRepository');
const lookupRepository = require('../repositories/lookupRepository');
const auditService = require('./auditService');
const { generateCertificatePdf } = require('../reports/certificatePdf');
const ApiError = require('../utils/ApiError');
const { pool } = require('../config/db');
const { effectiveBranchId } = require('../utils/effectiveScope');
const { getCertificateColumns, columnLabel } = require('../excel/specs/certificateSpec');
const { CERTIFICATE_DATE_RULES, checkDateRules, normalizeDateFields } = require('../validators/businessRules');

/** `{ churchId, branchId }` for every read below -- churchId is always the
 * requester's own church; branchId is null (unrestricted) for ADMIN, else
 * their own home branch (or, for Master Administrator, whichever branch
 * its switcher currently has selected) -- see utils/effectiveScope.js. */
function scopeFor(req) {
  return { churchId: req.user.churchId, branchId: effectiveBranchId(req) };
}

function resolveConfig(type) {
  const config = registry[type];
  if (!config) throw ApiError.notFound(`Unknown certificate type: ${type}`);
  return config;
}

function validateRequired(config, data) {
  const missing = config.required.filter((field) => {
    const value = data[field];
    return value === undefined || value === null || value === '';
  });
  if (missing.length) {
    throw ApiError.badRequest('Missing required field(s)', missing.map((f) => ({ field: f })));
  }
}

/**
 * Server-side business rules for a certificate's dates (the UI mirrors them,
 * but the API is the trust boundary): every date must be a real calendar
 * date -- an unparsable one used to reach MySQL and come back as a 500 --,
 * plus the per-type rules in businessRules.js (e.g. baptism not before birth,
 * birth not in the future). Returns the payload with dates normalised to ISO.
 *
 * On update only the rules touching a field the request actually changes are
 * checked, so fixing a remark on an old record that already breaks a rule
 * isn't blocked by the unrelated old data.
 */
function applyBusinessRules(type, payload, existing = null) {
  const columns = getCertificateColumns(type);
  const labelFor = (field) => columnLabel(columns, field, 'en');
  const dateFields = columns.filter((c) => c.type === 'date').map((c) => c.key);

  const { normalized, errors: dateErrors } = normalizeDateFields(payload, dateFields, labelFor);
  const errors = [...dateErrors];
  if (!errors.length) {
    const touched = (rule) => rule.field in payload || (rule.notBefore && rule.notBefore in payload);
    const rules = (CERTIFICATE_DATE_RULES[type] || []).filter((rule) => !existing || touched(rule));
    errors.push(...checkDateRules(rules, { ...(existing || {}), ...normalized }, labelFor));
  }
  if (errors.length) throw ApiError.badRequest(errors.map((e) => e.message).join(' '));
  return normalized;
}

async function list(type, query, req) {
  const config = resolveConfig(type);
  return certificateRepository.list(config, { ...query, ...scopeFor(req) });
}

async function getById(type, id, req) {
  const config = resolveConfig(type);
  const row = await certificateRepository.getById(config, id, scopeFor(req));
  if (!row) throw ApiError.notFound('Certificate not found');
  return row;
}

async function create(type, rawPayload, req) {
  const config = resolveConfig(type);
  validateRequired(config, rawPayload);
  const payload = applyBusinessRules(type, rawPayload);
  const churchId = req.user.churchId;

  // Claiming the certificate number and inserting the row it belongs to run
  // in ONE transaction -- see massIntentionService.create's identical
  // comment for why (a failed insert would otherwise permanently skip the
  // claimed number instead of rolling it back).
  const conn = await pool.getConnection();
  let created;
  try {
    await conn.beginTransaction();
    const certificateNo = await receiptSeriesRepository.claimNextCertificateNumberOnConn(
      conn,
      churchId,
      config.certificateType
    );
    created = await certificateRepository.create(config, payload, churchId, req.user.branchId, certificateNo, req.user.id, conn);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  await auditService.fromRequest(req, {
    action: 'CREATE',
    module: `${type}_certificates`,
    entityType: config.table,
    entityId: created.id,
    newValues: created,
  });
  return created;
}

async function update(type, id, rawPayload, req) {
  const config = resolveConfig(type);
  const before = await getById(type, id, req);
  const payload = applyBusinessRules(type, rawPayload, before);
  const updated = await certificateRepository.update(config, id, payload, req.user.churchId, req.user.id);

  await auditService.fromRequest(req, {
    action: 'UPDATE',
    module: `${type}_certificates`,
    entityType: config.table,
    entityId: id,
    oldValues: before,
    newValues: updated,
  });
  return updated;
}

async function remove(type, id, req) {
  const config = resolveConfig(type);
  const before = await getById(type, id, req);
  await certificateRepository.softDelete(config, id, req.user.churchId, req.user.id);

  await auditService.fromRequest(req, {
    action: 'DELETE',
    module: `${type}_certificates`,
    entityType: config.table,
    entityId: id,
    oldValues: before,
  });
}

const templateRepo = require('../repositories/certificateTemplateRepository');

async function buildPdf(type, id, req) {
  const config = resolveConfig(type);
  const record = await getById(type, id, req);
  const church = await lookupRepository.getChurchById(req.user.churchId);
  const template = await templateRepo.getTemplate(req.user.churchId, type);
  const buffer = await generateCertificatePdf(type, record, church, template);

  await auditService.fromRequest(req, {
    action: 'PRINT_CERTIFICATE',
    module: `${type}_certificates`,
    entityType: config.table,
    entityId: id,
  });
  return { buffer, certificateNo: record.certificate_no };
}

module.exports = { list, getById, create, update, remove, buildPdf };
