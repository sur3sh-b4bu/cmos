import ExcelJS from 'exceljs';

export interface ImportColumn {
  /** Column header text to match against the sheet's header row (case/whitespace-insensitive). */
  label: string;
  /** Property name the matched column's values are written to on each parsed row. */
  key: string;
  /** Additional header texts that should also map to this column. Chiefly
   * for relational fields: the create-form's own label ("Sex") and the
   * list's label for the same underlying field ("Gender") legitimately
   * differ, so a sheet built from either the form's wording or a plain
   * Export of the list still matches -- see toImportColumns(). */
  aliases?: string[];
  /** Set for relational fields -- resolveImportRow() looks the cell value up
   * against this master (by id or by name) instead of passing it through
   * coerceImportValue(). */
  masterKey?: string;
  /** Must be matched to a sheet column in the "match columns" step. */
  required?: boolean;
}

/** One column of an uploaded sheet, as offered in the "match columns" step. */
export interface ImportSourceColumn {
  /** 1-based position in the sheet (A = 1) -- what ImportMapping refers to. */
  number: number;
  /** The header-row text; '' when the column has data but no heading. */
  heading: string;
  /** A few example values from the column's first rows. */
  samples: string[];
}

/** One field the list can import, with the sheet column its heading matched (if any). */
export interface ImportField {
  key: string;
  label: string;
  required: boolean;
  suggestedColumn: number | null;
  /** A one-line explanation shown under the field, e.g. how the register number gets its prefix. */
  hint?: string;
}

/** Everything the "match columns" popup needs to know about a picked file. */
export interface ImportPreview {
  sheetName?: string;
  /** Data rows below the header row. */
  rowCount: number;
  sourceColumns: ImportSourceColumn[];
  fields: ImportField[];
}

/** The user's choice: field key -> 1-based sheet column. A field left out is not imported. */
export type ImportMapping = Record<string, number>;

export type ImportFieldType = 'text' | 'number' | 'date' | 'time' | 'checkbox' | 'select' | 'textarea';

/**
 * Builds the ImportColumn list a grid's Import button needs from its own
 * create-form field config (Masters' MasterFormField[], Certificates'
 * CertificateFormField[], ...) -- both already have the {key, label,
 * masterKey?} shape this needs structurally.
 *
 * `listColumns`, if given, is that same grid's *display* column config
 * (already translated, same as `fields`) -- a create-form's field and the
 * list's column for that same underlying data legitimately use different
 * wording (Baptism's form asks for "Child's Christian Name", the list
 * heads that column "Child Name"; the create-form's "Sex" is the list's
 * "Gender"), so the list's own label is registered as an alias wherever it
 * differs, since that's the literal header Export produces and what a user
 * copying "what's on screen" would reach for. Relational fields additionally
 * check the *_id -> *_name join-column convention used throughout this
 * app's list configs (gender_id's list column is gender_name, not gender_id).
 */
export function toImportColumns(
  fields: { key: string; label: string; masterKey?: string; required?: boolean }[],
  listColumns: { key: string; label: string }[] = []
): ImportColumn[] {
  const listLabelByKey = new Map(listColumns.map((c) => [c.key, c.label]));
  return fields.map((f) => {
    const listKey = f.masterKey ? f.key.replace(/_id$/, '_name') : f.key;
    const listLabel = listLabelByKey.get(listKey);
    // Compare against the PRIMARY label as it'll actually end up (relational
    // fields get " (Name or ID)" appended below) -- not the raw form label.
    // A relational field's form label and its list column's label are very
    // often the identical text (Branches' Church field and its list's
    // church_name column both just say "Church") -- comparing against the
    // raw label before the suffix was wrongly treating that as "no alias
    // needed", when the suffixed primary label is what Export's header
    // actually has to match against.
    const primaryLabel = f.masterKey ? `${f.label} (Name or ID)` : f.label;
    const aliases = new Set<string>();
    if (listLabel && listLabel !== primaryLabel) aliases.add(listLabel);
    // A relational field's PLAIN form label (no "(Name or ID)" suffix) is
    // also a legitimate header to accept: certificate-config.ts's own
    // Export builder (buildCertificateExportColumns) exports every form
    // field -- not just the handful shown on the list -- using each field's
    // bare label for ones with no corresponding list column at all (e.g.
    // Baptism's "Sex"/"Priest who Baptised"), so that's what a re-import of
    // that exact export actually has to match against.
    if (f.masterKey && f.label !== primaryLabel) aliases.add(f.label);
    return {
      key: f.key,
      label: primaryLabel,
      aliases: aliases.size ? [...aliases] : undefined,
      masterKey: f.masterKey,
      required: f.required,
    };
  });
}

