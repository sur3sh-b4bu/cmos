const { renderPdfBuffer } = require('../utils/pdfPrinter');
const { formatDateDMY } = require('../utils/dateFormat');
const { getThemePrimaryColor } = require('../utils/themeColors');
const { t, fontFor, localizedName, periodText } = require('../utils/pdfLabels');

async function generateMassIntentionsReportPdf({
  dateFrom,
  dateTo,
  church,
  rows,
  summary,
  generatedBy,
  currencySymbol = '₹',
  lang = 'en',
}) {
  const generatedAt = new Date();
  const isSingleDay = dateFrom === dateTo;
  const primaryColor = getThemePrimaryColor(church?.theme_color);

  const docFont = fontFor(
    lang,
    church?.name,
    church?.name_ta,
    ...rows.map((row) => row.name),
    ...rows.map((row) => row.mass_name),
    ...rows.map((row) => row.intention)
  );

  const widths = [22, ...(isSingleDay ? [] : [60]), 58, '*', '18%', '20%', 65];
  const headerCells = [
    { text: '#', style: 'tableHeader' },
    ...(isSingleDay ? [] : [{ text: t(lang, 'date'), style: 'tableHeader' }]),
    { text: t(lang, 'receiptNo'), style: 'tableHeader' },
    { text: t(lang, 'name'), style: 'tableHeader' },
    { text: t(lang, 'mass'), style: 'tableHeader' },
    { text: t(lang, 'massIntention'), style: 'tableHeader' },
    { text: t(lang, 'amount'), style: 'tableHeader', alignment: 'right' },
  ];

  const totalLabelColSpan = headerCells.length - 2;
  const totalRowFillerCells = Array.from({ length: totalLabelColSpan - 1 }, () => ({}));

  const body = [
    {
      table: {
        headerRows: 1,
        widths,
        body: [
          headerCells,
          ...rows.map((row, idx) => [
            { text: String(idx + 1), style: 'cell' },
            ...(isSingleDay ? [] : [{ text: formatDateDMY(row.prayer_date), style: 'cellSmall' }]),
            { text: row.receipt_no, style: 'cellSmall' },
            { text: row.name || '-', style: 'cell', bold: true },
            { text: row.mass_name || '-', style: 'cell' },
            { text: row.intention || '-', style: 'cellSmall' },
            { text: formatCurrency(row.offering_amount, currencySymbol), style: 'cell', alignment: 'right' },
          ]),
          [
            { text: '', border: [false, true, false, false] },
            { text: t(lang, 'total'), style: 'totalLabel', colSpan: totalLabelColSpan, border: [false, true, false, false] },
            ...totalRowFillerCells,
            { text: formatCurrency(summary.totalOffering, currencySymbol), style: 'totalValue', alignment: 'right', border: [false, true, false, false] },
          ],
        ],
      },
      layout: {
        fillColor: (rowIndex) => (rowIndex === 0 ? primaryColor : rowIndex % 2 === 0 ? '#F4F6FB' : null),
        hLineColor: () => '#D0D5DD',
        vLineColor: () => '#D0D5DD',
      },
    },
  ];

  if (!rows.length) {
    body.push({ text: t(lang, 'noMassIntentionsPeriod'), italics: true, alignment: 'center', margin: [0, 40, 0, 0] });
  }

  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [36, 90, 36, 50],
    defaultStyle: { font: docFont, fontSize: 11 },
    header: (currentPage) => ({
      margin: [36, 20, 36, 0],
      stack: [
        {
          columns: [
            { text: localizedName(church?.name, church?.name_ta, lang) || t(lang, 'churchOffice'), style: 'churchName', width: '*' },
            { text: `${t(lang, 'page')} ${currentPage}`, alignment: 'right', fontSize: 9, color: '#888888', width: 80 },
          ],
        },
        { text: t(lang, 'massIntentionsReportTitle'), style: 'docTitle' },
        {
          columns: [
            {
              text: isSingleDay
                ? `${t(lang, 'date')}: ${formatDateLong(dateFrom, lang)}`
                : periodText(lang, formatDateDMY(dateFrom), formatDateDMY(dateTo)),
              fontSize: 10,
            },
            [
              {
                text: `${t(lang, 'printedBy')}: ${generatedBy || t(lang, 'system')}`,
                alignment: 'right',
                fontSize: 10,
                bold: true,
                color: '#000000',
              },
              { text: `${t(lang, 'generated')}: ${formatDateDMY(generatedAt)} ${formatTime24(generatedAt)}`, alignment: 'right', fontSize: 9, color: '#888888' },
            ],
          ],
        },
        { canvas: [{ type: 'line', x1: 0, y1: 4, x2: 523, y2: 4, lineWidth: 1, lineColor: '#B08D2B' }] },
      ],
    }),
    footer: (currentPage, pageCount) => ({
      margin: [36, 0, 36, 20],
      stack: [
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 523, y2: 0, lineWidth: 0.5, lineColor: '#D0D5DD' }] },
        { text: `${t(lang, 'page')} ${currentPage} ${t(lang, 'of')} ${pageCount}`, alignment: 'right', fontSize: 8, color: '#888888', margin: [0, 4, 0, 0] },
      ],
    }),
    content: body,
    styles: {
      churchName: { fontSize: 16, bold: true, color: primaryColor },
      docTitle: { fontSize: 11, bold: true, color: '#B08D2B', margin: [0, 2, 0, 4] },
      tableHeader: { bold: true, color: '#FFFFFF', fontSize: 10 },
      cell: { fontSize: 10, margin: [0, 3, 0, 3] },
      cellSmall: { fontSize: 9, color: '#555555', margin: [0, 3, 0, 3] },
      totalLabel: { fontSize: 11, bold: true, margin: [0, 6, 0, 3] },
      totalValue: { fontSize: 12, bold: true, color: primaryColor, margin: [0, 6, 0, 3] },
    },
  };

  return renderPdfBuffer(docDefinition);
}

function formatDateLong(d, lang) {
  if (!d) return '';
  const weekday = new Date(d).toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-GB', { weekday: 'long' });
  return `${weekday}, ${formatDateDMY(d)}`;
}
function formatTime24(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
function formatCurrency(amount, symbol = '₹') {
  return `${symbol}${Number(amount || 0).toFixed(2)}`;
}

module.exports = { generateMassIntentionsReportPdf };
