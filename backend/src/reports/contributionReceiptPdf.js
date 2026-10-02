const QRCode = require('qrcode');
const { renderPdfBuffer } = require('../utils/pdfPrinter');
const { formatDateDMY } = require('../utils/dateFormat');
const { getThemePrimaryColor } = require('../utils/themeColors');
const { t, fontFor, localizedName } = require('../utils/pdfLabels');
const { getChurchLogoDataUrl, receiptHeader, receiptFooter } = require('./receiptPdf');

const PAGE_WIDTH_PT = 419.53; // A5 portrait width, same as receiptPdf.js (A5 = 419.53 x 595.28pt)

/**
 * Builds the verification QR payload for a contribution receipt.
 * Contains church name, receipt number, date, donor, contribution type, and amount.
 * Works completely offline when scanned with any smartphone camera or QR reader.
 */
function buildContributionQrPayload(contribution, church, currencySymbol = '₹', lang = 'en') {
  const churchName = localizedName(church?.name, church?.name_ta, lang) || t(lang, 'churchOffice');
  const contributionTypeText = contribution.contribution_type_is_custom
    ? contribution.custom_contribution_type
    : localizedName(contribution.contribution_type_name, contribution.contribution_type_name_ta, lang) ||
      contribution.custom_contribution_type ||
      '-';
  const dateStr = formatDateDMY(contribution.payment_date || contribution.created_at);
  const amountStr = `${currencySymbol}${Number(contribution.contribution_amount).toFixed(2)}`;

  const lines = [
    churchName,
    t(lang, 'contributionReceiptTitle'),
    `${t(lang, 'receiptNo')}: ${contribution.receipt_no}`,
    `${t(lang, 'date')}: ${dateStr}`,
    `${t(lang, 'donor')}: ${contribution.name}`,
    `${t(lang, 'contributionType')}: ${contributionTypeText}`,
    `${t(lang, 'amount')}: ${amountStr}`,
  ];
  if (church?.phone) {
    lines.push(`Ph: ${church.phone}`);
  }
  if (church?.website) {
    lines.push(church.website);
  }
  return lines.join('\n');
}

/**
 * A Contribution's receipt -- formatted for ISO A5 portrait paper.
 * Includes church header, receipt details, verification QR code, and thank-you footer.
 */
async function generateContributionReceiptPdf(contribution, church, currencySymbol = '₹', billedBy, lang = 'en', thankYouMessage) {
  const primaryColor = getThemePrimaryColor(church?.theme_color);
  const contributionTypeText = contribution.contribution_type_is_custom
    ? contribution.custom_contribution_type
    : localizedName(contribution.contribution_type_name, contribution.contribution_type_name_ta, lang) ||
      contribution.custom_contribution_type ||
      '-';
  const logoDataUrl = getChurchLogoDataUrl(church);

  const qrWidthPt = 90; // ~32mm square on real paper
  const qrText = buildContributionQrPayload(contribution, church, currencySymbol, lang);
  const qrDataUrl = await QRCode.toDataURL(qrText, { margin: 1, errorCorrectionLevel: 'M', width: 480 });

  const docDefinition = {
    // Fixed, exact ISO A5 -- printed on real A5 paper, so it must match a
    // recognized paper size on every device/printer. See receiptPdf.js's own
    // comment for why a content-sized custom page was tried and reverted.
    pageSize: 'A5',
    pageOrientation: 'portrait',
    pageMargins: [16, 16, 16, 16],
    // Donor/Contribution Type are free text and can be typed in Tamil
    // regardless of `lang` -- see receiptPdf.js's own comment on the same
    // issue.
    defaultStyle: { font: fontFor(lang, contribution.name, contributionTypeText), fontSize: 10.5 },
    background: function (currentPage, pageSize) {
      return [
        {
          canvas: [
            {
              type: 'rect',
              x: 8,
              y: 8,
              w: pageSize.width - 16,
              h: pageSize.height - 16,
              lineWidth: 1.5,
              lineColor: primaryColor,
              r: 4,
            },
          ],
        },
      ];
    },
    content: [
      ...receiptHeader(church, lang, logoDataUrl, primaryColor),
      { text: t(lang, 'contributionReceiptTitle'), style: 'title', alignment: 'center', margin: [0, 6, 0, 6] },
      {
        text: `${t(lang, 'billedBy')}: ${billedBy || t(lang, 'system')}`,
        alignment: 'center',
        fontSize: 10.5,
        bold: true,
        color: '#000000',
        margin: [0, 0, 0, 4],
      },
      {
        columns: [
          { text: t(lang, 'receiptNo'), bold: true, width: '50%' },
          { text: contribution.receipt_no, width: '50%', alignment: 'right' },
        ],
        margin: [0, 0, 0, 6],
      },
      {
        columns: [
          { text: t(lang, 'date'), bold: true, width: '50%' },
          { text: formatDateDMY(contribution.payment_date || contribution.created_at), width: '50%', alignment: 'right' },
        ],
      },
      { canvas: [{ type: 'line', x1: 0, y1: 4, x2: PAGE_WIDTH_PT - 32, y2: 4, lineWidth: 0.5 }], margin: [0, 8, 0, 10] },
      {
        columns: [
          { text: t(lang, 'donor'), bold: true, width: 'auto' },
          { text: contribution.name, alignment: 'right', width: '*' },
        ],
        columnGap: 8,
        margin: [0, 0, 0, 8],
      },
      {
        columns: [
          { text: t(lang, 'contributionType'), bold: true, width: 'auto' },
          { text: contributionTypeText, alignment: 'right', width: '*' },
        ],
        columnGap: 8,
        margin: [0, 0, 0, 8],
      },
      {
        columns: [
          { text: t(lang, 'amount'), bold: true, width: '50%' },
          { text: formatCurrency(contribution.contribution_amount, currencySymbol), width: '50%', alignment: 'right', bold: true },
        ],
        margin: [0, 8, 0, 10],
      },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: PAGE_WIDTH_PT - 32, y2: 0, lineWidth: 1, dash: { length: 3 } }] },
      { image: qrDataUrl, width: qrWidthPt, alignment: 'center', margin: [0, 8, 0, 2] },
      { text: t(lang, 'scanVerify'), alignment: 'center', fontSize: 7.5, color: '#444444', margin: [0, 0, 0, 2] },
      { text: thankYouMessage || t(lang, 'contributionThankYou'), alignment: 'center', italics: true, fontSize: 8, margin: [0, 2, 0, 8] },
      ...receiptFooter(church, lang),
    ].filter(Boolean),
    styles: {
      churchName: { fontSize: 18, bold: true, color: primaryColor },
      title: { fontSize: 12, bold: true, color: '#6E4E12' },
    },
  };

  return renderPdfBuffer(docDefinition);
}

function formatTime24(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
function formatCurrency(amount, symbol = '₹') {
  return `${symbol}${Number(amount).toFixed(2)}`;
}

module.exports = { generateContributionReceiptPdf, buildContributionQrPayload };
