import { Component, OnInit, TemplateRef, ViewChild, computed, inject, signal } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DateRangeFilterComponent, DateRange } from '../../shared/components/date-range-filter/date-range-filter';
import { DataTableComponent } from '../../shared/components/data-table/data-table';
import { DataTableColumn, DataTableSort } from '../../shared/components/data-table/data-table.model';
import { BarChartComponent, BarChartPoint } from '../../shared/components/bar-chart/bar-chart';
import { formatDateDMY } from '../../core/utils/date-format.util';
import { CurrencyService } from '../../core/services/currency.service';
import { FileDownloadService } from '../../core/services/file-download.service';
import { LanguageService } from '../../core/services/language.service';
import { AuthService } from '../../core/services/auth.service';
import { TranslatePipe } from '@ngx-translate/core';
import {
  ReportService,
  MassIntentionReportData,
  CollectionsReportData,
  ContributionCollectionsReportData,
  CertificateReportData,
} from './report.service';

const DATE_FMT = (v: string) => formatDateDMY(v);

@Component({
  selector: 'coms-reports',
  standalone: true,
  imports: [
    MatTabsModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    DateRangeFilterComponent,
    DataTableComponent,
    BarChartComponent,
    TranslatePipe,
  ],
  templateUrl: './reports.html',
  styleUrl: './reports.scss',
})
export class ReportsComponent implements OnInit {
  private reportService = inject(ReportService);
  private currencyService = inject(CurrencyService);
  private fileDownload = inject(FileDownloadService);
  private languageService = inject(LanguageService);
  authService = inject(AuthService);

  @ViewChild('collectionsPrintTpl', { static: true }) collectionsPrintTpl!: TemplateRef<unknown>;
  @ViewChild('contributionsPrintTpl', { static: true }) contributionsPrintTpl!: TemplateRef<unknown>;

  collectionCellTemplates: Record<string, TemplateRef<unknown>> = {};
  contributionCollectionCellTemplates: Record<string, TemplateRef<unknown>> = {};

  // Tracks which day's PDF is currently being generated, per table, and
  // which of the two print buttons (see printCollectionsDay's own comment)
  // triggered it -- so only that exact button shows a spinner/disables,
  // the other rows AND the other button on the same row stay clickable
  // while one print is in flight.
  printingCollections = signal<{ date: string; mine: boolean } | null>(null);
  printingContributions = signal<{ date: string; mine: boolean } | null>(null);
  printingPrayer = signal<boolean>(false);
  printingFullCollections = signal<boolean>(false);
  printingFullContributions = signal<boolean>(false);
  printingCertificates = signal<boolean>(false);

  range = signal<DateRange>({ from: '', to: '' });
  loading = signal(false);

  prayerData = signal<MassIntentionReportData | null>(null);
  collectionsData = signal<CollectionsReportData | null>(null);
  contributionCollectionsData = signal<ContributionCollectionsReportData | null>(null);
  certificatesData = signal<CertificateReportData | null>(null);

  prayerSearch = signal('');
  prayerSort = signal<DataTableSort | undefined>(undefined);

  collectionsSearch = signal('');
  collectionsSort = signal<DataTableSort | undefined>(undefined);

  contributionCollectionsSearch = signal('');
  contributionCollectionsSort = signal<DataTableSort | undefined>(undefined);

  certificatesSearch = signal('');
  certificatesSort = signal<DataTableSort | undefined>(undefined);

  // Reports return their full date-range result set in one response (no
  // server-side pagination) -- DataTableComponent still expects page
  // events, so pagination is handled client-side here with a plain slice.
  prayerPage = signal(0);
  prayerPageSize = signal(25);
  collectionsPage = signal(0);
  collectionsPageSize = signal(25);
  contributionCollectionsPage = signal(0);
  contributionCollectionsPageSize = signal(25);
  certificatesPage = signal(0);
  certificatesPageSize = signal(25);

