const registry = require('../config/masterRegistry');
const repo = require('../repositories/genericMasterRepository');
const auditService = require('../services/auditService');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

function resolveConfig(req) {
  const config = registry[req.params.masterKey];
  if (!config) {
    throw ApiError.notFound(`Unknown master table: ${req.params.masterKey}`);
  }
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

const listMasterKeys = asyncHandler(async (req, res) => {
  res.json({ success: true, data: Object.keys(registry) });
});

const list = asyncHandler(async (req, res) => {
  const config = resolveConfig(req);
  const { page, pageSize, search, includeInactive, ...filters } = req.query;
  const result = await repo.list(config, {
    page: page ? Number(page) : 1,
    pageSize: pageSize ? Number(pageSize) : 25,
    search,
    includeInactive: includeInactive === 'true',
    filters,
  });
  res.json({ success: true, data: result.rows, meta: { total: result.total, page: result.page, pageSize: result.pageSize } });
});

const getById = asyncHandler(async (req, res) => {
  const config = resolveConfig(req);
  const row = await repo.getById(config, req.params.id);
  if (!row) throw ApiError.notFound('Record not found');
  res.json({ success: true, data: row });
});

const create = asyncHandler(async (req, res) => {
  const config = resolveConfig(req);
  validateRequired(config, req.body);
  const row = await repo.create(config, req.body, req.user.id);
  await auditService.fromRequest(req, {
    action: 'CREATE',
    module: 'masters',
    entityType: req.params.masterKey,
    entityId: row.id,
    newValues: row,
  });
  res.status(201).json({ success: true, data: row });
});

const update = asyncHandler(async (req, res) => {
  const config = resolveConfig(req);
  const before = await repo.getById(config, req.params.id);
  if (!before) throw ApiError.notFound('Record not found');
  const row = await repo.update(config, req.params.id, req.body, req.user.id);
  await auditService.fromRequest(req, {
    action: 'UPDATE',
    module: 'masters',
    entityType: req.params.masterKey,
    entityId: row.id,
    oldValues: before,
    newValues: row,
  });
  res.json({ success: true, data: row });
});

const remove = asyncHandler(async (req, res) => {
  const config = resolveConfig(req);
  const before = await repo.getById(config, req.params.id);
  if (!before) throw ApiError.notFound('Record not found');
  await repo.softDelete(config, req.params.id, req.user.id);
  await auditService.fromRequest(req, {
    action: 'DELETE',
    module: 'masters',
    entityType: req.params.masterKey,
    entityId: req.params.id,
    oldValues: before,
  });
  res.json({ success: true, message: 'Record deleted' });
});

const reorder = asyncHandler(async (req, res) => {
  const config = resolveConfig(req);
  if (!config.hasSortOrder) {
    throw ApiError.badRequest('This master table does not support reordering');
  }
  const { orderedIds } = req.body;
  if (!Array.isArray(orderedIds) || !orderedIds.length) {
    throw ApiError.badRequest('orderedIds must be a non-empty array');
  }
  await repo.reorder(config, orderedIds, req.user.id);
  await auditService.fromRequest(req, {
    action: 'REORDER',
    module: 'masters',
    entityType: req.params.masterKey,
    newValues: { orderedIds },
  });
  res.json({ success: true, message: 'Order updated' });
});

module.exports = { listMasterKeys, list, getById, create, update, remove, reorder };
