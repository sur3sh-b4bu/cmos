import ExcelJS from 'exceljs';

export type Cell = string | number | null;

export interface ReportSheet {
  name: string;
  headers: string[];
  rows: Cell[][];
}

export interface WorkbookSpec {
  fileName: string;
  title: string;
  /** Lines of context written to an "About" sheet: the period, its comparison, when and by what it was generated. */
  about: [string, string][];
  sheets: ReportSheet[];
}

/** Excel sheet names: at most 31 characters and none of \ / ? * [ ] : */
export function safeSheetName(name: string): string {
  return name.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Report';
}

/** A file name safe on every operating system. */
export function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 80);
}

/**
 * A cell value that cannot be read as a formula: Excel treats text starting with = + - @ as one, and a church or type
 * name comes from data people typed. Numbers stay numbers.
 */
export function safeCell(value: Cell): Cell {
  if (typeof value !== 'string') return value;
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export async function buildWorkbook(spec: WorkbookSpec): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Church Office Management System';
  workbook.created = new Date();

  for (const sheetSpec of spec.sheets) {
    const sheet = workbook.addWorksheet(safeSheetName(sheetSpec.name));
    sheet.columns = sheetSpec.headers.map((header, i) => {
      const longest = Math.max(header.length, ...sheetSpec.rows.map((r) => String(r[i] ?? '').length));
      return { header, key: `c${i}`, width: Math.min(46, Math.max(12, longest + 3)) };
    });
    const head = sheet.getRow(1);
    head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B3D91' } };
    head.alignment = { vertical: 'middle' };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    for (const row of sheetSpec.rows) sheet.addRow(row.map(safeCell));
  }

  const about = workbook.addWorksheet('About');
  about.columns = [
    { key: 'k', width: 24 },
    { key: 'v', width: 60 },
  ];
  about.addRow([spec.title]).font = { bold: true, size: 14 };
  about.addRow([]);
  for (const [k, v] of spec.about) {
    const row = about.addRow([k, safeCell(v)]);
    row.getCell(1).font = { bold: true };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/** Builds the workbook and hands it to the browser as a download. */
export async function downloadWorkbook(spec: WorkbookSpec): Promise<void> {
  const blob = await buildWorkbook(spec);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeFileName(spec.fileName)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
