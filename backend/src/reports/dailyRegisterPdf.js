const { renderPdfBuffer } = require('../utils/pdfPrinter');
const { formatDateDMY } = require('../utils/dateFormat');
const { getThemePrimaryColor } = require('../utils/themeColors');
const { t, fontFor, localizedName } = require('../utils/pdfLabels');

/**
 * The Daily Prayer Register: the single most important printout in the
 * system (handed to the priest before Mass). Must be large, readable,
 * grouped by Mass, and correctly repeat its header across pages.
 */
async function generateDailyRegisterPdf({ prayerDate, church, entries, generatedBy, currencySymbol = '₹', namesOnly = false, lang = 'en' }) {
  const groups = groupByMass(entries, lang);
  const generatedAt = new Date();
  const primaryColor = getThemePrimaryColor(church?.theme_color);
  // See receiptPdf.js's own comment: names/intentions are free text that
  // can be Tamil regardless of `lang`, so every row across every group is
  // checked rather than trusting the register's own language alone.
  const docFont = fontFor(
    lang,
    ...groups.flatMap((g) => [g.massName, ...g.rows.flatMap((row) => [row.name, row.intentionText])])
  );

  // Second print option: names + intentions only, for handing to the priest
  // without exposing offering amounts or receipt numbers.
  const widths = namesOnly ? [28, '25%', '*'] : [28, '18%', '*', 68, 60];
  const headerCells = namesOnly
    ? [
        { text: '#', style: 'tableHeader' },
        { text: t(lang, 'name'), style: 'tableHeader' },
        { text: t(lang, 'massIntention'), style: 'tableHeader' },
      ]
    : [
        { text: '#', style: 'tableHeader' },
        { text: t(lang, 'name'), style: 'tableHeader' },
        { text: t(lang, 'massIntention'), style: 'tableHeader' },
        { text: t(lang, 'offering'), style: 'tableHeader', alignment: 'right' },
        { text: t(lang, 'receiptNo'), style: 'tableHeader' },
      ];

  const body = [];
  groups.forEach((group, i) => {
    body.push({
      text: `${group.massName}  –  ${formatTime(group.massTime)}`,
      style: 'massHeader',
      margin: [0, i === 0 ? 0 : 16, 0, 6],
    });
    body.push({
      table: {
        headerRows: 1,
        dontBreakRows: true,
        widths,
        body: [
          headerCells,
          ...group.rows.map((row, idx) =>
            namesOnly
              ? [
                  { text: String(idx + 1), style: 'cell', alignment: 'center' },
                  { text: row.name, style: 'cell', bold: true },
                  { text: row.intentionText, style: 'cell' },
                ]
              : [
                  { text: String(idx + 1), style: 'cell', alignment: 'center' },
                  { text: row.name, style: 'cell', bold: true },
                  { text: row.intentionText, style: 'cell' },
                  { text: row.offeringAmount > 0 ? formatCurrency(row.offeringAmount, currencySymbol) : '-', style: 'cell', alignment: 'right' },
                  { text: row.receiptNo, style: 'cellSmall', alignment: 'center' },
                ]
          ),
        ],
      },
      layout: {
        fillColor: (rowIndex) => (rowIndex === 0 ? primaryColor : rowIndex % 2 === 0 ? '#F4F6FB' : null),
        hLineColor: () => '#D0D5DD',
        vLineColor: () => '#D0D5DD',
      },
    });
  });

  if (!groups.length) {
    body.push({ text: t(lang, 'noRecords'), italics: true, alignment: 'center', margin: [0, 40, 0, 0] });
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
        { text: namesOnly ? t(lang, 'registerNamesOnlyTitle') : t(lang, 'registerTitle'), style: 'docTitle' },
        {
          columns: [
            { text: `${t(lang, 'date')}: ${formatDate(prayerDate)}`, fontSize: 10 },
            {
              text: `${t(lang, 'generated')}: ${formatDateDMY(generatedAt)} ${formatTime24(generatedAt)}`,
              alignment: 'right',
              fontSize: 9,
              color: '#888888',
            },
          ],
        },
        { canvas: [{ type: 'line', x1: 0, y1: 4, x2: 523, y2: 4, lineWidth: 1, lineColor: '#B08D2B' }] },
      ],
    }),
    footer: (currentPage, pageCount) => ({
      margin: [36, 0, 36, 20],
      stack: [
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 523, y2: 0, lineWidth: 0.5, lineColor: '#D0D5DD' }] },
        {
          columns: [
            { text: `${t(lang, 'generatedBy')}: ${generatedBy || t(lang, 'system')}`, fontSize: 8, color: '#888888' },
            { text: `${t(lang, 'page')} ${currentPage} ${t(lang, 'of')} ${pageCount}`, alignment: 'right', fontSize: 8, color: '#888888' },
          ],
          margin: [0, 4, 0, 0],
        },
      ],
    }),
    content: body,
    styles: {
      churchName: { fontSize: 16, bold: true, color: primaryColor },
      docTitle: { fontSize: 11, bold: true, color: '#B08D2B', margin: [0, 2, 0, 4] },
      massHeader: { fontSize: 14, bold: true, color: primaryColor },
      tableHeader: { bold: true, color: '#FFFFFF', fontSize: 11 },
      cell: { fontSize: 12, margin: [0, 3, 0, 3] },
      cellSmall: { fontSize: 9, color: '#555555', margin: [0, 3, 0, 3] },
    },
  };

  return renderPdfBuffer(docDefinition);
}

function groupByMass(entries, lang) {
  const map = new Map();
  for (const e of entries) {
    if (!map.has(e.mass_id)) {
      map.set(e.mass_id, {
        massId: e.mass_id,
        massName: localizedName(e.mass_name, e.mass_name_ta, lang),
        massTime: e.mass_time,
        rows: [],
      });
    }
    map.get(e.mass_id).rows.push({
      name: e.name,
      intentionText: e.intention_is_custom
        ? e.custom_intention
        : localizedName(e.intention_master_name, e.intention_master_name_ta, lang) || e.custom_intention || '-',
      offeringAmount: Number(e.offering_amount),
      receiptNo: e.receipt_no,
    });
  }
  return Array.from(map.values()).sort((a, b) => (a.massTime > b.massTime ? 1 : -1));
}

function formatDate(d) {
  // Weekday name kept -- a priest scanning the header for "which day is this"
  // benefits from it -- but the numeric date itself follows the app-wide
  // DD-MM-YYYY standard rather than the previous "04 August 2026" long form.
  const weekday = new Date(d).toLocaleDateString('en-GB', { weekday: 'long' });
  return `${weekday}, ${formatDateDMY(d)}`;
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

module.exports = { generateDailyRegisterPdf };
