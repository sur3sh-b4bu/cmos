const fs = require('fs');
const path = require('path');
const PDFDocument = require('@foliojs-fork/pdfkit');
const { renderPdfBuffer } = require('../utils/pdfPrinter');
const { formatDateDMY } = require('../utils/dateFormat');
const { hasTamilText } = require('../utils/pdfLabels');
const { getThemePrimaryColor } = require('../utils/themeColors');
const { UPLOAD_ROOT } = require('../middlewares/upload');

function getChurchLogoDataUrl(church) {
  if (church?.logo_url) {
    const filePath = path.join(UPLOAD_ROOT, church.logo_url.replace(/^\/uploads\//, ''));
    try {
      if (fs.existsSync(filePath)) {
        const buffer = fs.readFileSync(filePath);
        const ext = path.extname(filePath).slice(1).toLowerCase();
        const mime = ext === 'jpg' ? 'jpeg' : ext;
        return `data:image/${mime};base64,${buffer.toString('base64')}`;
      }
    } catch {
      // fallback to default image below
    }
  }

  // Check possible patron saint image locations (PNG prioritized, then JPG)
  const candidatePaths = [
    path.join(__dirname, '../../assets/images/patron_saint.png'),
    path.join(__dirname, '../../assets/images/patron_saint.jpg'),
    path.join(__dirname, '../../../frontend/src/assets/images/patron_saint.png'),
    path.join(__dirname, '../../../frontend/src/assets/images/patron_saint.jpg'),
  ];

  for (const p of candidatePaths) {
    try {
      if (fs.existsSync(p)) {
        const buffer = fs.readFileSync(p);
        const ext = path.extname(p).slice(1).toLowerCase();
        const mime = ext === 'jpg' ? 'jpeg' : ext;
        return `data:image/${mime};base64,${buffer.toString('base64')}`;
      }
    } catch {
      // continue to next candidate
    }
  }

  return null;
}

function formatDateSlash(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

/** Exact text width for a given font/size, via the same PDFKit build
 * pdfmake renders with underneath */
function measureTextWidth(text, font, fontSize) {
  const doc = new PDFDocument({ autoFirstPage: false });
  doc.font(font).fontSize(fontSize);
  const width = doc.widthOfString(text);
  doc.end();
  return width;
}

const LABEL_WIDTH = 168;
const SUB_LABEL_WIDTH = 62;
const LINE_WIDTH = 320;
const SUB_LINE_WIDTH = 258;
const DOTS = { length: 1, space: 2 };

function formatDate(d) {
  if (!d) return '';
  return formatDateDMY(d);
}

function dottedLine(width, ink) {
  return { canvas: [{ type: 'line', x1: 0, y1: 0, x2: width, y2: 0, lineWidth: 1, lineColor: ink, dash: DOTS }] };
}

function solidLine(width, color = '#333333') {
  return { canvas: [{ type: 'line', x1: 0, y1: 0, x2: width, y2: 0, lineWidth: 0.75, lineColor: color }] };
}

function row(ink, label, value, marginBottom = 7) {
  return {
    columns: [
      { width: LABEL_WIDTH, text: label, style: 'label' },
      {
        width: '*',
        stack: [
          { text: value || '', style: 'value', margin: [3, 0, 0, 1], ...(hasTamilText(value) ? { font: 'NotoSansTamil' } : {}) },
          dottedLine(LINE_WIDTH, ink),
        ],
      },
    ],
    columnGap: 2,
    margin: [0, 0, 0, marginBottom],
  };
}

function subRow(ink, subLabel, value, marginBottom = 6) {
  return {
    columns: [
      { width: SUB_LABEL_WIDTH, text: subLabel, style: 'subLabel' },
      {
        width: '*',
        stack: [
          { text: value || '', style: 'value', margin: [3, 0, 0, 1], ...(hasTamilText(value) ? { font: 'NotoSansTamil' } : {}) },
          dottedLine(SUB_LINE_WIDTH, ink),
        ],
      },
    ],
    columnGap: 2,
    margin: [0, 0, 0, marginBottom],
  };
}

const SUBROW_BASE_HEIGHT = 15;

function pairedRow(ink, label, subLabelA, valueA, subLabelB, valueB, subMarginBottom = 6, pairMarginBottom = 2) {
  const braceHeight = (SUBROW_BASE_HEIGHT + subMarginBottom) * 2;
  const braceWidth = Math.ceil(measureTextWidth('{', 'Times-Roman', braceHeight)) + 3;
  return {
    columns: [
      { width: LABEL_WIDTH - braceWidth - 2, text: label, style: 'label', margin: [0, 6, 0, 0] },
      { width: braceWidth, text: '{', font: 'Times', fontSize: braceHeight, color: ink, margin: [0, -4, 0, 0] },
      {
        width: '*',
        stack: [subRow(ink, subLabelA, valueA, subMarginBottom), subRow(ink, subLabelB, valueB, subMarginBottom)],
      },
    ],
    columnGap: 2,
    margin: [0, 0, 0, pairMarginBottom],
  };
}

function headerLine(ink, label, church, marginBottom) {
  return row(ink, label, church?.name, marginBottom);
}

function dioceseLine(ink, church) {
  return { text: church?.diocese || '', style: 'diocese', color: ink, alignment: 'right', margin: [0, 0, 0, 20] };
}

const PAGE_CONTENT_WIDTH = 499.28;
const TITLE_FONT_SIZE = { baptism: 15, marriage: 12, death: 15 };

function titleBlock(type, ink) {
  const text = REGISTER_TITLE[type];
  const fontSize = TITLE_FONT_SIZE[type];

  const lineWidth = Math.min(PAGE_CONTENT_WIDTH, measureTextWidth(text, 'Times-Bold', fontSize) + 4);
  return {
    stack: [
      { text, style: 'title', color: ink, fontSize, alignment: 'center', margin: [0, 0, 0, 4] },
      {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: lineWidth, y2: 0, lineWidth: 1.1, lineColor: ink }],
        alignment: 'center',
        margin: [0, 0, 0, 26],
      },
    ],
  };
}

function footer(type, ink, church, certificateNo, topSpacing) {
  const signatureLabel = { baptism: 'Catholic Priest', marriage: 'Parish Priest', death: 'CATHOLIC PRIEST' }[type];
  const showPlace = type === 'death';

  const dateBlock = [];
  if (showPlace) dateBlock.push({ text: `Place : ${church?.city || ''}`, style: 'footerLine', margin: [0, 0, 0, 4] });
  dateBlock.push({ text: `Date : ${formatDate(new Date())}`, style: 'footerLine' });

  return {
    stack: [
      { text: '', margin: [0, topSpacing, 0, 0] },
      {
        columns: [
          { width: '*', stack: dateBlock },
          { width: '*', text: signatureLabel, style: 'signature', color: ink, alignment: 'center' },
          { width: '*', text: 'Seal', style: 'signature', color: ink, alignment: 'center' },
        ],
      },
      { text: `Certificate No.: ${certificateNo}`, style: 'metadata', margin: [0, 22, 0, 0] },
    ],
  };
}

/**
 * Builds the exact Marriage Certificate layout matching the Tuticorin Diocese
 * "EXTRACT FROM THE REGISTER OF INDIAN CHRISTIAN MARRIAGES" paper certificate form.
 */
function buildExactMarriageDocument(record, church, ink) {
  const logoDataUrl = getChurchLogoDataUrl(church);
  const LINE_COLOR = '#555555';
  const LABEL_COL_WIDTH = 155;
  const FULL_LINE_WIDTH = 352;
  const SUB_LABEL_WIDTH = 78;
  const SUB_VAL_LINE_WIDTH = 274;
  const ROW_GAP = 19.5;
  const SUBROW_GAP = 13.5;
  const FONT_SIZE = 11.5;

  const solemnizedText = [
    church?.name,
    church?.address,
    church?.diocese ? (church.diocese.toLowerCase().includes('diocese') ? church.diocese : `${church.diocese} Diocese`) : null,
  ]
    .filter(Boolean)
    .join(', ');

  const singleLineRow = (label, valText) => ({
    columns: [
      { width: LABEL_COL_WIDTH, text: label, font: 'Times', bold: true, fontSize: FONT_SIZE, color: '#000000' },
      {
        width: '*',
        stack: [
          {
            text: valText ? `:  ${valText}` : ':',
            font: 'Times',
            bold: true,
            fontSize: FONT_SIZE,
            color: '#000000',
            margin: [0, 0, 0, 2],
            ...(hasTamilText(valText) ? { font: 'NotoSansTamil' } : {}),
          },
          solidLine(FULL_LINE_WIDTH, LINE_COLOR),
        ],
      },
    ],
    margin: [0, 0, 0, ROW_GAP],
  });

  const pairedFieldsRow = (label, groomVal, brideVal) => ({
    columns: [
      { width: LABEL_COL_WIDTH, text: label, font: 'Times', bold: true, fontSize: FONT_SIZE, color: '#000000' },
      {
        width: '*',
        stack: [
          // Bridegroom line
          {
            columns: [
              { width: SUB_LABEL_WIDTH, text: 'Bridegroom', font: 'Times', bold: true, fontSize: FONT_SIZE, color: '#000000' },
              {
                width: '*',
                stack: [
                  {
                    text: groomVal ? `:  ${groomVal}` : ':',
                    font: 'Times',
                    bold: true,
                    fontSize: FONT_SIZE,
                    color: '#000000',
                    margin: [0, 0, 0, 2],
                    ...(hasTamilText(groomVal) ? { font: 'NotoSansTamil' } : {}),
                  },
                  solidLine(SUB_VAL_LINE_WIDTH, LINE_COLOR),
                ],
              },
            ],
            margin: [0, 0, 0, SUBROW_GAP],
          },
          // Bride line
          {
            columns: [
              { width: SUB_LABEL_WIDTH, text: 'Bride', font: 'Times', bold: true, fontSize: FONT_SIZE, color: '#000000' },
              {
                width: '*',
                stack: [
                  {
                    text: brideVal ? `:  ${brideVal}` : ':',
                    font: 'Times',
                    bold: true,
                    fontSize: FONT_SIZE,
                    color: '#000000',
                    margin: [0, 0, 0, 2],
                    ...(hasTamilText(brideVal) ? { font: 'NotoSansTamil' } : {}),
                  },
                  solidLine(SUB_VAL_LINE_WIDTH, LINE_COLOR),
                ],
              },
            ],
          },
        ],
      },
    ],
    margin: [0, 0, 0, ROW_GAP],
  });

  const witnessesBlock = () => {
    const list = [record.witness1_name, record.witness2_name, record.witness3_name, record.witness4_name].filter((w) => w && String(w).trim());
    const count = Math.max(2, list.length);
    const witnessItems = [];
    for (let i = 0; i < count; i++) {
      const val = list[i] ? list[i].toUpperCase() : '';
      const isFirst = i === 0;
      const isLast = i === count - 1;
      witnessItems.push({
        stack: [
          {
            text: isFirst ? (val ? `:  ${val}` : ':') : (val ? `   ${val}` : ''),
            font: 'Times',
            bold: true,
            fontSize: FONT_SIZE,
            color: '#000000',
            margin: [0, 0, 0, 2],
            ...(hasTamilText(val) ? { font: 'NotoSansTamil' } : {}),
          },
          solidLine(FULL_LINE_WIDTH, LINE_COLOR),
        ],
        ...(isLast ? {} : { margin: [0, 0, 0, count > 2 ? 8 : SUBROW_GAP] }),
      });
    }

    return {
      columns: [
        { width: LABEL_COL_WIDTH, text: 'Witnesses', font: 'Times', bold: true, fontSize: FONT_SIZE, color: '#000000' },
        { width: '*', stack: witnessItems },
      ],
      margin: [0, 0, 0, ROW_GAP],
    };
  };

  const headerLogoBlock = logoDataUrl
    ? { image: logoDataUrl, width: 68, height: 82, fit: [68, 82], alignment: 'left' }
    : {
        table: {
          widths: [62],
          body: [
            [
              {
                stack: [{ text: '✝', fontSize: 28, alignment: 'center', margin: [0, 18, 0, 0], color: '#333333' }],
                border: [true, true, true, true],
                borderColor: '#333333',
                fillColor: '#f8f8f8',
                height: 76,
              },
            ],
          ],
        },
        layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => '#444444', vLineColor: () => '#444444' },
      };

  return {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: [44, 38, 44, 28],
    defaultStyle: { font: 'Times', fontSize: FONT_SIZE, color: '#000000' },
    content: [
      // Header: Left Image/Logo + Centered Certificate Titles
      {
        columns: [
          { width: 78, stack: [headerLogoBlock] },
          {
            width: '*',
            stack: [
              { text: 'CERTIFICATE OF MARRIAGE', font: 'Times', bold: true, fontSize: 17, alignment: 'center', margin: [0, 4, 0, 6] },
              { text: 'EXTRACT FROM THE REGISTER OF INDIAN', font: 'Times', bold: true, fontSize: 13, alignment: 'center', margin: [0, 0, 0, 3] },
              { text: 'CHRISTIAN MARRIAGES', font: 'Times', bold: true, fontSize: 13, alignment: 'center', margin: [0, 0, 0, 24] },
            ],
          },
        ],
        margin: [0, 0, 0, 24],
      },

      // Body rows
      {
        columns: [
          { width: LABEL_COL_WIDTH, text: 'Solemnized at', font: 'Times', bold: true, fontSize: FONT_SIZE, color: '#000000' },
          {
            width: '*',
            stack: [
              {
                text: solemnizedText,
                font: 'Times',
                bold: true,
                fontSize: FONT_SIZE,
                color: '#000000',
                margin: [0, 0, 0, 2],
                ...(hasTamilText(solemnizedText) ? { font: 'NotoSansTamil' } : {}),
              },
              solidLine(FULL_LINE_WIDTH, LINE_COLOR),
            ],
          },
        ],
        margin: [0, 0, 0, ROW_GAP],
      },

      singleLineRow('When Married', formatDateSlash(record.marriage_date)),
      singleLineRow('Where Married', (record.where_married || church?.name || '').toUpperCase()),
      pairedFieldsRow('Name of the Parties', record.groom_name?.toUpperCase(), record.bride_name?.toUpperCase()),
      pairedFieldsRow('Age', record.groom_age, record.bride_age),
      pairedFieldsRow('Condition', (record.groom_condition || 'BACHELOR').toUpperCase(), (record.bride_condition || 'SPINSTER').toUpperCase()),
      pairedFieldsRow('Residence', (record.groom_residence || '').toUpperCase(), (record.bride_residence || '').toUpperCase()),
      pairedFieldsRow("Father's Name & Surname", (record.groom_father_name || '').toUpperCase(), (record.bride_father_name || '').toUpperCase()),
      singleLineRow('By Banns or Licence', (record.banns_or_licence || 'BY BANNS').toUpperCase()),
      singleLineRow('Can.impediments dispensed', (record.impediments_dispensed || 'NIL').toUpperCase()),
      witnessesBlock(),
      singleLineRow('Minister of the Ceremony', (record.priest_display_name || '').toUpperCase()),

      // Footer - nicely spaced to cover bottom of the page
      {
        columns: [
          { width: '*', text: `Date:  ${formatDateSlash(new Date())}`, font: 'Times', bold: true, fontSize: FONT_SIZE, color: '#000000' },
          { width: '*', text: 'Seal', font: 'Times', bold: true, fontSize: FONT_SIZE, alignment: 'center', color: '#000000' },
          { width: '*', text: 'Parish Priest', font: 'Times', bold: true, fontSize: FONT_SIZE, alignment: 'center', color: '#000000' },
        ],
        margin: [0, 68, 0, 0],
      },
      { text: `Certificate No.: ${record.certificate_no}`, font: 'Times', fontSize: 8.5, color: '#888888', margin: [0, 18, 0, 0] },
    ],
  };
}

