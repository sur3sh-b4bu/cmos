import { Component, DestroyRef, OnInit, TemplateRef, ViewChild, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { debounceTime, firstValueFrom } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DataTableComponent } from '../../../shared/components/data-table/data-table';
import { DataTableColumn, DataTableSort } from '../../../shared/components/data-table/data-table.model';
import { DateRangeFilterComponent, DateRange } from '../../../shared/components/date-range-filter/date-range-filter';
import { FilterBarComponent } from '../../../shared/components/filter-bar/filter-bar';
import { FilterFieldDef } from '../../../shared/components/filter-bar/filter-bar.model';
import { ServerTransfer } from '../../../core/services/excel-transfer.service';
import { MasterLookupService } from '../../../core/services/master-lookup.service';
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
import { MassIntentionService } from '../mass-intention.service';
import { MassIntention } from '../mass-intention.model';
import { ReceivePaymentDialogComponent } from '../receive-payment-dialog/receive-payment-dialog';

@Component({
  selector: 'coms-mass-intentions-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    DataTableComponent,
    DateRangeFilterComponent,
    FilterBarComponent,
    TranslatePipe,
  ],
  templateUrl: './mass-intentions-list.html',
  styleUrl: './mass-intentions-list.scss',
})
export class MassIntentionsListComponent implements OnInit {
  private massIntentionService = inject(MassIntentionService);
  private notification = inject(NotificationService);
  private fileDownload = inject(FileDownloadService);
  private dialog = inject(MatDialog);
  private currencyService = inject(CurrencyService);
  private translate = inject(TranslateService);
  private masterLookup = inject(MasterLookupService);
  private realtime = inject(RealtimeService);
  private destroyRef = inject(DestroyRef);
  authService = inject(AuthService);
  languageService = inject(LanguageService);

  @ViewChild('intentionTpl', { static: true }) intentionTpl!: TemplateRef<unknown>;
  @ViewChild('actionsTpl', { static: true }) actionsTpl!: TemplateRef<unknown>;

  cellTemplates: Record<string, TemplateRef<unknown>> = {};

  rows = signal<MassIntention[]>([]);
  total = signal(0);
  loading = signal(false);
  pageIndex = signal(0);
  pageSize = signal(25);
  search = signal('');
  sort = signal<DataTableSort>({ active: 'prayer_date', direction: 'desc' });

  /** Filters by Mass Date (prayer_date), same field/component as Reports >
   * Mass Intentions -- see that page's own onRangeChange comment: the
   * filter emits its default preset ('This Month') on init, which is what
   * triggers this list's first fetch (see ngOnInit below), same pattern. */
  range = signal<DateRange>({ from: '', to: '' });

  /** Structured filters (Mass, Payment Method, Payment Status) rendered by
   * coms-filter-bar alongside the always-on Mass Date range above -- see
   * buildFilterFields() below. Combines via AND with each other, the date
   * range, and the free-text search box (see massIntentionRepository.js's
   * list()), so staff can narrow to e.g. one Mass AND Unpaid at once instead
   * of only ever matching a single search term. */
  filterFields = signal<FilterFieldDef[]>([]);
  /** Currently active structured filters, already flattened to the query-
   * param shape the backend expects -- merged straight into fetch()'s
   * params below (see FilterBarComponent's own `filtersChange`). */
  filters = signal<Record<string, string>>({});

  /** Import / Export / template are done by the API (see massIntentionTransferService.js). Export follows the date range, search box and filters on screen. */
  serverTransfer: ServerTransfer = this.massIntentionService.transferConfig(() => ({
    search: this.search() || undefined,
    prayerDateFrom: this.range().from || undefined,
    prayerDateTo: this.range().to || undefined,
    ...this.filters(),
  }));

  columns: DataTableColumn<MassIntention>[] = [
    { key: 'receipt_no', label: 'massIntentions.colReceiptNo', sortable: true },
    // When the booking was actually entered at the office -- distinct from
    // prayer_date/"Mass Date" below (the date the Mass itself falls on).
    {
      key: 'created_at',
      label: 'massIntentions.colEnteredOn',
      sortable: true,
      accessor: (row) => formatDateDMY(row.created_at),
    },
    { key: 'booked_by', label: 'massIntentions.bookedBy', accessor: (row) => row.booked_by || '-' },
    { key: 'phone', label: 'massIntentions.phoneNumber', accessor: (row) => row.phone || '-' },
    {
      key: 'prayer_date',
      label: 'massIntentions.colMassDate',
      sortable: true,
      accessor: (row) => formatDateDMY(row.prayer_date),
    },
    { key: 'mass_name', label: 'dashboard.colMass', accessor: (row) => this.massText(row) },
    { key: 'name', label: 'common.name', sortable: true },
    { key: 'intention', label: 'massIntentions.colIntention' },
    {
      key: 'offering_amount',
      label: 'massIntentions.colOffering',
      align: 'right',
      accessor: (row) => `${this.currencyService.current().symbol}${Number(row.offering_amount).toFixed(2)}`,
    },
    { key: 'actions', label: '', align: 'right' },
  ];

