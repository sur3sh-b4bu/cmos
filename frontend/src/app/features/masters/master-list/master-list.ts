import { Component, Input, OnChanges, TemplateRef, ViewChild, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { DataTableComponent } from '../../../shared/components/data-table/data-table';
import { DataTableColumn } from '../../../shared/components/data-table/data-table.model';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { NotificationService } from '../../../core/services/notification.service';
import { extractErrorMessage } from '../../../core/utils/http-error.util';
import { AuthService } from '../../../core/services/auth.service';
import { MasterService } from '../master.service';
import { MASTER_CONFIGS } from '../master-config';

@Component({
  selector: 'coms-master-list',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatIconModule, MatMenuModule, MatChipsModule, MatTooltipModule, DataTableComponent],
  templateUrl: './master-list.html',
  styleUrl: './master-list.scss',
})
export class MasterListComponent implements OnChanges {
  @Input({ required: true }) masterKey!: string;

  private masterService = inject(MasterService);
  private notification = inject(NotificationService);
  private dialog = inject(MatDialog);
  authService = inject(AuthService);

  @ViewChild('activeTpl', { static: true }) activeTpl!: TemplateRef<unknown>;
  @ViewChild('actionsTpl', { static: true }) actionsTpl!: TemplateRef<unknown>;

  config = MASTER_CONFIGS['churches'];
  columns: DataTableColumn[] = [];
  cellTemplates: Record<string, TemplateRef<unknown>> = {};

  rows = signal<any[]>([]);
  total = signal(0);
  loading = signal(false);
  pageIndex = signal(0);
  pageSize = signal(25);
  search = signal('');
  reordering = signal(false);

  ngOnChanges(): void {
    this.config = MASTER_CONFIGS[this.masterKey];
    this.columns = [...this.config.columns, { key: 'is_active', label: 'Active' }, { key: 'actions', label: '', align: 'right' }];
    this.cellTemplates = { is_active: this.activeTpl, actions: this.actionsTpl };
    this.pageIndex.set(0);
    this.fetch();
  }

  fetch(): void {
    this.loading.set(true);
    this.masterService
      .list(this.masterKey, { page: this.pageIndex() + 1, pageSize: this.pageSize(), search: this.search() || undefined })
      .subscribe({
        next: (res) => {
          this.rows.set(res.data);
          this.total.set(res.meta.total);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
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

  async deleteRow(row: any): Promise<void> {
    const label = row.name ?? row.label ?? row.setting_key ?? row.series_name ?? row.certificate_type ?? `#${row.id}`;
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: `Delete ${this.config.singularLabel.toLowerCase()}?`,
        message: `This will remove "${label}". Records already referencing it are unaffected, but it will no longer appear in dropdowns.`,
        confirmLabel: 'Delete',
        danger: true,
      },
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await firstValueFrom(this.masterService.delete(this.masterKey, row.id));
      this.notification.success(`${this.config.singularLabel} deleted.`);
      this.fetch();
    } catch (err) {
      this.notification.error(extractErrorMessage(err));
    }
  }

  async moveRow(row: any, direction: -1 | 1): Promise<void> {
    const ids = this.rows().map((r) => r.id);
    const index = ids.indexOf(row.id);
    const swapWith = index + direction;
    if (swapWith < 0 || swapWith >= ids.length) return;
    [ids[index], ids[swapWith]] = [ids[swapWith], ids[index]];

    this.reordering.set(true);
    try {
      await firstValueFrom(this.masterService.reorder(this.masterKey, ids));
      this.fetch();
    } catch (err) {
      this.notification.error(extractErrorMessage(err));
    } finally {
      this.reordering.set(false);
    }
  }
}