/** A calendar date as "YYYY-MM-DD", or null if that day does not exist (31-02-2020).
 * Pure arithmetic in UTC: never the browser's timezone, never a silent
 * roll-over to the next month. */
function calendarDate(year: number, month: number, day: number): string | null {
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Matches the app-wide display/export date convention (see
 * DdMmYyyyDateAdapter) -- every date column's Export cell is DD-MM-YYYY (or
 * DD/MM/YYYY) text, not an Excel-native date, since list columns format
 * dates through formatDateDMY() before Export ever sees them. */
const DMY_DATE = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/;
const ISO_DATE = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;

/** Coerces one parsed cell value to match what a create-form's own submit()
 * would send for a field of this type -- shared by every grid's import
 * handler so date/checkbox/number handling can't drift between them.
 * Returns undefined for a genuinely blank cell so the caller can omit the
 * key entirely rather than send an empty string. */
export function coerceImportValue(type: ImportFieldType, value: unknown): unknown {
  if (value === undefined || value === null || value === '') return undefined;
  switch (type) {
    case 'date': {
      // ExcelJS hands a date-formatted cell back as a Date at UTC midnight of
      // the calendar day shown in Excel -- read it with the UTC getters, or
      // any browser west of UTC would import the day before.
      if (value instanceof Date) {
        return isNaN(value.getTime()) ? value : calendarDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
      }
      // Text is DD-MM-YYYY (this app's own convention, see above) or ISO
      // YYYY-MM-DD. Nothing else is guessed at (`new Date(str)` depends on the
      // machine's locale); an unrecognised or impossible date is passed
      // through unchanged so the API rejects it with a clear message.
      const str = String(value).trim();
      const dmy = DMY_DATE.exec(str);
      if (dmy) return calendarDate(Number(dmy[3]), Number(dmy[2]), Number(dmy[1])) ?? value;
      const iso = ISO_DATE.exec(str);
      if (iso) return calendarDate(Number(iso[1]), Number(iso[2]), Number(iso[3])) ?? value;
      return value;
    }
    case 'checkbox': {
      const normalized = String(value).trim().toLowerCase();
      return ['yes', 'true', '1', 'y'].includes(normalized) ? 1 : 0;
    }
    case 'number':
      return Number(value);
    default:
      return typeof value === 'string' ? value.trim() : value;
  }
}

/** ExcelJS represents rich-text and hyperlink cells as objects rather than
 * plain values -- unwrap those down to the plain text a form field expects. */
function plainCellValue(value: ExcelJS.CellValue): unknown {
  if (value && typeof value === 'object') {
    if ('text' in value) return (value as { text: unknown }).text;
    if ('result' in value) return (value as { result: unknown }).result; // formula cell
  }
  return value;
}

/**
 * Reads an uploaded .xlsx workbook's first sheet back into plain objects
 * keyed by `columns[].key`, matching each sheet column to a target column by
 * its header label -- so a file re-exported via exportRowsToExcel (or a
 * hand-built one using the same header text) maps back correctly regardless
 * of column order, and columns with no matching header are simply ignored.
 * Blank rows (no cell in any mapped column) are skipped.
 */
