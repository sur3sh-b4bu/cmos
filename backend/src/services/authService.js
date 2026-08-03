const bcrypt = require('bcryptjs');
const userRepository = require('../repositories/userRepository');
const refreshTokenRepository = require('../repositories/refreshTokenRepository');
const auditService = require('./auditService');
const { signAccessToken, generateRefreshToken, hashRefreshToken } = require('../utils/jwt');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

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
    branchId: user.branch_id,
    mustChangePassword: !!user.must_change_password,
    permissions,
  };
}

async function buildAccessToken(user, permissions) {
  return signAccessToken({
    sub: user.id,
    username: user.username,
    roleId: user.role_id,
    roleCode: user.role_code,
    churchId: user.church_id,
    branchId: user.branch_id,
    permissions,
  });
}

async function issueRefreshToken(userId, req) {
  const token = generateRefreshToken();
  const expiresAt = new Date(Date.now() + env.jwt.refreshExpiresInDays * 24 * 60 * 60 * 1000);
  await refreshTokenRepository.create({
    userId,
    tokenHash: hashRefreshToken(token),
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

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const minutesLeft = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
    throw ApiError.forbidden(`Account locked due to repeated failed logins. Try again in ${minutesLeft} minute(s).`);
  }

  if (!user.is_active) {
    throw ApiError.forbidden('Your account has been deactivated. Contact your administrator.');
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatches) {
    const attempts = user.failed_login_attempts + 1;
    const lockedUntil =
      attempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) : null;
    await userRepository.recordFailedLogin(user.id, attempts, lockedUntil);
    await auditService.log({
      userId: user.id,
      username: user.username,
      action: 'LOGIN_FAILED',
      module: 'auth',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    if (lockedUntil) {
      throw ApiError.forbidden(`Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.`);
    }
    throw ApiError.unauthorized('Invalid username or password');
  }

  await userRepository.resetLoginAttempts(user.id);
  const permissions = await userRepository.getPermissionCodes(user.role_id);
  const accessToken = await buildAccessToken(user, permissions);
  const refreshToken = await issueRefreshToken(user.id, req);

  await auditService.log({
    userId: user.id,
    username: user.username,
    action: 'LOGIN_SUCCESS',
    module: 'auth',
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  return { accessToken, refreshToken, user: sanitizeUser(user, permissions) };
}

async function refresh(refreshTokenPlain, req) {
  if (!refreshTokenPlain) {
    throw ApiError.unauthorized('No refresh token provided');
  }
  const tokenHash = hashRefreshToken(refreshTokenPlain);
  const existing = await refreshTokenRepository.findValidByHash(tokenHash);
  if (!existing) {
    throw ApiError.unauthorized('Refresh token is invalid or has expired. Please log in again.');
  }

  const user = await userRepository.findById(existing.user_id);
  if (!user || !user.is_active) {
    throw ApiError.unauthorized('Account is no longer active');
  }

  const permissions = await userRepository.getPermissionCodes(user.role_id);
  const accessToken = await buildAccessToken(user, permissions);

  // Rotate refresh token: issue a new one and revoke the old, chaining them
  // together so reuse of a revoked token is detectable.
  const newRefreshToken = await issueRefreshToken(user.id, req);
  const newHash = hashRefreshToken(newRefreshToken);
  const [newRow] = await require('../config/db').pool.query(
    'SELECT id FROM refresh_tokens WHERE token_hash = ? LIMIT 1',
    [newHash]
  );
  await refreshTokenRepository.revoke(existing.id, newRow[0]?.id || null);

  return { accessToken, refreshToken: newRefreshToken, user: sanitizeUser(user, permissions) };
}

async function logout(refreshTokenPlain) {
  if (!refreshTokenPlain) return;
  const tokenHash = hashRefreshToken(refreshTokenPlain);
  const existing = await refreshTokenRepository.findValidByHash(tokenHash);
  if (existing) {
    await refreshTokenRepository.revoke(existing.id);
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
  await refreshTokenRepository.revokeAllForUser(userId);
}

module.exports = { login, refresh, logout, changePassword, sanitizeUser };
