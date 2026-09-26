'use strict';

const { DEFAULT_MAX_BYTES, DEFAULT_MAX_ROWS } = require('./workbookReader');

/**
 * Text for the "Notes" sheet of every import template, in English and Tamil.
 * Module-specific rows (required columns, allowed values, rules) are added by
 * each transfer service; this holds only what is common to all of them.
 */
const TEXT = {
  en: {
    sheet: 'Notes',
    header: ['Topic', 'Details'],
    howTo: 'How to use',
    howToText:
      'Fill in one record per row on the "Data" sheet, then use Import Excel. Row 2 is only an example: overwrite it or delete it. Columns you do not need can be left blank; do not rename the headings.',
    required: 'Required columns',
    date: 'Date format',
    dateText:
      'Write dates as DD-MM-YYYY (for example 05-04-2016). Real Excel date cells and YYYY-MM-DD also work. Month-first dates (MM/DD/YYYY) are rejected.',
    limits: 'Limits',
    limitsText: (mb, rows) =>
      `Only .xlsx files, up to ${mb} MB and ${rows} rows per file. Rows with a problem are skipped and listed in the result; all the good rows are still imported.`,
    alsoAccepted: 'also accepted',
    paid: 'Paid',
    unpaid: 'Unpaid',
  },
  ta: {
    sheet: 'குறிப்புகள்',
    header: ['தலைப்பு', 'விவரம்'],
    howTo: 'பயன்படுத்தும் முறை',
    howToText:
      '"Data" தாளில் ஒரு வரிசைக்கு ஒரு பதிவு என நிரப்பி, பின்னர் Import Excel பயன்படுத்தவும். 2-ஆம் வரிசை எடுத்துக்காட்டு மட்டுமே: அதை மாற்றவும் அல்லது நீக்கவும். தேவையில்லாத நெடுவரிசைகளை காலியாக விடலாம்; தலைப்புகளை மாற்ற வேண்டாம்.',
    required: 'கட்டாய நெடுவரிசைகள்',
    date: 'தேதி வடிவம்',
    dateText:
      'தேதிகளை DD-MM-YYYY என எழுதவும் (எ.கா. 05-04-2016). உண்மையான Excel தேதி கலங்களும் YYYY-MM-DD வடிவமும் ஏற்கப்படும். மாத-முதல் (MM/DD/YYYY) தேதிகள் நிராகரிக்கப்படும்.',
    limits: 'வரம்புகள்',
    limitsText: (mb, rows) =>
      `.xlsx கோப்புகள் மட்டும், ஒரு கோப்புக்கு ${mb} MB மற்றும் ${rows} வரிசைகள் வரை. பிழையுள்ள வரிசைகள் தவிர்க்கப்பட்டு முடிவில் பட்டியலிடப்படும்; சரியான வரிசைகள் இறக்குமதி செய்யப்படும்.`,
    alsoAccepted: 'மற்றும் ஏற்கப்படும்',
    paid: 'செலுத்தப்பட்டது',
    unpaid: 'செலுத்தப்படவில்லை',
  },
};

const textFor = (lang) => TEXT[lang === 'ta' ? 'ta' : 'en'];

/**
 * Notes-sheet rows: header, how-to, required columns, then the module's own
 * rows, then date format and limits.
 * @param {'en'|'ta'} lang
 * @param {{requiredNames: string, moduleRows?: string[][]}} options
 */
function buildNotesRows(lang, { requiredNames, moduleRows = [] }) {
  const t = textFor(lang);
  return [
    t.header,
    [t.howTo, t.howToText],
    [t.required, requiredNames],
    ...moduleRows,
    [t.date, t.dateText],
    [t.limits, t.limitsText((DEFAULT_MAX_BYTES / (1024 * 1024)).toFixed(0), DEFAULT_MAX_ROWS)],
  ];
}

module.exports = { buildNotesRows, textFor };
