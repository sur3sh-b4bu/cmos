jest.mock('../repositories/userRepository');
jest.mock('../repositories/lookupRepository');
jest.mock('../repositories/sessionRepository');
jest.mock('../utils/sessionToken', () => ({ hashSessionToken: jest.fn((plain) => `hash(${plain})`) }));

const userRepository = require('../repositories/userRepository');
const lookupRepository = require('../repositories/lookupRepository');
const sessionRepository = require('../repositories/sessionRepository');
const authenticate = require('./authenticate');

function makeReq(sessionCookie, headers = {}) {
  return {
    cookies: sessionCookie !== undefined ? { sid: sessionCookie } : {},
    get: jest.fn((name) => headers[name.toLowerCase()]),
  };
}

describe('authenticate middleware', () => {
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    next = jest.fn();
    sessionRepository.touch.mockResolvedValue(undefined);
  });

  it('rejects a missing session cookie without touching the DB', async () => {
    await authenticate(makeReq(undefined), {}, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    expect(sessionRepository.findValidByHash).not.toHaveBeenCalled();
  });

  it('rejects a session token that matches no valid (or expired) session', async () => {
    sessionRepository.findValidByHash.mockResolvedValue(null);

    await authenticate(makeReq('sometoken'), {}, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    expect(userRepository.getAuthStatus).not.toHaveBeenCalled();
  });

  it('rejects a valid session for a since-deactivated user', async () => {
    sessionRepository.findValidByHash.mockResolvedValue({ id: 1, user_id: 5 });
    userRepository.getAuthStatus.mockResolvedValue({ is_active: 0, role_id: 2 });

    await authenticate(makeReq('sometoken'), {}, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    expect(userRepository.getPermissionCodes).not.toHaveBeenCalled();
  });

  it('rejects a session whose user no longer exists at all', async () => {
    sessionRepository.findValidByHash.mockResolvedValue({ id: 1, user_id: 999 });
    userRepository.getAuthStatus.mockResolvedValue(null);

    await authenticate(makeReq('sometoken'), {}, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it('attaches req.user built fresh from the DB, slides the session expiry, and calls next() with no error', async () => {
    sessionRepository.findValidByHash.mockResolvedValue({ id: 1, user_id: 5 });
    userRepository.getAuthStatus.mockResolvedValue({
      is_active: 1,
      username: 'jdoe',
      role_id: 3,
      role_code: 'OFFICE_STAFF',
      church_id: 1,
      branch_id: 1,
    });
    userRepository.getPermissionCodes.mockResolvedValue(['mass_intentions.view', 'mass_intentions.create']);

    const req = makeReq('sometoken');
    await authenticate(req, {}, next);

    expect(userRepository.getPermissionCodes).toHaveBeenCalledWith(3);
    expect(req.user).toEqual({
      id: 5,
      username: 'jdoe',
      roleId: 3,
      roleCode: 'OFFICE_STAFF',
      churchId: 1,
      branchId: 1,
      permissions: ['mass_intentions.view', 'mass_intentions.create'],
    });
    expect(sessionRepository.touch).toHaveBeenCalledWith(1, expect.any(Date));
    expect(next).toHaveBeenCalledWith(); // called with no error
  });

  it('resolves a Master Administrator\'s churchId/branchId from validated X-Church-Id/X-Branch-Id headers, ignoring their own (null) church', async () => {
    sessionRepository.findValidByHash.mockResolvedValue({ id: 1, user_id: 9 });
    userRepository.getAuthStatus.mockResolvedValue({
      is_active: 1,
      username: 'master',
      role_id: 1,
      role_code: 'MASTER_ADMIN',
      church_id: null,
      branch_id: null,
    });
    userRepository.getPermissionCodes.mockResolvedValue([]);
    lookupRepository.getChurchById.mockResolvedValue({ id: 7, name: 'St. Mary\'s' });
    lookupRepository.getBranchById.mockResolvedValue({ id: 3, name: 'Main', church_id: 7 });

    const req = makeReq('sometoken', { 'x-church-id': '7', 'x-branch-id': '3' });
    await authenticate(req, {}, next);

    expect(req.user.churchId).toBe(7);
    expect(req.user.branchId).toBe(3);
    expect(next).toHaveBeenCalledWith();
  });

  it('leaves a Master Administrator with no church selected when no header is sent', async () => {
    sessionRepository.findValidByHash.mockResolvedValue({ id: 1, user_id: 9 });
    userRepository.getAuthStatus.mockResolvedValue({
      is_active: 1,
      username: 'master',
      role_id: 1,
      role_code: 'MASTER_ADMIN',
      church_id: null,
      branch_id: null,
    });
    userRepository.getPermissionCodes.mockResolvedValue([]);

    const req = makeReq('sometoken');
    await authenticate(req, {}, next);

    expect(req.user.churchId).toBeNull();
    expect(req.user.branchId).toBeNull();
    expect(lookupRepository.getChurchById).not.toHaveBeenCalled();
  });

  it('never lets a branch from a DIFFERENT church than the selected one take effect', async () => {
    sessionRepository.findValidByHash.mockResolvedValue({ id: 1, user_id: 9 });
    userRepository.getAuthStatus.mockResolvedValue({
      is_active: 1,
      username: 'master',
      role_id: 1,
      role_code: 'MASTER_ADMIN',
      church_id: null,
      branch_id: null,
    });
    userRepository.getPermissionCodes.mockResolvedValue([]);
    lookupRepository.getChurchById.mockResolvedValue({ id: 7, name: 'St. Mary\'s' });
    lookupRepository.getBranchById.mockResolvedValue({ id: 3, name: 'Other Branch', church_id: 99 }); // belongs to a different church

    const req = makeReq('sometoken', { 'x-church-id': '7', 'x-branch-id': '3' });
    await authenticate(req, {}, next);

    expect(req.user.churchId).toBe(7);
    expect(req.user.branchId).toBeNull();
  });

  it('ignores X-Church-Id/X-Branch-Id headers entirely for a role with a fixed home branch (Office Staff)', async () => {
    sessionRepository.findValidByHash.mockResolvedValue({ id: 1, user_id: 5 });
    userRepository.getAuthStatus.mockResolvedValue({
      is_active: 1,
      username: 'jdoe',
      role_id: 2,
      role_code: 'OFFICE_STAFF',
      church_id: 1,
      branch_id: 1,
    });
    userRepository.getPermissionCodes.mockResolvedValue([]);

    const req = makeReq('sometoken', { 'x-church-id': '999', 'x-branch-id': '999' });
    await authenticate(req, {}, next);

    expect(req.user.churchId).toBe(1);
    expect(req.user.branchId).toBe(1);
    expect(lookupRepository.getChurchById).not.toHaveBeenCalled();
  });

  it("resolves an ADMIN's branchId from a validated X-Branch-Id header, within their own (fixed) church", async () => {
    sessionRepository.findValidByHash.mockResolvedValue({ id: 1, user_id: 1 });
    userRepository.getAuthStatus.mockResolvedValue({
      is_active: 1,
      username: 'admin',
      role_id: 1,
      role_code: 'ADMIN',
      church_id: 1,
      branch_id: 3,
    });
    userRepository.getPermissionCodes.mockResolvedValue([]);
    lookupRepository.getBranchById.mockResolvedValue({ id: 4, name: 'Judes Church', church_id: 1 });

    const req = makeReq('sometoken', { 'x-branch-id': '4' });
    await authenticate(req, {}, next);

    expect(req.user.churchId).toBe(1); // never overridden by any header
    expect(req.user.branchId).toBe(4);
    expect(lookupRepository.getChurchById).not.toHaveBeenCalled(); // ADMIN's church is never header-driven
  });

  it('leaves an ADMIN branchId null ("All branches") when no X-Branch-Id header is sent, even though their own row has a home branch', async () => {
    sessionRepository.findValidByHash.mockResolvedValue({ id: 1, user_id: 1 });
    userRepository.getAuthStatus.mockResolvedValue({
      is_active: 1,
      username: 'admin',
      role_id: 1,
      role_code: 'ADMIN',
      church_id: 1,
      branch_id: 3,
    });
    userRepository.getPermissionCodes.mockResolvedValue([]);

    const req = makeReq('sometoken');
    await authenticate(req, {}, next);

    expect(req.user.churchId).toBe(1);
    expect(req.user.branchId).toBeNull();
    expect(lookupRepository.getBranchById).not.toHaveBeenCalled();
  });

  it('never lets an ADMIN select a branch belonging to a DIFFERENT church', async () => {
    sessionRepository.findValidByHash.mockResolvedValue({ id: 1, user_id: 1 });
    userRepository.getAuthStatus.mockResolvedValue({
      is_active: 1,
      username: 'admin',
      role_id: 1,
      role_code: 'ADMIN',
      church_id: 1,
      branch_id: 3,
    });
    userRepository.getPermissionCodes.mockResolvedValue([]);
    lookupRepository.getBranchById.mockResolvedValue({ id: 1, name: 'Our Lady of Snows', church_id: 2 }); // a different church

    const req = makeReq('sometoken', { 'x-branch-id': '1' });
    await authenticate(req, {}, next);

    expect(req.user.churchId).toBe(1);
    expect(req.user.branchId).toBeNull();
  });

  it('surfaces a DB failure as an unhandled error (a 500 via errorHandler.js), not a mis-reported auth failure', async () => {
    sessionRepository.findValidByHash.mockResolvedValue({ id: 1, user_id: 5 });
    const dbError = new Error('connection lost');
    userRepository.getAuthStatus.mockRejectedValue(dbError);

    await authenticate(makeReq('sometoken'), {}, next);

    expect(next).toHaveBeenCalledWith(dbError);
  });
});
