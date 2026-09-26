const ApiError = require('../utils/ApiError');

/**
 * Only the Master Administrator may use the routes behind this. Unlike authorize(), a permission code
 * cannot grant access: Central Management shows every church at once, which no per-church role may see.
 */
module.exports = function masterAdminOnly(req, res, next) {
  if (!req.user || req.user.roleCode !== 'MASTER_ADMIN') {
    return next(ApiError.forbidden('Central Management is available to the Master Administrator only.'));
  }
  return next();
};
