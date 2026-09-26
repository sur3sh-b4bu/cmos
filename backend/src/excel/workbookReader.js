'use strict';

const ExcelJS = require('exceljs');
const ApiError = require('../utils/ApiError');

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_MAX_ROWS = 20000;

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]; // "PK\x03\x04" -- every .xlsx is a ZIP
const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0]; // legacy .xls and password-protected Office files

function startsWith(buffer, magic) {
  return magic.every((byte, i) => buffer[i] === byte);
}

/** Case-, spacing- and asterisk-insensitive heading comparison. The
 * " (Name or ID)" suffix older exports/templates put on lookup columns is
 * ignored too, so old files keep importing. */
function normalizeHeading(text) {
  return String(text)
    .normalize('NFC')
    .replace(/[\u00a0\u200b]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s*\*+$/, '')
    .replace(/\s*\(name or id\)$/, '')
    .trim();
}

function cleanText(text) {
  const value = String(text).replace(/[\u00a0\u200b]/g, ' ').trim();
  return value === '' ? null : value;
}

/** ExcelJS hands back rich text, hyperlinks and formulas as objects; reduce
 * them to the plain value a person sees in the cell. A formula is never
 * evaluated or trusted -- only the value Excel last stored for it is read.
 * Still typed (Date/number/string) at this point -- see cellToText() below
 * for the column-aware step that turns this into plain text. */
function unwrapCell(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date || typeof value === 'number') return value;
  if (typeof value === 'string') return cleanText(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'object') {
    if (Array.isArray(value.richText)) return cleanText(value.richText.map((part) => part.text).join(''));
    if (value.error) return cleanText(value.error);
    if ('result' in value) return unwrapCell(value.result);
    if ('text' in value) return unwrapCell(value.text);
  }
  return null;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * Every column except a 'date' one is read as plain text, full stop -- the
 * type-specific parser (parseText/parseCode/parseAmount/a resolver, see
 * importEngine.js) is what decides how to convert that text into a number,
 * a code, a looked-up id, etc. A column's own declared type is what decides
 * that conversion, never Excel's own guess at the cell's type -- so a
 * "Certificate No." or "Remarks" cell that Excel silently auto-detected as
 * a date (Excel does this aggressively, even outside date columns) still
 * imports as the text it visibly shows, instead of being force-fed to a
 * date parser or rejected outright. `unwrapCell()`'s native Date/number
 * stays untouched ONLY for 'date' columns, whose parser (parseDateCell) is
 * built specifically to read a real Excel date cell or numeric serial --
 * converting it to text first and back would only re-introduce the
 * ambiguity that parser exists to avoid.
 *
 * A stray Date (the auto-detection case above) becomes DD-MM-YYYY read with
 * UTC getters -- never toString()/toLocaleDateString(), which would leak
 * the server's own timezone/locale into someone else's imported text.
 */
function cellToText(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return `${pad2(value.getUTCDate())}-${pad2(value.getUTCMonth() + 1)}-${value.getUTCFullYear()}`;
  }
  if (typeof value === 'number') return String(value);
  return value; // already a clean string, from unwrapCell above
}

/**
 * Builds heading -> column lookup from a spec's columns. Every column is
 * reachable by its English label, Tamil label, its key and any extra
 * aliases (legacy headings), so a file exported in either UI language, or by
 * an older version of the app, still maps correctly.
 */
function buildHeadingIndex(columns) {
  const index = new Map();
  for (const column of columns) {
    const accepted = [column.label && column.label.en, column.label && column.label.ta, column.key, ...(column.aliases || [])];
    for (const heading of accepted.filter(Boolean)) {
      const normalized = normalizeHeading(heading);
      const existing = index.get(normalized);
      if (existing && existing !== column) {
        throw new Error(`Import spec bug: heading "${heading}" maps to both "${existing.key}" and "${column.key}"`);
      }
      index.set(normalized, column);
    }
  }
  return index;
}

function headingLabel(column, lang) {
  return (column.label && (column.label[lang] || column.label.en)) || column.key;
}

function checkFileEnvelope(buffer, { fileName, maxBytes }) {
  if (fileName) {
    const dot = fileName.lastIndexOf('.');
    const extension = dot === -1 ? '' : fileName.slice(dot).toLowerCase();
    if (extension !== '.xlsx') {
      throw ApiError.badRequest(
        `Only .xlsx files can be imported${extension ? ` (this file is "${extension}")` : ''}. In Excel use File > Save As > Excel Workbook (*.xlsx).`
      );
    }
  }
  if (!buffer || buffer.length === 0) throw ApiError.badRequest('The file is empty.');
  if (buffer.length > maxBytes) {
    const mb = (bytes) => (bytes / (1024 * 1024)).toFixed(1);
    throw ApiError.badRequest(`The file is too large (${mb(buffer.length)} MB). The maximum size is ${mb(maxBytes)} MB.`);
  }
  if (startsWith(buffer, OLE_MAGIC)) {
    throw ApiError.badRequest(
      'This looks like an old Excel (.xls) or a password-protected file. Open it in Excel and use Save As > Excel Workbook (*.xlsx), without a password.'
    );
  }
  if (!startsWith(buffer, ZIP_MAGIC)) {
    throw ApiError.badRequest('This is not a valid .xlsx workbook. Export or save it from Excel as an Excel Workbook (*.xlsx).');
  }
}

