const { renderPdfBuffer } = require('../utils/pdfPrinter');
const { formatDateDMY } = require('../utils/dateFormat');
const { getThemePrimaryColor } = require('../utils/themeColors');
const { t, fontFor, localizedName, periodText } = require('../utils/pdfLabels');

async function generateCertificatesReportPdf({
  dateFrom,
  dateTo,
  church,
  rows,
  summary,
  generatedBy,
  lang = 'en',
}) {
  const generatedAt = new Date();
  const isSingleDay = dateFrom === dateTo;
  const primaryColor = getThemePrimaryColor(church?.theme_color);

  const docFont = fontFor(
    lang,
    church?.name,
    church?.name_ta,
    ...rows.map((row) => row.name)
  );

  const widths = [24, ...(isSingleDay ? [] : [65]), 90, 85, '*'];
  const headerCells = [
    { text: '#', style: 'tableHeader' },
    ...(isSingleDay ? [] : [{ text: t(lang, 'date'), style: 'tableHeader' }]),
    { text: t(lang, 'certificateType'), style: 'tableHeader' },
    { text: t(lang, 'receiptNo'), style: 'tableHeader' },
    { text: t(lang, 'name'), style: 'tableHeader' },
  ];

  const typeLabel = (type) => {
    switch (type) {
      case 'baptism': return t(lang, 'baptism');
      case 'marriage': return t(lang, 'marriage');
      case 'death': return t(lang, 'death');
      default: return type;
    }
  };

  const body = [
    {
      table: {
        headerRows: 1,
        widths,
        body: [
          headerCells,
          ...rows.map((row, idx) => [
            { text: String(idx + 1), style: 'cell' },
            ...(isSingleDay ? [] : [{ text: formatDateDMY(row.date), style: 'cellSmall' }]),
            { text: typeLabel(row.certificate_type), style: 'cell', bold: true },
            { text: row.certificate_no, style: 'cellSmall' },
            { text: row.name || '-', style: 'cell' },
          ]),
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
    body.push({ text: t(lang, 'noCertificatesPeriod'), italics: true, alignment: 'center', margin: [0, 40, 0, 0] });
  }

  // Summary stats block
  const summaryBlock = {
    columns: [
      { text: `${t(lang, 'baptism')}: ${summary['baptism'] || 0}`, bold: true, fontSize: 11 },
      { text: `${t(lang, 'marriage')}: ${summary['marriage'] || 0}`, bold: true, fontSize: 11 },
      { text: `${t(lang, 'death')}: ${summary['death'] || 0}`, bold: true, fontSize: 11 },
      { text: `${t(lang, 'total')}: ${summary.total || rows.length}`, bold: true, fontSize: 11, alignment: 'right', color: primaryColor },
    ],
    margin: [0, 0, 0, 14],
  };

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
        { text: t(lang, 'certificatesReportTitle'), style: 'docTitle' },
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
    content: [summaryBlock, ...body],
    styles: {
      churchName: { fontSize: 16, bold: true, color: primaryColor },
      docTitle: { fontSize: 11, bold: true, color: '#B08D2B', margin: [0, 2, 0, 4] },
      tableHeader: { bold: true, color: '#FFFFFF', fontSize: 10 },
      cell: { fontSize: 10, margin: [0, 3, 0, 3] },
      cellSmall: { fontSize: 9, color: '#555555', margin: [0, 3, 0, 3] },
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

module.exports = { generateCertificatesReportPdf };
