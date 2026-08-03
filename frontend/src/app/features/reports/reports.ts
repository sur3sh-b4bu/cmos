import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DateRangeFilterComponent, DateRange } from '../../shared/components/date-range-filter/date-range-filter';
import { DataTableComponent } from '../../shared/components/data-table/data-table';
import { DataTableColumn } from '../../shared/components/data-table/data-table.model';
import { BarChartComponent, BarChartPoint } from '../../shared/components/bar-chart/bar-chart';
import {
  ReportService,
  PrayerIntentionReportData,
  CollectionsReportData,
  CertificateReportData,
} from './report.service';

const CURRENCY = (v: number) => `₹${Number(v).toFixed(2)}`;
const DATE_FMT = (v: string) => (v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');

@Component({
  selector: 'coms-reports',
  standalone: true,
  imports: [
    MatTabsModule,
    MatIconModule,
    MatProgressSpinnerModule,
    DateRangeFilterComponent,
    DataTableComponent,
    BarChartComponent,
  ],
  templateUrl: './reports.html',
  styleUrl: './reports.scss',
})
export class ReportsComponent implements OnInit {
  private reportService = inject(ReportService);

  range = signal<DateRange>({ from: '', to: '' });
  loading = signal(false);

  prayerData = signal<PrayerIntentionReportData | null>(null);
  collectionsData = signal<CollectionsReportData | null>(null);
  certificatesData = signal<CertificateReportData | null>(null);

  // Reports return their full date-range result set in one response (no
  // server-side pagination) -- DataTableComponent still expects page
  // events, so pagination is handled client-side here with a plain slice.
  prayerPage = signal(0);
  prayerPageSize = signal(25);
  collectionsPage = signal(0);
  collectionsPageSize = signal(25);
  certificatesPage = signal(0);
  certificatesPageSize = signal(25);

  prayerRowsPage = computed(() => {
    const rows = this.prayerData()?.rows ?? [];
    const start = this.prayerPage() * this.prayerPageSize();
    return rows.slice(start, start + this.prayerPageSize());
  });
  collectionsRowsPage = computed(() => {
    const rows = this.collectionsData()?.byDay ?? [];
    const start = this.collectionsPage() * this.collectionsPageSize();
    return rows.slice(start, start + this.collectionsPageSize());
  });
  certificatesRowsPage = computed(() => {
    const rows = this.certificatesData()?.rows ?? [];
    const start = this.certificatesPage() * this.certificatesPageSize();
    return rows.slice(start, start + this.certificatesPageSize());
  });

  onPrayerPageChange(e: { pageIndex: number; pageSize: number }): void {
    this.prayerPage.set(e.pageIndex);
    this.prayerPageSize.set(e.pageSize);
  }
  onCollectionsPageChange(e: { pageIndex: number; pageSize: number }): void {
    this.collectionsPage.set(e.pageIndex);
    this.collectionsPageSize.set(e.pageSize);
  }
  onCertificatesPageChange(e: { pageIndex: number; pageSize: number }): void {
    this.certificatesPage.set(e.pageIndex);
    this.certificatesPageSize.set(e.pageSize);
  }

  prayerColumns: DataTableColumn[] = [
    { key: 'receipt_no', label: 'Receipt No.', sortable: true },
    { key: 'prayer_date', label: 'Date', accessor: (r: any) => DATE_FMT(r.prayer_date) },
    { key: 'name', label: 'Name' },
    { key: 'mass_name', label: 'Mass' },
    { key: 'intention', label: 'Intention' },
    { key: 'offering_amount', label: 'Offering', align: 'right', accessor: (r: any) => CURRENCY(r.offering_amount) },
    { key: 'status_label', label: 'Status' },
  ];

  collectionColumns: DataTableColumn[] = [
    { key: 'date', label: 'Date', accessor: (r: any) => DATE_FMT(r.date) },
    { key: 'count', label: 'Entries', align: 'right' },
    { key: 'total', label: 'Total Collected', align: 'right', accessor: (r: any) => CURRENCY(r.total) },
  ];

  certificateColumns: DataTableColumn[] = [
    { key: 'certificate_type', label: 'Type', accessor: (r: any) => r.certificate_type[0].toUpperCase() + r.certificate_type.slice(1) },
    { key: 'certificate_no', label: 'Certificate No.', sortable: true },
    { key: 'name', label: 'Name' },
    { key: 'date', label: 'Date', accessor: (r: any) => DATE_FMT(r.date) },
  ];

  collectionsByDayChart = computed<BarChartPoint[]>(() =>
    (this.collectionsData()?.byDay ?? []).map((d) => ({
      label: new Date(d.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      value: d.total,
    }))
  );

  paymentMethodChart = computed<BarChartPoint[]>(() =>
    (this.collectionsData()?.byPaymentMethod ?? []).map((d) => ({ label: d.method, value: d.total }))
  );

  ngOnInit(): void {
    // DateRangeFilterComponent emits its default preset ('This Month') on init, which triggers onRangeChange.
  }

  onRangeChange(range: DateRange): void {
    this.range.set(range);
    this.fetchAll();
  }

  private fetchAll(): void {
    const query = { dateFrom: this.range().from, dateTo: this.range().to };
    this.loading.set(true);

    this.reportService.prayerIntentions(query).subscribe((data) => this.prayerData.set(data));
    this.reportService.collections(query).subscribe((data) => this.collectionsData.set(data));
    this.reportService.certificates(query).subscribe((data) => {
      this.certificatesData.set(data);
      this.loading.set(false);
    });
  }

  currency(v: number | undefined): string {
    return CURRENCY(v ?? 0);
  }

  // The report already holds its full date-range result set in memory, so
  // "export all" just returns it -- no extra HTTP round trip needed.
  asyncPrayerAll = async () => this.prayerData()?.rows ?? [];
  asyncCollectionsAll = async () => this.collectionsData()?.byDay ?? [];
  asyncCertificatesAll = async () => this.certificatesData()?.rows ?? [];
}
