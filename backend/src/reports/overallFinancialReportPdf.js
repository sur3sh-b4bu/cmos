const { renderPdfBuffer } = require('../utils/pdfPrinter');
const { formatDateDMY } = require('../utils/dateFormat');
const { getThemePrimaryColor } = require('../utils/themeColors');
const { t, fontFor, localizedName, paymentMethodLabel, periodText, hasTamilText } = require('../utils/pdfLabels');

function formatCurrency(val, symbol = '₹') {
  const num = Number(val || 0);
  return `${symbol} ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCurrencyShort(val, symbol = '₹') {
  const num = Number(val || 0);
  return `${symbol}${num.toFixed(2)}`;
}

/**
 * Generates the Overall Consolidated Financial & Revenue Report PDF for a date range.
 * Includes:
 * 1. Executive financial summary (Total Income, Total Expense, Net Balance)
 * 2. Revenue / Income stream breakdown (Mass Intentions, Contributions, Other Receipts)
 * 3. Operating Expenditure / Payment breakdown by Account Head
 * 4. Payment Mode reconciliation table (Cash, Bank Transfer, UPI)
 */
async function generateOverallFinancialReportPdf({
  dateFrom,
  dateTo,
  church,
  data,
  generatedBy,
  currencySymbol = '₹',
  lang = 'en',
}) {
  const generatedAt = new Date();
  const isSingleDay = dateFrom === dateTo;
  const primaryColor = getThemePrimaryColor(church?.theme_color) || '#072a63';

  // Check all strings for Tamil font switching
  const allTexts = [
    church?.name,
    church?.name_ta,
    ...(data.contributions?.types || []).map((t) => t.typeName),
    ...(data.contributions?.types || []).map((t) => t.typeNameTa),
    ...(data.otherReceipts?.heads || []).map((h) => h.headName),
    ...(data.otherReceipts?.heads || []).map((h) => h.headTamilName),
    ...(data.expenses?.heads || []).map((h) => h.headName),
    ...(data.expenses?.heads || []).map((h) => h.headTamilName),
  ];
  const docFont = fontFor(lang, ...allTexts);

  const summary = data.summary || {};
  const modeTotals = data.modeTotals || {};

  const isTa = lang === 'ta';
  const reportTitle = isTa ? 'ஒருங்கிணைந்த நிதி & வருவாய் அறிக்கை' : 'CONSOLIDATED FINANCIAL & REVENUE REPORT';
  const subTitleText = isSingleDay
    ? `${t(lang, 'date')}: ${formatDateDMY(dateFrom)}`
    : periodText(lang, formatDateDMY(dateFrom), formatDateDMY(dateTo));

  // 1. Executive KPI Summary Box
  const summaryBox = {
    table: {
      widths: ['33.3%', '33.3%', '33.4%'],
      body: [
        [
          {
            fillColor: '#f0fdf4',
            margin: [8, 8, 8, 8],
            stack: [
              { text: isTa ? 'மொத்த வருவாய் (வரவு)' : 'TOTAL REVENUE (INCOME)', fontSize: 8.5, bold: true, color: '#166534', alignment: 'center' },
              { text: formatCurrency(summary.totalIncome, currencySymbol), fontSize: 13, bold: true, color: '#15803d', alignment: 'center', margin: [0, 4, 0, 0] },
              { text: `${summary.massCount + summary.contribCount + summary.otherReceiptsCount} ${isTa ? 'பதிவுகள்' : 'Transactions'}`, fontSize: 8, color: '#65a30d', alignment: 'center', margin: [0, 2, 0, 0] },
            ],
          },
          {
            fillColor: '#fef2f2',
            margin: [8, 8, 8, 8],
            stack: [
              { text: isTa ? 'மொத்த செலவினங்கள் (பற்று)' : 'TOTAL EXPENDITURE (EXPENSE)', fontSize: 8.5, bold: true, color: '#991b1b', alignment: 'center' },
              { text: formatCurrency(summary.totalExpense, currencySymbol), fontSize: 13, bold: true, color: '#b91c1c', alignment: 'center', margin: [0, 4, 0, 0] },
              { text: `${summary.paymentsCount} ${isTa ? 'செலவு பதிவுகள்' : 'Expense Entries'}`, fontSize: 8, color: '#ef4444', alignment: 'center', margin: [0, 2, 0, 0] },
            ],
          },
          {
            fillColor: summary.netBalance >= 0 ? '#eff6ff' : '#fff7ed',
            margin: [8, 8, 8, 8],
            stack: [
              { text: isTa ? 'நிகர இருப்பு / மீதம்' : 'NET SURPLUS / BALANCE', fontSize: 8.5, bold: true, color: summary.netBalance >= 0 ? '#1e40af' : '#c2410c', alignment: 'center' },
              { text: formatCurrency(summary.netBalance, currencySymbol), fontSize: 13, bold: true, color: summary.netBalance >= 0 ? '#1d4ed8' : '#ea580c', alignment: 'center', margin: [0, 4, 0, 0] },
              { text: summary.netBalance >= 0 ? (isTa ? 'உபரி இருப்பு' : 'Surplus') : (isTa ? 'பற்றாக்குறை' : 'Deficit'), fontSize: 8, color: '#64748b', alignment: 'center', margin: [0, 2, 0, 0] },
            ],
          },
        ],
      ],
    },
    layout: {
      hLineWidth: () => 1,
      vLineWidth: () => 1,
      hLineColor: () => '#e2e8f0',
      vLineColor: () => '#e2e8f0',
    },
    margin: [0, 0, 0, 14],
  };

  // 2. Income / Receipts Table Body
  const incomeTableRows = [
    [
      { text: '#', style: 'tableHeader', alignment: 'center', width: 22 },
      { text: isTa ? 'வருவாய் வகை / மூல தலைப்பு' : 'Income Head / Revenue Stream', style: 'tableHeader' },
      { text: isTa ? 'முறை' : 'Mode / Split', style: 'tableHeader', width: 105 },
      { text: isTa ? 'எண்ணிக்கை' : 'Entries', style: 'tableHeader', alignment: 'center', width: 45 },
      { text: isTa ? 'தொகை' : 'Amount', style: 'tableHeader', alignment: 'right', width: 75 },
    ],
  ];

  let incIdx = 1;

  // Mass Intentions Row
  const massMethodsText = (data.massIntentions?.methods || [])
    .map((m) => `${paymentMethodLabel(m.method, lang)}: ${formatCurrencyShort(m.total, currencySymbol)}`)
    .join('\n');
  incomeTableRows.push([
    { text: String(incIdx++), style: 'cell', alignment: 'center' },
    {
      stack: [
        { text: isTa ? 'திருப்பலி கருத்து காணிக்கைகள்' : 'Mass Intentions Offerings', bold: true, style: 'cell' },
        { text: isTa ? 'திருப்பலி வேண்டுதல் பதிவுகள்' : 'People Mass Intentions bookings', fontSize: 8, color: '#64748b' },
      ],
    },
    { text: massMethodsText || '-', fontSize: 8, color: '#334155' },
    { text: String(data.massIntentions?.count || 0), style: 'cell', alignment: 'center' },
    { text: formatCurrencyShort(data.massIntentions?.total, currencySymbol), style: 'cell', alignment: 'right', bold: true },
  ]);

  // Contribution Types Rows
  if ((data.contributions?.types || []).length > 0) {
    for (const ct of data.contributions.types) {
      const typeLabel = (isTa && ct.typeNameTa) ? ct.typeNameTa : ct.typeName;
      incomeTableRows.push([
        { text: String(incIdx++), style: 'cell', alignment: 'center' },
        {
          stack: [
            { text: `${isTa ? 'பங்களிப்பு' : 'Contribution'}: ${typeLabel}`, bold: true, style: 'cell' },
          ],
        },
        { text: isTa ? 'பங்களிப்பு நிதி' : 'Devotions & Offerings', fontSize: 8, color: '#64748b' },
        { text: String(ct.count), style: 'cell', alignment: 'center' },
        { text: formatCurrencyShort(ct.total, currencySymbol), style: 'cell', alignment: 'right' },
      ]);
    }
  } else if (data.contributions?.total > 0) {
    incomeTableRows.push([
      { text: String(incIdx++), style: 'cell', alignment: 'center' },
      { text: isTa ? 'பொது நன்கொடைகள் / பங்களிப்புகள்' : 'Contributions / Offerings', bold: true, style: 'cell' },
      { text: '-', fontSize: 8, color: '#64748b' },
      { text: String(data.contributions?.count || 0), style: 'cell', alignment: 'center' },
      { text: formatCurrencyShort(data.contributions?.total, currencySymbol), style: 'cell', alignment: 'right', bold: true },
    ]);
  }

  // Other Church Receipts Rows
  if ((data.otherReceipts?.heads || []).length > 0) {
    for (const rh of data.otherReceipts.heads) {
      const headLabel = (isTa && rh.headTamilName) ? rh.headTamilName : rh.headName;
      incomeTableRows.push([
        { text: String(incIdx++), style: 'cell', alignment: 'center' },
        {
          stack: [
            { text: headLabel, bold: true, style: 'cell' },
            ...(rh.section ? [{ text: rh.section, fontSize: 8, color: '#64748b' }] : []),
          ],
        },
        { text: isTa ? 'இதர வரவு' : 'Other Receipt', fontSize: 8, color: '#64748b' },
        { text: String(rh.count), style: 'cell', alignment: 'center' },
        { text: formatCurrencyShort(rh.total, currencySymbol), style: 'cell', alignment: 'right' },
      ]);
    }
  }

  // Total Income Row
  incomeTableRows.push([
    { text: '', border: [false, true, false, false] },
    { text: isTa ? 'மொத்த வருவாய் / வரவு' : 'TOTAL INCOME / RECEIPTS', style: 'totalLabel', colSpan: 3, border: [false, true, false, false], color: '#15803d' },
    {},
    {},
    { text: formatCurrencyShort(summary.totalIncome, currencySymbol), style: 'totalValue', alignment: 'right', border: [false, true, false, false], color: '#15803d' },
  ]);

  // 3. Operating Expenditure Table Body
  const expenseTableRows = [
    [
      { text: '#', style: 'tableHeader', alignment: 'center', width: 22 },
      { text: isTa ? 'செலவுத் தலைப்பு / விளக்கம்' : 'Expense Account Head / Category', style: 'tableHeader' },
      { text: isTa ? 'பிரிவு' : 'Section', style: 'tableHeader', width: 105 },
      { text: isTa ? 'எண்ணிக்கை' : 'Entries', style: 'tableHeader', alignment: 'center', width: 45 },
      { text: isTa ? 'தொகை' : 'Amount', style: 'tableHeader', alignment: 'right', width: 75 },
    ],
  ];

  let expIdx = 1;
  if ((data.expenses?.heads || []).length > 0) {
    for (const eh of data.expenses.heads) {
      const headLabel = (isTa && eh.headTamilName) ? eh.headTamilName : eh.headName;
      expenseTableRows.push([
        { text: String(expIdx++), style: 'cell', alignment: 'center' },
        { text: headLabel, bold: true, style: 'cell' },
        { text: eh.section || (isTa ? 'பொது செலவு' : 'Parish Expense'), fontSize: 8, color: '#64748b' },
        { text: String(eh.count), style: 'cell', alignment: 'center' },
        { text: formatCurrencyShort(eh.total, currencySymbol), style: 'cell', alignment: 'right' },
      ]);
    }
  } else {
    expenseTableRows.push([
      { text: '-', alignment: 'center', style: 'cell' },
      { text: isTa ? 'இந்த காலகட்டத்தில் செலவுகள் எதுவும் இல்லை' : 'No expenses recorded for this period', italics: true, color: '#64748b', colSpan: 4, style: 'cell' },
      {},
      {},
      {},
    ]);
  }

  // Total Expense Row
  expenseTableRows.push([
    { text: '', border: [false, true, false, false] },
    { text: isTa ? 'மொத்த செலவினங்கள் / பற்று' : 'TOTAL EXPENDITURE / PAYMENTS', style: 'totalLabel', colSpan: 3, border: [false, true, false, false], color: '#b91c1c' },
    {},
    {},
    { text: formatCurrencyShort(summary.totalExpense, currencySymbol), style: 'totalValue', alignment: 'right', border: [false, true, false, false], color: '#b91c1c' },
  ]);

  // 4. Payment Mode Summary Table
  const modeTableRows = [
    [
      { text: isTa ? 'பரிவர்த்தனை முறை' : 'Payment Mode / Channel', style: 'tableHeader' },
      { text: isTa ? 'வரவு (Income)' : 'Total Received', style: 'tableHeader', alignment: 'right' },
      { text: isTa ? 'பற்று (Expense)' : 'Total Paid Out', style: 'tableHeader', alignment: 'right' },
      { text: isTa ? 'நிகர இருப்பு (Net Balance)' : 'Net Mode Balance', style: 'tableHeader', alignment: 'right' },
    ],
    [
      { text: isTa ? 'பணம் (Cash in Hand)' : 'Cash in Hand', bold: true, style: 'cell' },
      { text: formatCurrencyShort(modeTotals.cash?.income || 0, currencySymbol), style: 'cell', alignment: 'right' },
      { text: formatCurrencyShort(modeTotals.cash?.expense || 0, currencySymbol), style: 'cell', alignment: 'right' },
      { text: formatCurrencyShort(modeTotals.cash?.balance || 0, currencySymbol), style: 'cell', alignment: 'right', bold: true, color: (modeTotals.cash?.balance || 0) >= 0 ? primaryColor : '#b91c1c' },
    ],
    [
      { text: isTa ? 'வங்கி / காசோலை (Bank & Cheque)' : 'Bank Transfer & Cheque', bold: true, style: 'cell' },
      { text: formatCurrencyShort(modeTotals.bank?.income || 0, currencySymbol), style: 'cell', alignment: 'right' },
      { text: formatCurrencyShort(modeTotals.bank?.expense || 0, currencySymbol), style: 'cell', alignment: 'right' },
      { text: formatCurrencyShort(modeTotals.bank?.balance || 0, currencySymbol), style: 'cell', alignment: 'right', bold: true, color: (modeTotals.bank?.balance || 0) >= 0 ? primaryColor : '#b91c1c' },
    ],
    [
      { text: isTa ? 'UPI / டிஜிட்டல் பரிவர்த்தனை (UPI / QR / Online)' : 'UPI & Online Digital', bold: true, style: 'cell' },
      { text: formatCurrencyShort(modeTotals.upi?.income || 0, currencySymbol), style: 'cell', alignment: 'right' },
      { text: formatCurrencyShort(modeTotals.upi?.expense || 0, currencySymbol), style: 'cell', alignment: 'right' },
      { text: formatCurrencyShort(modeTotals.upi?.balance || 0, currencySymbol), style: 'cell', alignment: 'right', bold: true, color: (modeTotals.upi?.balance || 0) >= 0 ? primaryColor : '#b91c1c' },
    ],
    ...(modeTotals.other?.income > 0 || modeTotals.other?.expense > 0
      ? [
          [
            { text: isTa ? 'மற்றவை (Other)' : 'Other Methods', bold: true, style: 'cell' },
            { text: formatCurrencyShort(modeTotals.other?.income || 0, currencySymbol), style: 'cell', alignment: 'right' },
            { text: formatCurrencyShort(modeTotals.other?.expense || 0, currencySymbol), style: 'cell', alignment: 'right' },
            { text: formatCurrencyShort(modeTotals.other?.balance || 0, currencySymbol), style: 'cell', alignment: 'right', bold: true },
          ],
        ]
      : []),
    [
      { text: isTa ? 'மொத்தம் (Grand Total)' : 'Grand Total', style: 'totalLabel', color: primaryColor },
      { text: formatCurrencyShort(summary.totalIncome, currencySymbol), style: 'totalValue', alignment: 'right', color: '#15803d' },
      { text: formatCurrencyShort(summary.totalExpense, currencySymbol), style: 'totalValue', alignment: 'right', color: '#b91c1c' },
      { text: formatCurrencyShort(summary.netBalance, currencySymbol), style: 'totalValue', alignment: 'right', color: summary.netBalance >= 0 ? primaryColor : '#b91c1c' },
    ],
  ];

  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [36, 96, 36, 60],
    defaultStyle: { font: docFont, fontSize: 9.5, color: '#1e293b' },
    header: (currentPage) => ({
      margin: [36, 18, 36, 0],
      stack: [
        {
          columns: [
            { text: localizedName(church?.name, church?.name_ta, lang) || t(lang, 'churchOffice'), style: 'churchName', width: '*' },
            { text: `${t(lang, 'page')} ${currentPage}`, alignment: 'right', fontSize: 8.5, color: '#888888', width: 80 },
          ],
        },
        { text: reportTitle, style: 'docTitle' },
        {
          columns: [
            { text: subTitleText, fontSize: 9.5, color: '#334155' },
            [
              { text: `${t(lang, 'printedBy')}: ${generatedBy || t(lang, 'system')}`, alignment: 'right', fontSize: 9.5, bold: true, color: '#0f172a' },
              { text: `${t(lang, 'generated')}: ${formatDateDMY(generatedAt)}`, alignment: 'right', fontSize: 8, color: '#64748b' },
            ],
          ],
        },
        { canvas: [{ type: 'line', x1: 0, y1: 4, x2: 523, y2: 4, lineWidth: 1.2, lineColor: '#b08d2b' }] },
      ],
    }),
    footer: (currentPage, pageCount) => ({
      margin: [36, 0, 36, 18],
      stack: [
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 523, y2: 0, lineWidth: 0.5, lineColor: '#cbd5e1' }] },
        {
          columns: [
            { text: `${t(lang, 'generatedBy')}: ${generatedBy || t(lang, 'system')} | ${localizedName(church?.name, church?.name_ta, lang)}`, fontSize: 8, color: '#64748b' },
            { text: `${t(lang, 'page')} ${currentPage} ${t(lang, 'of')} ${pageCount}`, alignment: 'right', fontSize: 8, color: '#64748b' },
          ],
          margin: [0, 4, 0, 0],
        },
      ],
    }),
    content: [
      // 1. Executive Summary Cards
      summaryBox,

      // 2. Income / Receipts Section
      { text: isTa ? '1. வருவாய் விவரங்கள் (RECEIPTS & REVENUE)' : '1. REVENUE & RECEIPTS BREAKDOWN', style: 'sectionHeader', margin: [0, 0, 0, 6] },
      {
        table: {
          headerRows: 1,
          widths: [22, '*', 105, 45, 75],
          body: incomeTableRows,
        },
        layout: {
          fillColor: (rowIndex) => (rowIndex === 0 ? '#f8fafc' : rowIndex % 2 === 0 ? '#fafaf9' : null),
          hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length - 1 || i === node.table.body.length ? 1 : 0.4),
          hLineColor: (i, node) => (i === 0 || i === 1 || i === node.table.body.length - 1 || i === node.table.body.length ? primaryColor : '#e2e8f0'),
          vLineWidth: () => 0.4,
          vLineColor: () => '#e2e8f0',
        },
        margin: [0, 0, 0, 14],
      },

      // 3. Operating Expenditure Section
      { text: isTa ? '2. செலவின விவரங்கள் (EXPENDITURE & PAYMENTS)' : '2. EXPENDITURE & PAYMENTS BREAKDOWN', style: 'sectionHeader', margin: [0, 6, 0, 6] },
      {
        table: {
          headerRows: 1,
          widths: [22, '*', 105, 45, 75],
          body: expenseTableRows,
        },
        layout: {
          fillColor: (rowIndex) => (rowIndex === 0 ? '#f8fafc' : rowIndex % 2 === 0 ? '#fafaf9' : null),
          hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length - 1 || i === node.table.body.length ? 1 : 0.4),
          hLineColor: (i, node) => (i === 0 || i === 1 || i === node.table.body.length - 1 || i === node.table.body.length ? primaryColor : '#e2e8f0'),
          vLineWidth: () => 0.4,
          vLineColor: () => '#e2e8f0',
        },
        margin: [0, 0, 0, 14],
      },

      // 4. Payment Modes Breakdown Section
      { text: isTa ? '3. கட்டண முறை வாரியான நிதி இருப்பு (PAYMENT MODE RECONCILIATION)' : '3. PAYMENT MODE RECONCILIATION & NET BALANCES', style: 'sectionHeader', margin: [0, 6, 0, 6] },
      {
        table: {
          headerRows: 1,
          widths: ['*', 90, 90, 100],
          body: modeTableRows,
        },
        layout: {
          fillColor: (rowIndex) => (rowIndex === 0 ? '#f8fafc' : rowIndex % 2 === 0 ? '#fafaf9' : null),
          hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length - 1 || i === node.table.body.length ? 1 : 0.4),
          hLineColor: (i, node) => (i === 0 || i === 1 || i === node.table.body.length - 1 || i === node.table.body.length ? primaryColor : '#e2e8f0'),
          vLineWidth: () => 0.4,
          vLineColor: () => '#e2e8f0',
        },
        margin: [0, 0, 0, 24],
      },

      // 5. Signatures Block
      {
        columns: [
          { text: `${t(lang, 'date')}: ${formatDateDMY(new Date())}`, fontSize: 9.5, bold: true, width: '33%' },
          { text: isTa ? 'முத்திரை (Seal)' : 'Seal', fontSize: 9.5, bold: true, alignment: 'center', width: '33%' },
          { text: isTa ? 'பங்குத்தந்தை / பொருளாளர்\n(Parish Priest / Bursar)' : 'Parish Priest / Bursar', fontSize: 9.5, bold: true, alignment: 'right', width: '34%' },
        ],
        margin: [0, 10, 0, 0],
      },
    ],
    styles: {
      churchName: { fontSize: 15, bold: true, color: primaryColor },
      docTitle: { fontSize: 11, bold: true, color: '#b08d2b', margin: [0, 2, 0, 3] },
      sectionHeader: { fontSize: 10.5, bold: true, color: primaryColor },
      tableHeader: { bold: true, color: primaryColor, fontSize: 9 },
      cell: { fontSize: 9, margin: [0, 2, 0, 2] },
      totalLabel: { fontSize: 9.5, bold: true, margin: [0, 4, 0, 2] },
      totalValue: { fontSize: 10, bold: true, margin: [0, 4, 0, 2] },
    },
  };

  return renderPdfBuffer(docDefinition);
}

module.exports = { generateOverallFinancialReportPdf };
