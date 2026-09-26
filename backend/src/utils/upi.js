/**
 * Builds a UPI deep link following NPCI's UPI Deep Linking Specification
 * (the same `upi://pay?...` scheme every retail QR code in India uses).
 * Opening it on an Android device brings up the "Complete action using"
 * chooser listing every installed UPI app (Google Pay, PhonePe, Paytm,
 * BHIM, ...), each pre-filled with payee, amount, note and reference --
 * there is no per-app variant of this link to fake; that IS how a generic
 * UPI QR behaves on a real phone.
 */
function buildUpiUri({ vpa, payeeName, amount, note, txnRef }) {
  // Built by hand rather than via URLSearchParams: that encodes spaces as
  // '+' (form encoding), but several banking apps' UPI-link parsers expect
  // '%20' since this is a URI query string, not a submitted form body --
  // '+' has shown up literally in the payee name/note on some apps.
  const parts = [
    ['pa', vpa], // payee address (VPA / UPI ID)
    ['pn', payeeName], // payee name
    ['am', Number(amount).toFixed(2)], // amount
    ['cu', 'INR'], // currency
    note ? ['tn', note] : null, // transaction note
    txnRef ? ['tr', txnRef] : null, // transaction reference
  ].filter(Boolean);

  const query = parts.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&');
  return `upi://pay?${query}`;
}

module.exports = { buildUpiUri };
