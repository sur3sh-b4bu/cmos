require('dotenv').config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: process.env.PORT || 4000,

  db: {
    host: required('DB_HOST', '127.0.0.1'),
    port: Number(process.env.DB_PORT || 3306),
    user: required('DB_USER', 'root'),
    password: process.env.DB_PASSWORD ?? '',
    database: required('DB_NAME', 'coms_db'),
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  },

  session: {
    // Name of the httpOnly cookie holding the opaque session id -- read by
    // authenticate.js, set/cleared by authController.js. Sharing it here
    // (rather than each file hardcoding its own copy) keeps the two in sync.
    cookieName: 'sid',
    expiresInDays: parseExpiryToDays(process.env.SESSION_EXPIRES_IN || '7d'),
  },

  cors: {
    // Comma-separated so the office machine can serve both localhost (staff at
    // the desk) and its LAN address (phones scanning a receipt QR).
    origin: (process.env.CORS_ORIGIN || 'http://localhost:4200')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  },

  // Base URL the receipt QR code points at. Must be an address a parishioner's
  // PHONE can reach -- `localhost` works for desk testing but has to become the
  // machine's LAN address or public hostname for real scanning to work.
  publicAppUrl: (process.env.PUBLIC_APP_URL || 'http://localhost:4200').replace(/\/+$/, ''),

  webauthn: {
    // rpId must be the site's registrable domain (no scheme, no port). Browsers
    // reject a mismatch outright, and a credential is permanently bound to the
    // rpId it was created under -- changing this invalidates existing passkeys.
    rpId: process.env.WEBAUTHN_RP_ID || 'localhost',
    rpName: process.env.WEBAUTHN_RP_NAME || 'Church Office Management System',
    // Every origin allowed to present an assertion, comma-separated.
    expectedOrigins: (process.env.WEBAUTHN_ORIGIN || 'http://localhost:4200')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  },

  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
    max: Number(process.env.RATE_LIMIT_MAX || 300),
  },

  payment: {
    // 'mock' | 'upi_direct' | unset (auto -- see payments/index.js).
    // TODO(real gateway): once integrated, this becomes 'razorpay' / 'cashfree' / etc.
    provider: process.env.PAYMENT_PROVIDER || null,
  },
};

function parseExpiryToDays(value) {
  const match = /^(\d+)d$/.exec(value.trim());
  return match ? Number(match[1]) : 7;
}
