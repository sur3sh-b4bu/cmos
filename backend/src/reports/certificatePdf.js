const { renderPdfBuffer } = require('../utils/pdfPrinter');
const { hasTamilText } = require('../utils/pdfLabels');
const { getThemePrimaryColor } = require('../utils/themeColors');

function formatCertDate(val) {
  if (!val) return '';
  const date = val instanceof Date ? val : new Date(val);
  if (Number.isNaN(date.getTime())) return String(val);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}

function getDioceseLabel(church) {
  if (church?.diocese && String(church.diocese).trim()) {
    const d = String(church.diocese).trim();
    return d.toLowerCase().includes('diocese') ? d : `${d} Diocese`;
  }
  return 'Tuticorin Diocese';
}

function dottedLine(width, color = '#333333') {
  return { canvas: [{ type: 'line', x1: 0, y1: 0, x2: width, y2: 0, lineWidth: 0.8, lineColor: color, dash: { length: 1, space: 2 } }] };
}

function solidLine(width, color = '#333333') {
  return { canvas: [{ type: 'line', x1: 0, y1: 0, x2: width, y2: 0, lineWidth: 0.8, lineColor: color }] };
}

/**
 * 1. MARRIAGE CERTIFICATE
 * Exactly matches Photo 1:
 * "EXTRACT FROM THE REGISTER OF INDIAN CHRISTIAN MARRIAGES"
 * Solemnized at .................................................... Tuticorin Diocese
 * All dotted lines, exact sublabels with 's, curly braces, footer with Parish Priest.
 */
