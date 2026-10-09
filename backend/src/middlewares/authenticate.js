const { hashSessionToken } = require('../utils/sessionToken');
const sessionRepository = require('../repositories/sessionRepository');
const userRepository = require('../repositories/userRepository');
const lookupRepository = require('../repositories/lookupRepository');
const ApiError = require('../utils/ApiError');

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'sid';
const PERMANENT_EXPIRY_MS = 100 * 365 * 24 * 60 * 60 * 1000;

module.exports = async function authenticate(req, res, next) {
  const sessionToken = req.cookies?.[COOKIE_NAME];
  if (!sessionToken) {
    return next(ApiError.unauthorized('Missing or expired session'));
  }

  try {
    const session = await sessionRepository.findValidByHash(hashSessionToken(sessionToken));
    if (!session) {
      return next(ApiError.unauthorized('Missing or expired session'));
    }

    const status = await userRepository.getAuthStatus(session.user_id);
    if (!status || !status.is_active) {
      return next(ApiError.unauthorized('Account is no longer active'));
    }

    const permissions = await userRepository.getPermissionCodes(status.role_id);
    req.user = {
      id: session.user_id,
      username: status.username,
      roleId: status.role_id,
      roleCode: status.role_code,
      churchId: status.church_id,
      branchId: status.branch_id,
      permissions,
    };

    const newExpiresAt = new Date(Date.now() + PERMANENT_EXPIRY_MS);
    await sessionRepository.touch(session.id, newExpiresAt);

    if (req.user.roleCode === 'MASTER_ADMIN') {
      const churchIdHeader = req.get('x-church-id');
      const branchIdHeader = req.get('x-branch-id');
      req.user.churchId = null;
      req.user.branchId = null;
      if (churchIdHeader) {
        const church = await lookupRepository.getChurchById(Number(churchIdHeader));
        if (church) {
          req.user.churchId = church.id;
          if (branchIdHeader) {
            const branch = await lookupRepository.getBranchById(Number(branchIdHeader));
            if (branch && branch.church_id === church.id) {
              req.user.branchId = branch.id;
            }
          }
        }
      }
    } else if (req.user.roleCode === 'ADMIN') {
      const branchIdHeader = req.get('x-branch-id');
      req.user.branchId = null;
      if (branchIdHeader) {
        const branch = await lookupRepository.getBranchById(Number(branchIdHeader));
        if (branch && branch.church_id === req.user.churchId) {
          req.user.branchId = branch.id;
        }
      }
    }
    next();
  } catch (err) {
    next(err);
  }
};
