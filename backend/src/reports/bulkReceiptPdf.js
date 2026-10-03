const { renderPdfBuffer } = require('../utils/pdfPrinter');
const { formatDateDMY } = require('../utils/dateFormat');
const { getThemePrimaryColor } = require('../utils/themeColors');
const { t, fontFor, localizedName } = require('../utils/pdfLabels');

/**
 * One combined receipt for a whole Bulk Mass Intention batch (see
 * bulk-mass-intention-form.ts) -- every intention just created/paid
 * together listed as its own line, with the grand total at the very end,
 * instead of printing N separate individual receipts (receiptPdf.js) one
 * at a time. Booked By/Phone/Payment Method are shown once at the top
 * since the bulk form collects them once and applies them to every row --
 * read off the first intention, since all of them share the same values.
 */
async function generateBulkReceiptPdf(intentions, church, currencySymbol = '₹', billedBy, lang = 'en') {
  const generatedAt = new Date();
  const primaryColor = getThemePrimaryColor(church?.theme_color);
  const first = intentions[0];
  const total = intentions.reduce((sum, i) => sum + Number(i.offering_amount), 0);
  // See receiptPdf.js's own comment: Name/Booked By/each row's intention
  // are free text that can be Tamil regardless of `lang`, so every row is
  // checked rather than trusting the report's own language alone.
  const docFont = fontFor(
    lang,
    first?.booked_by,
    ...intentions.flatMap((row) => [row.name, intentionText(row, lang)])
  );

  const body = [
    {
      table: {
        headerRows: 1,
        widths: [22, 60, 55, '*', '*', '18%', 60],
        body: [
          [
            { text: '#', style: 'tableHeader' },
            { text: t(lang, 'receiptNo'), style: 'tableHeader' },
            { text: t(lang, 'massDate'), style: 'tableHeader' },
            { text: t(lang, 'massTime'), style: 'tableHeader' },
            { text: t(lang, 'name'), style: 'tableHeader' },
            { text: t(lang, 'massIntention'), style: 'tableHeader' },
            { text: t(lang, 'amount'), style: 'tableHeader', alignment: 'right' },
          ],
          ...intentions.map((row, idx) => [
            { text: String(idx + 1), style: 'cell' },
            { text: row.receipt_no, style: 'cellSmall' },
            { text: formatDateDMY(row.prayer_date), style: 'cellSmall' },
            { text: `${localizedName(row.mass_name, row.mass_name_ta, lang)} (${formatTime(row.mass_time)})`, style: 'cell' },
            { text: row.name, style: 'cell', bold: true },
            { text: intentionText(row, lang), style: 'cell' },
            { text: formatCurrency(row.offering_amount, currencySymbol), style: 'cell', alignment: 'right' },
          ]),
          [
            { text: '', border: [false, true, false, false] },
            { text: t(lang, 'totalOffering'), style: 'totalLabel', colSpan: 5, border: [false, true, false, false] },
            {}, {}, {}, {},
            { text: formatCurrency(total, currencySymbol), style: 'totalValue', alignment: 'right', border: [false, true, false, false] },
          ],
        ],
      },
      layout: {
        fillColor: (rowIndex) => (rowIndex === 0 ? null : rowIndex % 2 === 0 ? '#F9FAFB' : null),
        hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length ? 1.2 : 0.5),
        hLineColor: (i) => (i === 0 || i === 1 ? primaryColor : '#D0D5DD'),
        vLineWidth: () => 0.5,
        vLineColor: () => '#D0D5DD',
      },
    },
  ];

  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [36, 118, 36, 50],
    defaultStyle: { font: docFont, fontSize: 12 },
    header: (currentPage) => ({
      margin: [36, 16, 36, 0],
      stack: [
        {
          table: {
            widths: ['*'],
            body: [
              [
                {
                  columns: [
                    { text: localizedName(church?.name, church?.name_ta, lang) || t(lang, 'churchOffice'), style: 'churchName', width: '*' },
                    { text: `${t(lang, 'page')} ${currentPage}`, alignment: 'right', fontSize: 9, color: '#888888', width: 80 },
                  ],
                  margin: [8, 6, 8, 6],
                },
              ],
            ],
          },
          layout: {
            fillColor: () => null,
            hLineWidth: () => 1.2,
            vLineWidth: () => 1.2,
            hLineColor: () => primaryColor,
            vLineColor: () => primaryColor,
          },
          margin: [0, 0, 0, 6],
        },
        { text: t(lang, 'bulkReceiptTitle'), style: 'docTitle' },
        {
          text: `${t(lang, 'billedBy')}: ${billedBy || t(lang, 'system')}`,
          fontSize: 11,
          bold: true,
          color: '#000000',
          margin: [0, 0, 0, 2],
        },
        {
          columns: [
            [
              first?.booked_by ? { text: `${t(lang, 'bookedBy')}: ${first.booked_by}`, fontSize: 10 } : null,
              first?.phone ? { text: `${t(lang, 'phone')}: ${first.phone}`, fontSize: 10 } : null,
            ].filter(Boolean),
            [
              { text: `${t(lang, 'paymentMethod')}: ${first?.payment_method_name || '-'}`, fontSize: 10, alignment: 'right' },
              first?.payment_reference_number
                ? { text: `${t(lang, 'reference')}: ${first.payment_reference_number}`, fontSize: 9, color: '#888888', alignment: 'right' }
                : null,
            ].filter(Boolean),
          ],
        },
        { canvas: [{ type: 'line', x1: 0, y1: 6, x2: 523, y2: 6, lineWidth: 1, lineColor: '#B08D2B' }] },
      ],
    }),
    footer: (currentPage, pageCount) => ({
      margin: [36, 0, 36, 20],
      stack: [
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 523, y2: 0, lineWidth: 0.5, lineColor: '#D0D5DD' }] },
        {
          columns: [
            { text: '', fontSize: 8 },
            { text: `${t(lang, 'page')} ${currentPage} ${t(lang, 'of')} ${pageCount}`, alignment: 'right', fontSize: 8, color: '#888888' },
          ],
          margin: [0, 4, 0, 0],
        },
      ],
    }),
    content: body,
    styles: {
      churchName: { fontSize: 16, bold: true, color: primaryColor },
      docTitle: { fontSize: 11, bold: true, color: '#B08D2B', margin: [0, 2, 0, 6] },
      tableHeader: { bold: true, color: primaryColor, fontSize: 10 },
      cell: { fontSize: 11, margin: [0, 3, 0, 3] },
      cellSmall: { fontSize: 9, color: '#555555', margin: [0, 3, 0, 3] },
      totalLabel: { fontSize: 12, bold: true, margin: [0, 6, 0, 3] },
      totalValue: { fontSize: 13, bold: true, color: primaryColor, margin: [0, 6, 0, 3] },
    },
  };

  return renderPdfBuffer(docDefinition);
}

function intentionText(row, lang) {
  if (row.intention_is_custom) return row.custom_intention || '-';
  const base = localizedName(row.intention_master_name, row.intention_master_name_ta, lang);
  if (base && row.custom_intention) return `${base} - ${row.custom_intention}`;
  return base || row.custom_intention || '-';
}
function formatTime24(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
// Same 12-hour "7:00 AM" formatting as receiptPdf.js's own formatTime, for
// the "Mass Time" column -- `time` here is the Masses master's own
// mass_time ("HH:MM:SS"), not a Date, so it can't reuse formatTime24 above.
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

module.exports = { generateBulkReceiptPdf };