function buildExactMarriageDocument(record, church, ink, template = null) {
  const THEME_COLOR = ink || '#072a63';
  const DATA_COLOR = '#000000';
  const LABEL_WIDTH = 180;
  const FULL_LINE_WIDTH = 330;
  const SUB_LABEL_WIDTH = 90;
  const SUB_LINE_WIDTH = 240;
  const ROW_GAP = 20;
  const SUBROW_GAP = 13;
  const FONT_SIZE = 12;
  const FOOTER_TOP = 68;

  const solemnizedText = [church?.name, church?.city].filter(Boolean).join(', ');
  const labels = template?.field_labels || {};
  const lbl = (key, def) => (labels[key] !== undefined && labels[key] !== null && String(labels[key]).trim() !== '' ? labels[key] : def);

  const titleText = template?.title || 'EXTRACT FROM THE REGISTER OF INDIAN CHRISTIAN MARRIAGES';
  const subheaderPrefix = template?.subheader_prefix || 'Solemnized at';
  const dioceseText = template?.diocese_label || getDioceseLabel(church);
  const signatoryTitle = template?.signatory_title || 'Parish Priest';
  const sealText = template?.seal_label || 'Seal';
  const dateLabel = lbl('date_label', 'Date :');

  const singleDottedRow = (label, valText) => ({
    columns: [
      { width: LABEL_WIDTH, text: label, font: 'Times', bold: true, fontSize: FONT_SIZE, color: THEME_COLOR },
      {
        width: '*',
        stack: [
          {
            text: [
              { text: ':  ', font: 'Times', bold: true, fontSize: FONT_SIZE, color: THEME_COLOR },
              {
                text: valText ? String(valText).toUpperCase() : '',
                font: 'Times',
                bold: true,
                fontSize: FONT_SIZE,
                color: DATA_COLOR,
                ...(hasTamilText(valText) ? { font: 'NotoSansTamil' } : {}),
              },
            ],
            margin: [0, 0, 0, 2],
          },
          dottedLine(FULL_LINE_WIDTH, THEME_COLOR),
        ],
      },
    ],
    margin: [0, 0, 0, ROW_GAP],
  });

  const pairedDottedRow = (label, groomLabel, groomVal, brideLabel, brideVal) => ({
    columns: [
      { width: LABEL_WIDTH - 18, text: label, font: 'Times', bold: true, fontSize: FONT_SIZE, color: THEME_COLOR, margin: [0, 6, 0, 0] },
      { width: 14, text: '{', font: 'Times', fontSize: 36, color: THEME_COLOR, margin: [0, -3, 0, 0] },
      {
        width: '*',
        stack: [
          // Bridegroom line
          {
            columns: [
              { width: SUB_LABEL_WIDTH, text: groomLabel, font: 'Times', bold: true, fontSize: FONT_SIZE, color: THEME_COLOR },
              {
                width: '*',
                stack: [
                  {
                    text: [
                      { text: ':  ', font: 'Times', bold: true, fontSize: FONT_SIZE, color: THEME_COLOR },
                      {
                        text: groomVal ? String(groomVal).toUpperCase() : '',
                        font: 'Times',
                        bold: true,
                        fontSize: FONT_SIZE,
                        color: DATA_COLOR,
                        ...(hasTamilText(groomVal) ? { font: 'NotoSansTamil' } : {}),
                      },
                    ],
                    margin: [0, 0, 0, 2],
                  },
                  dottedLine(SUB_LINE_WIDTH, THEME_COLOR),
                ],
              },
            ],
            margin: [0, 0, 0, SUBROW_GAP],
          },
          // Bride line
          {
            columns: [
              { width: SUB_LABEL_WIDTH, text: brideLabel, font: 'Times', bold: true, fontSize: FONT_SIZE, color: THEME_COLOR },
              {
                width: '*',
                stack: [
                  {
                    text: [
                      { text: ':  ', font: 'Times', bold: true, fontSize: FONT_SIZE, color: THEME_COLOR },
                      {
                        text: brideVal ? String(brideVal).toUpperCase() : '',
                        font: 'Times',
                        bold: true,
                        fontSize: FONT_SIZE,
                        color: DATA_COLOR,
                        ...(hasTamilText(brideVal) ? { font: 'NotoSansTamil' } : {}),
                      },
                    ],
                    margin: [0, 0, 0, 2],
                  },
                  dottedLine(SUB_LINE_WIDTH, THEME_COLOR),
                ],
              },
            ],
          },
        ],
      },
    ],
    margin: [0, 0, 0, ROW_GAP],
  });

  // Extract all witness names (handles both individual fields witness1..4 and comma-separated text)
  let extractedWitnessNames = [];
  const rawFields = [record.witness1_name, record.witness2_name, record.witness3_name, record.witness4_name];
  for (const f of rawFields) {
    if (f && String(f).trim()) {
      const parts = String(f).split(/,|\n/).map((s) => s.trim()).filter(Boolean);
      extractedWitnessNames.push(...parts);
    }
  }

  const witnessCountSetting = (labels['witness_count'] || 'auto').toString().trim().toLowerCase();
  const maxPrefixes = [
    lbl('witness1_prefix', '1.'),
    lbl('witness2_prefix', '2.'),
    lbl('witness3_prefix', '3.'),
    lbl('witness4_prefix', '4.'),
  ];

  let targetCount = 2;
  if (witnessCountSetting === '4') {
    targetCount = 4;
  } else if (witnessCountSetting === '3') {
    targetCount = 3;
  } else if (witnessCountSetting === '2') {
    targetCount = 2;
  } else {
    // 'auto' mode: match entered witnesses count (minimum 2, maximum 4)
    if (extractedWitnessNames.length >= 4) {
      targetCount = 4;
    } else if (extractedWitnessNames.length === 3) {
      targetCount = 3;
    } else {
      targetCount = 2;
    }
  }

  const selectedWitnesses = [];
  for (let i = 0; i < targetCount; i++) {
    selectedWitnesses.push({
      num: i + 1,
      name: extractedWitnessNames[i] || '',
      prefix: maxPrefixes[i] || `${i + 1}.`,
    });
  }

  const buildWitnessesRow = (label) => {
    const witnessItems = selectedWitnesses.map((w, idx) => {
      const pfx = (w.prefix || '').trim();
      const valText = w.name ? String(w.name).trim().toUpperCase() : '';
      return {
        stack: [
          {
            text: [
              { text: idx === 0 ? ':  ' : '   ', font: 'Times', bold: true, fontSize: FONT_SIZE, color: idx === 0 ? THEME_COLOR : '#ffffff00' },
              ...(pfx ? [{ text: `${pfx} `, font: 'Times', bold: true, fontSize: FONT_SIZE, color: THEME_COLOR }] : []),
              {
                text: valText,
                font: 'Times',
                bold: true,
                fontSize: FONT_SIZE,
                color: DATA_COLOR,
                ...(hasTamilText(valText) ? { font: 'NotoSansTamil' } : {}),
              },
            ],
            margin: [0, 0, 0, 2],
          },
          dottedLine(FULL_LINE_WIDTH, THEME_COLOR),
        ],
        margin: [0, 0, 0, idx === selectedWitnesses.length - 1 ? 0 : SUBROW_GAP],
      };
    });

    return {
      columns: [
        { width: LABEL_WIDTH, text: label, font: 'Times', bold: true, fontSize: FONT_SIZE, color: THEME_COLOR },
        {
          width: '*',
          stack: witnessItems,
        },
      ],
      margin: [0, 0, 0, ROW_GAP],
    };
  };

  const dynamicFooterTop = targetCount > 2 ? Math.max(32, FOOTER_TOP - (targetCount - 2) * 16) : FOOTER_TOP;

  return {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: [42, 44, 42, 30],
    defaultStyle: { font: 'Times', fontSize: FONT_SIZE, color: DATA_COLOR },
    content: [
      // Title: Underlined, Bold, Centered
      {
        text: titleText,
        font: 'Times',
        bold: true,
        fontSize: 13.5,
        decoration: 'underline',
        alignment: 'center',
        color: THEME_COLOR,
        margin: [0, 0, 0, 20],
      },

      // Subheader: Solemnized at .................. Tuticorin Diocese
      {
        columns: [
          {
            width: '*',
            stack: [
              {
                text: [
                  { text: `${subheaderPrefix} `, font: 'Times', bold: true, fontSize: FONT_SIZE, color: THEME_COLOR },
                  {
                    text: solemnizedText ? solemnizedText.toUpperCase() : '',
                    font: 'Times',
                    bold: true,
                    fontSize: FONT_SIZE,
                    color: DATA_COLOR,
                    ...(hasTamilText(solemnizedText) ? { font: 'NotoSansTamil' } : {}),
                  },
                ],
                margin: [0, 0, 0, 2],
              },
              dottedLine(380, THEME_COLOR),
            ],
          },
          {
            width: 'auto',
            text: dioceseText,
            font: 'Times',
            bold: true,
            fontSize: FONT_SIZE,
            alignment: 'right',
            color: THEME_COLOR,
            margin: [8, 0, 0, 0],
          },
        ],
        margin: [0, 0, 0, 22],
      },

      // 1. When Married
      singleDottedRow(lbl('marriage_date', 'When Married'), formatCertDate(record.marriage_date)),
      // 2. Where Married
      singleDottedRow(lbl('where_married', 'Where Married'), record.where_married || church?.name || ''),
      // 3. Name of the Parties (Bridegroom / Bride)
      pairedDottedRow(lbl('parties_name', 'Name of the Parties'), lbl('groom_sublabel', 'Bridegroom'), record.groom_name, lbl('bride_sublabel', 'Bride'), record.bride_name),
      // 4. Age (Bridegroom's / Bride's)
      pairedDottedRow(lbl('age', 'Age'), lbl('groom_age_sublabel', "Bridegroom's"), record.groom_age, lbl('bride_age_sublabel', "Bride's"), record.bride_age),
      // 5. Condition (Bridegroom's / Bride's)
      pairedDottedRow(lbl('condition', 'Condition'), lbl('groom_age_sublabel', "Bridegroom's"), record.groom_condition, lbl('bride_age_sublabel', "Bride's"), record.bride_condition),
      // 6. Profession (Bridegroom's / Bride's)
      pairedDottedRow(lbl('profession', 'Profession'), lbl('groom_age_sublabel', "Bridegroom's"), record.groom_profession, lbl('bride_age_sublabel', "Bride's"), record.bride_profession),
      // 7. Residence at the time of Marriage
      pairedDottedRow(lbl('residence', 'Residence at the\ntime of Marriage'), lbl('groom_age_sublabel', "Bridegroom's"), record.groom_residence, lbl('bride_age_sublabel', "Bride's"), record.bride_residence),
      // 8. Father's Name & Surname
      pairedDottedRow(lbl('father_name', "Father's Name\n& Surname"), lbl('groom_age_sublabel', "Bridegroom's"), record.groom_father_name, lbl('bride_age_sublabel', "Bride's"), record.bride_father_name),
      // 9. By banns or Licence
      singleDottedRow(lbl('banns_or_licence', 'By banns or Licence'), record.banns_or_licence || 'BY BANNS'),
      // 10. Can. impediments dispensed
      singleDottedRow(lbl('impediments_dispensed', 'Can. impediments dispensed'), record.impediments_dispensed || 'NIL'),
      // 11. Witnesses (Multi-line dotted rows)
      buildWitnessesRow(lbl('witnesses', 'Witnesses')),
      // 12. Minister of the Ceremony
      singleDottedRow(lbl('minister', 'Minister of the Ceremony'), record.priest_display_name || ''),

      // Footer: Date : .........   Seal   Parish Priest
      {
        columns: [
          {
            width: '*',
            text: [
              { text: `${dateLabel}  `, font: 'Times', bold: true, fontSize: FONT_SIZE, color: THEME_COLOR },
              { text: formatCertDate(new Date()), font: 'Times', bold: true, fontSize: FONT_SIZE, color: DATA_COLOR },
            ],
          },
          { width: '*', text: sealText, font: 'Times', bold: true, fontSize: FONT_SIZE, alignment: 'center', color: THEME_COLOR },
          { width: '*', text: signatoryTitle, font: 'Times', bold: true, fontSize: FONT_SIZE, alignment: 'right', color: THEME_COLOR },
        ],
        margin: [0, dynamicFooterTop, 0, 0],
      },
      { text: `Certificate No.: ${record.certificate_no}`, font: 'Times', fontSize: 8, color: THEME_COLOR, opacity: 0.6, margin: [0, 16, 0, 0] },
    ],
  };
}