  private filterAndSort<T>(rows: T[], searchTerm: string, columns: DataTableColumn<T>[], sort?: DataTableSort): T[] {
    let result = rows ?? [];
    const term = searchTerm.trim().toLowerCase();
    if (term) {
      result = result.filter((row: any) => {
        const objMatch = Object.values(row).some((val) => {
          if (val === null || val === undefined) return false;
          return String(val).toLowerCase().includes(term);
        });
        if (objMatch) return true;
        return columns.some((col) => {
          if (col.accessor) {
            try {
              const accVal = col.accessor(row);
              if (accVal !== null && accVal !== undefined) {
                return String(accVal).toLowerCase().includes(term);
              }
            } catch {
              // ignore accessor errors
            }
          }
          return false;
        });
      });
    }

    if (sort && sort.active && sort.direction) {
      const { active, direction } = sort;
      const isAsc = direction === 'asc';
      result = [...result].sort((a: any, b: any) => {
        const valA = a[active];
        const valB = b[active];
        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;
        if (typeof valA === 'number' && typeof valB === 'number') {
          return isAsc ? valA - valB : valB - valA;
        }
        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();
        return isAsc ? strA.localeCompare(strB) : strB.localeCompare(strA);
      });
    }

    return result;
  }

  filteredPrayerRows = computed(() => {
    const raw = this.prayerData()?.rows ?? [];
    return this.filterAndSort(raw, this.prayerSearch(), this.prayerColumns, this.prayerSort());
  });

  filteredCollectionsRows = computed(() => {
    const raw = this.collectionsData()?.byDay ?? [];
    return this.filterAndSort(raw, this.collectionsSearch(), this.collectionColumns, this.collectionsSort());
  });

  filteredContributionCollectionsRows = computed(() => {
    const raw = this.contributionCollectionsData()?.byDay ?? [];
    return this.filterAndSort(raw, this.contributionCollectionsSearch(), this.contributionCollectionColumns, this.contributionCollectionsSort());
  });

  filteredCertificatesRows = computed(() => {
    const raw = this.certificatesData()?.rows ?? [];
    return this.filterAndSort(raw, this.certificatesSearch(), this.certificateColumns, this.certificatesSort());
  });

  prayerRowsPage = computed(() => {
    const rows = this.filteredPrayerRows();
    const start = this.prayerPage() * this.prayerPageSize();
    return rows.slice(start, start + this.prayerPageSize());
  });
  collectionsRowsPage = computed(() => {
    const rows = this.filteredCollectionsRows();
    const start = this.collectionsPage() * this.collectionsPageSize();
    return rows.slice(start, start + this.collectionsPageSize());
  });
  contributionCollectionsRowsPage = computed(() => {
    const rows = this.filteredContributionCollectionsRows();
    const start = this.contributionCollectionsPage() * this.contributionCollectionsPageSize();
    return rows.slice(start, start + this.contributionCollectionsPageSize());
  });
  certificatesRowsPage = computed(() => {
    const rows = this.filteredCertificatesRows();
    const start = this.certificatesPage() * this.certificatesPageSize();
    return rows.slice(start, start + this.certificatesPageSize());
  });

  onPrayerPageChange(e: { pageIndex: number; pageSize: number }): void {
    this.prayerPage.set(e.pageIndex);
    this.prayerPageSize.set(e.pageSize);
  }
  onPrayerSearch(term: string): void {
    this.prayerSearch.set(term);
    this.prayerPage.set(0);
  }
  onPrayerSort(sort: DataTableSort): void {
    this.prayerSort.set(sort);
    this.prayerPage.set(0);
  }

  onCollectionsPageChange(e: { pageIndex: number; pageSize: number }): void {
    this.collectionsPage.set(e.pageIndex);
    this.collectionsPageSize.set(e.pageSize);
  }
  onCollectionsSearch(term: string): void {
    this.collectionsSearch.set(term);
    this.collectionsPage.set(0);
  }
  onCollectionsSort(sort: DataTableSort): void {
    this.collectionsSort.set(sort);
    this.collectionsPage.set(0);
  }

  onContributionCollectionsPageChange(e: { pageIndex: number; pageSize: number }): void {
    this.contributionCollectionsPage.set(e.pageIndex);
    this.contributionCollectionsPageSize.set(e.pageSize);
  }
  onContributionCollectionsSearch(term: string): void {
    this.contributionCollectionsSearch.set(term);
    this.contributionCollectionsPage.set(0);
  }
  onContributionCollectionsSort(sort: DataTableSort): void {
    this.contributionCollectionsSort.set(sort);
    this.contributionCollectionsPage.set(0);
  }