export async function parseExcelRows(
  file: File,
  columns: ImportColumn[],
  mapping?: ImportMapping
): Promise<Record<string, unknown>[]> {
  const workbook = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  // Sheet column -> the field keys it feeds (one column may feed several fields).
  const colIndexToKeys = new Map<number, string[]>();
  let keyToColumn: Iterable<[string, number]>;
  if (mapping) {
    // The user chose the columns in the "match columns" step; headings play no part.
    const known = new Set(columns.map((c) => c.key));
    keyToColumn = Object.entries(mapping).filter(([key]) => known.has(key));
  } else {
    keyToColumn = suggestColumns(sheet, columns);
  }
  for (const [key, colNumber] of keyToColumn) {
    colIndexToKeys.set(colNumber, [...(colIndexToKeys.get(colNumber) ?? []), key]);
  }

  const rows: Record<string, unknown>[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header row
    const record: Record<string, unknown> = {};
    let hasValue = false;
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const keys = colIndexToKeys.get(colNumber);
      if (!keys) return;
      const value = plainCellValue(cell.value);
      if (value === null || value === undefined || value === '') return;
      for (const key of keys) record[key] = value;
      hasValue = true;
    });
    if (hasValue) rows.push(record);
  });

  return rows;
}

/** field key -> sheet column whose header text matches the field's label or an alias (first match wins). */
function suggestColumns(sheet: ExcelJS.Worksheet, columns: ImportColumn[]): Map<string, number> {
  const labelToKey = new Map<string, string>();
  for (const c of columns) {
    labelToKey.set(c.label.trim().toLowerCase(), c.key);
    for (const alias of c.aliases ?? []) {
      labelToKey.set(alias.trim().toLowerCase(), c.key);
    }
  }
  const keyToColumn = new Map<string, number>();
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const label = String(plainCellValue(cell.value) ?? '').trim().toLowerCase();
    const key = labelToKey.get(label);
    if (key && !keyToColumn.has(key)) keyToColumn.set(key, colNumber);
  });
  return keyToColumn;
}

/** A cell as the person sees it, for the popup's sample values. Dates are read with the
 * UTC getters (see coerceImportValue) and shown DD-MM-YYYY like everywhere else in the app. */
function sampleText(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(value.getUTCDate())}-${pad(value.getUTCMonth() + 1)}-${value.getUTCFullYear()}`;
  }
  const text = String(value).trim();
  return text === '' ? null : text.slice(0, 60);
}

const PREVIEW_SAMPLES = 3;
const PREVIEW_SCAN_ROWS = 200;

/**
 * Reads only what the "match columns" popup needs from a picked workbook (the
 * browser-side counterpart of the API's import/preview): every sheet column
 * with its heading and a few sample values, and for each of `columns` the sheet
 * column its heading matches, if any.
 */
export async function previewExcelFile(file: File, columns: ImportColumn[]): Promise<ImportPreview> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.actualRowCount === 0) return { rowCount: 0, sourceColumns: [], fields: [] };

  const headerRow = sheet.getRow(1);
  const columnCount = Math.max(sheet.columnCount, headerRow.cellCount);
  const sourceColumns: ImportSourceColumn[] = [];
  for (let number = 1; number <= columnCount; number += 1) {
    const heading = sampleText(plainCellValue(headerRow.getCell(number).value)) ?? '';
    const samples: string[] = [];
    const lastRow = Math.min(sheet.rowCount, PREVIEW_SCAN_ROWS + 1);
    for (let r = 2; r <= lastRow && samples.length < PREVIEW_SAMPLES; r += 1) {
      const text = sampleText(plainCellValue(sheet.getRow(r).getCell(number).value));
      if (text !== null) samples.push(text);
    }
    if (heading || samples.length) sourceColumns.push({ number, heading, samples });
  }

  const suggested = suggestColumns(sheet, columns);
  return {
    sheetName: sheet.name,
    rowCount: Math.max(0, sheet.actualRowCount - 1),
    sourceColumns,
    fields: columns.map((c) => ({ key: c.key, label: c.label, required: !!c.required, suggestedColumn: suggested.get(c.key) ?? null })),
  };
}
