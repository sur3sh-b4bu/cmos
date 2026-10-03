import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  TemplateRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatMenuModule } from '@angular/material/menu';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { Subject, debounceTime, firstValueFrom } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DataTableColumn, DataTableSort } from './data-table.model';
import { exportRowsToExcel } from '../../utils/excel-export.util';
import { ImportColumn, ImportMapping, ImportPreview, parseExcelRows, previewExcelFile } from '../../utils/excel-import.util';
import { NotificationService } from '../../../core/services/notification.service';
import {
  ExcelTransferService,
  IMPORT_MAX_BYTES,
  ImportReport,
  ServerTransfer,
  TransferFileError,
} from '../../../core/services/excel-transfer.service';
import { ImportResultDialogComponent, ImportResultDialogData } from '../import-result-dialog/import-result-dialog';
import { ImportMappingDialogComponent } from '../import-mapping-dialog/import-mapping-dialog';
import { LanguageService } from '../../../core/services/language.service';
import { baminiToUnicode } from '../../../core/utils/bamini-to-unicode.util';
import { FileDownloadService } from '../../../core/services/file-download.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'coms-data-table',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    FormsModule,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatMenuModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    TranslatePipe,
  ],
  templateUrl: './data-table.html',
  styleUrl: './data-table.scss',
})
export class DataTableComponent<T = Record<string, unknown>> implements OnInit, OnChanges, OnDestroy {
  private translate = inject(TranslateService);
  private languageService = inject(LanguageService);
  private notification = inject(NotificationService);
  private excelTransfer = inject(ExcelTransferService);
  private fileDownload = inject(FileDownloadService);
  private authService = inject(AuthService);
  private dialog = inject(MatDialog);

  @Input({ required: true }) columns: DataTableColumn<T>[] = [];
  @Input() rows: T[] = [];
  @Input() total = 0;
  @Input() pageIndex = 0;
  @Input() pageSize = 25;
  @Input() pageSizeOptions = [10, 25, 50, 100];
  @Input() loading = false;
  @Input() sort?: DataTableSort;
  @Input({ required: true }) tableId!: string;
  @Input() cellTemplates: Record<string, TemplateRef<unknown>> = {};
  @Input() exportFileName = 'export';
  @Input() showExport = true;
  @Input() showPrint = true;
  /** A translation key (e.g. "certificates.noneRecorded"); falls back to a generic "No records found." if not set. */
  @Input() emptyMessageKey = '';
  /** Optional: fetch the full matching dataset (ignoring pagination) for export. Falls back to the currently loaded page. */
  @Input() exportAllFn?: () => Promise<T[]>;
  /** Optional: the exact column set Export Excel should write, in place of
   * `visibleColumns()`. Without this, Export only ever covers whatever
   * columns are both in the compact on-screen `columns` config AND
   * currently toggled visible -- fine for a grid whose list columns already
   * are the whole record, but Certificates' list intentionally shows only a
   * handful of a much larger record (see certificate-config.ts's
   * `formFields` vs `listColumns`), so exporting *that* silently drops most
   * of each certificate. Pass the record's full field set here for any grid
   * where "on-screen columns" and "the whole record" genuinely differ. */
  @Input() exportColumns?: DataTableColumn<T>[];
  /** Shows the Import Excel button next to Export -- opt-in per list, since
   * not every grid backing this table is a creatable entity (e.g. Audit
   * Logs, Reports are read-only). Only meaningful together with
   * importColumns, which tells the parser which header labels to read and
   * what key to file each one under on the objects handed back via
   * importRows -- typically a table's own create-form fields, not
   * necessarily the same set as its display `columns`. */
  @Input() showImport = false;
  @Input() importColumns: ImportColumn[] = [];
  /** Server-side Import / Export / template for this list (Certificates,
   * Mass Intentions, Contributions). When set, the buttons hand the .xlsx
   * itself to the API -- which parses dates, checks every row, saves the
   * valid ones in one transaction and reports the rest -- instead of the
   * browser-side importColumns/importRows path below, which stays for
   * Masters and Users. */
  @Input() serverTransfer?: ServerTransfer;

