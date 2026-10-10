/**
 * Simplified Auth Handler
 * Standard Username & Password verification is the primary and direct auth mechanism.
 */

async function getRegistrationOptions(user) {
  return { challenge: 'dummy_challenge' };
}

async function verifyRegistration(user, response, deviceLabel, req) {
  return { verified: true };
}

async function getAuthenticationOptions(username) {
  return { options: {}, hasCredentials: false };
}

async function verifyAuthentication(username, response, req) {
  return { verified: false };
}

async function listDevices(userId) {
  return [];
}

async function removeDevice(id, user, req) {
  return { success: true };
}

module.exports = {
  getRegistrationOptions,
  verifyRegistration,
  getAuthenticationOptions,
  verifyAuthentication,
  listDevices,
  removeDevice,
};
