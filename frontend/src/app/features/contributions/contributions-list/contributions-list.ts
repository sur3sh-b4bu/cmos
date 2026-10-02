import { Component, DestroyRef, OnInit, TemplateRef, ViewChild, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { debounceTime, firstValueFrom } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DataTableComponent } from '../../../shared/components/data-table/data-table';
import { DataTableColumn, DataTableSort } from '../../../shared/components/data-table/data-table.model';
import { ServerTransfer } from '../../../core/services/excel-transfer.service';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { NotificationService } from '../../../core/services/notification.service';
import { FileDownloadService } from '../../../core/services/file-download.service';
import { extractErrorMessage } from '../../../core/utils/http-error.util';
import { AuthService } from '../../../core/services/auth.service';
import { RealtimeService } from '../../../core/services/realtime.service';
import { CurrencyService } from '../../../core/services/currency.service';
import { LanguageService } from '../../../core/services/language.service';
import { formatDateDMY } from '../../../core/utils/date-format.util';
import { localizedName } from '../../../core/utils/localized-name.util';
import { ContributionService } from '../contribution.service';
import { Contribution } from '../contribution.model';
import { ContributionReceivePaymentDialogComponent } from '../contribution-receive-payment-dialog/contribution-receive-payment-dialog';

/** Replica of MassIntentionsListComponent -- see that component's own doc
 * comments for the general shape (including the Excel import, mirrored the
 * same way here). No Prayer Date/Mass columns -- a Contribution has neither. */
@Component({
  selector: 'coms-contributions-list',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule, DataTableComponent, TranslatePipe],
  templateUrl: './contributions-list.html',
  styleUrl: './contributions-list.scss',
})
export class ContributionsListComponent implements OnInit {
  private contributionService = inject(ContributionService);
  private notification = inject(NotificationService);
  private fileDownload = inject(FileDownloadService);
  private dialog = inject(MatDialog);
  private currencyService = inject(CurrencyService);
  private translate = inject(TranslateService);
  private realtime = inject(RealtimeService);
  private destroyRef = inject(DestroyRef);
  authService = inject(AuthService);
  languageService = inject(LanguageService);

  @ViewChild('typeTpl', { static: true }) typeTpl!: TemplateRef<unknown>;
  @ViewChild('actionsTpl', { static: true }) actionsTpl!: TemplateRef<unknown>;

  cellTemplates: Record<string, TemplateRef<unknown>> = {};

  rows = signal<Contribution[]>([]);
  total = signal(0);
  loading = signal(false);
  pageIndex = signal(0);
  pageSize = signal(25);
  search = signal('');
  sort = signal<DataTableSort>({ active: 'id', direction: 'desc' });

  /** Import / Export / template are done by the API (see contributionTransferService.js). Export follows the search box on screen. */
  serverTransfer: ServerTransfer = this.contributionService.transferConfig(() => ({ search: this.search() || undefined }));

  columns: DataTableColumn<Contribution>[] = [
    { key: 'receipt_no', label: 'massIntentions.colReceiptNo', sortable: true },
    // When the contribution was actually entered at the office -- a
    // Contribution has no separate scheduled/prayer date like a Mass
    // Intention does, so unlike that list's own colEnteredOn this is the
    // only date shown here. Reports > Contributions already breaks
    // contributions down by date (see contributionCollectionsDetailPdf.js);
    // this brings that same date into the list view itself.
    {
      key: 'created_at',
      label: 'massIntentions.colEnteredOn',
      sortable: true,
      accessor: (row) => formatDateDMY(row.created_at),
    },
    { key: 'name', label: 'common.name', sortable: true },
    { key: 'phone', label: 'massIntentions.phoneNumber', sortable: true, accessor: (row) => row.phone || '-' },
    { key: 'contribution_type', label: 'contributions.contributionType', sortable: true },
    {
      key: 'contribution_amount',
      label: 'contributions.amount',
      sortable: true,
      align: 'right',
      accessor: (row) => `${this.currencyService.current().symbol}${Number(row.contribution_amount).toFixed(2)}`,
    },
    { key: 'actions', label: '', align: 'right' },
  ];

  ngOnInit(): void {
    this.currencyService.load();
    this.cellTemplates = {
      contribution_type: this.typeTpl,
      actions: this.actionsTpl,
    };
    this.fetch();

    // Same reasoning as MassIntentionsListComponent's own subscription --
    // another user of this church just changed a Contribution, refetch.
    this.realtime
      .on('contributions:changed')
      .pipe(debounceTime(400), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.fetch());
  }

  fetch(): void {
    this.loading.set(true);
    const activeSort = this.sort();
    this.contributionService
      .list({
        page: this.pageIndex() + 1,
        pageSize: this.pageSize(),
        search: this.search() || undefined,
        sortBy: activeSort.direction ? activeSort.active : undefined,
        sortDir: activeSort.direction || undefined,
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

  onSortChange(sort: DataTableSort): void {
    this.sort.set(sort);
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

  contributionTypeText(row: Contribution): string {
    if (row.contribution_type_is_custom) return row.custom_contribution_type || '-';
    return localizedName({ name: row.contribution_type_name || '', name_ta: row.contribution_type_name_ta }, this.languageService.current()) || '-';
  }

  async receivePayment(row: Contribution): Promise<void> {
    const ref = this.dialog.open(ContributionReceivePaymentDialogComponent, {
      data: { contribution: row },
      width: '460px',
    });
    const updated = await firstValueFrom(ref.afterClosed());
    if (updated) this.fetch();
  }

  async deleteRow(row: Contribution): Promise<void> {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.translate.instant('contributions.deleteConfirmTitle'),
        message: this.translate.instant('contributions.deleteConfirmMessage', {
          name: row.name,
          receipt: row.receipt_no,
        }),
        confirmLabel: this.translate.instant('common.delete'),
        danger: true,
      },
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await firstValueFrom(this.contributionService.delete(row.id));
      this.notification.success(this.translate.instant('contributions.deleted'));
      this.fetch();
    } catch (err) {
      this.notification.error(extractErrorMessage(err));
    }
  }

  async printReceipt(row: Contribution): Promise<void> {
    await this.fileDownload.printPdf(this.contributionService.getReceiptUrl(row.id, this.languageService.current()));
  }
}