  get resolvedEmptyMessage(): string {
    return this.translate.instant(this.emptyMessageKey || 'common.noRecordsFound');
  }

  @Output() pageChange = new EventEmitter<{ pageIndex: number; pageSize: number }>();
  @Output() sortChange = new EventEmitter<DataTableSort>();
  @Output() searchChange = new EventEmitter<string>();
  @Output() rowClick = new EventEmitter<T>();
  @Output() exportRequested = new EventEmitter<void>();
  /** Fired once per picked file with every parsed row -- the parent owns
   * actually creating records from them (each entity has its own API/rules),
   * this component only owns picking the file and reading it into plain
   * objects keyed by importColumns. */
  @Output() importRows = new EventEmitter<Record<string, unknown>[]>();
  /** Fired after a server-side import saved at least one record, so the parent can reload its list. */
  @Output() imported = new EventEmitter<ImportReport>();

  searchTerm = '';
  exporting = signal(false);
  importing = signal(false);
  printing = signal(false);
  private searchSubject = new Subject<string>();

  /** "Type in Bamini" for the quick search box -- same convention as the
   * per-field toggles in mass-intention-form.ts/bulk-mass-intention-form.ts
   * (see bamini-to-unicode.util.ts): while on, the box renders in the
   * Bamini font and the raw text is left alone as the user types (the
   * greedy Bamini scanner needs the *whole* untouched token to convert
   * correctly, so converting keystroke-by-keystroke would corrupt it); on
   * blur it's converted to real Tamil Unicode and re-searched. Search
   * results won't match a Tamil name mid-typing here (the stored data is
   * real Unicode, not raw Bamini) -- click/tab away once to convert and
   * get real results, same tradeoff as every other Bamini field. */
  baminiSearch = signal(this.languageService.isTamilTextInput());

  /** Keeps the toggle above in sync if the text input mode changes while
   * this table is on screen, not just on initial load. */
  constructor() {
    effect(() => this.baminiSearch.set(this.languageService.isTamilTextInput()));
  }

  toggleBaminiSearch(): void {
    this.baminiSearch.update((v) => !v);
  }

  convertSearchBaminiOnBlur(): void {
    if (!this.baminiSearch()) return;
    this.baminiSearch.set(false);
    this.onSearchInput(baminiToUnicode(this.searchTerm));
  }

  visibleKeys = signal<Set<string>>(new Set());

  toggleableColumns = computed(() => this.columns.filter((c) => c.key !== 'actions' && !!c.label && !!c.label.trim()));

  displayedColumns = computed(() =>
    this.columns.filter((c) => c.key === 'actions' || this.visibleKeys().has(c.key)).map((c) => c.key)
  );
  visibleColumns = computed(() => this.columns.filter((c) => c.key === 'actions' || this.visibleKeys().has(c.key)));

  ngOnInit(): void {
    this.loadColumnVisibility();
    this.searchSubject.pipe(debounceTime(350)).subscribe((term) => this.searchChange.emit(term));
  }

  ngOnChanges(changes: SimpleChanges): void {
    // tableId changing (not just its first assignment) means this same
    // component instance is now showing a DIFFERENT table -- e.g.
    // Certificates' baptism/marriage/death or Masters' per-key routes all
    // reuse one parent component instance across navigation, which reuses
    // this child instance too, only rebinding its inputs. Without this,
    // visibleKeys (and thus displayedColumns/visibleColumns, which filter
    // the *new* columns by it) stays stuck on whichever table loaded
    // first: every column here whose key isn't also a key in that first
    // table gets silently hidden, since it was never in the stale Set.
    const tableIdChanged = !!changes['tableId'] && !changes['tableId'].firstChange;
    if (tableIdChanged || (this.columns.length && this.visibleKeys().size === 0)) {
      this.loadColumnVisibility();
    }
  }

  ngOnDestroy(): void {
    this.searchSubject.complete();
  }

  onSearchInput(value: string): void {
    this.searchTerm = value;
    this.searchSubject.next(value);
  }

