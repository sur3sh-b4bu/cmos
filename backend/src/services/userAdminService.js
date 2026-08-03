const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const userAdminRepository = require('../repositories/userAdminRepository');
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

async function list(query, req) {
  return userAdminRepository.list(query);
}

async function getById(id, req) {
  const row = await userAdminRepository.getById(id);
  if (!row) throw ApiError.notFound('User not found');
  return row;
}

async function create(payload, req) {
  const existing = await userAdminRepository.findByUsernameOrEmail(payload.username, payload.email);
  if (existing) {
    throw ApiError.conflict('A user with this username or email already exists.');
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);
  const created = await userAdminRepository.create(payload, passwordHash, req.user.id);

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
  const updated = await userAdminRepository.update(id, payload, req.user.id);

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

module.exports = { list, getById, create, update, setActive, resetPassword };
