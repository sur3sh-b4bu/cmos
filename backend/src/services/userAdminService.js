const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const userAdminRepository = require('../repositories/userAdminRepository');
const roleRepository = require('../repositories/roleRepository');
const lookupRepository = require('../repositories/lookupRepository');
const auditService = require('./auditService');
const ApiError = require('../utils/ApiError');

/** A readable random temp password: e.g. "Bright-Falcon-482". Admin relays it to the new user, who must change it on first login. */
function generateTempPassword() {
  const words = ['Bright', 'Swift', 'Golden', 'Quiet', 'Noble', 'Steady', 'Gentle', 'Faithful'];
  const nouns = ['Falcon', 'Harbor', 'Chapel', 'Lantern', 'Meadow', 'Beacon', 'Cedar', 'Summit'];
  const word = words[crypto.randomInt(words.length)];
  const noun = nouns[crypto.randomInt(nouns.length)];
  const digits = crypto.randomInt(100, 999);
  return `${word}-${noun}-${digits}`;
}

/** churchId here is always the requester's EFFECTIVE church -- their own
 * home church for every ordinary role, or whichever church a Master
 * Administrator currently has selected (null while in Central Management).
 * Passed straight into userAdminRepository, which pins a plain admin to
 * only their own church's users; Master Administrator's own reads are
 * otherwise unrestricted (see its addChurchScope) unless narrowed by its
 * Central Management (no church chosen); see list() below. */
function churchScopeFor(req) {
  return { churchId: req.user.churchId, isMasterAdmin: req.user.roleCode === 'MASTER_ADMIN' };
}

/** Resolves role_id -> its role_code and guards against privilege
 * escalation: only an existing Master Administrator may create or promote
 * another one. Returns the resolved role (or null if role_id wasn't part of
 * this payload, e.g. a partial update that doesn't touch role). */
async function resolveAndGuardRole(roleId, req) {
  if (roleId === undefined) return null;
  const role = await roleRepository.getRoleById(roleId);
  if (!role) throw ApiError.badRequest('Invalid role');
  if (role.code === 'MASTER_ADMIN' && req.user.roleCode !== 'MASTER_ADMIN') {
    throw ApiError.forbidden('Only a Master Administrator can grant the Master Administrator role');
  }
  return role;
}

/** A user's branch has to actually belong to their own church -- storing
 * one that doesn't (e.g. church_id=1 with a branch that's really under
 * church_id=2) produced exactly this bug: the header shows a real church
 * name next to a real branch name, but the pairing is nonsense. `null`
 * branchId ("no specific branch") always passes. */
async function validateBranchBelongsToChurch(churchId, branchId) {
  if (!branchId) return;
  if (!churchId) throw ApiError.badRequest('A branch can only be selected once a church is selected.');
  const branch = await lookupRepository.getBranchById(branchId);
  if (!branch || branch.church_id !== churchId) {
    throw ApiError.badRequest('Selected branch does not belong to the selected church.');
  }
}

async function list(query, req) {
  const scope = churchScopeFor(req);
  // A Master Administrator who has entered a church sees THAT church's users, like its own admin does --
  // a brand-new church must not show other churches' people. In Central Management (no church chosen)
  // it still sees everyone. Reads and changes by id (getById below) stay unrestricted for it.
  if (scope.isMasterAdmin && scope.churchId) scope.isMasterAdmin = false;
  return userAdminRepository.list(query, scope);
}

async function getById(id, req) {
  const row = await userAdminRepository.getById(id, churchScopeFor(req));
  if (!row) throw ApiError.notFound('User not found');
  return row;
}

