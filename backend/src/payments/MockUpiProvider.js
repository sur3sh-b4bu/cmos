const QRCode = require('qrcode');
const PaymentProvider = require('./PaymentProvider');

/**
 * Development-mode UPI provider -- renders a real, scannable `upi://pay`
 * QR code against a fake/demo VPA, purely so the booking + payment UI can be
 * built and demoed end-to-end before a real payment gateway is wired up.
 * Nothing here writes to the database; see paymentService.receivePayment()
 * for the step that actually records a payment once the user confirms it
 * (today: the "Simulate Payment Success" button; later: a gateway webhook).
 */
class MockUpiProvider extends PaymentProvider {
  constructor({ upiVpa } = {}) {
    super();
    this.name = 'mock';
    this.upiVpa = upiVpa || 'church-demo@upi';
  }

  async generateIntent({ amount, purpose, payeeName, currencyCode = 'INR', currencySymbol = '₹' }) {
    const amountStr = Number(amount).toFixed(2);
    const payUri =
      `upi://pay?pa=${encodeURIComponent(this.upiVpa)}` +
      `&pn=${encodeURIComponent(payeeName || 'Church')}` +
      `&am=${encodeURIComponent(amountStr)}` +
      `&cu=${encodeURIComponent(currencyCode)}` +
      `&tn=${encodeURIComponent(purpose || 'Mass Intention Offering')}`;

    const qrDataUrl = await QRCode.toDataURL(payUri, { margin: 1, width: 220 });

    return {
      qrDataUrl,
      payUri,
      isMock: true,
      display: {
        churchName: payeeName || 'Church',
        upiId: this.upiVpa,
        amount: amountStr,
        currency: currencyCode,
        symbol: currencySymbol,
        purpose: purpose || 'Mass Intention Offering',
      },
    };
  }
}

module.exports = MockUpiProvider;
