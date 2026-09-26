'use strict';

const setupService = require('../services/churchSetupService');
const auditService = require('../services/auditService');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

/** A Master Administrator may set up any church; everyone else only their own. */
function churchIdFor(req) {
  const churchId = Number(req.params.churchId);
  if (!Number.isInteger(churchId) || churchId < 1) throw ApiError.badRequest('Invalid church id');
  if (req.user.roleCode !== 'MASTER_ADMIN' && req.user.churchId !== churchId) {
    throw ApiError.forbidden('You can only set up your own church');
  }
  return churchId;
}

const status = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await setupService.getStatus(churchIdFor(req)) });
});

const apply = asyncHandler(async (req, res) => {
  const churchId = churchIdFor(req);
  // Creating a login is a users action: masters.create alone (which opens this endpoint) is not enough.
  if (req.body.admin && req.user.roleCode !== 'MASTER_ADMIN' && !(req.user.permissions || []).includes('users.create')) {
    throw ApiError.forbidden('Missing required permission: users.create');
  }
  const result = await setupService.apply(churchId, req.body, req.user.id);
  await auditService.fromRequest(req, {
    action: 'SETUP',
    module: 'church_setup',
    entityType: 'churches',
    entityId: churchId,
    newValues: { ...result.created, adminUsername: result.admin ? result.admin.username : undefined }, // never the password
  });
  res.json({ success: true, data: result });
});

module.exports = { status, apply };
