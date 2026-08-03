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
    const granted = req.user.permissions || [];
    const hasPermission = permissionCodes.some((code) => granted.includes(code));
    if (!hasPermission) {
      return next(ApiError.forbidden(`Missing required permission: ${permissionCodes.join(' or ')}`));
    }
    next();
  };
};
