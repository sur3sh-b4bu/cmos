jest.mock('../repositories/userRepository');
jest.mock('../repositories/sessionRepository');
jest.mock('./auditService');
jest.mock('../utils/sessionToken', () => ({
  generateSessionToken: jest.fn(() => 'plain-session-token'),
  hashSessionToken: jest.fn((plain) => `hash(${plain})`),
}));

const userRepository = require('../repositories/userRepository');
const sessionRepository = require('../repositories/sessionRepository');
const auditService = require('./auditService');
const authService = require('./authService');

function makeReq() {
  return { ip: '127.0.0.1', get: jest.fn(() => 'jest-test-agent') };
}

const ACTIVE_USER = {
  id: 42,
  username: 'jdoe',
  is_active: 1,
  role_id: 3,
  full_name: 'J Doe',
  password_hash: 'hashed',
};

describe('authService.login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects an unknown username without touching sessions', async () => {
    userRepository.findByUsername.mockResolvedValue(null);

    await expect(authService.login({ username: 'ghost', password: 'x' }, makeReq())).rejects.toMatchObject({
      statusCode: 401,
    });
    expect(sessionRepository.create).not.toHaveBeenCalled();
  });

  it('rejects a deactivated account', async () => {
    userRepository.findByUsername.mockResolvedValue({ ...ACTIVE_USER, is_active: 0 });

    await expect(authService.login({ username: 'jdoe', password: 'x' }, makeReq())).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('audit-logs and rejects a wrong password without ever locking the account', async () => {
    const bcrypt = require('bcryptjs');
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);
    userRepository.findByUsername.mockResolvedValue(ACTIVE_USER);

    await expect(authService.login({ username: 'jdoe', password: 'wrong' }, makeReq())).rejects.toMatchObject({
      statusCode: 401,
    });
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'LOGIN_FAILED', userId: 42 }));
    expect(sessionRepository.create).not.toHaveBeenCalled();
  });

  it('issues a session on a correct password and resets login attempts', async () => {
    const bcrypt = require('bcryptjs');
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
    userRepository.findByUsername.mockResolvedValue(ACTIVE_USER);
    userRepository.getPermissionCodes.mockResolvedValue(['dashboard.view']);

    const result = await authService.login({ username: 'jdoe', password: 'right' }, makeReq());

    expect(result.sessionToken).toBe('plain-session-token');
    expect(result.user.id).toBe(42);
    expect(userRepository.resetLoginAttempts).toHaveBeenCalledWith(42);
    expect(sessionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 42, sessionHash: 'hash(plain-session-token)' })
    );
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'LOGIN_SUCCESS', userId: 42 }));
  });
});

describe('authService.logout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('is a no-op with no session token', async () => {
    await authService.logout('');
    expect(sessionRepository.findValidByHash).not.toHaveBeenCalled();
  });

  it('revokes the session matching the given token', async () => {
    sessionRepository.findValidByHash.mockResolvedValue({ id: 5, user_id: 42 });

    await authService.logout('current-token');

    expect(sessionRepository.revoke).toHaveBeenCalledWith(5);
  });

  it('does nothing if the token matches no valid session', async () => {
    sessionRepository.findValidByHash.mockResolvedValue(null);

    await authService.logout('stale-token');

    expect(sessionRepository.revoke).not.toHaveBeenCalled();
  });
});

describe('authService.changePassword', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('revokes every session for the user once the password changes', async () => {
    const bcrypt = require('bcryptjs');
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
    userRepository.findById.mockResolvedValue(ACTIVE_USER);

    await authService.changePassword(42, 'current', 'newpassword1');

    expect(userRepository.updatePassword).toHaveBeenCalledWith(42, expect.any(String));
    expect(sessionRepository.revokeAllForUser).toHaveBeenCalledWith(42);
  });

  it('rejects a wrong current password without revoking anything', async () => {
    const bcrypt = require('bcryptjs');
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);
    userRepository.findById.mockResolvedValue(ACTIVE_USER);

    await expect(authService.changePassword(42, 'wrong', 'newpassword1')).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(sessionRepository.revokeAllForUser).not.toHaveBeenCalled();
  });
});