function buildRows(type, ink, record, s) {
  switch (type) {
    case 'baptism':
      return [
        row(ink, 'Place of Baptism', record.place_of_baptism, s.row),
        row(ink, 'Date of Baptism', formatDate(record.date_of_baptism), s.row),
        row(ink, "Child's Christian Name", record.child_name, s.row),
        row(ink, 'Date of Birth', formatDate(record.date_of_birth), s.row),
        row(ink, 'Sex', record.gender_name, s.row),
        pairedRow(ink, "Parent's Name", 'Father', record.father_name, 'Mother', record.mother_name, s.subRow, s.pair),
        row(ink, "Parent's Residence", record.parent_residence, s.row),
        pairedRow(ink, 'God Parents', 'Godfather', record.godfather_name, 'Godmother', record.godmother_name, s.subRow, s.pair),
        row(ink, 'Priest who Baptised', record.priest_display_name, s.row),
        row(ink, 'Remarks', record.remarks, s.row),
      ];
    case 'death':
      return [
        row(ink, 'Name', record.deceased_name, s.row),
        row(ink, 'Age', record.age, s.row),
        row(ink, 'Place', record.place, s.row),
        row(ink, 'Profession', record.profession, s.row),
        row(ink, 'Parents', record.parents, s.row),
        row(ink, 'Date of death', formatDate(record.date_of_death), s.row),
        row(ink, 'Place of death', record.place_of_death, s.row),
        row(ink, 'Cause', record.cause, s.row),
        row(ink, 'C. Confession', record.confession_received, s.row),
        row(ink, 'V. Viaticum', record.viaticum_received, s.row),
        row(ink, 'A. Anointing', record.anointing_received, s.row),
        row(ink, 'Date of Burial', formatDate(record.burial_date), s.row),
        row(ink, 'Place of Burial', record.cemetery, s.row),
        row(ink, 'Minister', record.priest_display_name, s.row),
        row(ink, 'Remarks', record.remarks, s.row),
      ];
    default:
      return [];
  }
}

