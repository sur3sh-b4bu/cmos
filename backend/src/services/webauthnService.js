const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');

const credentialRepository = require('../repositories/credentialRepository');
const userRepository = require('../repositories/userRepository');
const authService = require('./authService');
const auditService = require('./auditService');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');

/**
 * WebAuthn / passkey sign-in, so staff can unlock COMS with Windows Hello,
 * Touch ID or a phone fingerprint sensor instead of retyping a password.
 *
 * The biometric itself never leaves the device -- the sensor unlocks a private
 * key held in the machine's secure hardware, and the server only ever sees a
 * public key and a signature. There is no fingerprint image to store or leak.
 */

const rpID = env.webauthn.rpId;
const rpName = env.webauthn.rpName;
const expectedOrigins = env.webauthn.expectedOrigins;

// ---------------------------------------------------------------- registration

async function getRegistrationOptions(user) {
  const existing = await credentialRepository.listByUserId(user.id);

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: user.username,
    userDisplayName: user.full_name || user.username,
    attestationType: 'none',
    // Stops the same authenticator being enrolled twice for one account.
    excludeCredentials: existing.map((c) => ({
      id: c.credential_id,
      transports: c.transports ? c.transports.split(',') : undefined,
    })),
    authenticatorSelection: {
      // 'platform' = the biometric sensor built into this device, which is the
      // whole point here; a roaming USB key would defeat "just look at it".
      authenticatorAttachment: 'platform',
      residentKey: 'preferred',
      userVerification: 'required',
    },
  });

  await credentialRepository.saveChallenge(String(user.id), 'registration', options.challenge);
  return options;
}

async function verifyRegistration(user, response, deviceLabel, req) {
  const expectedChallenge = await credentialRepository.consumeChallenge(
    String(user.id),
    'registration'
  );
  if (!expectedChallenge) {
    throw ApiError.badRequest('Your setup session expired. Please start again.');
  }

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: expectedOrigins,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
  } catch (err) {
    throw ApiError.badRequest(`Could not register this device: ${err.message}`);
  }

  if (!verification.verified || !verification.registrationInfo) {
    throw ApiError.badRequest('Device registration could not be verified.');
  }

  const { credential } = verification.registrationInfo;

  await credentialRepository.create({
    userId: user.id,
    credentialId: credential.id,
    publicKey: Buffer.from(credential.publicKey),
    counter: credential.counter ?? 0,
    transports: credential.transports?.join(',') || null,
    deviceLabel: deviceLabel || 'This device',
  });

  await auditService.log({
    userId: user.id,
    username: user.username,
    action: 'WEBAUTHN_DEVICE_REGISTERED',
    module: 'auth',
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  return { verified: true };
}

// -------------------------------------------------------------- authentication

async function getAuthenticationOptions(username) {
  const user = await userRepository.findByUsername(username);

  // Deliberately no "unknown user" error: that would turn this endpoint into a
  // username oracle. An account with no passkeys and a non-existent account
  // produce the same response.
  const credentials = user ? await credentialRepository.listByUserId(user.id) : [];

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'required',
    allowCredentials: credentials.map((c) => ({
      id: c.credential_id,
      transports: c.transports ? c.transports.split(',') : undefined,
    })),
  });

  await credentialRepository.saveChallenge(
    username.toLowerCase(),
    'authentication',
    options.challenge
  );

  return { options, hasCredentials: credentials.length > 0 };
}

async function verifyAuthentication(username, response, req) {
  const expectedChallenge = await credentialRepository.consumeChallenge(
    username.toLowerCase(),
    'authentication'
  );
  if (!expectedChallenge) {
    throw ApiError.unauthorized('Your sign-in session expired. Please try again.');
  }

  const stored = await credentialRepository.findByCredentialId(response.id);
  if (!stored) {
    throw ApiError.unauthorized('This device is not registered for sign-in.');
  }

  const user = await userRepository.findByUsername(username);
  // Guards against presenting device A's credential while claiming to be user B.
  if (!user || stored.user_id !== user.id) {
    throw ApiError.unauthorized('This device is not registered for that account.');
  }
  if (!user.is_active) {
    throw ApiError.forbidden('Your account has been deactivated. Contact your administrator.');
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: expectedOrigins,
      expectedRPID: rpID,
      credential: {
        id: stored.credential_id,
        publicKey: new Uint8Array(stored.public_key),
        counter: Number(stored.counter),
        transports: stored.transports ? stored.transports.split(',') : undefined,
      },
      requireUserVerification: true,
    });
  } catch (err) {
    throw ApiError.unauthorized(`Biometric sign-in failed: ${err.message}`);
  }

  if (!verification.verified) {
    throw ApiError.unauthorized('Biometric sign-in could not be verified.');
  }

  await credentialRepository.updateCounter(stored.id, verification.authenticationInfo.newCounter);
  await userRepository.resetLoginAttempts(user.id);

  return authService.issueSessionForUser(user, req, 'LOGIN_SUCCESS_BIOMETRIC');
}

// ------------------------------------------------------------------ management

async function listDevices(userId) {
  const rows = await credentialRepository.listByUserId(userId);
  return rows.map((r) => ({
    id: r.id,
    deviceLabel: r.device_label,
    createdAt: r.created_at,
    lastUsedAt: r.last_used_at,
  }));
}

async function removeDevice(id, user, req) {
  const removed = await credentialRepository.deactivate(id, user.id);
  if (!removed) throw ApiError.notFound('Device not found.');
  await auditService.log({
    userId: user.id,
    username: user.username,
    action: 'WEBAUTHN_DEVICE_REMOVED',
    module: 'auth',
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
}

module.exports = {
  getRegistrationOptions,
  verifyRegistration,
  getAuthenticationOptions,
  verifyAuthentication,
  listDevices,
  removeDevice,
};
