const crypto = require('crypto');
const contributionRepository = require('../repositories/contributionRepository');
const contributionPaymentRepository = require('../repositories/contributionPaymentRepository');
const auditService = require('./auditService');
const ApiError = require('../utils/ApiError');
const { toLocalDateString } = require('../utils/dateFormat');
const { effectiveBranchId } = require('../utils/effectiveScope');

const VALID_METHODS = ['cash', 'upi', 'cheque', 'bank_transfer', 'other'];

/**
 * Step 2 of the payment workflow: the operator confirms money already
 * received (in any form) and records it against a Contribution. Same
 * "existence of this row IS the paid state" design as
 * paymentService.receivePayment -- no separate pending/verified status.
 * The UPI demo-QR step itself is shared with Mass Intentions (see
 * paymentService.generateDemoQr / PaymentService on the frontend) since it
 * doesn't touch either entity's table -- only this confirmation step does.
 */
async function receivePayment(contributionId, payload, req) {
  const scope = { churchId: req.user.churchId, branchId: effectiveBranchId(req) };
  const contribution = await contributionRepository.getById(contributionId, scope);
  if (!contribution) throw ApiError.notFound('Contribution not found');
  if (contribution.is_paid) {
    throw ApiError.badRequest('Payment has already been received for this Contribution.');
  }

  if (!VALID_METHODS.includes(payload.method)) {
    throw ApiError.badRequest('Select a valid payment method (Cash, UPI, Cheque, Bank Transfer, or Other).');
  }

  const transactionRef = `MANUAL-DON-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  await contributionPaymentRepository.createManual({
    contributionId: contribution.id,
    transactionRef,
    amount: contribution.contribution_amount,
    method: payload.method,
    referenceNumber: payload.referenceNumber,
    remarks: payload.remarks,
    paymentDate: payload.paymentDate || toLocalDateString(),
    userId: req.user.id,
  });

  const updated = await contributionRepository.getById(contributionId, scope);

  await auditService.fromRequest(req, {
    action: 'PAYMENT_RECEIVED',
    module: 'contributions',
    entityType: 'contribution_payment_transactions',
    entityId: contributionId,
    newValues: { method: payload.method, referenceNumber: payload.referenceNumber || null, amount: contribution.contribution_amount },
  });

  return updated;
}

module.exports = { receivePayment };
