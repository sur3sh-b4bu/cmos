import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  TemplateRef,
  computed,
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
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, debounceTime } from 'rxjs';
import { DataTableColumn, DataTableSort } from './data-table.model';
import { exportRowsToExcel } from '../../utils/excel-export.util';

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
    MatTooltipModule,
  ],
  templateUrl: './data-table.html',
  styleUrl: './data-table.scss',
})
export class DataTableComponent<T = Record<string, unknown>> implements OnInit, OnChanges, OnDestroy {
  @Input({ required: true }) columns: DataTableColumn<T>[] = [];
  @Input() rows: T[] = [];
  @Input() total = 0;
  @Input() pageIndex = 0;
  @Input() pageSize = 25;
  @Input() pageSizeOptions = [10, 25, 50, 100];
  @Input() loading = false;
  @Input({ required: true }) tableId!: string;
  @Input() cellTemplates: Record<string, TemplateRef<unknown>> = {};
  @Input() exportFileName = 'export';
  @Input() showExport = true;
  @Input() emptyMessage = 'No records found.';
  /** Optional: fetch the full matching dataset (ignoring pagination) for export. Falls back to the currently loaded page. */
  @Input() exportAllFn?: () => Promise<T[]>;

  @Output() pageChange = new EventEmitter<{ pageIndex: number; pageSize: number }>();
  @Output() sortChange = new EventEmitter<DataTableSort>();
  @Output() searchChange = new EventEmitter<string>();
  @Output() rowClick = new EventEmitter<T>();
  @Output() exportRequested = new EventEmitter<void>();

  searchTerm = '';
  exporting = signal(false);
  private searchSubject = new Subject<string>();

  visibleKeys = signal<Set<string>>(new Set());

  displayedColumns = computed(() =>
    this.columns.filter((c) => this.visibleKeys().has(c.key)).map((c) => c.key)
  );
  visibleColumns = computed(() => this.columns.filter((c) => this.visibleKeys().has(c.key)));

  ngOnInit(): void {
    this.loadColumnVisibility();
    this.searchSubject.pipe(debounceTime(350)).subscribe((term) => this.searchChange.emit(term));
  }

  ngOnChanges(): void {
    if (this.columns.length && this.visibleKeys().size === 0) {
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

  async exportExcel(): Promise<void> {
    if (this.exporting()) return;
    this.exporting.set(true);
    try {
      const rowsToExport = this.exportAllFn ? await this.exportAllFn() : this.rows;
      await exportRowsToExcel(this.visibleColumns(), rowsToExport, this.exportFileName);
    } finally {
      this.exporting.set(false);
    }
  }
}
