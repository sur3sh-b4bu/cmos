const path = require('path');
const PdfPrinter = require('pdfmake');

const fontsDir = path.join(__dirname, '..', '..', 'assets', 'fonts');

const fonts = {
  Roboto: {
    normal: path.join(fontsDir, 'Roboto-Regular.ttf'),
    bold: path.join(fontsDir, 'Roboto-Medium.ttf'),
    italics: path.join(fontsDir, 'Roboto-Italic.ttf'),
    bolditalics: path.join(fontsDir, 'Roboto-MediumItalic.ttf'),
  },
  // PDFKit's built-in Times family gives certificates the formal serif
  // typography used by traditional printed certificates.
  Times: {
    normal: 'Times-Roman',
    bold: 'Times-Bold',
    italics: 'Times-Italic',
    bolditalics: 'Times-BoldItalic',
  },
  // Tamil-capable font, used two ways: whenever a report's own `lang` is
  // 'ta' (see receiptPdf.js/bulkReceiptPdf.js/dailyRegisterPdf.js), and --
  // more often in practice -- whenever a *value* being printed contains
  // Tamil text regardless of the report's language, since names/Booked By/
  // custom intentions are free text an office worker can type in Tamil no
  // matter what the report itself is printed in (see pdfLabels.js's
  // hasTamilText/fontFor, used by every report generator in this folder).
  // Roboto and PDFKit's built-in Times have zero Tamil glyph coverage, so
  // without this those values silently render as tofu boxes instead of
  // failing loudly.
  //
  // Google's Noto Sans Tamil (SIL Open Font License -- freely
  // redistributable, unlike Windows' own Nirmala UI), fetched from
  // google/fonts (github.com/google/fonts/tree/main/ofl/notosanstamil) as
  // NotoSansTamil-Regular.ttf / NotoSansTamil-Bold.ttf; OFL.txt sits
  // alongside them for attribution. Upstream now only ships this as a
  // single variable font (wght 100-900) rather than separate static
  // Regular/Bold files, and this project has no font-instancing tool in
  // its toolchain to split one out -- so both entries below are literally
  // the same file; "bold" Tamil text renders at the variable font's
  // default (Regular-ish) weight rather than a true bold. Same accepted-
  // degradation spirit as no italics below, and a much smaller cost than
  // tofu boxes or a missing-file crash. This file happens to cover
  // Latin/ASCII too, so it's also safe to use for full documents that mix
  // Tamil and English content (see pdfLabels.js).
  NotoSansTamil: {
    normal: path.join(fontsDir, 'NotoSansTamil-Regular.ttf'),
    bold: path.join(fontsDir, 'NotoSansTamil-Bold.ttf'),
    // No italics either -- Noto Sans Tamil ships no italic weight, and
    // Tamil typography has no italic tradition, so this is an accepted
    // degradation.
    italics: path.join(fontsDir, 'NotoSansTamil-Regular.ttf'),
    bolditalics: path.join(fontsDir, 'NotoSansTamil-Bold.ttf'),
  },
};

const printer = new PdfPrinter(fonts);

/** Renders a pdfmake document definition to a Buffer. */
function renderPdfBuffer(docDefinition) {
  return new Promise((resolve, reject) => {
    try {
      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      const chunks = [];
      pdfDoc.on('data', (chunk) => chunks.push(chunk));
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
      pdfDoc.on('error', reject);
      pdfDoc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { renderPdfBuffer };
