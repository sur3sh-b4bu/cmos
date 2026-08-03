import { Component, Input, OnChanges, TemplateRef, ViewChild, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { DataTableComponent } from '../../../shared/components/data-table/data-table';
import { DataTableColumn } from '../../../shared/components/data-table/data-table.model';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { NotificationService } from '../../../core/services/notification.service';
import { FileDownloadService } from '../../../core/services/file-download.service';
import { extractErrorMessage } from '../../../core/utils/http-error.util';
import { AuthService } from '../../../core/services/auth.service';
import { CertificateService, CertificateType } from '../certificate.service';
import { CERTIFICATE_CONFIGS } from '../certificate-config';

const DATE_KEYS = new Set(['date_of_birth', 'date_of_baptism', 'marriage_date', 'date_of_death', 'burial_date']);

@Component({
  selector: 'coms-certificate-list',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule, DataTableComponent],
  templateUrl: './certificate-list.html',
  styleUrl: './certificate-list.scss',
})
export class CertificateListComponent implements OnChanges {
  @Input({ required: true }) certType!: CertificateType;

  private certificateService = inject(CertificateService);
  private notification = inject(NotificationService);
  private fileDownload = inject(FileDownloadService);
  private dialog = inject(MatDialog);
  authService = inject(AuthService);

  @ViewChild('actionsTpl', { static: true }) actionsTpl!: TemplateRef<unknown>;

  config = CERTIFICATE_CONFIGS.baptism;
  columns: DataTableColumn[] = [];
  cellTemplates: Record<string, TemplateRef<unknown>> = {};

  rows = signal<any[]>([]);
  total = signal(0);
  loading = signal(false);
  pageIndex = signal(0);
  pageSize = signal(25);
  search = signal('');

  ngOnChanges(): void {
    this.config = CERTIFICATE_CONFIGS[this.certType];
    this.columns = this.config.listColumns.map((col) =>
      DATE_KEYS.has(col.key)
        ? { ...col, accessor: (row: any) => (row[col.key] ? new Date(row[col.key]).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-') }
        : col
    );
    this.cellTemplates = { actions: this.actionsTpl };
    this.pageIndex.set(0);
    this.fetch();
  }

  fetch(): void {
    this.loading.set(true);
    this.certificateService
      .list(this.certType, { page: this.pageIndex() + 1, pageSize: this.pageSize(), search: this.search() || undefined })
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

  async printCertificate(row: any): Promise<void> {
    await this.fileDownload.openInNewTab(this.certificateService.getPrintUrl(this.certType, row.id));
  }

  async deleteRow(row: any): Promise<void> {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete certificate?',
        message: `This will remove the certificate for "${this.config.subjectAccessor(row)}" (${row.certificate_no}).`,
        confirmLabel: 'Delete',
        danger: true,
      },
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await firstValueFrom(this.certificateService.delete(this.certType, row.id));
      this.notification.success('Certificate deleted.');
      this.fetch();
    } catch (err) {
      this.notification.error(extractErrorMessage(err));
    }
  }
}
