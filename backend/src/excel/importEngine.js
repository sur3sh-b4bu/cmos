'use strict';

const { pool } = require('../config/db');
const logger = require('../utils/logger');
const ApiError = require('../utils/ApiError');
const { readWorkbook, headingLabel } = require('./workbookReader');
const { parseDateCell } = require('./dateOnly');

const CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,29}$/;
// "200", "200.50", "1,200.50", optionally with a currency symbol (older exports wrote "₹200.00").
const AMOUNT_TEXT = /^[₹$€£]?\s*(\d{1,3}(,\d{3})+|\d+)(\.\d+)?$/;
const MAX_AMOUNT = 99999999.99;

// Every cell reaching these three parsers is already plain text (or null) --
// see workbookReader.js's cellToText(), which turns every non-date column's
// cell into the text a person sees, before any of this ever runs. That's
// deliberate: Excel's own guess at a cell's type (auto-detecting a
// "Certificate No." or "Remarks" cell as a number or a date) never gets a
// vote here -- only the column's own declared type does, and these
// functions convert FROM text TO that type, uniformly, with nothing left
// to defensively branch on.

function parseText(raw, column) {
  const value = raw;
  if (column.max && value.length > column.max) {
    return { error: `Too long: ${value.length} characters, the limit is ${column.max}.` };
  }
  return { value };
}

function parseCode(raw) {
  if (!CODE_PATTERN.test(raw)) {
    return { error: 'May contain only letters, digits and . _ / - (up to 30 characters, starting with a letter or digit).' };
  }
  return { value: raw };
}

function parseAmount(raw, column) {
  if (!AMOUNT_TEXT.test(raw.trim())) {
    return { error: `"${raw}" is not a valid amount. Use digits with an optional decimal point, for example 200 or 200.50.` };
  }
  const number = Number(raw.replace(/[₹$€£,\s]/g, ''));
  if (!Number.isFinite(number)) return { error: 'Not a valid amount.' };
  if (Number(number.toFixed(2)) !== number) return { error: 'An amount can have at most 2 decimal places.' };
  if (column.positive && number <= 0) return { error: 'The amount must be greater than 0.' };
  if (number > MAX_AMOUNT) return { error: 'The amount is too large.' };
  return { value: number };
}

function parseValue(column, raw, { date1904, lookups, resolvers }) {
  if (raw === null || raw === undefined) return { value: null };
  switch (column.type) {
    case 'text':
      return parseText(raw, column);
    case 'code':
      return parseCode(raw);
    case 'date': {
      const parsed = parseDateCell(raw, { date1904 });
      return parsed.ok ? { value: parsed.iso } : { error: parsed.reason };
    }
    case 'number':
      return parseAmount(raw, column);
    default: {
      const resolver = resolvers[column.type];
      if (!resolver) throw new Error(`Import spec bug: no resolver for column type "${column.type}"`);
      return resolver(raw, lookups, column);
    }
  }
}

function sortErrors(errors, columns) {
  const order = new Map(columns.map((c, i) => [c.key, i]));
  return errors.sort((a, b) => a.row - b.row || (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0));
}

/**
 * Imports one workbook.
 *
 * Phase 1 (no database writes): read the file, then parse and validate EVERY
 * row, collecting problems as { row, column, message } where `column` is the
 * heading the user sees -- never a database column name. Phase 2: insert all
 * rows that passed, in file order, inside ONE transaction, so the valid rows
 * are saved together or (if the database itself fails part-way) not at all.
 * Rows that failed validation are skipped and reported; they never block the
 * valid ones.
 *
 * `mapping` ({ fieldKey: columnNumber }) is what the user chose in the
 * match-columns step; without it columns are found by heading.
 *
 * `spec` supplies: columns, loadLookups(ctx), resolvers, validateRow,
 * validateRowAsync?, findExistingUnique?, insertAll(conn, rows, ctx, lookups).
 *
 * @returns {Promise<{report: object, created: object[]}>}
 */
