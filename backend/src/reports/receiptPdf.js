const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const { renderPdfBuffer } = require('../utils/pdfPrinter');
const { buildCompactEvent } = require('../utils/icsBuilder');
const { formatDateDMY } = require('../utils/dateFormat');
const { getThemePrimaryColor, GOLD } = require('../utils/themeColors');
const { t, fontFor, localizedName, addressLine } = require('../utils/pdfLabels');
const { UPLOAD_ROOT } = require('../middlewares/upload');
const env = require('../config/env');

/** Reads the church's uploaded logo (see middlewares/upload.js) off disk and
 * returns it as a data URL, so both this PDF and receiptHtml.js's print
 * preview can embed it directly without needing a reachable HTTP URL for it
 * -- the same reason the QR code below is embedded as a data URL rather than
 * linked. Returns null when the church has no logo set, or the file is
 * missing from disk, in which case the receipt just omits it like every
 * other optional field here. */
function getChurchLogoDataUrl(church) {
  if (!church?.logo_url) return null;
  const filePath = path.join(UPLOAD_ROOT, church.logo_url.replace(/^\/uploads\//, ''));
  try {
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).slice(1).toLowerCase();
    const mime = ext === 'jpg' ? 'jpeg' : ext;
    return `data:image/${mime};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

const PAGE_WIDTH_PT = 419.53; // A5 portrait width (A5 = 419.53 x 595.28pt)

/**
 * Shared footer block for both single-record A5 receipts (this one and
 * contributionReceiptPdf.js) -- a small drawn cross ornament, then a
 * contact/visit-info card: the church's address+phone repeated as a "Visit
 * us at" line (the header above already shows them once, but a receipt is a
 * leave-behind, so repeating them at the bottom is what actually gets read
 * later), its email/website when set, and a "retain this receipt" note. A
 * plain "Authorized Signature"/seal block was tried here first and read too
 * bureaucratic for a parish receipt. Also has the side effect of giving the
 * fixed A5 page's bottom margin (see this file's own comment on why the
 * page can't just shrink to the content) something worth looking at instead
 * of being left blank on a short receipt.
 */
function receiptFooter(church, lang) {
  const address = addressLine(church, lang);
  const visitLine = address ? `${t(lang, 'visitUsAt')}: ${address}${church?.phone ? `   •   Ph: ${church.phone}` : ''}` : null;
  const contact = [church?.email, church?.website].filter(Boolean).join('   |   ');
  return [
    {
      canvas: [
        { type: 'line', x1: 20, y1: 0, x2: 20, y2: 26, lineWidth: 1.5, lineColor: GOLD },
        { type: 'line', x1: 10, y1: 8, x2: 30, y2: 8, lineWidth: 1.5, lineColor: GOLD },
      ],
      alignment: 'center',
      margin: [0, 0, 0, 10],
    },
    {
      table: {
        widths: ['*'],
        body: [
          [
            {
              stack: [
                visitLine ? { text: visitLine, alignment: 'center', fontSize: 7, color: '#666666', margin: [0, 0, 0, 4] } : null,
                contact ? { text: contact, alignment: 'center', fontSize: 7, color: '#666666', margin: [0, 0, 0, 4] } : null,
                { text: t(lang, 'retainReceipt'), alignment: 'center', italics: true, fontSize: 7.5, color: '#777777' },
              ].filter(Boolean),
              margin: [12, 8, 12, 8],
            },
          ],
        ],
      },
      layout: {
        hLineWidth: () => 0.75,
        vLineWidth: () => 0.75,
        hLineColor: () => '#E3D9B8',
        vLineColor: () => '#E3D9B8',
      },
      margin: [40, 0, 40, 10],
    },
  ];
}

/**
 * Builds the QR payload for a receipt.
 *
 * 'calendar' (default) embeds the calendar event itself, so scanning works
 * with no network, no Wi-Fi and no server running -- the phone creates the
 * entry straight from the printed code. 'url' instead links to the public
 * page, which needs connectivity but renders a confirmation screen and works
 * identically on every phone.
 */
function buildQrPayload(intention, church, mode, lang) {
  if (mode === 'url' && intention.public_token) {
    return `${env.publicAppUrl}/r/${intention.public_token}`;
  }

  const date = new Date(intention.prayer_date);
  const [h = '0', m = '0'] = String(intention.mass_time || '00:00:00').split(':');
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), Number(h), Number(m), 0);

  const text = intention.intention_is_custom
    ? intention.custom_intention
    : localizedName(intention.intention_master_name, intention.intention_master_name_ta, lang) ||
      intention.custom_intention ||
      t(lang, 'massIntention');
  const massName = localizedName(intention.mass_name, intention.mass_name_ta, lang);

  return buildCompactEvent({
    start,
    summary: `${text} - ${massName}`,
    location: localizedName(church?.name, church?.name_ta, lang) || undefined,
  });
}

/**
 * Shared header block for both single-record A5 receipts (this one and
 * contributionReceiptPdf.js) -- when the church has a logo, it sits on the
 * left with the name/address/phone stacked to its right (right-aligned),
 * rather than everything centered under the logo; without a logo there's
 * nothing to balance against on the left, so it falls back to the plain
 * centered block.
 */
function receiptHeader(church, lang, logoDataUrl, primaryColor = '#072a63') {
  const churchName = localizedName(church?.name, church?.name_ta, lang) || t(lang, 'churchOffice');
  const address = addressLine(church, lang);
  const textStack = [
    { text: churchName, style: 'churchName', alignment: logoDataUrl ? 'left' : 'center', color: '#ffffff' },
    address ? { text: address, alignment: logoDataUrl ? 'left' : 'center', fontSize: 9.5, color: '#ffffff', margin: [0, 2, 0, 0] } : null,
    church?.phone ? { text: `Ph: ${church.phone}`, alignment: logoDataUrl ? 'left' : 'center', fontSize: 9.5, color: '#ffffff', margin: [0, 1, 0, 0] } : null,
  ].filter(Boolean);

  const inner = logoDataUrl
    ? {
        columns: [
          { image: logoDataUrl, width: 44, alignment: 'left' },
          { width: '*', stack: textStack },
        ],
        columnGap: 10,
      }
    : { stack: textStack };

  return [
    {
      table: {
        widths: ['*'],
        body: [
          [
            {
              ...inner,
              margin: [10, 8, 10, 8],
            },
          ],
        ],
      },
      layout: {
        fillColor: () => primaryColor,
        hLineWidth: () => 0,
        vLineWidth: () => 0,
      },
      margin: [0, 0, 0, 8],
    },
  ];
}

// Printed size per QR module. Thermal printers resolve roughly 2.8 dots per
// point, so ~2.4pt keeps every module around 6-7 dots -- comfortably above the
// point where speckle and ink bleed start costing scans.
const MIN_PT_PER_MODULE = 2.4;
const QR_MIN_WIDTH_PT = 92;
const QR_MAX_WIDTH_PT = 150; // kept modest even on the wider A5 page -- scan reliability, not page fit, sets this ceiling

async function generateReceiptPdf(intention, church, thankYouMessage, qrMode = 'calendar', currencySymbol = '₹', billedBy, lang = 'en') {
  const primaryColor = getThemePrimaryColor(church?.theme_color);
  const qrText = buildQrPayload(intention, church, qrMode, lang);

  // Error-correction level M survives the speckle typical of receipt paper
  // without inflating the version.
  const qrOptions = { margin: 1, errorCorrectionLevel: 'M' };

  // Size the printed QR from its actual module count rather than a fixed
  // width: the offline calendar payload is several times longer than a URL and
  // at a fixed size its modules end up too small for a phone to resolve.
  const moduleCount = QRCode.create(qrText, qrOptions).modules.size;
  const qrWidthPt = Math.min(
    QR_MAX_WIDTH_PT,
    Math.max(QR_MIN_WIDTH_PT, Math.ceil(moduleCount * MIN_PT_PER_MODULE))
  );

  const qrDataUrl = await QRCode.toDataURL(qrText, { ...qrOptions, width: 480 });

  const intentionText = intention.intention_is_custom
    ? intention.custom_intention
    : localizedName(intention.intention_master_name, intention.intention_master_name_ta, lang) || intention.custom_intention || '-';
  const massName = localizedName(intention.mass_name, intention.mass_name_ta, lang);
  const logoDataUrl = getChurchLogoDataUrl(church);

  const docDefinition = {
    // Fixed, exact ISO A5 (148 x 210mm / 419.53 x 595.28pt) -- these receipts
    // are printed on real A5 paper, so the PDF's own page size has to match
    // that exactly for every printer driver, OS and browser to recognize and
    // select "A5" correctly. A shorter, content-sized custom page (tried and
    // reverted -- see git history) looks better in a PDF viewer but is not a
    // named paper size at all, so a real printer's driver has nothing to
    // match it to and can silently fall back to its own default paper
    // (commonly A4/Letter) with unpredictable scaling -- inconsistent across
    // devices is exactly what this must never be. The unused space below a
    // short receipt's content is the accepted trade-off for that guarantee.
    pageSize: 'A5',
    pageOrientation: 'portrait',
    pageMargins: [16, 16, 16, 16],
    // Font choice also looks at the actual free-text fields, not just
    // `lang` -- Booked By / Name / the custom intention can be typed in
    // Tamil regardless of which language the receipt itself is printed
    // in (see pdfLabels.js's fontFor).
    defaultStyle: {
      font: fontFor(lang, intention.name, intention.booked_by, intentionText, massName, intention.mass_offering_description, thankYouMessage),
      fontSize: 10.5,
    },
    content: [
      ...receiptHeader(church, lang, logoDataUrl, primaryColor),
      { text: t(lang, 'receiptTitle'), style: 'title', alignment: 'center', margin: [0, 6, 0, 6] },
      // Who's logged in and printing this receipt -- shown up in the header
      // block with the rest of the identifying details, not buried at the
      // bottom. Distinct from Booked By below (who the booking's on record
      // for) and not shown on the Daily Register (see dailyRegisterPdf.js's
      // own "Generated by" instead).
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
          { text: intention.receipt_no, width: '50%', alignment: 'right' },
        ],
        margin: [0, 0, 0, 3],
      },
      // When the booking itself was entered -- distinct from `massDate` below
      // (the Mass's own date, which a booking can be made well ahead of or
      // even, for a past record, after). Labeled "Billed Date" here
      // specifically (see pdfLabels.js's own comment) -- Collections/the
      // Daily Register still call this same column `enteredDate`.
      {
        columns: [
          { text: t(lang, 'billedDate'), bold: true, width: '50%' },
          { text: formatDateDMY(intention.created_at), width: '50%', alignment: 'right' },
        ],
      },
      { canvas: [{ type: 'line', x1: 0, y1: 4, x2: PAGE_WIDTH_PT - 32, y2: 4, lineWidth: 0.5 }], margin: [0, 4, 0, 4] },
      // Only the printed receipt shows this -- not the Daily Register, not
      // Reports -- per its one specified purpose (who to hand the receipt to
      // / who to contact about this booking), distinct from `name` (who the
      // Mass is offered for/by, which can be a different person).
      intention.booked_by
        ? {
            columns: [
              { text: t(lang, 'bookedBy'), bold: true, width: '50%' },
              { text: intention.booked_by, width: '50%', alignment: 'right' },
            ],
          }
        : null,
      intention.booked_by
        ? { canvas: [{ type: 'line', x1: 0, y1: 4, x2: PAGE_WIDTH_PT - 32, y2: 4, lineWidth: 0.5 }], margin: [0, 4, 0, 4] }
        : null,
      {
        columns: [
          { text: t(lang, 'massDate'), bold: true, width: '50%' },
          { text: formatDateDMY(intention.prayer_date), width: '50%', alignment: 'right' },
        ],
        margin: [0, 0, 0, 3],
      },
      {
        columns: [
          { text: t(lang, 'massTime'), bold: true, width: '50%' },
          { text: `${massName} (${formatTime(intention.mass_time)})`, width: '50%', alignment: 'right' },
        ],
        margin: [0, 0, 0, 3],
      },
      {
        columns: [
          { text: t(lang, 'offeredFor'), bold: true, width: 'auto' },
          { text: intention.name, alignment: 'right', width: '*' },
        ],
        columnGap: 8,
        margin: [0, 0, 0, 4],
      },
      {
        columns: [
          { text: t(lang, 'massIntention'), bold: true, width: 'auto' },
          { text: intentionText, alignment: 'right', width: '*' },
        ],
        columnGap: 8,
      },
      { canvas: [{ type: 'line', x1: 0, y1: 4, x2: PAGE_WIDTH_PT - 32, y2: 4, lineWidth: 0.5 }], margin: [0, 4, 0, 4] },
      {
        columns: [
          { text: t(lang, 'offering'), bold: true, width: '50%' },
          { text: formatCurrency(intention.offering_amount, currencySymbol), width: '50%', alignment: 'right', bold: true },
        ],
        margin: [0, 0, 0, intention.mass_offering_description ? 2 : 4],
      },
      // Optional note carried from the selected Mass (Masters > Masses >
      // Offering Description, see master-config.ts) -- e.g. what the
      // offering is customarily intended for. Same label/value row style
      // as offeredFor/massIntention above; omitted entirely when that Mass
      // has none set, same as every other optional field on this receipt.
      intention.mass_offering_description
        ? {
            columns: [
              { text: t(lang, 'offeringDescription'), bold: true, fontSize: 8, width: 'auto' },
              { text: intention.mass_offering_description, alignment: 'right', fontSize: 8, color: '#444444', width: '*' },
            ],
            columnGap: 8,
            margin: [0, 0, 0, 4],
          }
        : null,
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: PAGE_WIDTH_PT - 32, y2: 0, lineWidth: 1, dash: { length: 3 } }] },
      { image: qrDataUrl, width: qrWidthPt, alignment: 'center', margin: [0, 8, 0, 2] },
      { text: t(lang, 'scanCalendar'), alignment: 'center', fontSize: 7.5, color: '#444444', margin: [0, 0, 0, 2] },
      { text: thankYouMessage || t(lang, 'defaultThankYou'), alignment: 'center', italics: true, fontSize: 8, margin: [0, 2, 0, 8] },
      ...receiptFooter(church, lang),
      {
        text: `${t(lang, 'generated')}: ${formatDateDMY(new Date())} ${formatTime24(new Date())}`,
        alignment: 'center',
        fontSize: 7,
        color: '#666666',
        margin: [0, 4, 0, 0],
      },
    ].filter(Boolean),
    styles: {
      churchName: { fontSize: 18, bold: true, color: '#ffffff' },
      title: { fontSize: 12, bold: true, color: '#6E4E12' },
    },
  };

  return renderPdfBuffer(docDefinition);
}

function formatTime24(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = Number(h);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${m} ${suffix}`;
}
function formatCurrency(amount, symbol = '₹') {
  return `${symbol}${Number(amount).toFixed(2)}`;
}

// buildQrPayload is also used by receiptHtml.js (the print-preview HTML
// version of this same receipt -- see that file's own doc comment for why
// it exists) so the QR code's actual payload can never drift between the
// two renderings of the same data.
module.exports = { generateReceiptPdf, buildQrPayload, getChurchLogoDataUrl, receiptHeader, receiptFooter };
