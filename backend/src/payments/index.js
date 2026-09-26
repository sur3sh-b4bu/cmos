const MockUpiProvider = require('./MockUpiProvider');

/**
 * Single seam for swapping the mock provider for a real gateway later --
 * see PaymentProvider.js's TODO. Today this always resolves to the mock;
 * a real integration would check an env/system-setting flag here and
 * return e.g. `new RazorpayProvider(config)` instead.
 */
function resolveProvider({ upiVpa } = {}) {
  return new MockUpiProvider({ upiVpa });
}

module.exports = { resolveProvider };
