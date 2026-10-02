const QRCode = require('qrcode');
const { formatDateDMY } = require('../utils/dateFormat');
const { getThemePrimaryColor, GOLD } = require('../utils/themeColors');
const { t, localizedName, addressLine } = require('../utils/pdfLabels');
const { getChurchLogoDataUrl } = require('./receiptPdf');
const { buildContributionQrPayload } = require('./contributionReceiptPdf');

/**
 * The Contribution receipt's HTML counterpart -- see receiptHtml.js's own
 * doc comment for why this exists (a browser's print dialog won't reliably
 * default to A5 for an embedded PDF, but does honour a plain HTML page's
 * own `@page { size }`). Includes verification QR code, church branding,
 * and contact footer.
 */
async function generateContributionReceiptHtml(contribution, church, currencySymbol = '₹', billedBy, lang = 'en', thankYouMessage) {
  const primaryColor = getThemePrimaryColor(church?.theme_color);
  const qrText = buildContributionQrPayload(contribution, church, currencySymbol, lang);
  const qrDataUrl = await QRCode.toDataURL(qrText, { margin: 1, errorCorrectionLevel: 'M', width: 480 });

  const contributionTypeText = contribution.contribution_type_is_custom
    ? contribution.custom_contribution_type
    : localizedName(contribution.contribution_type_name, contribution.contribution_type_name_ta, lang) ||
      contribution.custom_contribution_type ||
      '-';
  const churchName = localizedName(church?.name, church?.name_ta, lang) || t(lang, 'churchOffice');
  const address = addressLine(church, lang);
  const logoDataUrl = getChurchLogoDataUrl(church);

  const rowHtml = (label, value) => `
      <div class="row"><span class="label">${esc(label)}</span><span class="value">${esc(value)}</span></div>`;

  return `<!DOCTYPE html>
<html lang="${lang === 'ta' ? 'ta' : 'en'}">
<head>
<meta charset="utf-8">
<title>${esc(t(lang, 'contributionReceiptTitle'))} ${esc(contribution.receipt_no)}</title>
<style>${baseStyles(primaryColor)}</style>
</head>
<body>
  <div class="receipt">
    ${headerHtml(churchName, address, church?.phone, logoDataUrl, primaryColor)}
    <div class="title">${esc(t(lang, 'contributionReceiptTitle'))}</div>
    <div class="billed-by">${esc(t(lang, 'billedBy'))}: ${esc(billedBy || t(lang, 'system'))}</div>
    <div class="dashed"></div>
    ${rowHtml(t(lang, 'receiptNo'), contribution.receipt_no)}
    ${rowHtml(t(lang, 'date'), formatDateDMY(contribution.payment_date || contribution.created_at))}
    <div class="solid"></div>
    <div class="row row--field"><span class="label">${esc(t(lang, 'donor'))}</span><span class="value">${esc(contribution.name)}</span></div>
    <div class="row row--field"><span class="label">${esc(t(lang, 'contributionType'))}</span><span class="value">${esc(contributionTypeText)}</span></div>
    <div class="row row--offering">
      <span class="label">${esc(t(lang, 'amount'))}</span>
      <span class="value">${esc(formatCurrency(contribution.contribution_amount, currencySymbol))}</span>
    </div>
    <div class="dashed"></div>
    <img class="qr" src="${qrDataUrl}" alt="QR code" />
    <div class="scan-text">${esc(t(lang, 'scanVerify'))}</div>
    <div class="thank-you">${esc(thankYouMessage || t(lang, 'contributionThankYou'))}</div>
    ${footerHtml(church, lang)}
  </div>
</body>
</html>`;
}

/** HTML counterpart of receiptPdf.js's receiptHeader() -- see receiptHtml.js's
 * own copy of this same helper for why it's duplicated rather than shared. */
function headerHtml(churchName, address, phone, logoDataUrl, primaryColor) {
  const info = `
    <div class="church-name" style="color: ${primaryColor} !important;">${esc(churchName)}</div>
    ${address ? `<div class="church-line" style="color: #333333 !important;">${esc(address)}</div>` : ''}
    ${phone ? `<div class="church-line" style="color: #333333 !important;">Ph: ${esc(phone)}</div>` : ''}`;
  if (!logoDataUrl) {
    return `<div class="receipt-header" style="border: 1.5pt solid ${primaryColor} !important; background: transparent !important; color: #111111 !important;">${info}</div>`;
  }
  return `
    <div class="receipt-header header-row" style="border: 1.5pt solid ${primaryColor} !important; background: transparent !important; color: #111111 !important;">
      <img class="church-logo" src="${logoDataUrl}" alt="${esc(churchName)}" />
      <div class="church-info">${info}</div>
    </div>`;
}

/** HTML counterpart of receiptPdf.js's receiptFooter() -- see receiptHtml.js's
 * own copy of this same helper for why it's duplicated rather than shared. */