const HEADER_LABEL = { baptism: 'Kept at', death: 'at' };
const REGISTER_TITLE = {
  baptism: 'EXTRACT FROM THE REGISTER OF BAPTISM',
  death: 'EXTRACT FROM THE REGISTER OF DEATHS KEPT',
};

const SPACING = {
  baptism: { row: 28, subRow: 26, pair: 10, footerTop: 70 },
  death: { row: 22, subRow: 22, pair: 4, footerTop: 51 },
};

async function generateCertificatePdf(type, record, church) {
  const primaryColor = getThemePrimaryColor(church?.theme_color);
  const ink = primaryColor;

  if (type === 'marriage') {
    const docDefinition = buildExactMarriageDocument(record, church, ink);
    return renderPdfBuffer(docDefinition);
  }

  const s = SPACING[type];
  const docDefinition = {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: [48, 44, 48, 40],
    defaultStyle: { font: 'Times', fontSize: 11, color: ink },
    content: [
      titleBlock(type, ink),
      dioceseLine(ink, church),
      headerLine(ink, HEADER_LABEL[type], church, s.row),
      ...buildRows(type, ink, record, s),
      footer(type, ink, church, record.certificate_no, s.footerTop),
    ],
    styles: {
      title: { fontSize: 15, bold: true },
      diocese: { fontSize: 11, italics: true },
      label: { fontSize: 10.5 },
      subLabel: { fontSize: 9.5, italics: true },
      value: { fontSize: 11, bold: true },
      signature: { fontSize: 10 },
      metadata: { fontSize: 8, color: '#6B7280' },
    },
  };

  return renderPdfBuffer(docDefinition);
}

module.exports = { generateCertificatePdf };
