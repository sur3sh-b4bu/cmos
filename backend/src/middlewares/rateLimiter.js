const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const COOKIE_NAME = env.session?.cookieName || 'sid';
const WINDOW_MS = env.rateLimit?.windowMs || 15 * 60 * 1000;
const MAX_REQUESTS = env.rateLimit?.max || 300;

function keyGenerator(req) {
  return req.cookies?.[COOKIE_NAME] || req.ip;
}

const LOGIN_PATHS = ['/api/auth/login'];
function skip(req) {
  return LOGIN_PATHS.includes(req.originalUrl.split('?')[0]);
}

const apiLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  skip,
  message: { success: false, message: 'Too many requests. Please slow down and try again shortly.' },
});

module.exports = { apiLimiter };