/**
 * 2. BAPTISM CERTIFICATE
 * Exactly matches Photo 2:
 * Pill/capsule border: [ EXTRACT FROM THE REGISTER OF BAPTISM ]
 * Kept at ____________________                  Tuticorin Diocese
 * Solid lines across, Parent's Name with curly brace and 2 plain lines (no Father/Mother label),
 * God Parents (single line), Footer: Catholic Priest.
 */
function buildExactBaptismDocument(record, church, ink, template = null) {
  const THEME_COLOR = ink || '#072a63';
  const DATA_COLOR = '#000000';
  const LABEL_WIDTH = 195;
  const LINE_WIDTH = 315;
  const ROW_GAP = 35;
  const FONT_SIZE = 13;
  const PARENT_SUB_GAP = 20;
  const FOOTER_TOP = 95;

  const churchLocation = [church?.name, church?.city].filter(Boolean).join(', ');
  const labels = template?.field_labels || {};
  const lbl = (key, def) => (labels[key] !== undefined && labels[key] !== null && String(labels[key]).trim() !== '' ? labels[key] : def);

  const titleText = template?.title || 'EXTRACT FROM THE REGISTER OF BAPTISM';
  const subheaderPrefix = template?.subheader_prefix || 'Kept at';
  const dioceseText = template?.diocese_label || getDioceseLabel(church);
  const signatoryTitle = template?.signatory_title || 'Catholic Priest';
  const sealText = template?.seal_label || 'Seal';
  const dateLabel = lbl('date_label', 'Date :');

  const singleSolidRow = (label, valText) => ({
    columns: [
      { width: LABEL_WIDTH, text: label, font: 'Times', bold: true, fontSize: FONT_SIZE, color: THEME_COLOR },
      {
        width: '*',
        stack: [
          {
            text: valText ? String(valText).toUpperCase() : '',
            font: 'Times',
            bold: true,
            fontSize: FONT_SIZE,
            color: DATA_COLOR,
            margin: [3, 0, 0, 2],
            ...(hasTamilText(valText) ? { font: 'NotoSansTamil' } : {}),
          },
          solidLine(LINE_WIDTH, THEME_COLOR),
        ],
      },
    ],
    margin: [0, 0, 0, ROW_GAP],
  });

  const godParentsStr = [record.godfather_name, record.godmother_name].filter(Boolean).join(', ');

  return {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: [44, 46, 44, 32],
    defaultStyle: { font: 'Times', fontSize: FONT_SIZE, color: DATA_COLOR },
    content: [
      // Pill box header: [ EXTRACT FROM THE REGISTER OF BAPTISM ]
      {
        stack: [
          {
            canvas: [
              {
                type: 'rect',
                x: 0,
                y: 0,
                w: 420,
                h: 34,
                r: 17,
                lineWidth: 1.4,
                lineColor: THEME_COLOR,
              },
            ],
            alignment: 'center',
          },
          {
            text: titleText,
            font: 'Times',
            bold: true,
            fontSize: 15,
            alignment: 'center',
            color: THEME_COLOR,
            margin: [0, -25, 0, 28],
          },
        ],
      },

      // Subheader: Kept at ____________________        Tuticorin Diocese
      {
        columns: [
          {
            width: '*',
            stack: [
              {
                text: [
                  { text: `${subheaderPrefix} `, font: 'Times', bold: true, fontSize: FONT_SIZE, color: THEME_COLOR },
                  {
                    text: churchLocation ? churchLocation.toUpperCase() : '',
                    font: 'Times',
                    bold: true,
                    fontSize: FONT_SIZE,
                    color: DATA_COLOR,
                    ...(hasTamilText(churchLocation) ? { font: 'NotoSansTamil' } : {}),
                  },
                ],
                margin: [0, 0, 0, 2],
              },
              solidLine(380, THEME_COLOR),
            ],
          },
          {
            width: 'auto',
            text: dioceseText,
            font: 'Times',
            bold: true,
            fontSize: FONT_SIZE,
            alignment: 'right',
            color: THEME_COLOR,
            margin: [8, 0, 0, 0],
          },
        ],
        margin: [0, 0, 0, 28],
      },

      // 1. Place of Baptism
      singleSolidRow(lbl('place_of_baptism', 'Place of Baptism'), record.place_of_baptism || church?.name || ''),
      // 2. Date of Baptism
      singleSolidRow(lbl('date_of_baptism', 'Date of Baptism'), formatCertDate(record.date_of_baptism)),
      // 3. Child's Christian Name
      singleSolidRow(lbl('child_name', "Child's Christian Name"), record.child_name),
      // 4. Date of Birth
      singleSolidRow(lbl('date_of_birth', 'Date of Birth'), formatCertDate(record.date_of_birth)),
      // 5. Sex
      singleSolidRow(lbl('gender', 'Sex'), record.gender_name || ''),

      // 6. Parent's Name with curly brace and 2 blank/data lines (NO Father/Mother label)
      {
        columns: [
          { width: LABEL_WIDTH - 20, text: lbl('parents_name', "Parent's Name"), font: 'Times', bold: true, fontSize: FONT_SIZE, color: THEME_COLOR, margin: [0, 16, 0, 0] },
          { width: 16, text: '{', font: 'Times', fontSize: 46, color: THEME_COLOR, margin: [0, -4, 0, 0] },
          {
            width: '*',
            stack: [
              {
                stack: [
                  {
                    text: record.father_name ? String(record.father_name).toUpperCase() : '',
                    font: 'Times',
                    bold: true,
                    fontSize: FONT_SIZE,
                    color: DATA_COLOR,
                    margin: [3, 0, 0, 2],
                    ...(hasTamilText(record.father_name) ? { font: 'NotoSansTamil' } : {}),
                  },
                  solidLine(LINE_WIDTH, THEME_COLOR),
                ],
                margin: [0, 0, 0, PARENT_SUB_GAP],
              },
              {
                stack: [
                  {
                    text: record.mother_name ? String(record.mother_name).toUpperCase() : '',
                    font: 'Times',
                    bold: true,
                    fontSize: FONT_SIZE,
                    color: DATA_COLOR,
                    margin: [3, 0, 0, 2],
                    ...(hasTamilText(record.mother_name) ? { font: 'NotoSansTamil' } : {}),
                  },
                  solidLine(LINE_WIDTH, THEME_COLOR),
                ],
              },
            ],
          },
        ],
        margin: [0, 0, 0, ROW_GAP],
      },

      // 7. Parent's Residence
      singleSolidRow(lbl('parent_residence', "Parent's Residence"), record.parent_residence),
      // 8. God Parents
      singleSolidRow(lbl('godparents', 'God Parents'), godParentsStr),
      // 9. Priest who Baptised
      singleSolidRow(lbl('priest', 'Priest who Baptised'), record.priest_display_name || ''),
      // 10. Remarks
      singleSolidRow(lbl('remarks', 'Remarks'), record.remarks || ''),

      // Footer: Date : ____________________   Seal   Catholic Priest
      {
        columns: [
          {
            width: '*',
            text: [
              { text: `${dateLabel}  `, font: 'Times', bold: true, fontSize: FONT_SIZE, color: THEME_COLOR },
              { text: formatCertDate(new Date()), font: 'Times', bold: true, fontSize: FONT_SIZE, color: DATA_COLOR },
            ],
          },
          { width: '*', text: sealText, font: 'Times', bold: true, fontSize: FONT_SIZE, alignment: 'center', color: THEME_COLOR },
          { width: '*', text: signatoryTitle, font: 'Times', bold: true, fontSize: FONT_SIZE, alignment: 'right', color: THEME_COLOR },
        ],
        margin: [0, FOOTER_TOP, 0, 0],
      },
      { text: `Certificate No.: ${record.certificate_no}`, font: 'Times', fontSize: 8.5, color: THEME_COLOR, opacity: 0.6, margin: [0, 16, 0, 0] },
    ],
  };
}

