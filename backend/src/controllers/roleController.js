const crypto = require('crypto');
const roleRepository = require('../repositories/roleRepository');
const lookupRepository = require('../repositories/lookupRepository');
const auditService = require('../services/auditService');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

function churchScopeFor(req) {
  return { churchId: req.user.churchId, isMasterAdmin: req.user.roleCode === 'MASTER_ADMIN' };
}

/** Roles' `code` keeps its DB-level global UNIQUE KEY (see migration 035),
 * so a custom role's code just needs to never collide with it -- not be
 * human-chosen or church-scoped-unique itself. Slugified from the name for
 * readability in the DB/audit log, plus a random suffix so two churches
 * naming a role identically (or the same church renaming/recreating one)
 * can never collide. */
function generateRoleCode(name) {
  const slug = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `CUSTOM_${slug || 'ROLE'}_${suffix}`;
}

const listRoles = asyncHandler(async (req, res) => {
  const scope = churchScopeFor(req);
  // Inside a church, a Master Administrator sees the shared system roles and THAT church's own custom roles
  // (so a new church does not show other churches' roles); in Central Management it still sees all of them.
  if (scope.isMasterAdmin && scope.churchId) scope.isMasterAdmin = false;
  const roles = await roleRepository.listRoles(scope);
  res.json({ success: true, data: roles });
});

/** A church admin defines its own custom role, always scoped to its own
 * home church -- never a global system role. Master Administrator (whose
 * `church_id` form field, like any Masters form, offers every church --
 * see genericMasterRepository's addChurchScope for why) may instead send
 * an explicit `church_id`, e.g. while in Central Management with no
 * switcher selection; falls back to its current selection if omitted. */
const create = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  if (!name || !String(name).trim()) {
    throw ApiError.badRequest('Role name is required');
  }

  const isMasterAdmin = req.user.roleCode === 'MASTER_ADMIN';
  let churchId = req.user.churchId;
  if (isMasterAdmin && req.body.church_id) {
    const church = await lookupRepository.getChurchById(Number(req.body.church_id));
    if (!church) throw ApiError.badRequest('Invalid church');
    churchId = church.id;
  }
  if (!churchId) {
    throw ApiError.badRequest('Select a church before creating a role');
  }

  const role = await roleRepository.createRole(
    { name: name.trim(), code: generateRoleCode(name), description, churchId },
    req.user.id
  );

  await auditService.fromRequest(req, {
    action: 'CREATE',
    module: 'roles',
    entityType: 'roles',
    entityId: role.id,
    newValues: { name: role.name, church_id: role.church_id },
  });

  res.status(201).json({ success: true, data: role });
});

const listPermissions = asyncHandler(async (req, res) => {
  const permissions = await roleRepository.listPermissions();
  res.json({ success: true, data: permissions });
});

/** A role not visible under this requester's own scope (a different
 * church's custom role, for anyone but Master Administrator) 404s the same
 * way an out-of-scope Masters/Users row does elsewhere in the app, rather
 * than leaking whether it exists. */
async function resolveOwnRole(req) {
  const roles = await roleRepository.listRoles(churchScopeFor(req));
  const role = roles.find((r) => String(r.id) === String(req.params.roleId));
  if (!role) throw ApiError.notFound('Role not found');
  return role;
}

const getRolePermissions = asyncHandler(async (req, res) => {
  await resolveOwnRole(req);
  const permissionIds = await roleRepository.getPermissionIdsForRole(req.params.roleId);
  res.json({ success: true, data: permissionIds });
});

const setRolePermissions = asyncHandler(async (req, res) => {
  const { permissionIds } = req.body;
  if (!Array.isArray(permissionIds)) {
    throw ApiError.badRequest('permissionIds must be an array');
  }
  const role = await resolveOwnRole(req);
  if (role.is_system_role) {
    throw ApiError.forbidden(
      `${role.name} is a protected system role and cannot have its permissions modified, to prevent accidental lockout.`
    );
  }
  await roleRepository.setRolePermissions(req.params.roleId, permissionIds, req.user.id);

  await auditService.fromRequest(req, {
    action: 'UPDATE_PERMISSIONS',
    module: 'roles',
    entityType: 'roles',
    entityId: req.params.roleId,
    newValues: { permissionIds },
  });

  res.json({ success: true, message: 'Permissions updated' });
});

module.exports = { listRoles, create, listPermissions, getRolePermissions, setRolePermissions };
