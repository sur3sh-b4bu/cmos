/**
 * Abstract contract for a UPI payment-intent provider. Only concerned with
 * producing something the payer can scan/tap to pay -- it never touches
 * payment_transactions itself. Recording that money was actually received
 * (mock-confirmed today, gateway-webhook-verified later) always goes through
 * paymentService.receivePayment(), which is provider-agnostic by design.
 *
 * TODO(real gateway): a real implementation (Razorpay/Cashfree/PhonePe PG)
 * would additionally expose something like createOrder()/verifySignature()
 * here, and its webhook handler would call receivePayment() the same way
 * the mock "Simulate Payment Success" button does today. Everything above
 * this interface -- the controller route, the frontend UI, the eventual
 * payment_transactions row -- stays the same; only the class returned by
 * resolveProvider() (see index.js) changes.
 *
 * @typedef {Object} PaymentDisplay
 * @property {string} churchName
 * @property {string} upiId
 * @property {string} amount
 * @property {string} currency  Currency code (e.g. 'INR') -- the app's current default, see lookupRepository.getDefaultCurrency().
 * @property {string} symbol    Currency symbol (e.g. '₹'), for display.
 * @property {string} purpose
 *
 * @typedef {Object} PaymentIntent
 * @property {string} qrDataUrl  Data URL (image/png) of the scannable QR code.
 * @property {string} payUri     The raw `upi://pay?...` deep link.
 * @property {PaymentDisplay} display
 * @property {boolean} isMock
 */

class PaymentProvider {
  /**
   * @param {{amount:number, purpose:string, payeeName:string}} params
   * @returns {Promise<PaymentIntent>}
   */
  async generateIntent(params) {
    throw new Error('generateIntent() not implemented');
  }
}

module.exports = PaymentProvider;
