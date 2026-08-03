import ExcelJS from 'exceljs';
import { DataTableColumn } from '../components/data-table/data-table.model';

export async function exportRowsToExcel<T>(
  columns: DataTableColumn<T>[],
  rows: T[],
  fileName: string
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Church Office Management System';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Data');
  sheet.columns = columns.map((c) => ({ header: c.label, key: c.key, width: Math.max(c.label.length + 4, 16) }));
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B3D91' } };

  for (const row of rows) {
    const record: Record<string, unknown> = {};
    for (const col of columns) {
      const accessor = col.exportAccessor ?? col.accessor;
      record[col.key] = accessor ? accessor(row) : (row as Record<string, unknown>)[col.key];
    }
    sheet.addRow(record);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName}.xlsx`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