async function runImport({ buffer, fileName, lang = 'en', spec, ctx, nowMs = Date.now(), mapping }) {
  const { rows, date1904, ignoredHeadings } = await readWorkbook(buffer, { columns: spec.columns, fileName, lang, mapping });
  const importable = spec.columns.filter((c) => !c.info);
  const byKey = new Map(importable.map((c) => [c.key, c]));
  const lookups = await spec.loadLookups(ctx);
  const resolvers = spec.resolvers || {};
  const errors = [];
  const valid = [];
  const seenUnique = new Map(importable.filter((c) => c.unique).map((c) => [c.key, new Map()]));
  const problem = (row, column, message) => errors.push({ row, key: column.key, column: headingLabel(column, lang), message });

  for (const { rowNumber, values: raw } of rows) {
    const rowProblems = [];
    const values = {};
    const fallbacks = [];

    for (const column of importable) {
      if (!(column.key in raw)) continue;
      const parsed = parseValue(column, raw[column.key], { date1904, lookups, resolvers });
      if (parsed.error) rowProblems.push({ column, message: parsed.error });
      else if (parsed.value === null && column.required) rowProblems.push({ column, message: 'This value is required.' });
      else {
        values[column.key] = parsed.value;
        // A resolver (see certificateTransferService.js's `priest`, for
        // example) can hand back a fallback instead of failing the row when
        // its text doesn't match anything in the master list -- e.g. a
        // historical import full of priest names never added under
        // Masters > Priests. Applied once every column has been read (below),
        // and only into a column that's still genuinely blank, so it can
        // never clobber something the file itself already put there.
        if (parsed.fallback) fallbacks.push(parsed.fallback);
      }
    }
    for (const fallback of fallbacks) {
      if (values[fallback.key] === null || values[fallback.key] === undefined || values[fallback.key] === '') {
        values[fallback.key] = fallback.value;
      }
    }

    if (!rowProblems.length) {
      for (const e of spec.validateRow(values, lookups, { lang, nowMs })) {
        rowProblems.push({ column: byKey.get(e.field) || importable[0], message: e.message });
      }
    }
    if (!rowProblems.length && spec.validateRowAsync) {
      for (const e of await spec.validateRowAsync(values, lookups, ctx, { lang, rowNumber })) {
        rowProblems.push({ column: byKey.get(e.field) || importable[0], message: e.message });
      }
    }
    if (!rowProblems.length) {
      for (const [key, seen] of seenUnique) {
        const value = values[key];
        if (!value) continue;
        const firstRow = seen.get(String(value).toLowerCase());
        if (firstRow) {
          rowProblems.push({ column: byKey.get(key), message: `"${value}" appears more than once in this file (also in row ${firstRow}).` });
        }
      }
    }

    if (rowProblems.length) {
      rowProblems.forEach((p) => problem(rowNumber, p.column, p.message));
    } else {
      for (const [key, seen] of seenUnique) {
        if (values[key]) seen.set(String(values[key]).toLowerCase(), rowNumber);
      }
      valid.push({ rowNumber, values });
    }
  }

  // Numbers that already exist in the database for this church.
  let importable_ = valid;
  if (spec.findExistingUnique && valid.length) {
    const failedRows = new Set();
    for (const key of seenUnique.keys()) {
      const wanted = valid.map((r) => r.values[key]).filter(Boolean);
      if (!wanted.length) continue;
      const existing = await spec.findExistingUnique(ctx, key, wanted);
      for (const r of valid) {
        const value = r.values[key];
        if (value && existing.has(String(value).toLowerCase())) {
          failedRows.add(r.rowNumber);
          problem(r.rowNumber, byKey.get(key), `"${value}" already exists in this church.`);
        }
      }
    }
    importable_ = valid.filter((r) => !failedRows.has(r.rowNumber));
  }

  let created = [];
  if (importable_.length) created = await insertInOneTransaction(spec, importable_, ctx, lookups);

  const failedRowNumbers = new Set(errors.map((e) => e.row));
  const report = {
    total: rows.length,
    imported: created.length,
    failed: failedRowNumbers.size,
    errors: sortErrors(errors, spec.columns).map(({ row, column, message }) => ({ row, column, message })),
    ignoredColumns: ignoredHeadings,
  };
  return { report, created };
}

async function insertInOneTransaction(spec, rows, ctx, lookups) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const created = await spec.insertAll(conn, rows, ctx, lookups);
    await conn.commit();
    return created;
  } catch (err) {
    await conn.rollback();
    if (err instanceof ApiError) throw err;
    if (err && err.code === 'ER_DUP_ENTRY') {
      throw ApiError.conflict(
        'The import was stopped because a record with the same number was saved by someone else at the same moment. Nothing was imported. Please try again.'
      );
    }
    logger.error('Excel import failed and was rolled back', { message: err && err.message, stack: err && err.stack });
    throw ApiError.internal('The import could not be completed and was rolled back. Nothing was saved. Please try again.');
  } finally {
    conn.release();
  }
}

module.exports = { runImport, parseValue, parseAmount, parseCode, parseText };
