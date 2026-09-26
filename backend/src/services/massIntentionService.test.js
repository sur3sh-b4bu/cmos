jest.mock('../repositories/massIntentionRepository');
jest.mock('../repositories/receiptSeriesRepository');
jest.mock('../repositories/lookupRepository');
jest.mock('../services/auditService');
jest.mock('../realtime/socketServer', () => ({ emitToChurch: jest.fn() }));
jest.mock('../config/db', () => ({ pool: { getConnection: jest.fn() } }));

const massIntentionRepository = require('../repositories/massIntentionRepository');
const receiptSeriesRepository = require('../repositories/receiptSeriesRepository');
const lookupRepository = require('../repositories/lookupRepository');
const auditService = require('../services/auditService');
const { pool } = require('../config/db');
const massIntentionService = require('./massIntentionService');

function makeConn() {
  return {
    beginTransaction: jest.fn().mockResolvedValue(undefined),
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined),
    release: jest.fn(),
    query: jest.fn(),
  };
}

function makeReq(overrides = {}) {
  return { user: { id: 1, churchId: 1, branchId: 1 }, ...overrides };
}

const VALID_PAYLOAD = {
  name: 'John Peter',
  prayerDate: '2026-08-05',
  massId: 1,
  prayerIntentionMasterId: 1,
  offeringAmount: 100,
  paymentMethodId: 1,
  allowDuplicate: true,
};

describe('massIntentionService.create -- receipt-number/insert atomicity', () => {
  let conn;

  beforeEach(() => {
    jest.clearAllMocks();
    conn = makeConn();
    pool.getConnection.mockResolvedValue(conn);
    lookupRepository.getMassById.mockResolvedValue({ id: 1 });
    lookupRepository.getActiveRestrictedDates.mockResolvedValue([]);
    lookupRepository.getPrayerIntentionMasterById.mockResolvedValue({ id: 1, is_custom: 0 });
    massIntentionRepository.findPotentialDuplicate.mockResolvedValue(null);
    receiptSeriesRepository.claimNextReceiptNumberOnConn.mockResolvedValue('RC0001');
  });

  it('commits once the number is claimed and the row is inserted', async () => {
    massIntentionRepository.create.mockResolvedValue({ id: 10, receipt_no: 'RC0001' });

    const result = await massIntentionService.create(VALID_PAYLOAD, makeReq());

    expect(result.id).toBe(10);
    expect(receiptSeriesRepository.claimNextReceiptNumberOnConn).toHaveBeenCalledWith(conn, 1);
    // The claim and the insert must run on the SAME connection for the
    // transaction to actually cover both.
    expect(massIntentionRepository.create).toHaveBeenCalledWith(expect.any(Object), 1, conn);
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(conn.rollback).not.toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalledTimes(1);
  });

  it('rolls back the claimed number if the insert afterward fails, instead of permanently skipping it', async () => {
    const insertError = new Error('DB went away mid-insert');
    massIntentionRepository.create.mockRejectedValue(insertError);

    await expect(massIntentionService.create(VALID_PAYLOAD, makeReq())).rejects.toThrow('DB went away mid-insert');

    expect(receiptSeriesRepository.claimNextReceiptNumberOnConn).toHaveBeenCalledWith(conn, 1);
    expect(conn.commit).not.toHaveBeenCalled();
    expect(conn.rollback).toHaveBeenCalledTimes(1);
    expect(conn.release).toHaveBeenCalledTimes(1);
    // Nothing gets audited/broadcast for a save that never actually happened.
    expect(auditService.fromRequest).not.toHaveBeenCalled();
  });

  it('releases the connection even if claiming the number itself fails (no active series configured)', async () => {
    const ApiError = require('../utils/ApiError');
    receiptSeriesRepository.claimNextReceiptNumberOnConn.mockRejectedValue(ApiError.badRequest('No active series'));

    await expect(massIntentionService.create(VALID_PAYLOAD, makeReq())).rejects.toMatchObject({ statusCode: 400 });

    expect(massIntentionRepository.create).not.toHaveBeenCalled();
    expect(conn.rollback).toHaveBeenCalledTimes(1);
    expect(conn.release).toHaveBeenCalledTimes(1);
  });
});