  ngOnInit(): void {
    this.currencyService.load();
    this.cellTemplates = {
      intention: this.intentionTpl,
      actions: this.actionsTpl,
    };
    this.buildFilterFields();
    // Rebuild if the site's language changes while this page is already
    // open (the header's language switcher updates in place, no navigation
    // -- see LanguageService.setLanguage) -- Payment Status's option labels
    // are plain instant()-resolved text, so they need re-translating.
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.buildFilterFields());
    // No direct fetch() call here -- coms-date-range-filter emits its
    // default preset ('This Month') on its own init, which reaches
    // onRangeChange() below and triggers the first fetch, same as Reports.

    // Another user of this SAME church (see socketServer.js's church-scoped
    // rooms) just created/updated/deleted/paid a Mass Intention -- refetch
    // so it shows up here without anyone needing a manual page reload.
    // debounceTime coalesces a burst (e.g. a Bulk Mass Intention save
    // creating several rows back to back) into a single refetch.
    this.realtime
      .on('mass-intentions:changed')
      .pipe(debounceTime(400), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.fetch());
  }

  /** Mass/Payment Method options come from their own masters lookup;
   * Payment Status is a fixed Paid/Unpaid pair, not a masters table, so it's
   * built with static options straight away. Re-run on every language
   * switch (below) so its "All"/labels stay in the newly-current language
   * -- unlike Certificates' filter fields (all translation keys resolved by
   * the template's `translate` pipe), Payment Status's option labels are
   * plain instant()-resolved text handed to FilterBarComponent, so they
   * don't re-translate themselves on a live language change otherwise. */
  private buildFilterFields(): void {
    const t = (key: string) => this.translate.instant(key);
    this.filterFields.set([
      { key: 'massId', label: 'dashboard.colMass', type: 'select' },
      { key: 'paymentMethodId', label: 'massIntentions.paymentMethod', type: 'select' },
      {
        key: 'paidOnly',
        label: 'massIntentions.paymentStatus',
        type: 'select',
        options: [
          { value: '1', label: t('massIntentions.paid') },
          { value: '0', label: t('massIntentions.unpaid') },
        ],
      },
    ]);
    this.masterLookup.list<{ id: number; name: string }>('masses').subscribe((rows) => {
      this.setFieldOptions('massId', rows);
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
    this.fetch();
  }

  fetch(): void {
    this.loading.set(true);
    this.massIntentionService
      .list({
        page: this.pageIndex() + 1,
        pageSize: this.pageSize(),
        search: this.search() || undefined,
        prayerDateFrom: this.range().from || undefined,
        prayerDateTo: this.range().to || undefined,
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

  onRangeChange(range: DateRange): void {
    this.range.set(range);
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

  intentionText(row: MassIntention): string {
    if (row.intention_is_custom) return row.custom_intention || '-';
    if (!row.intention_master_name) return '-';
    return localizedName({ name: row.intention_master_name, name_ta: row.intention_master_name_ta }, this.languageService.current());
  }

  massText(row: MassIntention): string {
    return localizedName({ name: row.mass_name, name_ta: row.mass_name_ta }, this.languageService.current());
  }

  async receivePayment(row: MassIntention): Promise<void> {
    const ref = this.dialog.open(ReceivePaymentDialogComponent, {
      data: { intention: row },
      width: '460px',
    });
    const updated = await firstValueFrom(ref.afterClosed());
    if (updated) this.fetch();
  }

  async deleteRow(row: MassIntention): Promise<void> {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.translate.instant('massIntentions.deleteConfirmTitle'),
        message: this.translate.instant('massIntentions.deleteConfirmMessage', {
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
      await firstValueFrom(this.massIntentionService.delete(row.id));
      this.notification.success(this.translate.instant('massIntentions.deleted'));
      this.fetch();
    } catch (err) {
      this.notification.error(extractErrorMessage(err));
    }
  }

  async printReceipt(row: MassIntention): Promise<void> {
    await this.fileDownload.printPdf(this.massIntentionService.getReceiptUrl(row.id, this.languageService.current()));
  }
}