  onPageEvent(event: PageEvent): void {
    this.pageChange.emit({ pageIndex: event.pageIndex, pageSize: event.pageSize });
  }

  onSortEvent(sort: Sort): void {
    this.sortChange.emit(sort as DataTableSort);
  }

  toggleColumn(key: string): void {
    const next = new Set(this.visibleKeys());
    if (next.has(key)) next.delete(key);
    else next.add(key);
    this.visibleKeys.set(next);
    localStorage.setItem(this.storageKey, JSON.stringify(Array.from(next)));
  }

  isColumnVisible(key: string): boolean {
    return this.visibleKeys().has(key);
  }

  private get storageKey(): string {
    return `coms-table-columns-${this.tableId}`;
  }

  private loadColumnVisibility(): void {
    const stored = localStorage.getItem(this.storageKey);
    if (stored) {
      try {
        this.visibleKeys.set(new Set(JSON.parse(stored)));
        return;
      } catch {
        /* fall through to defaults */
      }
    }
    this.visibleKeys.set(new Set(this.columns.filter((c) => !c.hiddenByDefault).map((c) => c.key)));
  }

  getCellValue(row: T, column: DataTableColumn<T>): unknown {
    return column.accessor ? column.accessor(row) : (row as Record<string, unknown>)[column.key];
  }

  /** Same value as getCellValue, stringified for the template's `| translate`
   * (TranslatePipe only accepts string | null | undefined, but accessors are
   * typed `unknown` since they can return anything a column needs to
   * display) -- see data-table.html's own comment on why that pipe is there. */
  getCellText(row: T, column: DataTableColumn<T>): string {
    const value = this.getCellValue(row, column);
    return value === null || value === undefined ? '' : String(value);
  }

  async exportExcel(): Promise<void> {
    if (this.exporting()) return;
    if (this.serverTransfer) {
      await this.serverExport(this.serverTransfer);
      return;
    }
    this.exporting.set(true);
    try {
      const rowsToExport = this.exportAllFn ? await this.exportAllFn() : this.rows;
      // column.label is a translation key for most grids (e.g.
      // "massIntentions.colReceiptNo") -- the table itself only ever shows
      // it through the `| translate` pipe (see data-table.html), but
      // exportRowsToExcel takes headers as literal text, so without this it
      // writes the raw key into the sheet instead of what's on screen. That
      // in turn broke Import, since a sheet built by copying the visible
      // column names (or re-importing this exact export) could never match
      // a raw, untranslated key.
      const translatedColumns = (this.exportColumns ?? this.visibleColumns()).map((c) => ({
        ...c,
        label: this.translate.instant(c.label),
      }));
      await exportRowsToExcel(translatedColumns, rowsToExport, this.exportFileName);
    } finally {
      this.exporting.set(false);
    }
  }

