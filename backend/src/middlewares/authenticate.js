const { hashSessionToken } = require('../utils/sessionToken');
const sessionRepository = require('../repositories/sessionRepository');
const userRepository = require('../repositories/userRepository');
const lookupRepository = require('../repositories/lookupRepository');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');

/**
 * Verifies the `sid` session cookie against the `sessions` table and attaches
 * the resolved user as req.user.
 *
 * Nothing about role/permissions/church/branch is trusted from a token
 * payload -- a session id is just an opaque lookup key -- so every
 * authenticated request re-checks is_active/role_code/permissions/church_id/
 * branch_id fresh against the DB (getAuthStatus is a single indexed PK
 * lookup, cheap at this app's scale). This makes deactivating a user,
 * changing their role, editing a role's permission set, or moving them to a
 * different church/branch all take effect on their very next request, never
 * delayed by a cached claim.
 */
module.exports = async function authenticate(req, res, next) {
  const sessionToken = req.cookies?.[env.session.cookieName];
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
    // Refetched every request (not just when role_id differs from the
    // token's) so an admin editing a ROLE's own permission set -- not just
    // reassigning a user to a different role -- also takes effect right
    // away.
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

    // Sliding expiration -- an active session is extended on every request
    // rather than expiring on a fixed clock, so it never dies mid-use; a
    // genuinely idle one still does once this new expiry itself passes.
    const newExpiresAt = new Date(Date.now() + env.session.expiresInDays * 24 * 60 * 60 * 1000);
    await sessionRepository.touch(session.id, newExpiresAt);

    // Master Administrator has no home church (church_id/branch_id are NULL
    // on that role's own user row -- see seed.js) and instead acts as
    // whichever church/branch it selects via Settings > Change Church &
    // Branch. The frontend sends that choice as headers on every request;
    // re-validated here rather than trusted blindly, and never even looked
    // at for any other role -- a non-master-admin's churchId/branchId always
    // stay exactly what's on their own row, headers or not.
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
      // Unlike Master Administrator, an ADMIN's church is fixed (their own
      // home church, from their own row) -- only WHICH BRANCH of that
      // church they're currently viewing is switchable, via Settings >
      // Change Branch. Defaults to null ("All branches" -- this role's
      // traditional unrestricted view, see utils/effectiveScope.js) rather
      // than the home branch_id on their own row, unless the header names
      // one of their own church's branches; a request naming another
      // church's branch (or one that doesn't exist) is silently ignored.
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
    // A DB hiccup here is an infrastructure failure, not an auth failure --
    // surface it as the standard 500 (see errorHandler.js) rather than
    // mis-reporting it as "invalid session" and locking everyone out on a
    // transient error.
    next(err);
  }
};
