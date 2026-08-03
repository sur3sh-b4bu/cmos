import { Component, OnInit, TemplateRef, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { DataTableComponent } from '../../../shared/components/data-table/data-table';
import { DataTableColumn, DataTableSort } from '../../../shared/components/data-table/data-table.model';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { NotificationService } from '../../../core/services/notification.service';
import { FileDownloadService } from '../../../core/services/file-download.service';
import { extractErrorMessage } from '../../../core/utils/http-error.util';
import { AuthService } from '../../../core/services/auth.service';
import { PrayerIntentionService } from '../prayer-intention.service';
import { PrayerIntention } from '../prayer-intention.model';

@Component({
  selector: 'coms-prayer-intentions-list',
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatIconModule, MatMenuModule, DataTableComponent],
  templateUrl: './prayer-intentions-list.html',
  styleUrl: './prayer-intentions-list.scss',
})
export class PrayerIntentionsListComponent implements OnInit {
  private prayerIntentionService = inject(PrayerIntentionService);
  private notification = inject(NotificationService);
  private fileDownload = inject(FileDownloadService);
  private dialog = inject(MatDialog);
  authService = inject(AuthService);

  @ViewChild('statusTpl', { static: true }) statusTpl!: TemplateRef<unknown>;
  @ViewChild('intentionTpl', { static: true }) intentionTpl!: TemplateRef<unknown>;
  @ViewChild('actionsTpl', { static: true }) actionsTpl!: TemplateRef<unknown>;

  cellTemplates: Record<string, TemplateRef<unknown>> = {};

  rows = signal<PrayerIntention[]>([]);
  total = signal(0);
  loading = signal(false);
  pageIndex = signal(0);
  pageSize = signal(25);
  search = signal('');
  sort = signal<DataTableSort>({ active: 'prayer_date', direction: 'desc' });

  columns: DataTableColumn<PrayerIntention>[] = [
    { key: 'receipt_no', label: 'Receipt No.', sortable: true },
    {
      key: 'prayer_date',
      label: 'Prayer Date',
      sortable: true,
      accessor: (row) => new Date(row.prayer_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    },
    { key: 'mass_name', label: 'Mass' },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'intention', label: 'Prayer Intention' },
    {
      key: 'offering_amount',
      label: 'Offering',
      align: 'right',
      accessor: (row) => `₹${Number(row.offering_amount).toFixed(2)}`,
    },
    { key: 'status', label: 'Status' },
    { key: 'actions', label: '', align: 'right' },
  ];

  ngOnInit(): void {
    this.cellTemplates = {
      intention: this.intentionTpl,
      status: this.statusTpl,
      actions: this.actionsTpl,
    };
    this.fetch();
  }

  fetch(): void {
    this.loading.set(true);
    this.prayerIntentionService
      .list({
        page: this.pageIndex() + 1,
        pageSize: this.pageSize(),
        search: this.search() || undefined,
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

  intentionText(row: PrayerIntention): string {
    return row.intention_is_custom ? row.custom_intention || '-' : row.intention_master_name || '-';
  }

  async markCompleted(row: PrayerIntention): Promise<void> {
    try {
      await firstValueFrom(this.prayerIntentionService.markCompleted(row.id));
      this.notification.success(`Marked "${row.name}" as completed.`);
      this.fetch();
    } catch (err) {
      this.notification.error(extractErrorMessage(err));
    }
  }

  async deleteRow(row: PrayerIntention): Promise<void> {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete prayer intention?',
        message: `This will remove the entry for "${row.name}" (Receipt ${row.receipt_no}). This action can be reversed only by an administrator.`,
        confirmLabel: 'Delete',
        danger: true,
      },
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await firstValueFrom(this.prayerIntentionService.delete(row.id));
      this.notification.success('Prayer intention deleted.');
      this.fetch();
    } catch (err) {
      this.notification.error(extractErrorMessage(err));
    }
  }

  async printReceipt(row: PrayerIntention): Promise<void> {
    await this.fileDownload.openInNewTab(this.prayerIntentionService.getReceiptUrl(row.id));
  }
}