  async printTable(): Promise<void> {
    if (this.printing()) return;
    this.printing.set(true);
    try {
      const rowsToPrint = this.exportAllFn ? await this.exportAllFn() : this.rows;
      if (!rowsToPrint || rowsToPrint.length === 0) {
        this.notification.warning(this.translate.instant('common.noRecordsFound'));
        return;
      }

      const cols = (this.exportColumns ?? this.visibleColumns()).filter(
        (c) => c.key !== 'actions' && !c.hiddenByDefault
      );

      const currentUser = this.authService.currentUser();
      const activeBranch = this.authService.activeChurchBranch();
      const churchName = activeBranch?.churchName || currentUser?.churchName || 'CHURCH OFFICE MANAGEMENT SYSTEM';
      const churchCity = '';
      const title = this.exportFileName ? this.exportFileName.replace(/[-_]/g, ' ').toUpperCase() : 'REPORT';
      const now = new Date().toLocaleString();

      const headerHtml = `
        <div class="print-header">
          <div class="church-title">${churchName}</div>
          ${churchCity ? `<div class="church-sub">${churchCity}</div>` : ''}
          <div class="report-title">${title}</div>
          <div class="report-meta">
            <span><strong>Total Records:</strong> ${rowsToPrint.length}</span>
            <span><strong>Printed Date:</strong> ${now}</span>
          </div>
        </div>
      `;

      const theadHtml = `
        <thead>
          <tr>
            <th style="width: 35px; text-align: center;">#</th>
            ${cols.map((c) => `<th style="text-align: ${c.align || 'left'}">${this.translate.instant(c.label)}</th>`).join('')}
          </tr>
        </thead>
      `;

      const tbodyHtml = `
        <tbody>
          ${rowsToPrint
            .map(
              (row, idx) => `
            <tr>
              <td style="text-align: center; color: #64748b; font-size: 11px;">${idx + 1}</td>
              ${cols
                .map((c) => {
                  const val = this.getCellText(row, c);
                  return `<td style="text-align: ${c.align || 'left'}">${val !== null && val !== undefined ? val : ''}</td>`;
                })
                .join('')}
            </tr>
          `
            )
            .join('')}
        </tbody>
      `;

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>${title}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm 8mm;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              color: #1e293b;
              margin: 0;
              padding: 0;
              font-size: 10px;
              line-height: 1.35;
            }
            .print-header {
              text-align: center;
              margin-bottom: 12px;
              border-bottom: 2px solid #072a63;
              padding-bottom: 8px;
            }
            .church-title {
              font-size: 16px;
              font-weight: 700;
              color: #072a63;
              letter-spacing: 0.4px;
            }
            .church-sub {
              font-size: 11px;
              color: #64748b;
              margin-top: 2px;
            }
            .report-title {
              font-size: 13px;
              font-weight: 600;
              color: #334155;
              margin-top: 6px;
              letter-spacing: 0.3px;
            }
            .report-meta {
              display: flex;
              justify-content: space-between;
              margin-top: 6px;
              font-size: 10px;
              color: #64748b;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 6px;
              table-layout: auto;
            }
            th {
              background-color: #f1f5f9;
              color: #072a63;
              font-weight: 700;
              font-size: 9.5px;
              padding: 6px 4px;
              border: 1px solid #cbd5e1;
              text-transform: uppercase;
              letter-spacing: 0.2px;
            }
            td {
              padding: 5px 4px;
              border: 1px solid #e2e8f0;
              font-size: 9.5px;
              word-break: break-word;
            }
            tr:nth-child(even) {
              background-color: #f8fafc;
            }
            @media print {
              @page {
                size: A4 portrait;
                margin: 10mm 8mm;
              }
              thead { display: table-header-group; }
              tr { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          ${headerHtml}
          <table>
            ${theadHtml}
            ${tbodyHtml}
          </table>
        </body>
        </html>
      `;

      this.fileDownload.printHtmlContent(html);
    } catch {
      this.notification.error(this.translate.instant('common.somethingWentWrong'));
    } finally {
      this.printing.set(false);
    }
  }

  async downloadTemplate(): Promise<void> {
    if (!this.serverTransfer || this.exporting()) return;
    this.exporting.set(true);
    try {
      await this.excelTransfer.downloadTemplate(this.serverTransfer);
    } catch (err) {
      this.showFileError(this.fileNameOr('template'), err);
    } finally {
      this.exporting.set(false);
    }
  }

  private async serverExport(transfer: ServerTransfer): Promise<void> {
    this.exporting.set(true);
    try {
      const count = await this.excelTransfer.exportFile(transfer);
      this.notification.success(
        count === 1 ? this.translate.instant('common.exportedOneRecord') : this.translate.instant('common.exportedRecords', { count })
      );
    } catch (err) {
      this.notification.error(err instanceof Error ? err.message : this.translate.instant('common.somethingWentWrong'));
    } finally {
      this.exporting.set(false);
    }
  }

  /** Checks a picked file before uploading it, so an obviously wrong one is refused with a clear reason. */
  private checkPickedFile(file: File): string | null {
    const dot = file.name.lastIndexOf('.');
    const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : '';
    if (!ext) return this.translate.instant('common.importNoExtension');
    if (ext !== '.xlsx') return this.translate.instant('common.importOnlyXlsx', { ext });
    if (file.size === 0) return this.translate.instant('common.importFileEmpty');
    if (file.size > IMPORT_MAX_BYTES) {
      return this.translate.instant('common.importFileTooLarge', {
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        max: `${IMPORT_MAX_BYTES / (1024 * 1024)} MB`,
      });
    }
    return null;
  }

  private showFileError(fileName: string, err: unknown): void {
    const message = err instanceof Error ? err.message : this.translate.instant('common.somethingWentWrong');
    const fileError = {
      message,
      expectedHeadings: err instanceof TransferFileError ? err.expectedHeadings : [],
      foundHeadings: err instanceof TransferFileError ? err.foundHeadings : [],
    };
    this.openResult({ fileName, fileError });
  }

  private fileNameOr(fallback: string): string {
    return this.serverTransfer?.fallbackFileName ?? fallback;
  }

  private openResult(data: ImportResultDialogData): void {
    this.dialog.open(ImportResultDialogComponent, { data, width: '760px', maxWidth: '94vw', autoFocus: 'dialog' });
  }

  /** importColumns with their labels translated. Lists such as Masters build their import fields from
   * form-field configs whose labels are translation keys ("common.name"); the sheet's headings and the
   * popup need the words a person actually sees ("Name"). A relational field's " (Name or ID)" suffix is
   * kept as is. Text that is not a key comes back unchanged from instant(). */
  private translatedImportColumns(): ImportColumn[] {
    const suffix = ' (Name or ID)';
    const t = (label: string) =>
      label.endsWith(suffix) ? this.translate.instant(label.slice(0, -suffix.length)) + suffix : this.translate.instant(label);
    return this.importColumns.map((c) => ({ ...c, label: t(c.label), aliases: c.aliases?.map(t) }));
  }

  /** The "match columns" popup: resolves with the user's choice, or undefined if they cancelled. */
  private async askForMapping(fileName: string, preview: ImportPreview): Promise<ImportMapping | undefined> {
    const ref = this.dialog.open<ImportMappingDialogComponent, { fileName: string; preview: ImportPreview }, ImportMapping | undefined>(
      ImportMappingDialogComponent,
      { data: { fileName, preview }, width: '920px', maxWidth: '96vw', autoFocus: 'dialog', disableClose: true }
    );
    return firstValueFrom(ref.afterClosed());
  }

  private async serverImport(transfer: ServerTransfer, file: File): Promise<void> {
    const rejection = this.checkPickedFile(file);
    if (rejection) {
      this.showFileError(file.name, new TransferFileError(rejection));
      return;
    }
    this.importing.set(true);
    try {
      // Step 1: have the API read the file's columns (nothing is saved yet).
      const preview = await this.excelTransfer.previewImport(transfer, file);
      // Step 2: the user matches the file's columns to the fields.
      this.importing.set(false);
      const mapping = await this.askForMapping(file.name, preview);
      if (!mapping) return; // cancelled
      // Step 3: import with exactly those columns.
      this.importing.set(true);
      const report = await this.excelTransfer.importFile(transfer, file, mapping);
      this.openResult({ fileName: file.name, report });
      if (report.imported > 0) this.imported.emit(report);
    } catch (err) {
      this.showFileError(file.name, err);
    } finally {
      this.importing.set(false);
    }
  }

  async onImportFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // allows re-picking the same file again (e.g. after fixing it)
    if (!file || this.importing()) return;

    if (this.serverTransfer) {
      await this.serverImport(this.serverTransfer, file);
      return;
    }

    this.importing.set(true);
    try {
      const preview = await previewExcelFile(file, this.translatedImportColumns());
      this.importing.set(false);
      const mapping = await this.askForMapping(file.name, preview);
      if (!mapping) return; // cancelled
      this.importing.set(true);
      const rows = await parseExcelRows(file, this.translatedImportColumns(), mapping);
      if (!rows.length) {
        this.notification.error(this.translate.instant('common.importNoRows'));
        return;
      }
      this.importRows.emit(rows);
    } catch {
      this.notification.error(this.translate.instant('common.importParseFailed'));
    } finally {
      this.importing.set(false);
    }
  }
}
