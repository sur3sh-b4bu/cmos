const PDFDocument = require('@foliojs-fork/pdfkit');
const { renderPdfBuffer } = require('../utils/pdfPrinter');
const { formatDateDMY } = require('../utils/dateFormat');
const { hasTamilText } = require('../utils/pdfLabels');
const { getThemePrimaryColor } = require('../utils/themeColors');

/** Exact text width for a given font/size, via the same PDFKit build
 * pdfmake renders with underneath -- used to size the Baptism title's
 * pill-shaped border precisely instead of guessing a width and either
 * clipping the text or leaving it swimming in too much padding. */
function measureTextWidth(text, font, fontSize) {
  const doc = new PDFDocument({ autoFirstPage: false });
  doc.font(font).fontSize(fontSize);
  const width = doc.widthOfString(text);
  doc.end();
  return width;
}

/**
 * Renders each certificate as a plain "extract from the register" copy --
 * matching the physical diocese register-extract forms (Baptism/Marriage/
 * Death) this church already uses, down to the dotted fill-in lines and the
 * curly-brace grouping for paired rows (Bridegroom/Bride, Father/Mother,
 * ...) -- rather than a decorative ornamental certificate. Every labeled
 * line on the paper forms has a corresponding row here, in the same order.
 *
 * Ink color dynamically matches the church's brand theme color (e.g. maroon,
 * blue, etc.).
 */

const LABEL_WIDTH = 168;
const SUB_LABEL_WIDTH = 62;
// A4 content width (595.28 - 48 - 48 margins) minus each row's fixed
// columns, with a small safety margin -- a canvas line's width is a fixed
// number, not "fill remaining space" like a column, so this has to be
// gotten right or it overflows into (and corrupts) whatever sits next to it.
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

/** One "Label .................... value" row -- the value sits just above
 * the dotted line, the way a typed entry sits on these forms. The dotted
 * line is unconditional (blank fields still show the full fill-in line,
 * exactly like an unfilled spot on the paper form).
 *
 * marginBottom is a parameter (not a constant) so each certificate type can
 * spread its own fixed set of rows across the full page -- see SPACING
 * below: baptism has far fewer rows than death, so it needs a much bigger
 * per-row gap to fill the same A4 page. */
function row(ink, label, value, marginBottom = 7) {
  return {
    columns: [
      { width: LABEL_WIDTH, text: label, style: 'label' },
      {
        width: '*',
        stack: [
          // Names/places/remarks are free text and can be typed in Tamil --
          // 'Times' is a built-in PDF font with no Tamil glyphs at all, so
          // this one value falls back to NotoSansTamil rather than the
          // whole certificate losing its formal serif look -- see
          // receiptPdf.js's own comment on the same underlying issue.
          { text: value || '', style: 'value', margin: [3, 0, 0, 1], ...(hasTamilText(value) ? { font: 'NotoSansTamil' } : {}) },
          dottedLine(LINE_WIDTH, ink),
        ],
      },
    ],
    columnGap: 2,
    margin: [0, 0, 0, marginBottom],
  };
}

/** A sub-line inside a brace-grouped pair. See row() above re: marginBottom. */
function subRow(ink, subLabel, value, marginBottom = 6) {
  return {
    columns: [
      { width: SUB_LABEL_WIDTH, text: subLabel, style: 'subLabel' },
      {
        width: '*',
        stack: [
          // See row() above.
          { text: value || '', style: 'value', margin: [3, 0, 0, 1], ...(hasTamilText(value) ? { font: 'NotoSansTamil' } : {}) },
          dottedLine(SUB_LINE_WIDTH, ink),
        ],
      },
    ],
    columnGap: 2,
    margin: [0, 0, 0, marginBottom],
  };
}

// subRow()'s actual rendered height is ~15pt of text+dotted-line plus
// whatever bottom margin it's given -- kept as a formula (not a flat
// constant) so the brace below stays sized to exactly two subRow()s
// regardless of which per-type margin SPACING hands it.
const SUBROW_BASE_HEIGHT = 15;

/** One outer label (e.g. "Name of the Parties") brace-grouping two
 * subRow()s (e.g. Bridegroom / Bride). The brace itself is the actual "{"
 * glyph from the font, not a hand-drawn curve -- a real typeface's brace is
 * a genuinely well-designed shape (the correct taper, the point, the
 * curvature), and no amount of hand-rolled SVG bezier-fiddling matched it
 * as convincingly as just asking the font for the character it already
 * has. Sized so its natural height roughly spans the two subRow()s below it.
 *
 * Its COLUMN width has to be measured, not guessed: this glyph gets scaled
 * up to 80+pt (tall enough to span two rows), and a "{" at that size is
 * nowhere near as narrow as it looks at body text size -- a fixed 16pt
 * column (this used to hardcode one) is far too narrow at that scale, so
 * the glyph's own ink spills out both sides into the label and the
 * subLabel text next to it. measureTextWidth (already used above for the
 * title's underline) gives the real width at this exact font size instead;
 * the label column shrinks by the same amount so nothing else on the row
 * shifts or overflows. */
