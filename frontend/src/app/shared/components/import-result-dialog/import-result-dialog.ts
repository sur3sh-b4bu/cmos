import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import ExcelJS from 'exceljs';
import { ImportReport } from '../../../core/services/excel-transfer.service';

export interface ImportResultDialogData {
  fileName: string;
  /** Set when the file was read: how many rows were saved and which were not. */
  report?: ImportReport;
  /** Set when the whole file was rejected (wrong type, empty, wrong headings, too large...). */
  fileError?: { message: string; expectedHeadings: string[]; foundHeadings: string[] };
}

/**
 * Stays on screen until closed (unlike a toast) so a long list of row
 * problems can actually be read, scrolled and downloaded.
 */
@Component({
  selector: 'coms-import-result-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule, TranslatePipe],
  templateUrl: './import-result-dialog.html',
  styleUrl: './import-result-dialog.scss',
})
export class ImportResultDialogComponent {
  data = inject<ImportResultDialogData>(MAT_DIALOG_DATA);
  private translate = inject(TranslateService);

  /** Writes the row problems to an .xlsx the user can fix and re-upload alongside their file. */
  async downloadErrorReport(): Promise<void> {
    const errors = this.data.report?.errors ?? [];
    const t = (key: string) => this.translate.instant(key);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Church Office Management System';
    const sheet = workbook.addWorksheet(t('common.importErrorsSheet'));
    sheet.columns = [
      { header: t('common.importColRow'), key: 'row', width: 8 },
      { header: t('common.importColColumn'), key: 'column', width: 32 },
      { header: t('common.importColProblem'), key: 'message', width: 90 },
    ];
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B3D91' } };
    for (const error of errors) {
      // Written as plain text cells, never formulas -- a message can quote the user's own cell value.
      sheet.addRow({ row: error.row, column: error.column, message: error.message });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${this.baseName(this.data.fileName)}-import-errors.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  private baseName(fileName: string): string {
    return fileName.replace(/\.[^.]*$/, '') || 'import';
  }
}