/**
 * 3. DEATH CERTIFICATE
 * Exactly matches Photo 3:
 * Centered 2-line title:
 * EXTRACT FROM THE REGISTER OF
 * DEATHS KEPT
 * at ____________________                  Tuticorin Diocese
 * Exactly 14 fields with ':' and solid lines.
 * Footer: Place & Date on left, Seal in center, CATHOLIC PRIEST (ALL CAPS) on right.
 */
function buildExactDeathDocument(record, church, ink, template = null) {
  const THEME_COLOR = ink || '#072a63';
  const DATA_COLOR = '#000000';
  const LABEL_WIDTH = 160;
  const LINE_WIDTH = 350;
  const ROW_GAP = 24.5;
  const FONT_SIZE = 12;
  const FOOTER_TOP = 75;

  const churchLocation = [church?.name, church?.city].filter(Boolean).join(', ');
  const labels = template?.field_labels || {};
  const lbl = (key, def) => (labels[key] !== undefined && labels[key] !== null && String(labels[key]).trim() !== '' ? labels[key] : def);

  const rawTitle = template?.title || 'EXTRACT FROM THE REGISTER OF\nDEATHS KEPT';
  const titleLines = String(rawTitle).split('\n');
  const subheaderPrefix = template?.subheader_prefix || 'at';
  const dioceseText = template?.diocese_label || getDioceseLabel(church);
  const signatoryTitle = template?.signatory_title || 'CATHOLIC PRIEST';
  const sealText = template?.seal_label || 'Seal';
  const placeLabel = lbl('place_label', 'Place :');
  const dateLabel = lbl('date_label', 'Date  :');

  const deathRow = (label, valText) => ({
    columns: [
      { width: LABEL_WIDTH, text: label, font: 'Times', bold: true, fontSize: FONT_SIZE, color: THEME_COLOR },
      {
        width: '*',
        stack: [
          {
            text: [
              { text: ':  ', font: 'Times', bold: true, fontSize: FONT_SIZE, color: THEME_COLOR },
              {
                text: valText ? String(valText).toUpperCase() : '',
                font: 'Times',
                bold: true,
                fontSize: FONT_SIZE,
                color: DATA_COLOR,
                ...(hasTamilText(valText) ? { font: 'NotoSansTamil' } : {}),
              },
            ],
            margin: [0, 0, 0, 2],
          },
          solidLine(LINE_WIDTH, THEME_COLOR),
        ],
      },
    ],
    margin: [0, 0, 0, ROW_GAP],
  });

  return {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: [42, 42, 42, 28],
    defaultStyle: { font: 'Times', fontSize: FONT_SIZE, color: DATA_COLOR },
    content: [
      // 2-line Title (or dynamic lines from template)
      {
        stack: titleLines.map((line, idx) => ({
          text: line,
          font: 'Times',
          bold: true,
          fontSize: 14.5,
          alignment: 'center',
          color: THEME_COLOR,
          margin: [0, idx === 0 ? 0 : 2, 0, idx === titleLines.length - 1 ? 20 : 0],
        })),
      },

      // Subheader: at ____________________                  Tuticorin Diocese
      {
        columns: [
          {
            width: '*',
            stack: [
              {
                text: [
                  { text: `${subheaderPrefix} `, font: 'Times', bold: true, fontSize: FONT_SIZE, color: THEME_COLOR },
                  {
                    text: churchLocation ? churchLocation.toUpperCase() : '',
                    font: 'Times',
                    bold: true,
                    fontSize: FONT_SIZE,
                    color: DATA_COLOR,
                    ...(hasTamilText(churchLocation) ? { font: 'NotoSansTamil' } : {}),
                  },
                ],
                margin: [0, 0, 0, 2],
              },
              solidLine(380, THEME_COLOR),
            ],
          },
          {
            width: 'auto',
            text: dioceseText,
            font: 'Times',
            bold: true,
            fontSize: FONT_SIZE,
            alignment: 'right',
            color: THEME_COLOR,
            margin: [8, 0, 0, 0],
          },
        ],
        margin: [0, 0, 0, 22],
      },

      // 14 exact rows matching Photo 3
      deathRow(lbl('deceased_name', 'Name'), record.deceased_name),
      deathRow(lbl('age', 'Age'), record.age),
      deathRow(lbl('place', 'Place'), record.place),
      deathRow(lbl('profession', 'Profession'), record.profession),
      deathRow(lbl('parents', 'Parents'), record.parents),
      deathRow(lbl('date_of_death', 'Date of death'), formatCertDate(record.date_of_death)),
      deathRow(lbl('place_of_death', 'Place of death'), record.place_of_death),
      deathRow(lbl('cause', 'Cause'), record.cause),
      deathRow(lbl('confession', 'C.Confession'), record.confession_received),
      deathRow(lbl('viaticum', 'V.Viaticum'), record.viaticum_received),
      deathRow(lbl('anointing', 'A.Anointing'), record.anointing_received),
      deathRow(lbl('burial_date', 'Date of Burial'), formatCertDate(record.burial_date)),
      deathRow(lbl('cemetery', 'Place of Burial'), record.cemetery),
      deathRow(lbl('minister', 'Minister'), record.priest_display_name || ''),

      // Footer: Place & Date on left, Seal in center, CATHOLIC PRIEST on right
      {
        columns: [
          {
            width: '*',
            stack: [
              {
                text: [
                  { text: `${placeLabel}  `, font: 'Times', bold: true, fontSize: FONT_SIZE, color: THEME_COLOR },
                  { text: church?.city ? String(church.city).toUpperCase() : '', font: 'Times', bold: true, fontSize: FONT_SIZE, color: DATA_COLOR },
                ],
                margin: [0, 0, 0, 4],
              },
              {
                text: [
                  { text: `${dateLabel}  `, font: 'Times', bold: true, fontSize: FONT_SIZE, color: THEME_COLOR },
                  { text: formatCertDate(new Date()), font: 'Times', bold: true, fontSize: FONT_SIZE, color: DATA_COLOR },
                ],
              },
            ],
          },
          { width: '*', text: sealText, font: 'Times', bold: true, fontSize: FONT_SIZE, alignment: 'center', color: THEME_COLOR, margin: [0, 10, 0, 0] },
          { width: '*', text: signatoryTitle, font: 'Times', bold: true, fontSize: FONT_SIZE, alignment: 'right', color: THEME_COLOR, margin: [0, 10, 0, 0] },
        ],
        margin: [0, FOOTER_TOP, 0, 0],
      },
      { text: `Certificate No.: ${record.certificate_no}`, font: 'Times', fontSize: 8, color: THEME_COLOR, opacity: 0.6, margin: [0, 14, 0, 0] },
    ],
  };
}

