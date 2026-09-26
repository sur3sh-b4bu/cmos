const authService = require('../services/authService');
const webauthnService = require('../services/webauthnService');
const userRepository = require('../repositories/userRepository');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');

// `secure` follows the actual connection rather than NODE_ENV: browsers refuse
// to store a Secure cookie received over plain http://, so tying it to
// production mode would make login silently fail for anyone running a
// production build on a LAN without HTTPS. Behind an HTTPS reverse proxy the
// proxy must send X-Forwarded-Proto (nginx: proxy_set_header
// X-Forwarded-Proto $scheme) for the flag to be set.
function sessionCookieOptions(req) {
  return {
    httpOnly: true,
    secure: req.secure || req.get('x-forwarded-proto') === 'https',
    sameSite: 'strict',
    // The session cookie is the ONLY credential and must ride along with
    // every API request, not just /api/auth.
    path: '/',
    maxAge: env.session.expiresInDays * 24 * 60 * 60 * 1000,
  };
}

const login = asyncHandler(async (req, res) => {
  const { sessionToken, user } = await authService.login(req.body, req);
  res.cookie(env.session.cookieName, sessionToken, sessionCookieOptions(req));
  res.json({ success: true, data: { user } });
});

const logout = asyncHandler(async (req, res) => {
  const incoming = req.cookies?.[env.session.cookieName];
  await authService.logout(incoming);
  res.clearCookie(env.session.cookieName, { path: '/' });
  res.json({ success: true, message: 'Logged out successfully' });
});

// The frontend restores its whole session from this on every page load (see
// AuthService.restoreSession), so it must return the SAME full user shape
// login does -- name, role name, church name/logo/theme, branch name -- not
// authenticate.js's slimmer req.user (which also carries a Master
// Administrator's/ADMIN's *switcher-selected* church/branch rather than
// their own home ones). A stripped-down version here made a refreshed
// regular user lose their church/role info and look like a Master
// Administrator, who has no home church.
const me = asyncHandler(async (req, res) => {
  const user = await userRepository.findById(req.user.id);
  res.json({ success: true, data: { user: authService.sanitizeUser(user, req.user.permissions) } });
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  await authService.changePassword(req.user.id, currentPassword, newPassword);
  res.json({ success: true, message: 'Password changed successfully. Please log in again.' });
});

// ------------------------------------------------- WebAuthn (biometric) login

const webauthnRegisterOptions = asyncHandler(async (req, res) => {
  const user = await userRepository.findById(req.user.id);
  const options = await webauthnService.getRegistrationOptions(user);
  res.json({ success: true, data: options });
});

const webauthnRegisterVerify = asyncHandler(async (req, res) => {
  const user = await userRepository.findById(req.user.id);
  const result = await webauthnService.verifyRegistration(
    user,
    req.body.response,
    req.body.deviceLabel,
    req
  );
  res.json({ success: true, data: result, message: 'Biometric sign-in enabled for this device.' });
});

const webauthnLoginOptions = asyncHandler(async (req, res) => {
  const { username } = req.body;
  if (!username || typeof username !== 'string') {
    throw ApiError.badRequest('Enter your username first.');
  }
  const { options, hasCredentials } = await webauthnService.getAuthenticationOptions(username);
  res.json({ success: true, data: { options, hasCredentials } });
});

const webauthnLoginVerify = asyncHandler(async (req, res) => {
  const { username, response } = req.body;
  if (!username || !response) throw ApiError.badRequest('Incomplete sign-in request.');
  const { sessionToken, user } = await webauthnService.verifyAuthentication(username, response, req);
  res.cookie(env.session.cookieName, sessionToken, sessionCookieOptions(req));
  res.json({ success: true, data: { user } });
});

const webauthnListDevices = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await webauthnService.listDevices(req.user.id) });
});

const webauthnRemoveDevice = asyncHandler(async (req, res) => {
  await webauthnService.removeDevice(req.params.id, req.user, req);
  res.json({ success: true, message: 'Device removed.' });
});

module.exports = {
  login,
  logout,
  me,
  changePassword,
  webauthnRegisterOptions,
  webauthnRegisterVerify,
  webauthnLoginOptions,
  webauthnLoginVerify,
  webauthnListDevices,
  webauthnRemoveDevice,
};