function footerHtml(church, lang) {
  const address = addressLine(church, lang);
  const visitLine = address ? `${t(lang, 'visitUsAt')}: ${address}${church?.phone ? `   •   Ph: ${church.phone}` : ''}` : null;
  const contact = [church?.email, church?.website].filter(Boolean).join('   |   ');
  return `
    <div class="cross-ornament"><span class="cross-v"></span><span class="cross-h"></span></div>
    <div class="note-card">
      ${visitLine ? `<div class="contact-line">${esc(visitLine)}</div>` : ''}
      ${contact ? `<div class="contact-line">${esc(contact)}</div>` : ''}
      <div class="retain-note">${esc(t(lang, 'retainReceipt'))}</div>
    </div>`;
}

/** Same A5 print stylesheet as receiptHtml.js -- see that file's own
 * comment for why exact 148x210mm (matching the real paper) and `@page`,
 * not the printer's remembered default, is what fixes the paper-size
 * problem this exists to solve. */
function baseStyles(primaryColor) {
  return `
  @page {
    size: 148mm 210mm;
    margin: 0;
  }
  @media print {
    @page {
      size: 148mm 210mm;
      margin: 0;
    }
    html, body {
      width: 148mm;
      max-width: 148mm;
      margin: 0 !important;
      padding: 3mm 4mm !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .receipt {
      border: 1.5pt solid ${primaryColor} !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .receipt-header {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  }
  @font-face {
    font-family: 'Noto Sans Tamil';
    src: url('/fonts/NotoSansTamil-tamil.woff2') format('woff2'), url('/fonts/NotoSansTamil-latin.woff2') format('woff2');
    font-display: swap;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    width: 148mm;
    font-family: 'Noto Sans Tamil', Arial, sans-serif;
    font-size: 10.5pt;
    color: #1a1a1a;
    padding: 3mm 4mm;
  }
  .receipt {
    width: 100%;
    max-width: 140mm;
    padding: 10pt 12pt;
    margin: 0 auto;
    border: 1.5pt solid ${primaryColor};
    border-radius: 6pt;
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .receipt-header {
    background: transparent;
    color: #111827;
    border: 1.5pt solid ${primaryColor};
    border-radius: 4pt;
    padding: 8pt 12pt;
    margin-bottom: 6pt;
    text-align: center;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .receipt-header .church-name {
    font-size: 15pt;
    font-weight: bold;
    color: ${primaryColor} !important;
    text-align: center;
    letter-spacing: 0.02em;
    line-height: 1.2;
  }
  .receipt-header .church-line {
    font-size: 9pt;
    text-align: center;
    margin-top: 2pt;
    color: #374151 !important;
    line-height: 1.3;
  }

  .receipt-header.header-row {
    display: flex;
    align-items: center;
    gap: 12pt;
    text-align: left;
  }
  .receipt-header .church-logo {
    flex-shrink: 0;
    width: 44pt;
    height: auto;
    margin: 0;
    border-radius: 4pt;
    background: #ffffff;
    padding: 2pt;
  }
  .receipt-header.header-row .church-name {
    text-align: left;
  }
  .receipt-header.header-row .church-line {
    text-align: left;
  }
  .dashed { border-top: 1pt dashed #000; margin: 6pt 0; }
  .solid { border-top: 0.5pt solid #000; margin: 8pt 0 10pt; }
  .title { font-size: 12pt; font-weight: bold; color: #6E4E12; text-align: center; margin: 6pt 0 4pt; }
  .billed-by { font-size: 10pt; font-weight: bold; text-align: center; margin-bottom: 6pt; color: #333333; }
  .row { display: flex; justify-content: space-between; gap: 8pt; margin-bottom: 6pt; }
  .row .label { font-weight: bold; flex-shrink: 0; }
  .row .value { text-align: right; }
  .row--offering { margin-top: 8pt; margin-bottom: 10pt; font-weight: bold; }
  .qr { display: block; width: 100pt; margin: 8pt auto 2pt; }
  .scan-text { font-size: 7.5pt; color: #444444; text-align: center; margin-bottom: 2pt; }
  .thank-you { font-size: 8pt; font-style: italic; text-align: center; margin-bottom: 8pt; }
  .cross-ornament { position: relative; width: 40pt; height: 26pt; margin: 0 auto 10pt; }
  .cross-v { position: absolute; left: 50%; top: 0; width: 1.5pt; height: 26pt; background: ${GOLD}; transform: translateX(-50%); }
  .cross-h { position: absolute; left: 50%; top: 8pt; width: 20pt; height: 1.5pt; background: ${GOLD}; transform: translateX(-50%); }
  .note-card { border: 0.75pt solid #E3D9B8; border-radius: 4pt; padding: 8pt 12pt; margin: 0 auto 10pt; max-width: 300pt; text-align: center; }
  .contact-line { font-size: 7pt; color: #666666; margin-bottom: 4pt; }
  .retain-note { font-size: 7.5pt; font-style: italic; color: #777777; }
  .generated { font-size: 7pt; color: #666666; text-align: center; margin-top: 4pt; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  `;
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function formatTime24(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
function formatCurrency(amount, symbol = '₹') {
  return `${symbol}${Number(amount).toFixed(2)}`;
}

module.exports = { generateContributionReceiptHtml };
