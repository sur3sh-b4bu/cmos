const registry = require('../config/certificateRegistry');
const certificateRepository = require('../repositories/certificateRepository');
const receiptSeriesRepository = require('../repositories/receiptSeriesRepository');
const lookupRepository = require('../repositories/lookupRepository');
const auditService = require('./auditService');
const { generateCertificatePdf } = require('../reports/certificatePdf');
const ApiError = require('../utils/ApiError');

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

async function list(type, query, req) {
  const config = resolveConfig(type);
  return certificateRepository.list(config, { ...query, churchId: req.user.churchId });
}

async function getById(type, id, req) {
  const config = resolveConfig(type);
  const row = await certificateRepository.getById(config, id, req.user.churchId);
  if (!row) throw ApiError.notFound('Certificate not found');
  return row;
}

async function create(type, payload, req) {
  const config = resolveConfig(type);
  validateRequired(config, payload);
  const churchId = req.user.churchId;
  const certificateNo = await receiptSeriesRepository.claimNextCertificateNumber(churchId, config.certificateType);
  const created = await certificateRepository.create(config, payload, churchId, certificateNo, req.user.id);

  await auditService.fromRequest(req, {
    action: 'CREATE',
    module: `${type}_certificates`,
    entityType: config.table,
    entityId: created.id,
    newValues: created,
  });
  return created;
}

async function update(type, id, payload, req) {
  const config = resolveConfig(type);
  const before = await getById(type, id, req);
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

async function buildPdf(type, id, req) {
  const config = resolveConfig(type);
  const record = await getById(type, id, req);
  const church = await lookupRepository.getChurchById(req.user.churchId);
  const buffer = await generateCertificatePdf(type, record, church, config.title);

  await auditService.fromRequest(req, {
    action: 'PRINT_CERTIFICATE',
    module: `${type}_certificates`,
    entityType: config.table,
    entityId: id,
  });
  return { buffer, certificateNo: record.certificate_no };
}

module.exports = { list, getById, create, update, remove, buildPdf };
