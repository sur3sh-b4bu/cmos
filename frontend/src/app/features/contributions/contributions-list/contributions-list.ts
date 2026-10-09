import { Component, DestroyRef, OnInit, TemplateRef, ViewChild, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { debounceTime, firstValueFrom } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DataTableComponent } from '../../../shared/components/data-table/data-table';
import { DataTableColumn, DataTableSort } from '../../../shared/components/data-table/data-table.model';
import { FilterBarComponent } from '../../../shared/components/filter-bar/filter-bar';
import { FilterFieldDef } from '../../../shared/components/filter-bar/filter-bar.model';
import { ServerTransfer } from '../../../core/services/excel-transfer.service';
import { MasterLookupService } from '../../../core/services/master-lookup.service';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { NotificationService } from '../../../core/services/notification.service';
import { FileDownloadService } from '../../../core/services/file-download.service';
import { extractErrorMessage } from '../../../core/utils/http-error.util';
import { AuthService } from '../../../core/services/auth.service';
import { CurrencyService } from '../../../core/services/currency.service';
import { LanguageService } from '../../../core/services/language.service';
import { formatDateDMY } from '../../../core/utils/date-format.util';
import { localizedName } from '../../../core/utils/localized-name.util';
import { ContributionService } from '../contribution.service';
import { Contribution } from '../contribution.model';
import { ContributionReceivePaymentDialogComponent } from '../contribution-receive-payment-dialog/contribution-receive-payment-dialog';

@Component({
  selector: 'coms-contributions-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    DataTableComponent,
    FilterBarComponent,
    TranslatePipe,
  ],
  templateUrl: './contributions-list.html',
  styleUrl: './contributions-list.scss',
})
export class ContributionsListComponent implements OnInit {
  private contributionService = inject(ContributionService);
  private notification = inject(NotificationService);
  private fileDownload = inject(FileDownloadService);
  private dialog = inject(MatDialog);
  currencyService = inject(CurrencyService);
  private translate = inject(TranslateService);
  private masterLookup = inject(MasterLookupService);
  private destroyRef = inject(DestroyRef);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  authService = inject(AuthService);
  languageService = inject(LanguageService);

  @ViewChild('typeTpl', { static: true }) typeTpl!: TemplateRef<unknown>;
  @ViewChild('amountTpl', { static: true }) amountTpl!: TemplateRef<unknown>;
  @ViewChild('actionsTpl', { static: true }) actionsTpl!: TemplateRef<unknown>;

  cellTemplates: Record<string, TemplateRef<unknown>> = {};

  rows = signal<Contribution[]>([]);
  total = signal(0);
  loading = signal(false);
  pageIndex = signal(0);
  pageSize = signal(25);
  search = signal('');
  sort = signal<DataTableSort>({ active: 'id', direction: 'desc' });

  filterFields = signal<FilterFieldDef[]>([]);
  filters = signal<Record<string, string>>({});

  /** Import / Export / template are done by the API (see contributionTransferService.js). Export follows the search box on screen. */
  serverTransfer: ServerTransfer = this.contributionService.transferConfig(() => ({
    search: this.search() || undefined,
    ...this.filters(),
  }));

  columns: DataTableColumn<Contribution>[] = [
    { key: 'receipt_no', label: 'massIntentions.colReceiptNo', sortable: true },
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
      contribution_amount: this.amountTpl,
      actions: this.actionsTpl,
    };

    const initialPaidOnly = this.route.snapshot.queryParamMap.get('paidOnly');
    if (initialPaidOnly) {
      this.filters.set({ paidOnly: initialPaidOnly });
    }

    this.buildFilterFields();
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.buildFilterFields());
    this.fetch();
  }

  private buildFilterFields(): void {
    const t = (key: string) => this.translate.instant(key);
    this.filterFields.set([
      { key: 'enteredDate', label: 'massIntentions.colEnteredOn', type: 'dateRange' },
      { key: 'contributionTypeId', label: 'contributions.contributionType', type: 'select' },
      { key: 'paymentMethodId', label: 'massIntentions.paymentMethod', type: 'select' },
      {
        key: 'paidOnly',
        label: 'massIntentions.paymentStatus',
        type: 'select',
        options: [
          { value: '1', label: t('massIntentions.paid') },
          { value: '0', label: t('massIntentions.unpaid') },
          { value: 'refunded', label: t('massIntentions.statusRefunded') },
        ],
      },
    ]);
    this.masterLookup.list<{ id: number; name: string }>('donation_types').subscribe((rows) => {
      this.setFieldOptions('contributionTypeId', rows);
    });
    this.masterLookup.list<{ id: number; name: string }>('payment_methods').subscribe((rows) => {
      this.setFieldOptions('paymentMethodId', rows);
    });
  }

  private setFieldOptions(key: string, rows: { id: number; name: string }[]): void {
    this.filterFields.update((current) =>
      current.map((f) => (f.key === key ? { ...f, options: rows.map((r) => ({ value: r.id, label: r.name })) } : f))
    );
  }

  onFiltersChange(filters: Record<string, string>): void {
    this.filters.set(filters);
    this.pageIndex.set(0);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: Object.keys(filters).length ? filters : {},
    });
    this.fetch();
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
        ...this.filters(),
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

  async refundRow(row: Contribution): Promise<void> {
    const symbol = this.currencyService.current().symbol;
    const formattedAmount = `${symbol}${Number(row.contribution_amount).toFixed(2)}`;
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.translate.instant('common.refundConfirmTitle'),
        message: this.translate.instant('common.refundConfirmMessage', {
          name: row.name,
          receipt: row.receipt_no,
          amount: formattedAmount,
        }),
        confirmLabel: this.translate.instant('common.refund'),
        danger: true,
      },
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await firstValueFrom(this.contributionService.refund(row.id));
      this.notification.success(this.translate.instant('common.refundSuccess', { receipt: row.receipt_no }));
      this.fetch();
    } catch (err) {
      this.notification.error(extractErrorMessage(err));
    }
  }

  async unrefundRow(row: Contribution): Promise<void> {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.translate.instant('common.unrefundConfirmTitle'),
        message: this.translate.instant('common.unrefundConfirmMessage', {
          name: row.name,
          receipt: row.receipt_no,
        }),
        confirmLabel: this.translate.instant('common.unrefund'),
        danger: false,
      },
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await firstValueFrom(this.contributionService.unrefund(row.id));
      this.notification.success(this.translate.instant('common.unrefundSuccess', { receipt: row.receipt_no }));
      this.fetch();
    } catch (err) {
      this.notification.error(extractErrorMessage(err));
    }
  }

  async printReceipt(row: Contribution): Promise<void> {
    await this.fileDownload.printHtml(this.contributionService.getReceiptPrintUrl(row.id, this.languageService.current()));
  }
}
