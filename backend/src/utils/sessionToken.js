const crypto = require('crypto');

/** Opaque, high-entropy session id. Only its SHA-256 hash is ever persisted
 * (see sessionRepository) -- the plain value lives solely in the httpOnly
 * `sid` cookie, never in the database. */
function generateSessionToken() {
  return crypto.randomBytes(64).toString('hex');
}

function hashSessionToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = { generateSessionToken, hashSessionToken };