async function create(payload, req) {
  const existing = await userAdminRepository.findByUsernameOrEmail(payload.username, payload.email);
  if (existing) {
    throw ApiError.conflict('A user with this username or email already exists.');
  }

  const role = await resolveAndGuardRole(payload.role_id, req);
  const scoped = { ...payload };
  if (role?.code === 'MASTER_ADMIN') {
    // A Master Administrator account has no home church, regardless of
    // whatever the client sent.
    scoped.church_id = null;
    scoped.branch_id = null;
  } else if (req.user.roleCode === 'MASTER_ADMIN') {
    // Master Administrator's own New User form offers every church (its
    // `churches` list is deliberately unscoped -- see
    // genericMasterRepository's addChurchScope), so respect whichever one
    // it explicitly picked; only fall back to the current switcher
    // selection if the payload somehow omitted one.
    scoped.church_id = payload.church_id || req.user.churchId;
    scoped.branch_id = payload.branch_id || null;
  } else {
    // Plain admin: always pinned to their own church, never whatever the
    // client sent -- prevents planting a user into another church via
    // payload tampering.
    scoped.church_id = req.user.churchId;
    scoped.branch_id = payload.branch_id || null;
  }
  if (!scoped.church_id) {
    // Only a MASTER_ADMIN target may have no church. A plain admin always
    // has one; this only ever trips for Master Administrator in Central
    // Management creating a non-master-admin user without picking a
    // church on the form.
    throw ApiError.badRequest('Select a church for this user');
  }
  await validateBranchBelongsToChurch(scoped.church_id, scoped.branch_id);

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);
  const created = await userAdminRepository.create(scoped, passwordHash, req.user.id);

  await auditService.fromRequest(req, {
    action: 'CREATE',
    module: 'users',
    entityType: 'users',
    entityId: created.id,
    newValues: { username: created.username, role_id: created.role_id },
  });

  return { user: created, tempPassword };
}

async function update(id, payload, req) {
  const before = await getById(id, req);
  const role = await resolveAndGuardRole(payload.role_id, req);
  const targetIsMasterAdmin = role ? role.code === 'MASTER_ADMIN' : before.role_code === 'MASTER_ADMIN';

  const scoped = { ...payload };
  if (targetIsMasterAdmin) {
    scoped.church_id = null;
    scoped.branch_id = null;
  } else if (req.user.roleCode !== 'MASTER_ADMIN') {
    // Same rule as create(): a plain admin can never change church_id via
    // the client, only pinned to their own effective church.
    scoped.church_id = req.user.churchId;
  }
  // Else: Master Administrator editing a non-master-admin user -- its own
  // reads (getById above) are unrestricted across every church (see
  // userAdminRepository's addChurchScope), so there's nothing to force
  // here; an explicit church_id in the payload (if any) is respected
  // as-is, same as create().

  if (!targetIsMasterAdmin) {
    // Validate the EFFECTIVE final church/branch, not just whatever this
    // partial payload touched -- e.g. changing church_id alone (without
    // also clearing/reassigning branch_id) must be caught if the user's
    // existing branch belongs to the church being moved away from.
    const effectiveChurchId = 'church_id' in scoped ? scoped.church_id : before.church_id;
    const effectiveBranchId = 'branch_id' in scoped ? scoped.branch_id : before.branch_id;
    if (!effectiveChurchId) {
      throw ApiError.badRequest('Select a church for this user');
    }
    await validateBranchBelongsToChurch(effectiveChurchId, effectiveBranchId);
  }

  const updated = await userAdminRepository.update(id, scoped, req.user.id);

  await auditService.fromRequest(req, {
    action: 'UPDATE',
    module: 'users',
    entityType: 'users',
    entityId: id,
    oldValues: { full_name: before.full_name, role_id: before.role_id },
    newValues: { full_name: updated.full_name, role_id: updated.role_id },
  });
  return updated;
}

async function setActive(id, isActive, req) {
  if (id === req.user.id && !isActive) {
    throw ApiError.badRequest('You cannot deactivate your own account.');
  }
  await getById(id, req);
  await userAdminRepository.setActive(id, isActive, req.user.id);

  await auditService.fromRequest(req, {
    action: isActive ? 'ACTIVATE' : 'DEACTIVATE',
    module: 'users',
    entityType: 'users',
    entityId: id,
  });
}

async function resetPassword(id, req) {
  await getById(id, req);
  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);
  await userAdminRepository.resetPassword(id, passwordHash, req.user.id);

  await auditService.fromRequest(req, {
    action: 'RESET_PASSWORD',
    module: 'users',
    entityType: 'users',
    entityId: id,
  });

  return { tempPassword };
}

module.exports = { list, getById, create, update, setActive, resetPassword, generateTempPassword };
