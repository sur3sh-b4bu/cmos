const bcrypt = require('bcryptjs');
const userRepository = require('../repositories/userRepository');
const sessionRepository = require('../repositories/sessionRepository');
const auditService = require('./auditService');
const { generateSessionToken, hashSessionToken } = require('../utils/sessionToken');
const ApiError = require('../utils/ApiError');

// 100 years (effectively permanent / never expires)
const PERMANENT_EXPIRY_MS = 100 * 365 * 24 * 60 * 60 * 1000;

function sanitizeUser(user, permissions) {
  return {
    id: user.id,
    username: user.username,
    fullName: user.full_name,
    email: user.email,
    phone: user.phone,
    roleId: user.role_id,
    roleCode: user.role_code,
    roleName: user.role_name,
    churchId: user.church_id,
    churchName: user.church_name,
    churchNameTa: user.church_name_ta,
    churchLogoUrl: user.church_logo_url,
    churchThemeColor: user.church_theme_color || 'blue',
    branchId: user.branch_id,
    branchName: user.branch_name,
    mustChangePassword: !!user.must_change_password,
    permissions,
  };
}

async function issueSession(userId, req) {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + PERMANENT_EXPIRY_MS);
  await sessionRepository.create({
    userId,
    sessionHash: hashSessionToken(token),
    expiresAt,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  return token;
}

async function login({ username, password }, req) {
  const user = await userRepository.findByUsername(username);
  if (!user) {
    throw ApiError.unauthorized('Invalid username or password');
  }

  if (!user.is_active) {
    throw ApiError.forbidden('Your account has been deactivated. Contact your administrator.');
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatches) {
    await auditService.log({
      userId: user.id,
      username: user.username,
      action: 'LOGIN_FAILED',
      module: 'auth',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    throw ApiError.unauthorized('Invalid username or password');
  }

  await userRepository.resetLoginAttempts(user.id);
  return issueSessionForUser(user, req, 'LOGIN_SUCCESS');
}

/**
 * Issues a session and writes the audit entry for an already-authenticated user.
 */
async function issueSessionForUser(user, req, action = 'LOGIN_SUCCESS') {
  const permissions = await userRepository.getPermissionCodes(user.role_id);
  const sessionToken = await issueSession(user.id, req);

  await auditService.log({
    userId: user.id,
    username: user.username,
    action,
    module: 'auth',
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  return { sessionToken, user: sanitizeUser(user, permissions) };
}

async function logout(sessionTokenPlain) {
  if (!sessionTokenPlain) return;
  const sessionHash = hashSessionToken(sessionTokenPlain);
  const existing = await sessionRepository.findValidByHash(sessionHash);
  if (existing) {
    await sessionRepository.revoke(existing.id);
  }
}

async function changePassword(userId, currentPassword, newPassword) {
  const user = await userRepository.findById(userId);
  if (!user) throw ApiError.notFound('User not found');

  const matches = await bcrypt.compare(currentPassword, user.password_hash);
  if (!matches) throw ApiError.badRequest('Current password is incorrect');

  if (newPassword.length < 8) {
    throw ApiError.badRequest('New password must be at least 8 characters long');
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await userRepository.updatePassword(userId, passwordHash);
  await sessionRepository.revokeAllForUser(userId);
}

module.exports = { login, logout, changePassword, sanitizeUser, issueSessionForUser };
