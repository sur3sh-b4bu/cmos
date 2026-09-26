const QRCode = require('qrcode');
const { buildQrPayload, getChurchLogoDataUrl } = require('./receiptPdf');
const { formatDateDMY } = require('../utils/dateFormat');
const { getThemePrimaryColor, GOLD } = require('../utils/themeColors');
const { t, localizedName, addressLine } = require('../utils/pdfLabels');

/**
 * The SAME Mass Intention receipt as receiptPdf.js, rendered as an HTML
 * document instead of a PDF, so the browser's print dialog can be trusted
 * to default to the right paper size.
 *
 * The problem this solves: these receipts are meant for real A5 paper, and
 * the generated PDF genuinely is exact A5 -- but a real (or virtual)
 * printer's print dialog picks its "Paper size" default from that
 * PRINTER's own configured default in the OS, not from the PDF's own page
 * size, so office staff had to switch it to A5 by hand on every single
 * print. A browser's print pipeline for a *native embedded PDF* just
 * doesn't reliably carry the document's own size through to that dialog.
 *
 * A plain HTML page is different: the CSS Paged Media `@page { size }`
 * descriptor below IS honoured by Chromium/Firefox's print preview as the
 * default paper size for that print job, regardless of the printer's own
 * configured default -- exactly the mechanism real invoice/ticket sites
 * rely on. So printReceipt (frontend's mass-intention.service.ts /
 * file-download.service.ts's printHtml) now prints this HTML view instead
 * of the PDF for the one-click "Print" action; the PDF endpoint (and this
 * file's own data) stays untouched for anyone who still wants an actual
 * PDF file.
 */
async function generateReceiptHtml(intention, church, thankYouMessage, qrMode = 'calendar', currencySymbol = '₹', billedBy, lang = 'en') {
  const primaryColor = getThemePrimaryColor(church?.theme_color);
  const qrText = buildQrPayload(intention, church, qrMode, lang);
  const qrDataUrl = await QRCode.toDataURL(qrText, { margin: 1, errorCorrectionLevel: 'M', width: 480 });

  const intentionText = intention.intention_is_custom
    ? intention.custom_intention
    : localizedName(intention.intention_master_name, intention.intention_master_name_ta, lang) || intention.custom_intention || '-';
  const massName = localizedName(intention.mass_name, intention.mass_name_ta, lang);
  const churchName = localizedName(church?.name, church?.name_ta, lang) || t(lang, 'churchOffice');
  const address = addressLine(church, lang);
  const logoDataUrl = getChurchLogoDataUrl(church);

  const rowHtml = (label, value) => `
      <div class="row"><span class="label">${esc(label)}</span><span class="value">${esc(value)}</span></div>`;

  return `<!DOCTYPE html>
<html lang="${lang === 'ta' ? 'ta' : 'en'}">
<head>
<meta charset="utf-8">
<title>${esc(t(lang, 'receiptTitle'))} ${esc(intention.receipt_no)}</title>
<style>${baseStyles(primaryColor)}</style>
</head>
<body>
  <div class="receipt">
    ${headerHtml(churchName, address, church?.phone, logoDataUrl, primaryColor)}
    <div class="title">${esc(t(lang, 'receiptTitle'))}</div>
    <div class="billed-by">${esc(t(lang, 'billedBy'))}: ${esc(billedBy || t(lang, 'system'))}</div>
    <div class="dashed"></div>
    ${rowHtml(t(lang, 'receiptNo'), intention.receipt_no)}
    ${rowHtml(t(lang, 'billedDate'), formatDateDMY(intention.created_at))}
    <div class="solid"></div>
    ${intention.booked_by ? rowHtml(t(lang, 'bookedBy'), intention.booked_by) : ''}
    ${intention.booked_by ? '<div class="solid"></div>' : ''}
    ${rowHtml(t(lang, 'massDate'), formatDateDMY(intention.prayer_date))}
    ${rowHtml(t(lang, 'massTime'), `${massName} (${formatTime(intention.mass_time)})`)}
    <div class="row row--field"><span class="label">${esc(t(lang, 'offeredFor'))}</span><span class="value">${esc(intention.name)}</span></div>
    <div class="row row--field"><span class="label">${esc(t(lang, 'massIntention'))}</span><span class="value">${esc(intentionText)}</span></div>
    <div class="solid"></div>
    <div class="row row--offering">
      <span class="label">${esc(t(lang, 'offering'))}</span>
      <span class="value">${esc(formatCurrency(intention.offering_amount, currencySymbol))}</span>
    </div>
    ${
      intention.mass_offering_description
        ? `<div class="row row--field row--small"><span class="label">${esc(t(lang, 'offeringDescription'))}</span><span class="value">${esc(intention.mass_offering_description)}</span></div>`
        : ''
    }
    <div class="dashed"></div>
    <img class="qr" src="${qrDataUrl}" alt="QR code" />
    <div class="scan-text">${esc(t(lang, 'scanCalendar'))}</div>
    <div class="thank-you">${esc(thankYouMessage || t(lang, 'defaultThankYou'))}</div>
    ${footerHtml(church, lang)}
    <div class="generated">${esc(t(lang, 'generated'))}: ${esc(formatDateDMY(new Date()))} ${esc(formatTime24(new Date()))}</div>
  </div>
</body>
</html>`;
}

