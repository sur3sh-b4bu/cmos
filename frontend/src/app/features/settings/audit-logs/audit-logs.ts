import { Component, OnInit, TemplateRef, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { DataTableComponent } from '../../../shared/components/data-table/data-table';
import { DataTableColumn } from '../../../shared/components/data-table/data-table.model';
import { AuditLogService } from './audit-log.service';
import { AuditLog } from './audit-log.model';
import { AuditDetailDialogComponent } from './audit-detail-dialog';

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'var(--coms-color-success)',
  UPDATE: 'var(--coms-color-warning)',
  DELETE: 'var(--coms-color-danger)',
  LOGIN_SUCCESS: 'var(--coms-color-success)',
  LOGIN_FAILED: 'var(--coms-color-danger)',
  PRINT_RECEIPT: 'var(--coms-color-info)',
  PRINT_REGISTER: 'var(--coms-color-info)',
  PRINT_CERTIFICATE: 'var(--coms-color-info)',
  MARK_COMPLETED: 'var(--coms-color-success)',
  MARK_ALL_COMPLETED: 'var(--coms-color-success)',
  REORDER: 'var(--coms-color-info)',
};

const MODULES = [
  'auth',
  'masters',
  'prayer_intentions',
  'prayer_register',
  'baptism_certificates',
  'marriage_certificates',
  'death_certificates',
];

@Component({
  selector: 'coms-audit-logs',
  standalone: true,
  imports: [FormsModule, MatFormFieldModule, MatSelectModule, MatButtonModule, MatIconModule, MatTooltipModule, DataTableComponent],
  templateUrl: './audit-logs.html',
  styleUrl: './audit-logs.scss',
})
export class AuditLogsComponent implements OnInit {
  private auditLogService = inject(AuditLogService);
  private dialog = inject(MatDialog);

  @ViewChild('actionTpl', { static: true }) actionTpl!: TemplateRef<unknown>;
  @ViewChild('detailTpl', { static: true }) detailTpl!: TemplateRef<unknown>;

  modules = MODULES;
  moduleFilter = signal<string>('');

  rows = signal<AuditLog[]>([]);
  total = signal(0);
  loading = signal(false);
  pageIndex = signal(0);
  pageSize = signal(25);
  search = signal('');

  columns: DataTableColumn[] = [];
  cellTemplates: Record<string, TemplateRef<unknown>> = {};

  ngOnInit(): void {
    this.columns = [
      {
        key: 'created_at',
        label: 'When',
        sortable: true,
        accessor: (r: AuditLog) => new Date(r.created_at).toLocaleString('en-GB'),
      },
      { key: 'username_snapshot', label: 'User', accessor: (r: AuditLog) => r.username_snapshot || 'System' },
      { key: 'action', label: 'Action' },
      { key: 'module', label: 'Module' },
      {
        key: 'entity_type',
        label: 'Entity',
        accessor: (r: AuditLog) => (r.entity_id ? `${r.entity_type} #${r.entity_id}` : r.entity_type || '-'),
      },
      { key: 'detail', label: '', align: 'right' },
    ];
    this.cellTemplates = { action: this.actionTpl, detail: this.detailTpl };
    this.fetch();
  }

  actionColor(action: string): string {
    return ACTION_COLORS[action] || 'var(--coms-text-muted)';
  }

  fetch(): void {
    this.loading.set(true);
    this.auditLogService
      .list({
        page: this.pageIndex() + 1,
        pageSize: this.pageSize(),
        search: this.search() || undefined,
        module: this.moduleFilter() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.rows.set(res.data);
          this.total.set(res.meta.total);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  onModuleFilterChange(value: string): void {
    this.moduleFilter.set(value);
    this.pageIndex.set(0);
    this.fetch();
  }

  onPageChange(event: { pageIndex: number; pageSize: number }): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.fetch();
  }

  onSearchChange(term: string): void {
    this.search.set(term);
    this.pageIndex.set(0);
    this.fetch();
  }

  viewDetail(row: AuditLog): void {
    this.dialog.open(AuditDetailDialogComponent, { data: row, width: '560px' });
  }
}