/**
 * 4. CONFIRMATION CERTIFICATE
 * Exactly matches Photo 4:
 * Centered Title: Extract from Confirmation Register
 * Kept at ____________________                  Tuticorin Diocese
 * Exactly 10 fields with ':' and solid lines.
 * Signature line below field 10.
 * Footer: SEAL (ALL CAPS) in center, Parish Priest on right.
 */
function buildExactConfirmationDocument(record, church, ink, template = null) {
  const THEME_COLOR = ink || '#072a63';
  const DATA_COLOR = '#000000';
  const LABEL_WIDTH = 190;
  const LINE_WIDTH = 320;
  const ROW_GAP = 34;
  const FONT_SIZE = 13;
  const FOOTER_TOP = 88;

  const churchLocation = [church?.name, church?.city].filter(Boolean).join(', ');
  const labels = template?.field_labels || {};
  const lbl = (key, def) => (labels[key] !== undefined && labels[key] !== null && String(labels[key]).trim() !== '' ? labels[key] : def);

  const titleText = template?.title || 'Extract from Confirmation Register';
  const subheaderPrefix = template?.subheader_prefix || 'Kept at';
  const dioceseText = template?.diocese_label || getDioceseLabel(church);
  const signatoryTitle = template?.signatory_title || 'Parish Priest';
  const sealText = template?.seal_label || 'SEAL';
  const dateLabel = lbl('date_label', 'Date :');

  const confirmationRow = (label, valText) => ({
    columns: [
      { width: LABEL_WIDTH, text: label, font: 'Times', bold: true, fontSize: FONT_SIZE, color: THEME_COLOR },
      {
        width: '*',
        stack: [
          {
            text: [
              { text: ':  ', font: 'Times', bold: true, fontSize: FONT_SIZE, color: THEME_COLOR },
              {
                text: valText ? String(valText).toUpperCase() : '',
                font: 'Times',
                bold: true,
                fontSize: FONT_SIZE,
                color: DATA_COLOR,
                ...(hasTamilText(valText) ? { font: 'NotoSansTamil' } : {}),
              },
            ],
            margin: [0, 0, 0, 2],
          },
          solidLine(LINE_WIDTH, THEME_COLOR),
        ],
      },
    ],
    margin: [0, 0, 0, ROW_GAP],
  });

  return {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: [42, 46, 42, 32],
    defaultStyle: { font: 'Times', fontSize: FONT_SIZE, color: DATA_COLOR },
    content: [
      // Title: Extract from Confirmation Register (Title Case)
      {
        text: titleText,
        font: 'Times',
        bold: true,
        fontSize: 16.5,
        alignment: 'center',
        color: THEME_COLOR,
        margin: [0, 0, 0, 26],
      },

      // Subheader: Kept at ____________________        Tuticorin Diocese
      {
        columns: [
          {
            width: '*',
            stack: [
              {
                text: [
                  { text: `${subheaderPrefix} `, font: 'Times', bold: true, fontSize: FONT_SIZE, color: THEME_COLOR },
                  {
                    text: churchLocation ? churchLocation.toUpperCase() : '',
                    font: 'Times',
                    bold: true,
                    fontSize: FONT_SIZE,
                    color: DATA_COLOR,
                    ...(hasTamilText(churchLocation) ? { font: 'NotoSansTamil' } : {}),
                  },
                ],
                margin: [0, 0, 0, 2],
              },
              solidLine(380, THEME_COLOR),
            ],
          },
          {
            width: 'auto',
            text: dioceseText,
            font: 'Times',
            bold: true,
            fontSize: FONT_SIZE,
            alignment: 'right',
            color: THEME_COLOR,
            margin: [8, 0, 0, 0],
          },
        ],
        margin: [0, 0, 0, 28],
      },

      // 10 exact rows matching Photo 4
      confirmationRow(lbl('name', 'Name'), record.name),
      confirmationRow(lbl('age', 'Age'), record.age),
      confirmationRow(lbl('gender', 'Sex'), record.gender_name || ''),
      confirmationRow(lbl('parents', 'Parents'), record.parents),
      confirmationRow(lbl('caste', 'Caste'), record.caste),
      confirmationRow(lbl('sponsors', 'Sponsors'), record.sponsors),
      confirmationRow(lbl('domicile', 'Domicile'), record.domicile),
      confirmationRow(lbl('place_of_confirmation', 'Place of Confirmation'), record.place_of_confirmation || church?.name || ''),
      confirmationRow(lbl('date_of_confirmation', 'Date of Confirmation'), formatCertDate(record.date_of_confirmation)),
      confirmationRow(lbl('bishop', 'Bishop who confirmed'), record.bishop_name || ''),

      // Signature line on left below Bishop who confirmed
      {
        columns: [
          {
            width: 190,
            stack: [
              { text: ' ', margin: [0, 0, 0, 26] },
              solidLine(190, THEME_COLOR),
            ],
          },
          { width: '*', text: '' },
        ],
        margin: [0, 0, 0, 16],
      },

      // Footer: Date on left, SEAL in center, Parish Priest on right
      {
        columns: [
          {
            width: '*',
            text: [
              { text: `${dateLabel}  `, font: 'Times', bold: true, fontSize: FONT_SIZE, color: THEME_COLOR },
              { text: formatCertDate(new Date()), font: 'Times', bold: true, fontSize: FONT_SIZE, color: DATA_COLOR },
            ],
          },
          { width: '*', text: sealText, font: 'Times', bold: true, fontSize: FONT_SIZE, alignment: 'center', color: THEME_COLOR },
          { width: '*', text: signatoryTitle, font: 'Times', bold: true, fontSize: FONT_SIZE, alignment: 'right', color: THEME_COLOR },
        ],
        margin: [0, FOOTER_TOP, 0, 0],
      },
      { text: `Certificate No.: ${record.certificate_no}`, font: 'Times', fontSize: 8, color: THEME_COLOR, opacity: 0.6, margin: [0, 16, 0, 0] },
    ],
  };
}

async function generateCertificatePdf(type, record, church, template = null) {
  const primaryColor = getThemePrimaryColor(church?.theme_color);
  const ink = primaryColor;

  let docDefinition;
  switch (type) {
    case 'marriage':
      docDefinition = buildExactMarriageDocument(record, church, ink, template);
      break;
    case 'baptism':
      docDefinition = buildExactBaptismDocument(record, church, ink, template);
      break;
    case 'death':
      docDefinition = buildExactDeathDocument(record, church, ink, template);
      break;
    case 'confirmation':
      docDefinition = buildExactConfirmationDocument(record, church, ink, template);
      break;
    default:
      throw new Error(`Unsupported certificate type for PDF generation: ${type}`);
  }

  return renderPdfBuffer(docDefinition);
}

module.exports = {
  generateCertificatePdf,
  buildExactMarriageDocument,
  buildExactBaptismDocument,
  buildExactDeathDocument,
  buildExactConfirmationDocument,
};
