const ApiError = require('../utils/ApiError');

/**
 * Guards routes that assume a church is always present. A no-op for every
 * role except Master Administrator while it's in "Central Management"
 * (churchId null -- see authenticate.js and the frontend's
 * AuthService.useCentralManagement()) rather than acting as an actual
 * church via Settings > Change Church & Branch -- everyone else's
 * churchId always comes from their own user row and is never null.
 */
module.exports = function requireChurchContext(req, res, next) {
  if (!req.user?.churchId) {
    return next(ApiError.badRequest('Select a church to continue -- Central Management has no records of its own'));
  }
  next();
};
