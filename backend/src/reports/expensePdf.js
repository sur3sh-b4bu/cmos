const { renderPdfBuffer } = require('../utils/pdfPrinter');
const { getThemePrimaryColor } = require('../utils/themeColors');
const { hasTamilText } = require('../utils/pdfLabels');

function formatCurrency(val, symbol = '₹') {
  const num = Number(val || 0);
  return `${symbol} ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function splitRsPs(val) {
  if (val === undefined || val === null || val === '') return { rs: '', ps: '' };
  const num = Number(val);
  if (isNaN(num) || num === 0) return { rs: '', ps: '' };
  const fixed = num.toFixed(2);
  const [rs, ps] = fixed.split('.');
  return { rs, ps };
}

function getMonthName(monthYear) {
  if (!monthYear) return '';
  const [y, m] = monthYear.split('-');
  const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }).toUpperCase();
}

async function generateMonthlyAccountsPdf({
  data,
  church,
  currencySymbol = '₹',
  lang = 'en',
}) {
  const THEME_COLOR = getThemePrimaryColor(church?.theme_color) || '#072a63';
  const DATA_COLOR = '#000000';
  const monthYearStr = getMonthName(data.monthYear);
  const churchName = (church?.name || "St. Mary's Church").toUpperCase();
  const dioceseName = (church?.diocese || 'Tuticorin Diocese').toUpperCase();

  const receipts = data.receipts || [];
  const payments = data.payments || [];
  const maxRows = Math.max(receipts.length, payments.length);

  // Group items by section for receipts and payments
  const ledgerTableBody = [
    [
      { text: 'RECEIPTS', style: 'tableHeader', alignment: 'center', fillColor: '#f1f5f9' },
      { text: 'TOTAL (Rs.)', style: 'tableHeader', alignment: 'right', fillColor: '#f1f5f9', width: 75 },
      { text: 'PAYMENTS', style: 'tableHeader', alignment: 'center', fillColor: '#f1f5f9' },
      { text: 'TOTAL (Rs.)', style: 'tableHeader', alignment: 'right', fillColor: '#f1f5f9', width: 75 },
    ],
  ];

  for (let i = 0; i < maxRows; i++) {
    const r = receipts[i];
    const p = payments[i];

    const rText = r ? (r.tamil_name && lang === 'ta' ? r.tamil_name : r.name) : '';
    const rAmt = r && Number(r.amount) > 0 ? Number(r.amount).toFixed(2) : (r ? '-' : '');
    const pText = p ? (p.tamil_name && lang === 'ta' ? p.tamil_name : p.name) : '';
    const pAmt = p && Number(p.amount) > 0 ? Number(p.amount).toFixed(2) : (p ? '-' : '');

    const isRHeader = r && (r.section === 'Opening Balance' && r.order_index === 10);
    const isPHeader = p && (p.section === 'Administrative Expenses' && p.order_index === 10);

    ledgerTableBody.push([
      {
        text: rText,
        fontSize: 8.5,
        bold: !!r?.is_auto || isRHeader,
        color: r?.is_auto ? THEME_COLOR : DATA_COLOR,
        font: hasTamilText(rText) ? 'NotoSansTamil' : 'Times',
        margin: [2, 1.5, 2, 1.5],
      },
      {
        text: rAmt,
        fontSize: 8.5,
        alignment: 'right',
        bold: !!r?.is_auto,
        font: 'Times',
        margin: [2, 1.5, 2, 1.5],
      },
      {
        text: pText,
        fontSize: 8.5,
        bold: !!p?.is_auto || isPHeader,
        color: p?.is_auto ? THEME_COLOR : DATA_COLOR,
        font: hasTamilText(pText) ? 'NotoSansTamil' : 'Times',
        margin: [2, 1.5, 2, 1.5],
      },
      {
        text: pAmt,
        fontSize: 8.5,
        alignment: 'right',
        bold: !!p?.is_auto,
        font: 'Times',
        margin: [2, 1.5, 2, 1.5],
      },
    ]);
  }

  // Total footer row
  ledgerTableBody.push([
    { text: 'TOTAL RECEIPTS', fontSize: 9.5, bold: true, color: THEME_COLOR, font: 'Times', margin: [2, 3, 2, 3] },
    { text: Number(data.totalReceipts || 0).toFixed(2), fontSize: 9.5, bold: true, alignment: 'right', color: THEME_COLOR, font: 'Times', margin: [2, 3, 2, 3] },
    { text: 'TOTAL PAYMENTS', fontSize: 9.5, bold: true, color: THEME_COLOR, font: 'Times', margin: [2, 3, 2, 3] },
    { text: Number(data.totalPayments || 0).toFixed(2), fontSize: 9.5, bold: true, alignment: 'right', color: THEME_COLOR, font: 'Times', margin: [2, 3, 2, 3] },
  ]);

  const abstract = data.abstract || {};
  const openCash = splitRsPs(abstract.opening_cash_hand);
  const openBank = splitRsPs(abstract.opening_cash_bank);
  const openFd = splitRsPs(abstract.opening_fixed_deposits);

  const closeCash = splitRsPs(abstract.closing_cash_hand);
  const closeBank = splitRsPs(abstract.closing_cash_bank);
  const closeFd = splitRsPs(abstract.closing_fixed_deposits);

  // Parish totals excluding opening/closing and specific projects
  const receiptsParishNum = receipts
    .filter((r) => !['REC_OPEN_CASH', 'REC_OPEN_BANK', 'REC_OPEN_FD', 'REC_PROJ_INC'].includes(r.code || ''))
    .reduce((s, r) => s + (Number(r.amount) || 0), 0);

  const paymentsParishNum = payments
    .filter((p) => !['PAY_CLOSE_CASH', 'PAY_CLOSE_BANK', 'PAY_CLOSE_FD', 'PAY_PROJ_SPENT'].includes(p.code || ''))
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const receiptsParish = splitRsPs(receiptsParishNum);
  const receiptsProj = splitRsPs(abstract.receipts_specific_project);

  const paymentsParish = splitRsPs(paymentsParishNum);
  const paymentsProj = splitRsPs(abstract.payments_specific_project);

  const totalAbstractReceipts = (Number(abstract.opening_cash_hand) || 0) +
    (Number(abstract.opening_cash_bank) || 0) +
    (Number(abstract.opening_fixed_deposits) || 0) +
    receiptsParishNum +
    (Number(abstract.receipts_specific_project) || 0);

  const totalAbstractPayments = paymentsParishNum +
    (Number(abstract.payments_specific_project) || 0) +
    (Number(abstract.closing_cash_hand) || 0) +
    (Number(abstract.closing_cash_bank) || 0) +
    (Number(abstract.closing_fixed_deposits) || 0);

  const totalAbsRec = splitRsPs(totalAbstractReceipts);
  const totalAbsPay = splitRsPs(totalAbstractPayments);

  const remitStole = splitRsPs(abstract.remit_stole_fees);
  const remitMass = splitRsPs(abstract.remit_mass_intentions);
  const remitParish = splitRsPs(abstract.remit_parish_contribution);
  const remitDio = splitRsPs(abstract.remit_diocesan_collection);

  const recvMonthly = splitRsPs(abstract.recv_monthly_allowance);
  const recvMedical = splitRsPs(abstract.recv_medical_allowance);
  const recvMission = splitRsPs(abstract.recv_mission_conveyance);
  const recvOther = splitRsPs(abstract.recv_any_other);

  const docDefinition = {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: [28, 28, 28, 28],
    defaultStyle: { font: 'Times', fontSize: 9.5, color: DATA_COLOR },
    styles: {
      tableHeader: { font: 'Times', bold: true, fontSize: 9.5, color: THEME_COLOR },
      sectionTitle: { font: 'Times', bold: true, fontSize: 11, color: THEME_COLOR },
      subTitle: { font: 'Times', bold: true, fontSize: 9.5, color: '#334155' },
    },
    content: [
      // ==========================================
      // PAGE 1: FRONT - DETAILED RECEIPTS & PAYMENTS LEDGER
      // ==========================================
      {
        stack: [
          { text: churchName, font: 'Times', bold: true, fontSize: 13, alignment: 'center', color: THEME_COLOR },
          { text: `${dioceseName} - PARISH FINANCIAL LEDGER (MONTH: ${monthYearStr})`, font: 'Times', bold: true, fontSize: 10, alignment: 'center', margin: [0, 2, 0, 8] },
        ],
      },
      {
        table: {
          headerRows: 1,
          widths: ['*', 75, '*', 75],
          body: ledgerTableBody,
        },
        layout: {
          hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length - 1 || i === node.table.body.length ? 1.2 : 0.4),
          vLineWidth: () => 0.8,
          hLineColor: (i, node) => (i === 0 || i === 1 || i === node.table.body.length - 1 || i === node.table.body.length ? THEME_COLOR : '#cbd5e1'),
          vLineColor: () => '#cbd5e1',
        },
      },

      // PAGE BREAK TO BACK SIDE
      { text: '', pageBreak: 'after' },

      // ==========================================
      // PAGE 2: BACK - DIOCESE MONTHLY FINANCIAL REPORT ABSTRACT
      // (EXACT TEXTUAL STRUCTURAL BLUEPRINT)
      // ==========================================
      {
        stack: [
          // 1. Document Header & Metadata
          // Top Header (Centered, Bold, All Caps)
          { text: `DIOCESE OF ${dioceseName.replace(/DIOCESE/gi, '').trim() || 'TUTICORIN'}`, font: 'Times', bold: true, fontSize: 13, alignment: 'center', color: THEME_COLOR, margin: [0, 0, 0, 3] },
          // Sub-Header (Centered, Bold, All Caps)
          {
            text: [
              { text: 'FINANCIAL REPORT FOR THE MONTH OF ', font: 'Times', bold: true, fontSize: 10.5, color: THEME_COLOR },
              { text: (monthYearStr || '____________________').toUpperCase(), font: 'Times', bold: true, fontSize: 10.5, color: DATA_COLOR, decoration: 'underline' },
            ],
            alignment: 'center',
            margin: [0, 0, 0, 12],
          },

          // Metadata: Left-Aligned Entries stacked vertically + Top-Right Unit No
          {
            columns: [
              {
                width: '70%',
                stack: [
                  {
                    text: [
                      { text: 'Name of Priest :  ', font: 'Times', bold: true, fontSize: 10, color: THEME_COLOR },
                      { text: (abstract.priest_name || '___________________________________').toUpperCase(), font: 'Times', bold: true, fontSize: 10, color: DATA_COLOR },
                    ],
                    margin: [0, 0, 0, 9],
                  },
                  {
                    text: [
                      { text: 'Parish :  ', font: 'Times', bold: true, fontSize: 10, color: THEME_COLOR },
                      { text: (church?.name || '_________________________________________').toUpperCase(), font: 'Times', bold: true, fontSize: 10, color: DATA_COLOR },
                    ],
                    margin: [0, 0, 0, 9],
                  },
                  {
                    text: [
                      { text: 'Designation :  ', font: 'Times', bold: true, fontSize: 10, color: THEME_COLOR },
                      { text: abstract.designation || 'Parish Priest', font: 'Times', bold: true, fontSize: 10, color: DATA_COLOR },
                    ],
                    margin: [0, 0, 0, 0],
                  },
                ],
              },
              {
                width: '30%',
                stack: [
                  {
                    text: [
                      { text: 'Unit No :  ', font: 'Times', bold: true, fontSize: 10, color: THEME_COLOR },
                      { text: abstract.unit_no || '_________', font: 'Times', bold: true, fontSize: 10, color: DATA_COLOR },
                    ],
                    alignment: 'right',
                    margin: [0, 0, 0, 0],
                  },
                ],
              },
            ],
            margin: [0, 0, 0, 16],
          },

          // 2. Main Financial Accounting Grid
          { text: 'I. ABSTRACT (from parish journal)', font: 'Times', bold: true, fontSize: 10.5, color: THEME_COLOR, margin: [0, 0, 0, 6] },
          {
            table: {
              widths: ['34%', '11%', '5%', '34%', '11%', '5%'],
              body: [
                [
                  { text: 'RECEIPTS', font: 'Times', bold: true, color: THEME_COLOR, alignment: 'center', fillColor: '#f1f5f9', margin: [2, 4.5, 2, 4.5] },
                  { text: 'Rs.', font: 'Times', bold: true, color: THEME_COLOR, alignment: 'center', fillColor: '#f1f5f9', margin: [2, 4.5, 2, 4.5] },
                  { text: 'Ps.', font: 'Times', bold: true, color: THEME_COLOR, alignment: 'center', fillColor: '#f1f5f9', margin: [2, 4.5, 2, 4.5] },
                  { text: 'PAYMENTS', font: 'Times', bold: true, color: THEME_COLOR, alignment: 'center', fillColor: '#f1f5f9', margin: [2, 4.5, 2, 4.5] },
                  { text: 'Rs.', font: 'Times', bold: true, color: THEME_COLOR, alignment: 'center', fillColor: '#f1f5f9', margin: [2, 4.5, 2, 4.5] },
                  { text: 'Ps.', font: 'Times', bold: true, color: THEME_COLOR, alignment: 'center', fillColor: '#f1f5f9', margin: [2, 4.5, 2, 4.5] },
                ],
                [
                  { text: 'Opening Balance', font: 'Times', bold: true, margin: [3, 4, 2, 4] },
                  { text: '', margin: [2, 4, 2, 4] },
                  { text: '', margin: [2, 4, 2, 4] },
                  { text: 'Total Payments during the month', font: 'Times', bold: true, margin: [3, 4, 2, 4] },
                  { text: '', margin: [2, 4, 2, 4] },
                  { text: '', margin: [2, 4, 2, 4] },
                ],
                [
                  { text: '1. Cash in hand', margin: [10, 3.5, 2, 3.5] },
                  { text: openCash.rs, alignment: 'right', margin: [2, 3.5, 2, 3.5] },
                  { text: openCash.ps, alignment: 'right', margin: [2, 3.5, 2, 3.5] },
                  { text: '- from the parish', margin: [10, 3.5, 2, 3.5] },
                  { text: paymentsParish.rs, alignment: 'right', margin: [2, 3.5, 2, 3.5] },
                  { text: paymentsParish.ps, alignment: 'right', margin: [2, 3.5, 2, 3.5] },
                ],
                [
                  { text: '2. Cash at Bank', margin: [10, 3.5, 2, 3.5] },
                  { text: openBank.rs, alignment: 'right', margin: [2, 3.5, 2, 3.5] },
                  { text: openBank.ps, alignment: 'right', margin: [2, 3.5, 2, 3.5] },
                  { text: '- for a specific project', margin: [10, 3.5, 2, 3.5] },
                  { text: paymentsProj.rs, alignment: 'right', margin: [2, 3.5, 2, 3.5] },
                  { text: paymentsProj.ps, alignment: 'right', margin: [2, 3.5, 2, 3.5] },
                ],
                [
                  { text: '3. Fixed Deposits', margin: [10, 3.5, 2, 3.5] },
                  { text: openFd.rs, alignment: 'right', margin: [2, 3.5, 2, 3.5] },
                  { text: openFd.ps, alignment: 'right', margin: [2, 3.5, 2, 3.5] },
                  { text: 'Closing Balance', font: 'Times', bold: true, margin: [3, 3.5, 2, 3.5] },
                  { text: '', margin: [2, 3.5, 2, 3.5] },
                  { text: '', margin: [2, 3.5, 2, 3.5] },
                ],
                [
                  { text: 'Total Receipts during the month', font: 'Times', bold: true, margin: [3, 3.5, 2, 3.5] },
                  { text: '', margin: [2, 3.5, 2, 3.5] },
                  { text: '', margin: [2, 3.5, 2, 3.5] },
                  { text: '1. Cash in hand', margin: [10, 3.5, 2, 3.5] },
                  { text: closeCash.rs, alignment: 'right', margin: [2, 3.5, 2, 3.5] },
                  { text: closeCash.ps, alignment: 'right', margin: [2, 3.5, 2, 3.5] },
                ],
                [
                  { text: '- from the parish', margin: [10, 3.5, 2, 3.5] },
                  { text: receiptsParish.rs, alignment: 'right', margin: [2, 3.5, 2, 3.5] },
                  { text: receiptsParish.ps, alignment: 'right', margin: [2, 3.5, 2, 3.5] },
                  { text: '2. Cash at Bank', margin: [10, 3.5, 2, 3.5] },
                  { text: closeBank.rs, alignment: 'right', margin: [2, 3.5, 2, 3.5] },
                  { text: closeBank.ps, alignment: 'right', margin: [2, 3.5, 2, 3.5] },
                ],
                [
                  { text: '- for a specific project', margin: [10, 3.5, 2, 3.5] },
                  { text: receiptsProj.rs, alignment: 'right', margin: [2, 3.5, 2, 3.5] },
                  { text: receiptsProj.ps, alignment: 'right', margin: [2, 3.5, 2, 3.5] },
                  { text: '3. Fixed Deposits', margin: [10, 3.5, 2, 3.5] },
                  { text: closeFd.rs, alignment: 'right', margin: [2, 3.5, 2, 3.5] },
                  { text: closeFd.ps, alignment: 'right', margin: [2, 3.5, 2, 3.5] },
                ],
                [
                  { text: 'Total', font: 'Times', bold: true, color: THEME_COLOR, margin: [3, 4.5, 2, 4.5] },
                  { text: totalAbsRec.rs, font: 'Times', bold: true, color: THEME_COLOR, alignment: 'right', margin: [2, 4.5, 2, 4.5] },
                  { text: totalAbsRec.ps, font: 'Times', bold: true, color: THEME_COLOR, alignment: 'right', margin: [2, 4.5, 2, 4.5] },
                  { text: 'Total', font: 'Times', bold: true, color: THEME_COLOR, margin: [3, 4.5, 2, 4.5] },
                  { text: totalAbsPay.rs, font: 'Times', bold: true, color: THEME_COLOR, alignment: 'right', margin: [2, 4.5, 2, 4.5] },
                  { text: totalAbsPay.ps, font: 'Times', bold: true, color: THEME_COLOR, alignment: 'right', margin: [2, 4.5, 2, 4.5] },
                ],
              ],
            },
            layout: {
              hLineWidth: () => 0.6,
              vLineWidth: () => 0.6,
              hLineColor: () => THEME_COLOR,
              vLineColor: () => THEME_COLOR,
            },
          },

          // 3. Footnote Disclaimer Note
          {
            text: [
              { text: 'Please Note : ', font: 'Times', bold: true, decoration: 'underline' },
              { text: 'The Closing Balance of the previous month should be carried over as the opening balance of the current month.', font: 'Times', italics: true },
            ],
            fontSize: 8.5,
            color: '#1e293b',
            margin: [0, 6, 0, 20],
          },

          // 4. Section II: Amount to be remitted to the Procurator
          { text: 'II. Amount to be remitted to the Procurator', font: 'Times', bold: true, fontSize: 10.5, color: THEME_COLOR, margin: [0, 0, 0, 10] },
          {
            table: {
              widths: ['60%', '6%', '34%'],
              body: [
                [
                  { text: 'i)   Stole Fees', border: [false, false, false, false], margin: [0, 5, 0, 5] },
                  { text: 'Rs.', font: 'Times', bold: true, color: THEME_COLOR, border: [false, false, false, false], margin: [0, 5, 0, 5] },
                  {
                    stack: [
                      { text: remitStole.rs ? `${remitStole.rs}.${remitStole.ps}` : '', font: 'Times', bold: true, margin: [0, 0, 0, 1] },
                      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 155, y2: 0, lineWidth: 0.6, lineColor: '#64748b' }] },
                    ],
                    border: [false, false, false, false],
                    margin: [0, 5, 0, 5],
                  },
                ],
                [
                  { text: 'ii)  Mass Intentions remitted to the Diocese', border: [false, false, false, false], margin: [0, 5, 0, 5] },
                  { text: 'Rs.', font: 'Times', bold: true, color: THEME_COLOR, border: [false, false, false, false], margin: [0, 5, 0, 5] },
                  {
                    stack: [
                      { text: remitMass.rs ? `${remitMass.rs}.${remitMass.ps}` : '', font: 'Times', bold: true, margin: [0, 0, 0, 1] },
                      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 155, y2: 0, lineWidth: 0.6, lineColor: '#64748b' }] },
                    ],
                    border: [false, false, false, false],
                    margin: [0, 5, 0, 5],
                  },
                ],
                [
                  { text: 'iii) Parish Contribution to the Diocese', border: [false, false, false, false], margin: [0, 5, 0, 5] },
                  { text: 'Rs.', font: 'Times', bold: true, color: THEME_COLOR, border: [false, false, false, false], margin: [0, 5, 0, 5] },
                  {
                    stack: [
                      { text: remitParish.rs ? `${remitParish.rs}.${remitParish.ps}` : '', font: 'Times', bold: true, margin: [0, 0, 0, 1] },
                      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 155, y2: 0, lineWidth: 0.6, lineColor: '#64748b' }] },
                    ],
                    border: [false, false, false, false],
                    margin: [0, 5, 0, 5],
                  },
                ],
                [
                  { text: 'iv) Collection to be given to the Diocese', border: [false, false, false, false], margin: [0, 5, 0, 5] },
                  { text: 'Rs.', font: 'Times', bold: true, color: THEME_COLOR, border: [false, false, false, false], margin: [0, 5, 0, 5] },
                  {
                    stack: [
                      { text: remitDio.rs ? `${remitDio.rs}.${remitDio.ps}` : '', font: 'Times', bold: true, margin: [0, 0, 0, 1] },
                      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 155, y2: 0, lineWidth: 0.6, lineColor: '#64748b' }] },
                    ],
                    border: [false, false, false, false],
                    margin: [0, 5, 0, 5],
                  },
                ],
              ],
            },
            layout: 'noBorders',
            margin: [0, 0, 0, 22],
          },

          // 5. Section III: Amount to be received from the Procurator
          { text: 'III. Amount to be received from the Procurator', font: 'Times', bold: true, fontSize: 10.5, color: THEME_COLOR, margin: [0, 0, 0, 10] },
          {
            table: {
              widths: ['60%', '6%', '34%'],
              body: [
                [
                  { text: 'i)   Monthly allowance (Congrua)', border: [false, false, false, false], margin: [0, 5, 0, 5] },
                  { text: 'Rs.', font: 'Times', bold: true, color: THEME_COLOR, border: [false, false, false, false], margin: [0, 5, 0, 5] },
                  {
                    stack: [
                      { text: recvMonthly.rs ? `${recvMonthly.rs}.${recvMonthly.ps}` : '', font: 'Times', bold: true, margin: [0, 0, 0, 1] },
                      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 155, y2: 0, lineWidth: 0.6, lineColor: '#64748b' }] },
                    ],
                    border: [false, false, false, false],
                    margin: [0, 5, 0, 5],
                  },
                ],
                [
                  { text: 'ii)  Medical allowance (Bills to be attached)', border: [false, false, false, false], margin: [0, 5, 0, 5] },
                  { text: 'Rs.', font: 'Times', bold: true, color: THEME_COLOR, border: [false, false, false, false], margin: [0, 5, 0, 5] },
                  {
                    stack: [
                      { text: recvMedical.rs ? `${recvMedical.rs}.${recvMedical.ps}` : '', font: 'Times', bold: true, margin: [0, 0, 0, 1] },
                      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 155, y2: 0, lineWidth: 0.6, lineColor: '#64748b' }] },
                    ],
                    border: [false, false, false, false],
                    margin: [0, 5, 0, 5],
                  },
                ],
                [
                  { text: 'iii) Mission Conveyance', border: [false, false, false, false], margin: [0, 5, 0, 5] },
                  { text: 'Rs.', font: 'Times', bold: true, color: THEME_COLOR, border: [false, false, false, false], margin: [0, 5, 0, 5] },
                  {
                    stack: [
                      { text: recvMission.rs ? `${recvMission.rs}.${recvMission.ps}` : '', font: 'Times', bold: true, margin: [0, 0, 0, 1] },
                      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 155, y2: 0, lineWidth: 0.6, lineColor: '#64748b' }] },
                    ],
                    border: [false, false, false, false],
                    margin: [0, 5, 0, 5],
                  },
                ],
                [
                  { text: 'iv) Any Other', border: [false, false, false, false], margin: [0, 5, 0, 5] },
                  { text: 'Rs.', font: 'Times', bold: true, color: THEME_COLOR, border: [false, false, false, false], margin: [0, 5, 0, 5] },
                  {
                    stack: [
                      { text: recvOther.rs ? `${recvOther.rs}.${recvOther.ps}` : '', font: 'Times', bold: true, margin: [0, 0, 0, 1] },
                      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 155, y2: 0, lineWidth: 0.6, lineColor: '#64748b' }] },
                    ],
                    border: [false, false, false, false],
                    margin: [0, 5, 0, 5],
                  },
                ],
              ],
            },
            layout: 'noBorders',
            margin: [0, 0, 0, 50],
          },

          // 6. Signatures (Positioned at bottom of page)
          {
            columns: [
              { text: `Date: ${new Date().toLocaleDateString('en-GB')}`, font: 'Times', bold: true, fontSize: 10, width: '33%' },
              { text: 'Seal', font: 'Times', bold: true, fontSize: 10, alignment: 'center', width: '33%' },
              { text: 'Parish Priest', font: 'Times', bold: true, fontSize: 10, alignment: 'right', width: '34%' },
            ],
            margin: [0, 20, 0, 0],
          },
        ],
      },
    ],
  };

  return renderPdfBuffer(docDefinition);
}

module.exports = { generateMonthlyAccountsPdf };
