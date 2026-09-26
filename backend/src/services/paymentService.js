const crypto = require('crypto');
const massIntentionRepository = require('../repositories/massIntentionRepository');
const paymentRepository = require('../repositories/paymentRepository');
const massIntentionService = require('./massIntentionService');
const lookupRepository = require('../repositories/lookupRepository');
const auditService = require('./auditService');
const { effectiveBranchId } = require('../utils/effectiveScope');
const { resolveProvider } = require('../payments');
const ApiError = require('../utils/ApiError');
const { pool } = require('../config/db');
const { emitToChurch } = require('../realtime/socketServer');
const { toLocalDateString } = require('../utils/dateFormat');

const VALID_METHODS = ['cash', 'upi', 'cheque', 'bank_transfer', 'other'];

async function getUpiVpaSetting() {
  const [[row]] = await pool.query("SELECT setting_value FROM system_settings WHERE setting_key = 'UPI_VPA' LIMIT 1");
  return (row?.setting_value || '').trim() || null;
}

/**
 * Development-mode UPI QR for the "Receive Payment" flow's UPI branch (see
 * the mass-intention-form's inline mock panel). Purely a display concern --
 * amount/purpose come straight from the in-progress form (no saved intention
 * required yet), and nothing is written to the database here. The user
 * confirming "Simulate Payment Success" is what actually calls
 * receivePayment() below to record the transaction.
 */
async function generateDemoQr({ amount, purpose }, req) {
  const church = await lookupRepository.getChurchById(req.user.churchId);
  const upiVpa = await getUpiVpaSetting();
  const currency = await lookupRepository.getDefaultCurrency();
  const provider = resolveProvider({ upiVpa });
  return provider.generateIntent({
    amount,
    purpose: (purpose || 'Mass Intention Offering').slice(0, 50),
    payeeName: church?.name || 'Church',
    currencyCode: currency.code,
    currencySymbol: currency.symbol,
  });
}

/**
 * Step 2 of the payment workflow: the operator confirms money already
 * received (in any form) and records it against a Mass Intention. There is
 * no separate "pending/verified" status -- the existence of this row IS the
 * paid state (see massIntentionRepository's PAYMENT_JOIN).
 */
async function receivePayment(intentionId, payload, req) {
  const scope = { churchId: req.user.churchId, branchId: effectiveBranchId(req) };
  const intention = await massIntentionRepository.getById(intentionId, scope);
  if (!intention) throw ApiError.notFound('Mass intention not found');
  if (intention.is_paid) {
    throw ApiError.badRequest('Payment has already been received for this Mass Intention.');
  }

  // Trust boundary: a Restricted Date must be un-payable even if the booking
  // predates the restriction being added, or the frontend gate was bypassed.
  await massIntentionService.assertNotRestrictedDate(intention.prayer_date, intention.church_id);

  if (!VALID_METHODS.includes(payload.method)) {
    throw ApiError.badRequest('Select a valid payment method (Cash, UPI, Cheque, Bank Transfer, or Other).');
  }

  const transactionRef = `MANUAL-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  await paymentRepository.createManual({
    massIntentionId: intention.id,
    transactionRef,
    amount: intention.offering_amount,
    method: payload.method,
    referenceNumber: payload.referenceNumber,
    remarks: payload.remarks,
    paymentDate: payload.paymentDate || toLocalDateString(),
    userId: req.user.id,
  });

  const updated = await massIntentionRepository.getById(intentionId, scope);

  await auditService.fromRequest(req, {
    action: 'PAYMENT_RECEIVED',
    module: 'mass_intentions',
    entityType: 'payment_transactions',
    entityId: intentionId,
    newValues: { method: payload.method, referenceNumber: payload.referenceNumber || null, amount: intention.offering_amount },
  });

  emitToChurch(intention.church_id, 'mass-intentions:changed', { action: 'paid', id: intentionId });

  return updated;
}

module.exports = { receivePayment, generateDemoQr };