/** Validates the file itself and returns its workbook and the sheet to read ("Data", else the first). */
async function loadSheet(buffer, { fileName, maxBytes = DEFAULT_MAX_BYTES }) {
  checkFileEnvelope(buffer, { fileName, maxBytes });

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw ApiError.badRequest('This file could not be read as an .xlsx workbook. It may be damaged. Try exporting it again.');
  }

  const sheet = workbook.getWorksheet('Data') || workbook.worksheets[0];
  if (!sheet || sheet.actualRowCount === 0) throw ApiError.badRequest('The file has no data.');
  return { workbook, sheet };
}

const PREVIEW_SAMPLES = 3;
const PREVIEW_SCAN_ROWS = 200;

/**
 * Describes an uploaded sheet for the "match columns" step: every column of
 * the file (its heading and a few example values, so the user can tell which
 * is which even when headings are wrong or missing) and, for each importable
 * field, the file column the heading-matching would have picked on its own
 * (`suggestedColumn`, or null). Column numbers are 1-based sheet positions --
 * the same numbers readWorkbook()'s `mapping` option takes back.
 *
 * Unlike readWorkbook this never rejects unrecognised headings: the point of
 * the step is that the user can fix exactly that by choosing columns by hand.
 */
async function previewWorkbook(buffer, { columns, fileName, lang = 'en', maxBytes = DEFAULT_MAX_BYTES, hints = {} }) {
  const { sheet } = await loadSheet(buffer, { fileName, maxBytes });
  const importable = columns.filter((c) => !c.info);
  const index = buildHeadingIndex(importable);

  const headerRow = sheet.getRow(1);
  const columnCount = Math.max(sheet.columnCount, headerRow.cellCount);
  const sourceColumns = [];
  const suggestedByKey = new Map();

  for (let number = 1; number <= columnCount; number += 1) {
    const heading = cellToText(unwrapCell(headerRow.getCell(number).value)) || '';
    const samples = [];
    const lastRow = Math.min(sheet.rowCount, PREVIEW_SCAN_ROWS + 1);
    for (let r = 2; r <= lastRow && samples.length < PREVIEW_SAMPLES; r += 1) {
      const text = cellToText(unwrapCell(sheet.getRow(r).getCell(number).value));
      if (text !== null) samples.push(String(text).slice(0, 60));
    }
    // A column with no heading and no data is just formatting spill-over.
    if (!heading && !samples.length) continue;

    const matched = heading ? index.get(normalizeHeading(heading)) : null;
    if (matched && !suggestedByKey.has(matched.key)) suggestedByKey.set(matched.key, number);
    sourceColumns.push({ number, heading, samples });
  }

  return {
    sheetName: sheet.name,
    rowCount: Math.max(0, sheet.actualRowCount - 1),
    sourceColumns,
    fields: importable.map((c) => ({
      key: c.key,
      label: headingLabel(c, lang),
      required: Boolean(c.required),
      suggestedColumn: suggestedByKey.get(c.key) ?? null,
      ...(hints[c.key] ? { hint: hints[c.key] } : {}),
    })),
  };
}

/**
 * Checks a user-chosen `{ fieldKey: columnNumber }` mapping against the fields
 * the module accepts and the sheet's real size; returns it as a Map. One file
 * column may feed several fields. Every
 * problem is an ApiError.badRequest -- the mapping arrives from the browser
 * and is never trusted.
 */
function validateMapping(mapping, { importable, sheet, lang }) {
  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) {
    throw ApiError.badRequest('The column mapping is not valid.');
  }
  const byKey = new Map(importable.map((c) => [c.key, c]));
  const columnCount = Math.max(sheet.columnCount, sheet.getRow(1).cellCount);
  const result = new Map();

  for (const [key, number] of Object.entries(mapping)) {
    const field = byKey.get(key);
    if (!field) throw ApiError.badRequest(`The column mapping names an unknown field "${key}".`);
    if (!Number.isInteger(number) || number < 1 || number > columnCount) {
      throw ApiError.badRequest(`The column chosen for "${headingLabel(field, lang)}" does not exist in the file.`);
    }
    // The same column may deliberately feed more than one field (the popup only warns about it).
    result.set(key, number);
  }

  const missing = importable.filter((c) => c.required && !result.has(c.key));
  if (missing.length) {
    throw ApiError.badRequest(`Choose a column for the required field(s): ${missing.map((c) => `"${headingLabel(c, lang)}"`).join(', ')}.`);
  }
  if (result.size === 0) throw ApiError.badRequest('No fields were selected to import.');
  return result;
}