  onCertificatesPageChange(e: { pageIndex: number; pageSize: number }): void {
    this.certificatesPage.set(e.pageIndex);
    this.certificatesPageSize.set(e.pageSize);
  }
  onCertificatesSearch(term: string): void {
    this.certificatesSearch.set(term);
    this.certificatesPage.set(0);
  }
  onCertificatesSort(sort: DataTableSort): void {
    this.certificatesSort.set(sort);
    this.certificatesPage.set(0);
  }

  async printMassIntentionsReport(): Promise<void> {
    if (this.printingPrayer()) return;
    this.printingPrayer.set(true);
    try {
      await this.fileDownload.printPdf(
        this.reportService.getMassIntentionsPrintUrl(
          { dateFrom: this.range().from, dateTo: this.range().to },
          this.languageService.current()
        )
      );
    } finally {
      this.printingPrayer.set(false);
    }
  }

  async printCollectionsRangeReport(mine = false): Promise<void> {
    if (this.printingFullCollections()) return;
    this.printingFullCollections.set(true);
    try {
      await this.fileDownload.printPdf(
        this.reportService.getCollectionsDetailPrintUrl(
          this.range().from,
          this.range().to,
          mine,
          'payment',
          this.languageService.current()
        )
      );
    } finally {
      this.printingFullCollections.set(false);
    }
  }

  async printContributionsRangeReport(mine = false): Promise<void> {
    if (this.printingFullContributions()) return;
    this.printingFullContributions.set(true);
    try {
      await this.fileDownload.printPdf(
        this.reportService.getContributionCollectionsDetailPrintUrl(
          this.range().from,
          this.range().to,
          mine,
          this.languageService.current()
        )
      );
    } finally {
      this.printingFullContributions.set(false);
    }
  }

  async printCertificatesReport(): Promise<void> {
    if (this.printingCertificates()) return;
    this.printingCertificates.set(true);
    try {
      await this.fileDownload.printPdf(
        this.reportService.getCertificatesPrintUrl(
          { dateFrom: this.range().from, dateTo: this.range().to },
          this.languageService.current()
        )
      );
    } finally {
      this.printingCertificates.set(false);
    }
  }

  /** Prints the per-payment breakdown PDF for one day of the "by day" table
   * directly from its row's print icon -- no intermediate on-screen popup
   * (that dialog still exists, and still opens from Dashboard's Today's/
   * Monthly Collections stat cards -- see collections-detail-dialog.ts /
   * dashboard.ts -- just not from this list anymore).
   *
   * Two icons share this one method (see reports.html): `mine: true` is
   * "my collections" -- every user's own billed transactions for that day,
   * always available. `mine: false` is the all-users breakdown with a
   * per-row Billed By column -- only rendered at all for someone with
   * reports.print_all (see canPrintAllUsers below), and independently
   * enforced server-side regardless (see reportController.js). */
  async printCollectionsDay(row: { date: string }, mine: boolean, event: Event): Promise<void> {
    event.stopPropagation();
    if (this.printingCollections()) return;
    this.printingCollections.set({ date: row.date, mine });
    try {
      await this.fileDownload.printPdf(
        this.reportService.getCollectionsDetailPrintUrl(row.date, row.date, mine, 'payment', this.languageService.current())
      );
    } finally {
      this.printingCollections.set(null);
    }
  }

  /** Same idea as printCollectionsDay, for the separate Contributions tab. */
  async printContributionsDay(row: { date: string }, mine: boolean, event: Event): Promise<void> {
    event.stopPropagation();
    if (this.printingContributions()) return;
    this.printingContributions.set({ date: row.date, mine });
    try {
      await this.fileDownload.printPdf(
        this.reportService.getContributionCollectionsDetailPrintUrl(row.date, row.date, mine, this.languageService.current())
      );
    } finally {
      this.printingContributions.set(null);
    }
  }

  /** Gates the "all users" print icon in the template -- reports.view alone
   * (every role that can even see this page) only ever covers printing
   * one's own day; seeing who billed everyone else's transactions is the
   * sensitive, admin-by-default capability (see seed.js). */
  get canPrintAllUsers(): boolean {
    return this.authService.hasPermission('reports.print_all');
  }