function pairedRow(ink, label, subLabelA, valueA, subLabelB, valueB, subMarginBottom = 6, pairMarginBottom = 2) {
  const braceHeight = (SUBROW_BASE_HEIGHT + subMarginBottom) * 2;
  const braceWidth = Math.ceil(measureTextWidth('{', 'Times-Roman', braceHeight)) + 3; // +3: small safety margin around the measured ink
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

/** "Kept at / Solemnized at / at" -- the top line of every one of these
 * register-extract forms, filled with the church's own name. */
function headerLine(ink, label, church, marginBottom) {
  return row(ink, label, church?.name, marginBottom);
}

function dioceseLine(ink, church) {
  return { text: church?.diocese || '', style: 'diocese', color: ink, alignment: 'right', margin: [0, 0, 0, 20] };
}

const PAGE_CONTENT_WIDTH = 499.28; // A4 (595.28) minus 48+48 left/right margins
// Marriage's title is the longest of the three -- sized down just enough to
// fit on one line within the page (matching the original), rather than
// wrapping like Death's intentionally-two-line title does.
const TITLE_FONT_SIZE = { baptism: 15, marriage: 12, death: 15 };

/**
 * All three register forms use the same title treatment: plain bold text
 * with a straight underline sized to the exact measured text width (see
 * measureTextWidth), so it never reads as too wide/narrow or disconnected
 * from the text above it.
 */
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

/** Date/Place, the priest's title, and "Seal" sit side by side in one row
 * at the bottom of the original forms -- plain printed text with no ruled
 * line under any of them (unlike every field above, which does get a
 * dotted fill-in line). The signature and seal stamp go directly in the
 * blank space near their printed labels. */
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
        // Three equal-width columns, evenly spanning the full page width --
        // not Date on the left with Priest/Seal crowded together at the
        // far right edge.
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
    case 'marriage':
      return [
        row(ink, 'When Married', formatDate(record.marriage_date), s.row),
        row(ink, 'Where Married', record.where_married, s.row),
        pairedRow(ink, 'Name of the Parties', 'Bridegroom', record.groom_name, 'Bride', record.bride_name, s.subRow, s.pair),
        pairedRow(ink, 'Age', 'Bridegroom', record.groom_age, 'Bride', record.bride_age, s.subRow, s.pair),
        pairedRow(ink, 'Condition', 'Bridegroom', record.groom_condition, 'Bride', record.bride_condition, s.subRow, s.pair),
        pairedRow(ink, 'Profession', 'Bridegroom', record.groom_profession, 'Bride', record.bride_profession, s.subRow, s.pair),
        pairedRow(ink, 'Residence at the\ntime of Marriage', 'Bridegroom', record.groom_residence, 'Bride', record.bride_residence, s.subRow, s.pair),
        pairedRow(ink, "Father's Name &\nSurname", 'Bridegroom', record.groom_father_name, 'Bride', record.bride_father_name, s.subRow, s.pair),
        row(ink, 'By banns or Licence', record.banns_or_licence, s.row),
        row(ink, 'Can. impediments dispensed', record.impediments_dispensed, s.row),
        row(ink, 'Witnesses', [record.witness1_name, record.witness2_name].filter(Boolean).join('  &  '), s.row),
        // Present on the original register but easy to miss since it isn't
        // near the other priest-related fields -- it's its own line right
        // before the signature block, distinct from the "Parish Priest"
        // signature label below.
        row(ink, 'Minister of the Ceremony', record.priest_display_name, s.row),
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

const HEADER_LABEL = { baptism: 'Kept at', marriage: 'Solemnized at', death: 'at' };
const REGISTER_TITLE = {
  baptism: 'EXTRACT FROM THE REGISTER OF BAPTISM',
  marriage: 'EXTRACT FROM THE REGISTER OF INDIAN CHRISTIAN MARRIAGES',
  death: 'EXTRACT FROM THE REGISTER OF DEATHS KEPT',
};

// Per-type vertical rhythm -- row/subRow/pair are each type's own dotted-
// line-row bottom margin (see row()/subRow()/pairedRow() above), footerTop
// is the blank gap above the Date/Priest/Seal line. Every certificate of a
// given type always renders the exact same fixed set of rows (dotted lines
// show even for blank fields, same as the paper form), so -- unlike a
// normal document -- how much space is needed to fill one A4 page is known
// in advance and doesn't vary per record. It DOES vary a lot per type
// though: Death has 15 single-value rows to spread across the page, Baptism
// has only 9 (plus 2 paired) -- so Baptism needs much bigger gaps than
// Death to reach the same full-page height. These values were tuned against
// PDF_DEBUG_HEIGHT (see pdfPrinter.js) so each type's content -- including
// the footer -- ends a modest, consistent distance above the bottom margin.
const SPACING = {
  baptism: { row: 28, subRow: 26, pair: 10, footerTop: 70 },
  marriage: { row: 13, subRow: 15, pair: 7, footerTop: 46 },
  death: { row: 22, subRow: 22, pair: 4, footerTop: 51 },
};

async function generateCertificatePdf(type, record, church) {
  const primaryColor = getThemePrimaryColor(church?.theme_color);
  const ink = primaryColor;
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
