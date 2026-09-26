const fs = require('fs');
const path = require('path');
const registry = require('../config/masterRegistry');
const repo = require('../repositories/genericMasterRepository');
const auditService = require('../services/auditService');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { UPLOAD_ROOT } = require('../middlewares/upload');
const { effectiveBranchId } = require('../utils/effectiveScope');

const { isValidPhone, PHONE_MESSAGE } = require('../validators/businessRules');

function resolveConfig(req) {
  const config = registry[req.params.masterKey];
  if (!config) {
    throw ApiError.notFound(`Unknown master table: ${req.params.masterKey}`);
  }
  return config;
}

/** `churchId` is the requester's EFFECTIVE church -- their own home church
 * for every ordinary role, or whichever church a Master Administrator
 * currently has selected (see authenticate.js). `branchId` is their
 * EFFECTIVE branch (see utils/effectiveScope.js) -- null for ADMIN, or for
 * anyone with no branch of their own/selected. Threaded into every
 * genericMasterRepository call so a church-scoped table (see
 * masterRegistry.js's `churchScope`) only ever shows/accepts writes for
 * that church, and a branch-scoped table (`branchScope`) is additionally
 * narrowed to that branch; a table with no matching marker ignores the
 * corresponding field entirely. */
function churchScopeFor(req) {
  return {
    churchId: req.user.churchId,
    branchId: effectiveBranchId(req),
    isMasterAdmin: req.user.roleCode === 'MASTER_ADMIN',
  };
}

function validateRequired(config, data) {
  const missing = config.required.filter((field) => {
    const value = data[field];
    return value === undefined || value === null || value === '';
  });
  if (missing.length) {
    throw ApiError.badRequest('Missing required field(s)', missing.map((f) => ({ field: f })));
  }
  if (data.phone !== undefined && !isValidPhone(data.phone)) {
    throw ApiError.badRequest(PHONE_MESSAGE, [{ field: 'phone', message: PHONE_MESSAGE }]);
  }
}

const listMasterKeys = asyncHandler(async (req, res) => {
  res.json({ success: true, data: Object.keys(registry) });
});

/**
 * A Master Administrator reads every church's masters by default (the Masters screens and the
 * church switcher need that -- see genericMasterRepository.addChurchScope). A data-entry
 * dropdown (a Mass, a Priest) instead sends `scoped=true`: while the Master Administrator is
 * acting as a church, it should offer only THAT church's rows, like it does for the church's own admin.
 */
function readScopeFor(req) {
  const scope = churchScopeFor(req);
  if (req.query.scoped === 'true' && scope.isMasterAdmin && scope.churchId) return { ...scope, isMasterAdmin: false };
  return scope;
}

const list = asyncHandler(async (req, res) => {
  const config = resolveConfig(req);
  const { page, pageSize, search, includeInactive, ...filters } = req.query;
  delete filters.scoped; // a read-mode flag (see readScopeFor), not a column filter
  const result = await repo.list(config, {
    page: page ? Number(page) : 1,
    pageSize: pageSize ? Number(pageSize) : 25,
    search,
    includeInactive: includeInactive === 'true',
    filters,
    churchScope: readScopeFor(req),
  });
  res.json({ success: true, data: result.rows, meta: { total: result.total, page: result.page, pageSize: result.pageSize } });
});

const getById = asyncHandler(async (req, res) => {
  const config = resolveConfig(req);
  const row = await repo.getById(config, req.params.id, churchScopeFor(req));
  if (!row) throw ApiError.notFound('Record not found');
  res.json({ success: true, data: row });
});

