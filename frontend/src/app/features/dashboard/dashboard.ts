import { Component, DestroyRef, OnInit, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';
import { CurrencyService } from '../../core/services/currency.service';
import { DashboardFilterService } from '../../core/services/dashboard-filter.service';
import { MasterLookupService } from '../../core/services/master-lookup.service';
import { MassIntentionService } from '../mass-intentions/mass-intention.service';
import { DashboardStats } from '../mass-intentions/mass-intention.model';
import { CurrencyInrPipe } from '../../shared/pipes/currency-inr.pipe';
import { BarChartComponent, BarChartPoint } from '../../shared/components/bar-chart/bar-chart';
import { formatDateDMY } from '../../core/utils/date-format.util';
import { ReportService } from '../reports/report.service';
import { CollectionsDetailDialogComponent } from '../reports/collections-detail-dialog';
import { ContributionCollectionsDetailDialogComponent } from '../reports/contribution-collections-detail-dialog';
import { TodayIntentionsDialogComponent } from './today-intentions-dialog/today-intentions-dialog';

@Component({
  selector: 'coms-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    DatePipe,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    CurrencyInrPipe,
    BarChartComponent,
    TranslatePipe,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class DashboardComponent implements OnInit {
  authService = inject(AuthService);
  private router = inject(Router);
  private massIntentionService = inject(MassIntentionService);
  private reportService = inject(ReportService);
  private masterLookup = inject(MasterLookupService);
  private currencyService = inject(CurrencyService);
  private translate = inject(TranslateService);
  private dialog = inject(MatDialog);
  private destroyRef = inject(DestroyRef);
  /** The filter itself lives in the header, not on this page -- see
   * DashboardFilterService's own comment. */
  dashboardFilter = inject(DashboardFilterService);

  loading = signal(true);
  stats = signal<DashboardStats | null>(null);
  today = new Date();

  periodLoading = signal(true);
  periodCollections = signal(0);
  periodContributions = signal(0);
  /** Canonical Mass order (sort_order, as configured under Masters > Masses)
   * -- loaded once, used to keep "Mass Intentions by Mass Time" in a stable
   * order (and to show every Mass, even ones with zero intentions in the
   * selected period) instead of whatever order rows happen to come back in. */
  private massOrder = signal<{ id: number; name: string }[]>([]);
  private periodCollectionsTrend = signal<{ date: string; total: number }[]>([]);
  /** Just the mass_name of each row in the selected period -- kept as raw
   * rows rather than pre-aggregated counts, and combined with massOrder via
   * a computed() below (see intentionsByMassData), so this stays correct
   * regardless of which of the two independent HTTP calls (masses,
   * mass-intentions report) happens to resolve first. */
  private periodMassNames = signal<string[]>([]);

  constructor() {
    // Reacts to the header-hosted filter (see dashboardFilter above)
    // rather than an (rangeChange) binding of our own -- fires once
    // immediately with whatever range is already set (a no-op if the
    // header's filter hasn't emitted its default preset yet; fetchPeriodStats
    // itself guards on an empty range) and again on every later change.
    effect(() => {
      this.dashboardFilter.range();
      this.fetchPeriodStats();
    });
  }

  currencyFormatter = (v: number) => `${this.currencyService.current().symbol}${v.toLocaleString('en-IN')}`;

  /** Scoped to the header filter's range (see periodCollectionsTrend),
   * not a fixed "last 7 days" -- see fetchPeriodStats(). */
  collectionsTrendData = computed<BarChartPoint[]>(() =>
    this.periodCollectionsTrend().map((t) => ({
      label: new Date(t.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      value: t.total,
    }))
  );

  /** Also scoped to the header filter's range now, not all-time -- see
   * fetchPeriodStats(). Every configured Mass appears, even with a zero
   * count for this period (same "show the gap" behaviour the old all-time
   * chart had), in the Masters-configured order rather than whatever order
   * rows happened to come back in. */
  intentionsByMassData = computed<BarChartPoint[]>(() => {
    const counts = new Map<string, number>();
    for (const name of this.periodMassNames()) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return this.massOrder().map((m) => ({ label: m.name, value: counts.get(m.name) ?? 0 }));
  });

  ngOnInit(): void {
    this.currencyService.load();
    this.fetchStats();
    this.masterLookup.list<{ id: number; name: string }>('masses').subscribe((rows) => this.massOrder.set(rows));
  }

  private fetchStats(): void {
    this.massIntentionService.getDashboardStats().subscribe({
      next: (stats) => {
        this.stats.set(stats);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /** Backs the two period-scoped cards (Mass Collections / Contributions) AND
   * both charts below (Collections trend, Mass Intentions by Mass Time) --
   * reuses Reports' own endpoints (same data the Reports tabs show for the
   * identical range) rather than duplicating that aggregation a second
   * time in the dashboard-stats endpoint. */
  private fetchPeriodStats(): void {
    const { from, to } = this.dashboardFilter.range();
    if (!from || !to) return;
    this.periodLoading.set(true);
    this.reportService.collections({ dateFrom: from, dateTo: to }).subscribe({
      next: (data) => {
        this.periodCollections.set(data.summary.totalOffering);
        this.periodCollectionsTrend.set(data.byDay);
        this.periodLoading.set(false);
      },
      error: () => this.periodLoading.set(false),
    });
    this.reportService.contributionCollections({ dateFrom: from, dateTo: to }).subscribe((data) => {
      this.periodContributions.set(data.summary.totalOffering);
    });
    this.reportService.massIntentions({ dateFrom: from, dateTo: to }).subscribe((data) => {
      this.periodMassNames.set(data.rows.map((r) => r.mass_name));
    });
  }

  formatDate = formatDateDMY;

  /** "Today" / "Tomorrow" / "In 5 days" -- reads better than a bare date for
   * something the office is meant to notice is coming up soon. */
  daysUntilLabel(dateStr: string): string {
    const target = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000);
    if (diffDays === 0) return this.translate.instant('dashboard.today');
    if (diffDays === 1) return this.translate.instant('dashboard.tomorrow');
    if (diffDays > 1) return this.translate.instant('dashboard.inNDays', { n: diffDays });
    return formatDateDMY(dateStr);
  }

  announcementDateRange(a: { start_date: string | null; end_date: string | null }): string {
    if (!a.start_date && !a.end_date) return '';
    if (a.start_date && a.end_date) return `${formatDateDMY(a.start_date)} – ${formatDateDMY(a.end_date)}`;
    return formatDateDMY(a.start_date ?? a.end_date);
  }

  private toIso(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /** Detailed, printable breakdown behind the Today's Mass Collections
   * stat card -- same date the card's own total is computed over (see
   * massIntentionRepository.getDashboardStats). Uses dateBasis: 'entered'
   * so a Mass Intention booked today shows up here even if its payment_date
   * was backdated/left at an earlier default -- so the dialog's total can
   * differ from the card's (which stays payment_date-based); see
   * reportRepository.collectionsRangeDetail's dateBasis doc comment. */
  openTodayCollections(): void {
    const todayIso = this.toIso(new Date());
    this.dialog.open(CollectionsDetailDialogComponent, {
      data: { dateFrom: todayIso, dateTo: todayIso, dateBasis: 'entered' },
      // Same width as the period-scoped version below (openPeriodCollections)
      // -- 920px was cramming the Billed By/Method/Amount columns together
      // ("looks congested").
      width: '1100px',
      maxWidth: '95vw',
    });
  }

  /** Register-style popup behind the Today's Mass Intentions stat card --
   * same "grouped by Mass" view as the Daily Prayer Register page, just
   * for today and in a dialog rather than a full page. */
  openTodayIntentions(): void {
    this.dialog.open(TodayIntentionsDialogComponent, {
      data: { date: this.toIso(new Date()) },
      width: '1080px',
      maxWidth: '95vw',
    });
  }

  /** Register-style popup behind the Tomorrow's Mass Intentions stat card */
  openTomorrowIntentions(): void {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    this.dialog.open(TodayIntentionsDialogComponent, {
      data: { date: this.toIso(tomorrow) },
      width: '1080px',
      maxWidth: '95vw',
    });
  }

  /** Same idea, for the Today's Contributions stat card. */
  openTodayContributions(): void {
    const todayIso = this.toIso(new Date());
    this.dialog.open(ContributionCollectionsDetailDialogComponent, {
      data: { dateFrom: todayIso, dateTo: todayIso },
      // See openTodayCollections' identical fix above -- same dialog
      // component, same congestion at 920px.
      width: '1100px',
      maxWidth: '95vw',
    });
  }

  /** Detailed, printable breakdown behind the period-scoped Mass
   * Collections card -- whatever range the date-range filter is currently
   * set to (see range/periodLabel above), so the dialog's total always
   * matches what's shown on the card that opened it. */
  openPeriodCollections(): void {
    const { from, to } = this.dashboardFilter.range();
    if (!from || !to) return;
    this.dialog.open(CollectionsDetailDialogComponent, {
      data: { dateFrom: from, dateTo: to, dateBasis: 'entered' },
      width: '1100px',
      maxWidth: '95vw',
    });
  }

  /** Same idea as openPeriodCollections, for the Contributions card. */
  openPeriodContributions(): void {
    const { from, to } = this.dashboardFilter.range();
    if (!from || !to) return;
    this.dialog.open(ContributionCollectionsDetailDialogComponent, {
      data: { dateFrom: from, dateTo: to },
      width: '1100px',
      maxWidth: '95vw',
    });
  }

  /** Navigates to mass intentions filtered by refunded status */
  openRefunds(): void {
    this.router.navigate(['/mass-intentions'], { queryParams: { paidOnly: 'refunded' } });
  }
}
