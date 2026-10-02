const { renderPdfBuffer } = require('../utils/pdfPrinter');
const { formatDateDMY } = require('../utils/dateFormat');
const { getThemePrimaryColor } = require('../utils/themeColors');
const { t, fontFor, localizedName, paymentMethodLabel, periodText } = require('../utils/pdfLabels');

/**
 * Per-payment breakdown for a date range of the Collections report -- who
 * paid what, summing to the range's total. Printed from Reports >
 * Collections/Contributions (clicking a date in the "by day" table -- dateFrom
 * === dateTo) and from the Dashboard's Today's/Monthly Collections stat
 * cards (dateFrom/dateTo spanning that same range).
 *
 * Backs TWO different print buttons (see reportController's `mine`
 * handling): `mine: true` is every row's own transactions already, so a
 * per-row "who billed it" column would just repeat the header's Billed By
 * line -- only the all-users variant (reports.print_all, admin by default)
 * adds it, "side by side" with the rest of each row as asked.
 *
 * Supports the same `lang` param as every other printout in this app (see
 * pdfLabels.js) -- this was English-only for a while as a deliberate "admin
 * business report" choice, but that read as an odd, inconsistent gap once
 * everything else printed in Tamil.
 */
async function generateCollectionsDetailPdf({
  dateFrom,
  dateTo,
  church,
  rows,
  total,
  generatedBy,
  currencySymbol = '₹',
  mine = false,
  dateBasis = 'payment',
  lang = 'en',
}) {
  const generatedAt = new Date();
  const isSingleDay = dateFrom === dateTo;
  const primaryColor = getThemePrimaryColor(church?.theme_color);
  const showBilledByColumn = !mine;
  // Booked By/Mass are free text/localized-but-possibly-Tamil-anyway -- see
  // receiptPdf.js's own comment on the same content-vs-lang font issue.
  const docFont = fontFor(
    lang,
    church?.name,
    church?.name_ta,
    ...rows.map((row) => row.booked_by),
    ...rows.map((row) => row.mass_name),
    ...rows.map((row) => row.mass_name_ta)
  );
  const dateField = dateBasis === 'entered' ? 'entered_date' : 'payment_date';
  const dateLabel = dateBasis === 'entered' ? t(lang, 'enteredDate') : t(lang, 'date');

  // A single day's breakdown omits the Date column -- every row would
  // repeat the same value already shown in the header line above the table.
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
    ...(isSingleDay ? [] : [{ text: dateLabel, style: 'tableHeader' }]),
    { text: t(lang, 'receiptNo'), style: 'tableHeader' },
    { text: t(lang, 'bookedBy'), style: 'tableHeader' },
    { text: t(lang, 'mass'), style: 'tableHeader' },
    ...(showBilledByColumn ? [{ text: t(lang, 'billedBy'), style: 'tableHeader' }] : []),
    { text: t(lang, 'method'), style: 'tableHeader' },
    { text: t(lang, 'amount'), style: 'tableHeader', alignment: 'right' },
  ];
  // Spans every column between '#' and 'Amount' -- computed from
  // headerCells so it always matches regardless of which optional columns
  // (Date, Billed By) are present.
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
            ...(isSingleDay ? [] : [{ text: formatDateDMY(row[dateField]), style: 'cellSmall' }]),
            { text: row.receipt_no, style: 'cellSmall' },
            { text: row.booked_by || '-', style: 'cell', bold: true },
            { text: localizedName(row.mass_name, row.mass_name_ta, lang), style: 'cell' },
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
    body.push({ text: t(lang, 'noCollectionsPeriod'), italics: true, alignment: 'center', margin: [0, 40, 0, 0] });
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
        { text: mine ? t(lang, 'collectionsBreakdownMine') : t(lang, 'collectionsBreakdownAll'), style: 'docTitle' },
        {
          columns: [
            {
              text: isSingleDay
                ? `${t(lang, 'date')}: ${formatDateLong(dateFrom, lang)}`
                : periodText(lang, formatDateDMY(dateFrom), formatDateDMY(dateTo)),
              fontSize: 10,
            },
            [
              // Admin's all-users variant: this is the admin printing an
              // oversight report, not billing anything themselves -- "Printed
              // By" reads correctly there. The "mine" variant keeps "Billed
              // By" (every row on it genuinely was billed by this person).
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

module.exports = { generateCollectionsDetailPdf };
