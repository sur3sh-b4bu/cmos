const ApiError = require('../utils/ApiError');

/**
 * RBAC guard. Usage: router.get('/x', authenticate, authorize('prayer_intentions.view'), handler)
 * Pass multiple codes to require ANY of them (e.g. for endpoints shared across roles).
 */
module.exports = function authorize(...permissionCodes) {
  return function authorizeMiddleware(req, res, next) {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }
    // Cross-church superuser -- deliberately not seeded with any
    // role_permissions rows (see seed.js), so its access can never be
    // narrowed by editing Roles & Permissions. Church/branch scoping still
    // applies via requireChurchContext + the church-scoped repositories.
    if (req.user.roleCode === 'MASTER_ADMIN') {
      return next();
    }
    const granted = req.user.permissions || [];
    const hasPermission = permissionCodes.some((code) => granted.includes(code));
    if (!hasPermission) {
      return next(ApiError.forbidden(`Missing required permission: ${permissionCodes.join(' or ')}`));
    }
    next();
  };
};
