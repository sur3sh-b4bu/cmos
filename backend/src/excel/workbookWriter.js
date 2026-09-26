'use strict';

const ExcelJS = require('exceljs');
const { isoToUtcDate } = require('./dateOnly');

const DATE_FORMAT = 'dd-mm-yyyy';
const AMOUNT_FORMAT = '0.00';
const TEXT_FORMAT = '@';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Text a spreadsheet program could mistake for a formula or command. */
const FORMULA_LEADERS = /^[=+\-@\t\r]/;

function looksLikeFormula(text) {
  return FORMULA_LEADERS.test(text);
}

/**
 * Writes one cell.
 *
 * Every text value is stored as an explicit string cell -- never as a formula
 * object -- so opening the file cannot run anything. Text that starts with
 * = + - @ (or tab/CR) is additionally given the Text number format ("@"),
 * which is what stops Excel converting it into a live formula if someone
 * later edits the cell. The value itself is left untouched (no apostrophe
 * prefix), so the export stays lossless: a phone number such as "+91 98765"
 * round-trips exactly.
 */
function writeCell(cell, column, value) {
  if (value === null || value === undefined || value === '') return;

  if (column.type === 'date') {
    const date = typeof value === 'string' ? isoToUtcDate(value.slice(0, 10)) : value;
    if (date) {
      cell.value = date;
      cell.numFmt = DATE_FORMAT;
      return;
    }
    // Not an ISO date (should not happen for stored data): keep it visible as text.
    cell.value = String(value);
    return;
  }

  if (column.type === 'number') {
    const number = Number(value);
    if (Number.isFinite(number)) {
      cell.value = number;
      cell.numFmt = column.numFmt || AMOUNT_FORMAT;
      return;
    }
  }

  const text = String(value);
  cell.value = text;
  if (looksLikeFormula(text)) cell.numFmt = TEXT_FORMAT;
}

function styleHeader(sheet) {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B3D91' } };
  header.alignment = { vertical: 'middle', wrapText: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

function widthFor(column) {
  if (column.width) return column.width;
  const base = column.type === 'date' ? 14 : Math.max(String(column.header).length + 4, 16);
  return Math.min(base, 48);
}

/**
 * @param {object} options
 * @param {{header: string, key: string, type?: 'text'|'date'|'number', numFmt?: string, width?: number}[]} options.columns
 * @param {Object[]} options.rows       values keyed by column.key (dates as ISO "YYYY-MM-DD")
 * @param {{title: string, rows: string[][]}} [options.notes]   optional second sheet
 * @param {string} [options.sheetName]
 * @returns {Promise<Buffer>}
 */
async function buildWorkbookBuffer({ columns, rows, notes, sheetName = 'Data' }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Church Office Management System';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: widthFor(c) }));
  styleHeader(sheet);

  rows.forEach((values, i) => {
    const row = sheet.getRow(i + 2);
    columns.forEach((column, columnIndex) => writeCell(row.getCell(columnIndex + 1), column, values[column.key]));
  });

  if (notes) {
    const notesSheet = workbook.addWorksheet(notes.title);
    notesSheet.getColumn(1).width = 30;
    notesSheet.getColumn(2).width = 100;
    notes.rows.forEach((line, i) => {
      const row = notesSheet.getRow(i + 1);
      line.forEach((text, c) => {
        const cell = row.getCell(c + 1);
        cell.value = String(text);
        cell.alignment = { vertical: 'top', wrapText: true };
        if (looksLikeFormula(String(text))) cell.numFmt = TEXT_FORMAT;
      });
      if (i === 0) row.font = { bold: true };
    });
  }

  const written = await workbook.xlsx.writeBuffer();
  return Buffer.from(written);
}

module.exports = { buildWorkbookBuffer, looksLikeFormula, XLSX_MIME, DATE_FORMAT };
