const roleRepository = require('../repositories/roleRepository');
const auditService = require('../services/auditService');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

const listRoles = asyncHandler(async (req, res) => {
  const roles = await roleRepository.listRoles();
  res.json({ success: true, data: roles });
});

const listPermissions = asyncHandler(async (req, res) => {
  const permissions = await roleRepository.listPermissions();
  res.json({ success: true, data: permissions });
});

const getRolePermissions = asyncHandler(async (req, res) => {
  const permissionIds = await roleRepository.getPermissionIdsForRole(req.params.roleId);
  res.json({ success: true, data: permissionIds });
});

const setRolePermissions = asyncHandler(async (req, res) => {
  const { permissionIds } = req.body;
  if (!Array.isArray(permissionIds)) {
    throw ApiError.badRequest('permissionIds must be an array');
  }
  const roles = await roleRepository.listRoles();
  const role = roles.find((r) => String(r.id) === String(req.params.roleId));
  if (role?.is_system_role) {
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

module.exports = { listRoles, listPermissions, getRolePermissions, setRolePermissions };
