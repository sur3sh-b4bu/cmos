const rateLimit = require('express-rate-limit');
const env = require('../config/env');

/**
 * Keyed by the `sid` session cookie -- i.e. per logged-in device/browser --
 * not by IP. Several staff (or one person on a laptop and a phone) sharing
 * one office network, or the app being reached through a port-forwarding /
 * tunnelling proxy in dev, all make every request look like it comes from
 * the same IP address; keying on the IP then meant one device's heavy use
 * (a big export, a page with several widgets) could trip "Too many
 * requests" for everybody else on that network, no matter which device
 * they tried next. A session cookie is unique per browser login, so this
 * gives each signed-in device its own quota regardless of what's in front
 * of it on the network. Requests with no session yet (login, the public
 * receipt pages) fall back to the IP -- the same thing express-rate-limit
 * would use by default -- since there is no other per-client identity yet.
 */
function keyGenerator(req) {
  return req.cookies?.[env.session.cookieName] || req.ip;
}

// Sign-in attempts (a wrong password, a mistyped username, a rejected
// passkey) must never be blocked by this limiter, on any device, no matter
// how many times someone retries -- the project deliberately has no login
// lockout (see authController.js/authService.js), so this generic
// request-volume limiter shouldn't reintroduce one through the back door.
// `req.originalUrl` (not req.path, which is already relative once this
// middleware is mounted at '/api') always carries the full "/api/..." path,
// so this check doesn't depend on where the middleware happens to be mounted.
const LOGIN_PATHS = ['/api/auth/login', '/api/auth/webauthn/login/options', '/api/auth/webauthn/login/verify'];
function skip(req) {
  return LOGIN_PATHS.includes(req.originalUrl.split('?')[0]);
}

const apiLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  skip,
  message: { success: false, message: 'Too many requests. Please slow down and try again shortly.' },
});

module.exports = { apiLimiter };