/**
 * Reads the first data sheet of an .xlsx upload into plain rows keyed by the
 * spec's column keys.
 *
 * File-level problems (wrong type, empty, too large, wrong headings, too many
 * rows) throw ApiError.badRequest with a message the user can act on. Row-level
 * problems are NOT decided here -- this only extracts values; the import
 * engine validates them.
 *
 * With `mapping` ({ fieldKey: 1-based column number }) the columns are the ones
 * the user picked in the match-columns step and headings are not consulted;
 * without it, columns are found by matching headings.
 *
 * @param {Buffer} buffer
 * @param {{columns: object[], fileName?: string, lang?: 'en'|'ta', maxBytes?: number, maxRows?: number, mapping?: Object<string, number>}} options
 * @returns {Promise<{rows: {rowNumber: number, values: Object}[], date1904: boolean, ignoredHeadings: string[]}>}
 */
async function readWorkbook(buffer, { columns, fileName, lang = 'en', maxBytes = DEFAULT_MAX_BYTES, maxRows = DEFAULT_MAX_ROWS, mapping }) {
  const { workbook, sheet } = await loadSheet(buffer, { fileName, maxBytes });

  const importable = columns.filter((c) => !c.info);
  const columnByKey = new Map(importable.map((c) => [c.key, c]));
  let columnNumberByKey = new Map();
  const ignoredHeadings = [];

  if (mapping) {
    // The user chose the columns themselves (see previewWorkbook): headings
    // play no part. Headings of the columns they left out are reported as ignored.
    columnNumberByKey = validateMapping(mapping, { importable, sheet, lang });
    const used = new Set(columnNumberByKey.values());
    sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, columnNumber) => {
      const text = cellToText(unwrapCell(cell.value));
      if (typeof text === 'string' && !used.has(columnNumber)) ignoredHeadings.push(text);
    });
  } else {
    const index = buildHeadingIndex(importable);
    const foundHeadings = [];
    const repeated = [];

    sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, columnNumber) => {
      const text = unwrapCell(cell.value);
      if (typeof text !== 'string') return;
      foundHeadings.push(text);
      const column = index.get(normalizeHeading(text));
      if (!column) {
        ignoredHeadings.push(text);
        return;
      }
      if (columnNumberByKey.has(column.key)) repeated.push(text);
      else columnNumberByKey.set(column.key, columnNumber);
    });

    if (repeated.length) {
      throw ApiError.badRequest(`The heading "${repeated[0]}" appears more than once. Each column may appear only once.`);
    }

    const missing = importable.filter((c) => c.required && !columnNumberByKey.has(c.key));
    if (missing.length) {
      throw ApiError.badRequest(
        `The file does not have the expected column headings. Missing required column(s): ${missing
          .map((c) => `"${headingLabel(c, lang)}"`)
          .join(', ')}. Download the import template to get the exact headings.`,
        { expectedHeadings: importable.map((c) => headingLabel(c, lang)), foundHeadings }
      );
    }
    if (columnNumberByKey.size === 0) {
      throw ApiError.badRequest('None of the column headings were recognised. Download the import template to get the exact headings.', {
        expectedHeadings: importable.map((c) => headingLabel(c, lang)),
        foundHeadings,
      });
    }
  }

  if (sheet.actualRowCount - 1 > maxRows) {
    throw ApiError.badRequest(`The file has more than ${maxRows} rows. Split it into smaller files and import them one at a time.`);
  }

  const rows = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = {};
    let hasValue = false;
    for (const [key, columnNumber] of columnNumberByKey) {
      const raw = unwrapCell(row.getCell(columnNumber).value);
      const value = columnByKey.get(key).type === 'date' ? raw : cellToText(raw);
      values[key] = value;
      if (value !== null) hasValue = true;
    }
    if (hasValue) rows.push({ rowNumber, values });
  });

  if (rows.length === 0) throw ApiError.badRequest('The file has headings but no data rows.');

  return { rows, date1904: Boolean(workbook.properties && workbook.properties.date1904), ignoredHeadings };
}

module.exports = {
  readWorkbook,
  previewWorkbook,
  normalizeHeading,
  buildHeadingIndex,
  headingLabel,
  unwrapCell,
  cellToText,
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_ROWS,
};