/** HTML counterpart of receiptPdf.js's receiptHeader() -- with a logo, it
 * sits on the left with the name/address/phone stacked to its right
 * (right-aligned); without one, falls back to the plain centered block. */
function headerHtml(churchName, address, phone, logoDataUrl, primaryColor) {
  const info = `
    <div class="church-name" style="color: #ffffff !important;">${esc(churchName)}</div>
    ${address ? `<div class="church-line" style="color: #ffffff !important; opacity: 0.95;">${esc(address)}</div>` : ''}
    ${phone ? `<div class="church-line" style="color: #ffffff !important; opacity: 0.95;">Ph: ${esc(phone)}</div>` : ''}`;
  if (!logoDataUrl) {
    return `<div class="receipt-header" style="background-color: ${primaryColor} !important; background: ${primaryColor} !important; color: #ffffff !important;">${info}</div>`;
  }
  return `
    <div class="receipt-header header-row" style="background-color: ${primaryColor} !important; background: ${primaryColor} !important; color: #ffffff !important;">
      <img class="church-logo" src="${logoDataUrl}" alt="${esc(churchName)}" />
      <div class="church-info">${info}</div>
    </div>`;
}

/** HTML counterpart of receiptPdf.js's receiptFooter() -- same cross
 * ornament + contact/visit-info note card, kept in sync by hand since one
 * is pdfmake content and the other is markup (see this file's own doc
 * comment for why the two renderings can't just share one code path). */
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

/** Shared print-page styling -- exact A5 (148 x 210mm), matching the real
 * A5 paper stock these receipts are printed on (see receiptPdf.js's own
 * comment on why a content-sized custom height was tried and rejected: a
 * non-standard size is not something a real printer driver can be trusted
 * to honour either). See generateReceiptHtml's own doc comment for why
 * `@page { size }` -- not the printer's own remembered default -- is what
 * actually fixes the paper-size problem this file exists to solve. */
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
      padding: 0 !important;
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
  body { width: 148mm; font-family: 'Noto Sans Tamil', Arial, sans-serif; font-size: 10.5pt; color: #1a1a1a; }
  .receipt { width: 148mm; max-width: 148mm; padding: 14pt 16pt; margin: 0 auto; }
  .receipt-header {
    background: ${primaryColor};
    color: #ffffff;
    border-radius: 6pt;
    padding: 10pt 14pt;
    margin-bottom: 8pt;
    text-align: center;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .receipt-header .church-name {
    font-size: 16pt;
    font-weight: bold;
    color: #ffffff;
    text-align: center;
    letter-spacing: 0.02em;
    line-height: 1.2;
  }
  .receipt-header .church-line {
    font-size: 9.5pt;
    text-align: center;
    margin-top: 2pt;
    color: #ffffff;
    opacity: 0.95;
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
  .solid { border-top: 0.5pt solid #000; margin: 4pt 0; }
  .title { font-size: 12pt; font-weight: bold; color: #6E4E12; text-align: center; margin: 6pt 0 4pt; }
  .billed-by { font-size: 10pt; font-weight: bold; text-align: center; margin-bottom: 6pt; color: #333333; }
  .row { display: flex; justify-content: space-between; gap: 8pt; margin-bottom: 3pt; }
  .row .label { font-weight: bold; flex-shrink: 0; }
  .row .value { text-align: right; }
  .row--offering { margin-top: 4pt; font-weight: bold; }
  .row--field { margin-bottom: 4pt; }
  .row--small { font-size: 8pt; color: #444444; }
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

/** Escapes free text (church/receipt data can be Tamil, contain an
 * apostrophe, "&", "<Sons>", etc.) so it can never break out of the markup
 * or be interpreted as HTML -- every value above goes through this. */
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function formatTime24(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
function formatTime(time) {
  if (!time) return '';
  const [h, m] = time.split(':');
  const hour = Number(h);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${m} ${suffix}`;
}
function formatCurrency(amount, symbol = '₹') {
  return `${symbol}${Number(amount).toFixed(2)}`;
}

module.exports = { generateReceiptHtml };
