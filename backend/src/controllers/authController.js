const authService = require('../services/authService');
const userRepository = require('../repositories/userRepository');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'sid';
const PERMANENT_EXPIRY_MS = 100 * 365 * 24 * 60 * 60 * 1000;

function sessionCookieOptions(req) {
  return {
    httpOnly: true,
    secure: req.secure || req.get('x-forwarded-proto') === 'https',
    sameSite: 'lax',
    path: '/',
    maxAge: PERMANENT_EXPIRY_MS,
  };
}

const login = asyncHandler(async (req, res) => {
  const { sessionToken, user } = await authService.login(req.body, req);
  res.cookie(COOKIE_NAME, sessionToken, sessionCookieOptions(req));
  res.json({ success: true, data: { user } });
});

const logout = asyncHandler(async (req, res) => {
  const incoming = req.cookies?.[COOKIE_NAME];
  await authService.logout(incoming);
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ success: true, message: 'Logged out successfully' });
});

const me = asyncHandler(async (req, res) => {
  const user = await userRepository.findById(req.user.id);
  res.json({ success: true, data: { user: authService.sanitizeUser(user, req.user.permissions) } });
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  await authService.changePassword(req.user.id, currentPassword, newPassword);
  res.json({ success: true, message: 'Password changed successfully. Please log in again.' });
});

module.exports = {
  login,
  logout,
  me,
  changePassword,
};
