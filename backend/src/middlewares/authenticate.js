const { verifyAccessToken } = require('../utils/jwt');
const ApiError = require('../utils/ApiError');

/** Verifies the Bearer access token and attaches the decoded payload as req.user. */
module.exports = function authenticate(req, res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(ApiError.unauthorized('Missing or malformed Authorization header'));
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      username: payload.username,
      roleId: payload.roleId,
      roleCode: payload.roleCode,
      churchId: payload.churchId,
      branchId: payload.branchId,
      permissions: payload.permissions || [],
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(ApiError.unauthorized('Access token expired'));
    }
    next(ApiError.unauthorized('Invalid access token'));
  }
};