  prayerColumns: DataTableColumn[] = [
    { key: 'receipt_no', label: 'massIntentions.colReceiptNo', sortable: true },
    { key: 'prayer_date', label: 'massIntentions.colMassDate', accessor: (r: any) => DATE_FMT(r.prayer_date) },
    { key: 'name', label: 'common.name' },
    { key: 'mass_name', label: 'dashboard.colMass' },
    { key: 'offering_amount', label: 'massIntentions.colOffering', align: 'right', accessor: (r: any) => this.currency(r.offering_amount) },
  ];

  collectionColumns: DataTableColumn[] = [
    { key: 'date', label: 'common.date', accessor: (r: any) => DATE_FMT(r.date) },
    { key: 'count', label: 'reports.colEntries', align: 'right' },
    { key: 'total', label: 'reports.colTotalCollected', align: 'right', accessor: (r: any) => this.currency(r.total) },
    { key: 'actions', label: '', align: 'right' },
  ];

  contributionCollectionColumns: DataTableColumn[] = [
    { key: 'date', label: 'common.date', accessor: (r: any) => DATE_FMT(r.date) },
    { key: 'count', label: 'reports.colEntries', align: 'right' },
    { key: 'total', label: 'reports.colTotalCollected', align: 'right', accessor: (r: any) => this.currency(r.total) },
    { key: 'actions', label: '', align: 'right' },
  ];

  certificateColumns: DataTableColumn[] = [
    { key: 'certificate_type', label: 'reports.colType', accessor: (r: any) => r.certificate_type[0].toUpperCase() + r.certificate_type.slice(1) },
    { key: 'certificate_no', label: 'certificates.common.certificateNo', sortable: true },
    { key: 'name', label: 'common.name' },
    { key: 'date', label: 'common.date', accessor: (r: any) => DATE_FMT(r.date) },
  ];

  collectionsByDayChart = computed<BarChartPoint[]>(() =>
    [...(this.collectionsData()?.byDay ?? [])]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({
        label: new Date(d.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
        value: d.total,
      }))
  );

  paymentMethodChart = computed<BarChartPoint[]>(() =>
    (this.collectionsData()?.byPaymentMethod ?? []).map((d) => ({ label: d.method, value: d.total }))
  );

  contributionCollectionsByDayChart = computed<BarChartPoint[]>(() =>
    [...(this.contributionCollectionsData()?.byDay ?? [])]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({
        label: new Date(d.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
        value: d.total,
      }))
  );

  contributionPaymentMethodChart = computed<BarChartPoint[]>(() =>
    (this.contributionCollectionsData()?.byPaymentMethod ?? []).map((d) => ({ label: d.method, value: d.total }))
  );

  ngOnInit(): void {
    this.currencyService.load();
    this.collectionCellTemplates = { actions: this.collectionsPrintTpl };
    this.contributionCollectionCellTemplates = { actions: this.contributionsPrintTpl };
    // DateRangeFilterComponent emits its default preset ('This Month') on init, which triggers onRangeChange.
  }

  onRangeChange(range: DateRange): void {
    this.range.set(range);
    this.fetchAll();
  }

  private fetchAll(): void {
    const query = { dateFrom: this.range().from, dateTo: this.range().to };
    this.loading.set(true);

    this.reportService.massIntentions(query).subscribe((data) => this.prayerData.set(data));
    this.reportService.collections(query).subscribe((data) => this.collectionsData.set(data));
    this.reportService.contributionCollections(query).subscribe((data) => this.contributionCollectionsData.set(data));
    this.reportService.certificates(query).subscribe((data) => {
      this.certificatesData.set(data);
      this.loading.set(false);
    });
  }

  // An arrow function class field (not a regular method) -- it's passed
  // around as an unbound callback (reports.html's [valueFormatter]="currency"
  // on <coms-bar-chart>, and inside the accessor closures below), so it must
  // capture `this` lexically rather than relying on being called as
  // `this.currency(...)`, which a regular method can't guarantee.
  currency = (v: number | undefined): string => {
    return `${this.currencyService.current().symbol}${Number(v ?? 0).toFixed(2)}`;
  };

  // The report already holds its full date-range result set in memory, so
  // "export all" returns the filtered set if search is applied.
  asyncPrayerAll = async () => this.filteredPrayerRows();
  asyncCollectionsAll = async () => this.filteredCollectionsRows();
  asyncContributionCollectionsAll = async () => this.filteredContributionCollectionsRows();
  asyncCertificatesAll = async () => this.filteredCertificatesRows();
}
