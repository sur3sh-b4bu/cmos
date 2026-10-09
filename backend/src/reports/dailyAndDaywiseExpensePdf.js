const { renderPdfBuffer } = require('../utils/pdfPrinter');
const { formatDateDMY } = require('../utils/dateFormat');
const { getThemePrimaryColor } = require('../utils/themeColors');
const { t, fontFor, localizedName, paymentMethodLabel, hasTamilText } = require('../utils/pdfLabels');

function formatCurrency(val, symbol = '₹') {
  const num = Number(val || 0);
  return `${symbol} ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getMonthLongName(monthYear) {
  if (!monthYear) return '';
  const [y, m] = monthYear.split('-');
  const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }).toUpperCase();
}

/**
 * 1. Selected Day Print (Daily Statement PDF)
 */
async function generateDailyReceiptPaymentPdf({
  date,
  church,
  transactions = [],
  totals = {},
  generatedBy,
  currencySymbol = '₹',
  lang = 'en',
}) {
  const primaryColor = getThemePrimaryColor(church?.theme_color) || '#072a63';
  const isTa = lang === 'ta';

  const allTexts = [
    church?.name,
    church?.name_ta,
    ...transactions.map((tx) => tx.account_head_name),
    ...transactions.map((tx) => tx.account_head_tamil_name),
    ...transactions.map((tx) => tx.head_name),
    ...transactions.map((tx) => tx.paid_to),
    ...transactions.map((tx) => tx.notes),
  ];
  const docFont = fontFor(lang, ...allTexts);

  const reportTitle = isTa ? 'தினசரி வரவு & செலவு அறிக்கை' : 'DAILY RECEIPTS & PAYMENTS STATEMENT';
  const dateFormatted = formatDateDMY(date);

  // Summary Metrics Box
  const summaryBox = {
    table: {
      widths: ['33.3%', '33.3%', '33.4%'],
      body: [
        [
          {
            fillColor: '#f0fdf4',
            margin: [8, 8, 8, 8],
            stack: [
              { text: isTa ? 'அன்றைய வரவு (Receipts)' : 'TODAY RECEIPTS (INCOME)', fontSize: 8.5, bold: true, color: '#166534', alignment: 'center' },
              { text: formatCurrency(totals.totalReceipts, currencySymbol), fontSize: 13, bold: true, color: '#15803d', alignment: 'center', margin: [0, 3, 0, 0] },
              { text: `${totals.receiptCount || 0} ${isTa ? 'வரவு பதிவுகள்' : 'Receipts'}`, fontSize: 7.5, color: '#65a30d', alignment: 'center', margin: [0, 2, 0, 0] },
            ],
          },
          {
            fillColor: '#fef2f2',
            margin: [8, 8, 8, 8],
            stack: [
              { text: isTa ? 'அன்றைய செலவு (Payments)' : 'TODAY PAYMENTS (EXPENSE)', fontSize: 8.5, bold: true, color: '#991b1b', alignment: 'center' },
              { text: formatCurrency(totals.totalPayments, currencySymbol), fontSize: 13, bold: true, color: '#b91c1c', alignment: 'center', margin: [0, 3, 0, 0] },
              { text: `${totals.paymentCount || 0} ${isTa ? 'செலவு பதிவுகள்' : 'Payments'}`, fontSize: 7.5, color: '#ef4444', alignment: 'center', margin: [0, 2, 0, 0] },
            ],
          },
          {
            fillColor: (totals.netBalance || 0) >= 0 ? '#eff6ff' : '#fff7ed',
            margin: [8, 8, 8, 8],
            stack: [
              { text: isTa ? 'அன்றைய நிகர இருப்பு' : 'NET DAILY BALANCE', fontSize: 8.5, bold: true, color: (totals.netBalance || 0) >= 0 ? '#1e40af' : '#c2410c', alignment: 'center' },
              { text: formatCurrency(totals.netBalance, currencySymbol), fontSize: 13, bold: true, color: (totals.netBalance || 0) >= 0 ? '#1d4ed8' : '#ea580c', alignment: 'center', margin: [0, 3, 0, 0] },
              { text: (totals.netBalance || 0) >= 0 ? (isTa ? 'உபரி' : 'Surplus') : (isTa ? 'பற்றாக்குறை' : 'Deficit'), fontSize: 7.5, color: '#64748b', alignment: 'center', margin: [0, 2, 0, 0] },
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
    margin: [0, 0, 0, 10],
  };

  // Payment Mode Breakdown Bar
  const modeBar = {
    table: {
      widths: ['25%', '25%', '25%', '25%'],
      body: [
        [
          { text: `${isTa ? 'ரொக்கம்' : 'Cash'}: ${formatCurrency(totals.cashTotal, currencySymbol)}`, fontSize: 8.5, bold: true, color: '#334155', alignment: 'center', fillColor: '#f8fafc', margin: [4, 4, 4, 4] },
          { text: `${isTa ? 'வங்கி' : 'Bank'}: ${formatCurrency(totals.bankTotal, currencySymbol)}`, fontSize: 8.5, bold: true, color: '#334155', alignment: 'center', fillColor: '#f8fafc', margin: [4, 4, 4, 4] },
          { text: `UPI: ${formatCurrency(totals.upiTotal, currencySymbol)}`, fontSize: 8.5, bold: true, color: '#334155', alignment: 'center', fillColor: '#f8fafc', margin: [4, 4, 4, 4] },
          { text: `${isTa ? 'காசோலை' : 'Cheque'}: ${formatCurrency(totals.chequeTotal, currencySymbol)}`, fontSize: 8.5, bold: true, color: '#334155', alignment: 'center', fillColor: '#f8fafc', margin: [4, 4, 4, 4] },
        ],
      ],
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => '#cbd5e1',
      vLineColor: () => '#cbd5e1',
    },
    margin: [0, 0, 0, 14],
  };

  // Transactions Table Body
  const tableRows = [
    [
      { text: '#', style: 'th', alignment: 'center', width: 22 },
      { text: isTa ? 'வகை' : 'TYPE', style: 'th', width: 52 },
      { text: isTa ? 'விவரம் (Account Head)' : 'ACCOUNT HEAD / PURPOSE', style: 'th', width: '*' },
      { text: isTa ? 'வவுச்சர்' : 'VOUCHER', style: 'th', width: 55, alignment: 'center' },
      { text: isTa ? 'பெயர் / நபர்' : 'PAYER / PAYEE', style: 'th', width: 75 },
      { text: isTa ? 'முறை' : 'MODE', style: 'th', width: 50, alignment: 'center' },
      { text: isTa ? 'வரவு (₹)' : 'RECEIPT (₹)', style: 'th', width: 65, alignment: 'right' },
      { text: isTa ? 'செலவு (₹)' : 'PAYMENT (₹)', style: 'th', width: 65, alignment: 'right' },
    ],
  ];

  if (transactions.length === 0) {
    tableRows.push([
      {
        text: isTa ? 'இந்த நாளில் எந்த வரவு/செலவு பதிவுகளும் இல்லை' : 'No receipts or payments recorded on this day.',
        colSpan: 8,
        italics: true,
        alignment: 'center',
        color: '#64748b',
        margin: [0, 16, 0, 16],
      },
      {}, {}, {}, {}, {}, {}, {},
    ]);
  } else {
    transactions.forEach((tx, idx) => {
      const isRec = tx.type === 'receipt';
      const headName = isTa && tx.account_head_tamil_name
        ? tx.account_head_tamil_name
        : (tx.account_head_name || tx.head_name || 'General');

      tableRows.push([
        { text: String(idx + 1), style: 'td', alignment: 'center' },
        {
          text: isRec ? (isTa ? 'வரவு' : 'RECEIPT') : (isTa ? 'செலவு' : 'PAYMENT'),
          style: 'td',
          bold: true,
          color: isRec ? '#15803d' : '#b91c1c',
          fontSize: 7.5,
        },
        {
          stack: [
            { text: headName, bold: true, fontSize: 8.5 },
            ...(tx.notes ? [{ text: tx.notes, fontSize: 7, color: '#64748b', margin: [0, 1, 0, 0] }] : []),
          ],
          style: 'td',
        },
        { text: tx.voucher_no || `VCH-${tx.id}`, style: 'td', alignment: 'center', fontSize: 7.5 },
        { text: tx.paid_to || '—', style: 'td', fontSize: 8 },
        { text: paymentMethodLabel(lang, tx.payment_method_code) || tx.payment_method_name || 'Cash', style: 'td', alignment: 'center', fontSize: 7.5 },
        { text: isRec ? Number(tx.amount).toFixed(2) : '—', style: 'td', alignment: 'right', bold: isRec, color: isRec ? '#15803d' : '#94a3b8' },
        { text: !isRec ? Number(tx.amount).toFixed(2) : '—', style: 'td', alignment: 'right', bold: !isRec, color: !isRec ? '#b91c1c' : '#94a3b8' },
      ]);
    });

    // Grand Total Row
    tableRows.push([
      { text: isTa ? 'மொத்த கூட்டுத்தொகை' : 'DAILY TOTALS', colSpan: 6, style: 'thTotal', alignment: 'right' },
      {}, {}, {}, {}, {},
      { text: Number(totals.totalReceipts || 0).toFixed(2), style: 'thTotal', alignment: 'right', color: '#15803d' },
      { text: Number(totals.totalPayments || 0).toFixed(2), style: 'thTotal', alignment: 'right', color: '#b91c1c' },
    ]);
  }

  const docDefinition = {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: [32, 75, 32, 50],
    defaultStyle: { font: docFont, fontSize: 8.5, color: '#0f172a' },
    header: (currentPage, pageCount) => ({
      margin: [32, 16, 32, 0],
      stack: [
        {
          columns: [
            {
              stack: [
                { text: localizedName(church?.name, church?.name_ta, lang) || "St. Mary's Church", fontSize: 13, bold: true, color: primaryColor },
                { text: church?.diocese ? `${church.diocese.toUpperCase()} DIOCESE` : 'DIOCESE OF TUTICORIN', fontSize: 8, bold: true, color: '#64748b' },
              ],
              width: '*',
            },
            {
              stack: [
                { text: reportTitle, fontSize: 10.5, bold: true, color: primaryColor, alignment: 'right' },
                { text: `${isTa ? 'தேதி' : 'Date'}: ${dateFormatted}`, fontSize: 9, bold: true, color: '#047857', alignment: 'right', margin: [0, 2, 0, 0] },
              ],
              width: 220,
            },
          ],
        },
        { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 531, y2: 5, lineWidth: 1.2, lineColor: primaryColor }] },
      ],
    }),
    footer: (currentPage, pageCount) => ({
      margin: [32, 0, 32, 16],
      stack: [
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 531, y2: 0, lineWidth: 0.5, lineColor: '#cbd5e1' }] },
        {
          columns: [
            { text: `${isTa ? 'உருவாக்கியவர்' : 'Generated by'}: ${generatedBy || 'COMS System'} · ${new Date().toLocaleString('en-IN')}`, fontSize: 7.5, color: '#64748b' },
            { text: `${isTa ? 'பக்கம்' : 'Page'} ${currentPage} / ${pageCount}`, alignment: 'right', fontSize: 7.5, color: '#64748b' },
          ],
          margin: [0, 4, 0, 0],
        },
      ],
    }),
    content: [
      summaryBox,
      modeBar,
      {
        table: {
          headerRows: 1,
          widths: [22, 52, '*', 55, 75, 50, 65, 65],
          body: tableRows,
        },
        layout: {
          fillColor: (rowIndex) => (rowIndex === 0 ? '#f1f5f9' : rowIndex % 2 === 0 ? '#fbfcfe' : null),
          hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length ? 1 : 0.5),
          hLineColor: (i, node) => (i === 0 || i === 1 || i === node.table.body.length ? primaryColor : '#e2e8f0'),
          vLineWidth: () => 0.5,
          vLineColor: () => '#e2e8f0',
        },
        margin: [0, 0, 0, 25],
      },
      // Signatures
      {
        columns: [
          {
            stack: [
              { text: '_______________________________', color: '#94a3b8' },
              { text: isTa ? 'தயாரித்தவர் / கணக்காளர்' : 'Prepared By / Accountant', bold: true, fontSize: 8.5, margin: [0, 3, 0, 0] },
            ],
            width: '50%',
          },
          {
            stack: [
              { text: '_______________________________', color: '#94a3b8', alignment: 'right' },
              { text: isTa ? 'பங்குத்தந்தை / பொறுப்பாளர்' : 'Parish Priest / In-Charge', bold: true, fontSize: 8.5, alignment: 'right', margin: [0, 3, 0, 0] },
            ],
            width: '50%',
          },
        ],
        margin: [0, 20, 0, 0],
      },
    ],
    styles: {
      th: { fontSize: 8, bold: true, color: primaryColor, margin: [2, 4, 2, 4] },
      td: { fontSize: 8, margin: [2, 3, 2, 3] },
      thTotal: { fontSize: 8.5, bold: true, color: primaryColor, fillColor: '#f1f5f9', margin: [2, 5, 2, 5] },
    },
  };

  return renderPdfBuffer(docDefinition);
}

/**
 * 2. Day-wise 31 Days Monthly Register (1 to 31 Days Day-by-Day Statement PDF)
 */
async function generateDaywiseMonthReceiptPaymentPdf({
  monthYear,
  church,
  dailyBreakdown = [],
  totals = {},
  generatedBy,
  currencySymbol = '₹',
  lang = 'en',
}) {
  const primaryColor = getThemePrimaryColor(church?.theme_color) || '#072a63';
  const isTa = lang === 'ta';
  const monthTitle = getMonthLongName(monthYear);

  const allTexts = [
    church?.name,
    church?.name_ta,
    ...dailyBreakdown.flatMap((d) => (d.entries || []).map((e) => e.account_head_name)),
    ...dailyBreakdown.flatMap((d) => (d.entries || []).map((e) => e.account_head_tamil_name)),
    ...dailyBreakdown.flatMap((d) => (d.entries || []).map((e) => e.paid_to)),
  ];
  const docFont = fontFor(lang, ...allTexts);

  const reportTitle = isTa
    ? `${monthTitle} - 31 நாட்கள் தினசரி வரவு & செலவு பதிவேடு`
    : `${monthTitle} - 31 DAYS DAY-WISE RECEIPTS & PAYMENTS REGISTER`;

  // Summary KPI Header Banner
  const summaryBox = {
    table: {
      widths: ['25%', '25%', '25%', '25%'],
      body: [
        [
          {
            fillColor: '#f0fdf4',
            margin: [6, 6, 6, 6],
            stack: [
              { text: isTa ? 'மாதத்தின் மொத்த வரவு' : 'MONTH TOTAL RECEIPTS', fontSize: 8, bold: true, color: '#166534', alignment: 'center' },
              { text: formatCurrency(totals.totalReceipts, currencySymbol), fontSize: 12, bold: true, color: '#15803d', alignment: 'center', margin: [0, 2, 0, 0] },
            ],
          },
          {
            fillColor: '#fef2f2',
            margin: [6, 6, 6, 6],
            stack: [
              { text: isTa ? 'மாதத்தின் மொத்த செலவு' : 'MONTH TOTAL PAYMENTS', fontSize: 8, bold: true, color: '#991b1b', alignment: 'center' },
              { text: formatCurrency(totals.totalPayments, currencySymbol), fontSize: 12, bold: true, color: '#b91c1c', alignment: 'center', margin: [0, 2, 0, 0] },
            ],
          },
          {
            fillColor: (totals.netBalance || 0) >= 0 ? '#eff6ff' : '#fff7ed',
            margin: [6, 6, 6, 6],
            stack: [
              { text: isTa ? 'மாத நிகர இருப்பு (மீதம்)' : 'MONTH NET BALANCE', fontSize: 8, bold: true, color: (totals.netBalance || 0) >= 0 ? '#1e40af' : '#c2410c', alignment: 'center' },
              { text: formatCurrency(totals.netBalance, currencySymbol), fontSize: 12, bold: true, color: (totals.netBalance || 0) >= 0 ? '#1d4ed8' : '#ea580c', alignment: 'center', margin: [0, 2, 0, 0] },
            ],
          },
          {
            fillColor: '#f8fafc',
            margin: [6, 6, 6, 6],
            stack: [
              { text: isTa ? 'மொத்த பதிவுகள்' : 'TOTAL TRANSACTIONS', fontSize: 8, bold: true, color: '#334155', alignment: 'center' },
              { text: `${totals.totalCount || 0} Entries`, fontSize: 12, bold: true, color: '#0f172a', alignment: 'center', margin: [0, 2, 0, 0] },
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
    margin: [0, 0, 0, 10],
  };

  // Day-wise Table Body
  const tableRows = [
    [
      { text: isTa ? 'நாள் / தேதி' : 'DAY / DATE', style: 'th', width: 70 },
      { text: isTa ? 'பதிவுகள்' : 'COUNT', style: 'th', width: 42, alignment: 'center' },
      { text: isTa ? 'விவர சுருக்கம் (வகை & கணக்கு தலைப்பு)' : 'PARTICULARS / ACCOUNT HEADS SUMMARY', style: 'th', width: '*' },
      { text: isTa ? 'வரவு (₹)' : 'RECEIPTS (₹)', style: 'th', width: 75, alignment: 'right' },
      { text: isTa ? 'செலவு (₹)' : 'PAYMENTS (₹)', style: 'th', width: 75, alignment: 'right' },
      { text: isTa ? 'அன்றைய நிகரம் (₹)' : 'DAY NET (₹)', style: 'th', width: 75, alignment: 'right' },
    ],
  ];

  let runningNet = 0;

  dailyBreakdown.forEach((dayItem) => {
    const hasTx = dayItem.entries && dayItem.entries.length > 0;
    const dayRec = Number(dayItem.receipts || 0);
    const dayPay = Number(dayItem.payments || 0);
    const dayNet = dayRec - dayPay;
    runningNet += dayNet;

    const particularsStack = [];
    if (hasTx) {
      dayItem.entries.forEach((e) => {
        const isR = e.type === 'receipt';
        const hName = isTa && e.account_head_tamil_name
          ? e.account_head_tamil_name
          : (e.account_head_name || e.head_name || 'General');
        particularsStack.push({
          text: [
            { text: `• [${isR ? 'REC' : 'PAY'}] `, bold: true, color: isR ? '#15803d' : '#b91c1c' },
            { text: `${hName}` },
            ...(e.paid_to ? [{ text: ` (${e.paid_to})`, color: '#64748b' }] : []),
            { text: ` : ₹${Number(e.amount).toFixed(2)}`, bold: true },
          ],
          fontSize: 7.5,
          margin: [0, 1, 0, 1],
        });
      });
    } else {
      particularsStack.push({ text: '—', color: '#94a3b8', italics: true, fontSize: 8 });
    }

    tableRows.push([
      {
        stack: [
          { text: dayItem.dayLabel, bold: true, fontSize: 8.5, color: '#0f172a' },
          { text: dayItem.dateDMY, fontSize: 7, color: '#64748b' },
        ],
        style: 'td',
        fillColor: hasTx ? (dayItem.dayNum % 2 === 0 ? '#fbfcfe' : '#ffffff') : '#f8fafc',
      },
      {
        text: hasTx ? String(dayItem.entries.length) : '0',
        style: 'td',
        alignment: 'center',
        fontSize: 8,
        color: hasTx ? '#0f172a' : '#94a3b8',
        fillColor: hasTx ? (dayItem.dayNum % 2 === 0 ? '#fbfcfe' : '#ffffff') : '#f8fafc',
      },
      {
        stack: particularsStack,
        style: 'td',
        fillColor: hasTx ? (dayItem.dayNum % 2 === 0 ? '#fbfcfe' : '#ffffff') : '#f8fafc',
      },
      {
        text: dayRec > 0 ? dayRec.toFixed(2) : '—',
        style: 'td',
        alignment: 'right',
        bold: dayRec > 0,
        color: dayRec > 0 ? '#15803d' : '#94a3b8',
        fillColor: hasTx ? (dayItem.dayNum % 2 === 0 ? '#fbfcfe' : '#ffffff') : '#f8fafc',
      },
      {
        text: dayPay > 0 ? dayPay.toFixed(2) : '—',
        style: 'td',
        alignment: 'right',
        bold: dayPay > 0,
        color: dayPay > 0 ? '#b91c1c' : '#94a3b8',
        fillColor: hasTx ? (dayItem.dayNum % 2 === 0 ? '#fbfcfe' : '#ffffff') : '#f8fafc',
      },
      {
        text: hasTx ? (dayNet >= 0 ? `+${dayNet.toFixed(2)}` : dayNet.toFixed(2)) : '—',
        style: 'td',
        alignment: 'right',
        bold: hasTx,
        color: hasTx ? (dayNet >= 0 ? '#1d4ed8' : '#ea580c') : '#94a3b8',
        fillColor: hasTx ? (dayItem.dayNum % 2 === 0 ? '#fbfcfe' : '#ffffff') : '#f8fafc',
      },
    ]);
  });

  // Grand Total Row
  tableRows.push([
    { text: isTa ? 'மாத மொத்த கூட்டுத்தொகை (GRAND TOTAL)' : 'MONTH GRAND TOTALS', colSpan: 3, style: 'thTotal', alignment: 'right' },
    {}, {},
    { text: Number(totals.totalReceipts || 0).toFixed(2), style: 'thTotal', alignment: 'right', color: '#15803d' },
    { text: Number(totals.totalPayments || 0).toFixed(2), style: 'thTotal', alignment: 'right', color: '#b91c1c' },
    { text: Number(totals.netBalance || 0).toFixed(2), style: 'thTotal', alignment: 'right', color: (totals.netBalance || 0) >= 0 ? '#1d4ed8' : '#ea580c' },
  ]);

  const docDefinition = {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: [32, 75, 32, 50],
    defaultStyle: { font: docFont, fontSize: 8.5, color: '#0f172a' },
    header: (currentPage, pageCount) => ({
      margin: [32, 16, 32, 0],
      stack: [
        {
          columns: [
            {
              stack: [
                { text: localizedName(church?.name, church?.name_ta, lang) || "St. Mary's Church", fontSize: 13, bold: true, color: primaryColor },
                { text: church?.diocese ? `${church.diocese.toUpperCase()} DIOCESE` : 'DIOCESE OF TUTICORIN', fontSize: 8, bold: true, color: '#64748b' },
              ],
              width: '*',
            },
            {
              stack: [
                { text: reportTitle, fontSize: 10, bold: true, color: primaryColor, alignment: 'right' },
                { text: `${isTa ? 'மாதம்' : 'Month'}: ${monthTitle}`, fontSize: 9, bold: true, color: '#047857', alignment: 'right', margin: [0, 2, 0, 0] },
              ],
              width: 250,
            },
          ],
        },
        { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 531, y2: 5, lineWidth: 1.2, lineColor: primaryColor }] },
      ],
    }),
    footer: (currentPage, pageCount) => ({
      margin: [32, 0, 32, 16],
      stack: [
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 531, y2: 0, lineWidth: 0.5, lineColor: '#cbd5e1' }] },
        {
          columns: [
            { text: `${isTa ? 'உருவாக்கியவர்' : 'Generated by'}: ${generatedBy || 'COMS System'} · ${new Date().toLocaleString('en-IN')}`, fontSize: 7.5, color: '#64748b' },
            { text: `${isTa ? 'பக்கம்' : 'Page'} ${currentPage} / ${pageCount}`, alignment: 'right', fontSize: 7.5, color: '#64748b' },
          ],
          margin: [0, 4, 0, 0],
        },
      ],
    }),
    content: [
      summaryBox,
      {
        table: {
          headerRows: 1,
          widths: [70, 42, '*', 75, 75, 75],
          body: tableRows,
        },
        layout: {
          fillColor: (rowIndex) => (rowIndex === 0 ? '#f1f5f9' : null),
          hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length ? 1 : 0.5),
          hLineColor: (i, node) => (i === 0 || i === 1 || i === node.table.body.length ? primaryColor : '#e2e8f0'),
          vLineWidth: () => 0.5,
          vLineColor: () => '#e2e8f0',
        },
        margin: [0, 0, 0, 25],
      },
      // Signatures
      {
        columns: [
          {
            stack: [
              { text: '_______________________________', color: '#94a3b8' },
              { text: isTa ? 'தயாரித்தவர் / கணக்காளர்' : 'Prepared By / Accountant', bold: true, fontSize: 8.5, margin: [0, 3, 0, 0] },
            ],
            width: '50%',
          },
          {
            stack: [
              { text: '_______________________________', color: '#94a3b8', alignment: 'right' },
              { text: isTa ? 'பங்குத்தந்தை / பொறுப்பாளர்' : 'Parish Priest / In-Charge', bold: true, fontSize: 8.5, alignment: 'right', margin: [0, 3, 0, 0] },
            ],
            width: '50%',
          },
        ],
        margin: [0, 20, 0, 0],
      },
    ],
    styles: {
      th: { fontSize: 8, bold: true, color: primaryColor, margin: [2, 4, 2, 4] },
      td: { fontSize: 8, margin: [2, 3, 2, 3] },
      thTotal: { fontSize: 8.5, bold: true, color: primaryColor, fillColor: '#f1f5f9', margin: [2, 5, 2, 5] },
    },
  };

  return renderPdfBuffer(docDefinition);
}

module.exports = {
  generateDailyReceiptPaymentPdf,
  generateDaywiseMonthReceiptPaymentPdf,
};