const create = asyncHandler(async (req, res) => {
  const config = resolveConfig(req);
  // Creating a brand-new church (the tenant itself, not a row scoped to
  // one) is Master-Administrator-only -- everyone else's `churchScope`
  // already confines them to their own single church row and can't create
  // a second one.
  if (req.params.masterKey === 'churches' && req.user.roleCode !== 'MASTER_ADMIN') {
    throw ApiError.forbidden('Only a Master Administrator can create a new church');
  }
  validateRequired(config, req.body);
  const row = await repo.create(config, req.body, req.user.id, churchScopeFor(req));
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
  const churchScope = churchScopeFor(req);
  const before = await repo.getById(config, req.params.id, churchScope);
  if (!before) throw ApiError.notFound('Record not found');
  if (req.body.phone !== undefined && !isValidPhone(req.body.phone)) {
    throw ApiError.badRequest(PHONE_MESSAGE, [{ field: 'phone', message: PHONE_MESSAGE }]);
  }
  const row = await repo.update(config, req.params.id, req.body, req.user.id, churchScope);
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
  const churchScope = churchScopeFor(req);
  const before = await repo.getById(config, req.params.id, churchScope);
  if (!before) throw ApiError.notFound('Record not found');
  await repo.softDelete(config, req.params.id, req.user.id, churchScope);
  await auditService.fromRequest(req, {
    action: 'DELETE',
    module: 'masters',
    entityType: req.params.masterKey,
    entityId: req.params.id,
    oldValues: before,
  });
  res.json({ success: true, message: 'Record deleted' });
});

const setDefault = asyncHandler(async (req, res) => {
  const config = resolveConfig(req);
  if (!config.hasDefaultFlag) {
    throw ApiError.badRequest('This master table does not support a default row');
  }
  const churchScope = churchScopeFor(req);
  const before = await repo.getById(config, req.params.id, churchScope);
  if (!before) throw ApiError.notFound('Record not found');
  const row = await repo.setDefault(config, req.params.id, req.user.id, churchScope);
  await auditService.fromRequest(req, {
    action: 'SET_DEFAULT',
    module: 'masters',
    entityType: req.params.masterKey,
    entityId: row.id,
    oldValues: { is_default: before.is_default },
    newValues: { is_default: row.is_default },
  });
  res.json({ success: true, data: row });
});

/** Church logo upload -- separate from the generic create/update endpoints
 * because it's multipart, not JSON, and writes a file to disk in addition to
 * the `logo_url` column. See middlewares/upload.js for the multer config. */
const uploadChurchLogo = asyncHandler(async (req, res) => {
  const config = registry.churches;
  const churchScope = churchScopeFor(req);
  const church = await repo.getById(config, req.params.id, churchScope);
  if (!church) {
    if (req.file) fs.unlink(req.file.path, () => {});
    throw ApiError.notFound('Church not found');
  }
  if (!req.file) {
    throw ApiError.badRequest('No logo file uploaded');
  }

  // Best-effort cleanup of the previous logo file -- a missing/already-gone
  // file here must never fail the request, hence the swallowed callback.
  if (church.logo_url) {
    const oldPath = path.join(UPLOAD_ROOT, church.logo_url.replace(/^\/uploads\//, ''));
    fs.unlink(oldPath, () => {});
  }

  const logoUrl = `/uploads/church-logos/${req.file.filename}`;
  const updated = await repo.update(config, req.params.id, { logo_url: logoUrl }, req.user.id, churchScope);

  await auditService.fromRequest(req, {
    action: 'UPDATE',
    module: 'masters',
    entityType: 'churches',
    entityId: updated.id,
    oldValues: { logo_url: church.logo_url },
    newValues: { logo_url: updated.logo_url },
  });

  res.json({ success: true, data: updated });
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
  await repo.reorder(config, orderedIds, req.user.id, churchScopeFor(req));
  await auditService.fromRequest(req, {
    action: 'REORDER',
    module: 'masters',
    entityType: req.params.masterKey,
    newValues: { orderedIds },
  });
  res.json({ success: true, message: 'Order updated' });
});

module.exports = { listMasterKeys, list, getById, create, update, remove, reorder, setDefault, uploadChurchLogo };
