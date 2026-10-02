const { renderPdfBuffer } = require('../utils/pdfPrinter');
const { formatDateDMY } = require('../utils/dateFormat');
const { getThemePrimaryColor } = require('../utils/themeColors');
const { t, fontFor, localizedName, paymentMethodLabel, periodText } = require('../utils/pdfLabels');

/**
 * Contributions' equivalent of collectionsDetailPdf.js -- per-payment breakdown
 * for a date range of the Contributions collections report, "Contribution Type"
 * in place of "Mass". Printed from Reports > Contributions (clicking a date in
 * the "by day" table). Backs the same "mine" vs all-users (+ per-row
 * Billed By column) split, and the same `lang` support -- see
 * collectionsDetailPdf.js's own comments on both.
 */
async function generateContributionCollectionsDetailPdf({ dateFrom, dateTo, church, rows, total, generatedBy, currencySymbol = '₹', mine = false, lang = 'en' }) {
  const generatedAt = new Date();
  const isSingleDay = dateFrom === dateTo;
  const primaryColor = getThemePrimaryColor(church?.theme_color);
  const showBilledByColumn = !mine;
  // Name/Contribution Type are free text/localized-but-possibly-Tamil-anyway
  // -- see collectionsDetailPdf.js's own comment on the same issue.
  const docFont = fontFor(
    lang,
    church?.name,
    church?.name_ta,
    ...rows.map((row) => row.name),
    ...rows.map((row) => contributionTypeText(row, lang))
  );

  const widths = [
    24,
    ...(isSingleDay ? [] : [65]),
    60,
    '*',
    '15%',
    ...(showBilledByColumn ? ['13%'] : []),
    '13%',
    70,
  ];
  const headerCells = [
    { text: '#', style: 'tableHeader' },
    ...(isSingleDay ? [] : [{ text: t(lang, 'date'), style: 'tableHeader' }]),
    { text: t(lang, 'receiptNo'), style: 'tableHeader' },
    { text: t(lang, 'name'), style: 'tableHeader' },
    { text: t(lang, 'contributionType'), style: 'tableHeader' },
    ...(showBilledByColumn ? [{ text: t(lang, 'billedBy'), style: 'tableHeader' }] : []),
    { text: t(lang, 'method'), style: 'tableHeader' },
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
            ...(isSingleDay ? [] : [{ text: formatDateDMY(row.payment_date), style: 'cellSmall' }]),
            { text: row.receipt_no, style: 'cellSmall' },
            { text: row.name, style: 'cell', bold: true },
            { text: contributionTypeText(row, lang), style: 'cell' },
            ...(showBilledByColumn ? [{ text: row.billed_by || t(lang, 'system'), style: 'cellSmall' }] : []),
            { text: paymentMethodLabel(row.method, lang), style: 'cell' },
            { text: formatCurrency(row.amount, currencySymbol), style: 'cell', alignment: 'right' },
          ]),
          [
            { text: '', border: [false, true, false, false] },
            { text: t(lang, 'total'), style: 'totalLabel', colSpan: totalLabelColSpan, border: [false, true, false, false] },
            ...totalRowFillerCells,
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

  if (!rows.length) {
    body.push({ text: t(lang, 'noContributionsPeriod'), italics: true, alignment: 'center', margin: [0, 40, 0, 0] });
  }

  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [36, 90, 36, 50],
    defaultStyle: { font: docFont, fontSize: 12 },
    header: (currentPage) => ({
      margin: [36, 20, 36, 0],
      stack: [
        {
          columns: [
            { text: localizedName(church?.name, church?.name_ta, lang) || t(lang, 'churchOffice'), style: 'churchName', width: '*' },
            { text: `${t(lang, 'page')} ${currentPage}`, alignment: 'right', fontSize: 9, color: '#888888', width: 80 },
          ],
        },
        { text: mine ? t(lang, 'contributionsBreakdownMine') : t(lang, 'contributionsBreakdownAll'), style: 'docTitle' },
        {
          columns: [
            {
              text: isSingleDay
                ? `${t(lang, 'date')}: ${formatDateLong(dateFrom, lang)}`
                : periodText(lang, formatDateDMY(dateFrom), formatDateDMY(dateTo)),
              fontSize: 10,
            },
            [
              // Same reasoning as collectionsDetailPdf.js's own header --
              // only the admin all-users variant reads as "Printed By".
              {
                text: `${mine ? t(lang, 'billedBy') : t(lang, 'printedBy')}: ${generatedBy || t(lang, 'system')}`,
                alignment: 'right',
                fontSize: 11,
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
      tableHeader: { bold: true, color: primaryColor, fontSize: 11 },
      cell: { fontSize: 12, margin: [0, 3, 0, 3] },
      cellSmall: { fontSize: 9, color: '#555555', margin: [0, 3, 0, 3] },
      totalLabel: { fontSize: 12, bold: true, margin: [0, 6, 0, 3] },
      totalValue: { fontSize: 13, bold: true, color: primaryColor, margin: [0, 6, 0, 3] },
    },
  };

  return renderPdfBuffer(docDefinition);
}

function contributionTypeText(row, lang) {
  if (row.contribution_type_is_custom) return row.custom_contribution_type || '-';
  return localizedName(row.contribution_type_name, row.contribution_type_name_ta, lang) || row.custom_contribution_type || '-';
}
function formatDateLong(d, lang) {
  const weekday = new Date(d).toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-GB', { weekday: 'long' });
  return `${weekday}, ${formatDateDMY(d)}`;
}
function formatTime24(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
function formatCurrency(amount, symbol = '₹') {
  return `${symbol}${Number(amount).toFixed(2)}`;
}

module.exports = { generateContributionCollectionsDetailPdf };
