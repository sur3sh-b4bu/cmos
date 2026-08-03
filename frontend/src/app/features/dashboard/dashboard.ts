import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../core/services/auth.service';
import { PrayerIntentionService } from '../prayer-intentions/prayer-intention.service';
import { DashboardStats } from '../prayer-intentions/prayer-intention.model';
import { CurrencyInrPipe } from '../../shared/pipes/currency-inr.pipe';
import { BarChartComponent, BarChartPoint } from '../../shared/components/bar-chart/bar-chart';

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
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class DashboardComponent implements OnInit {
  authService = inject(AuthService);
  private prayerIntentionService = inject(PrayerIntentionService);

  loading = signal(true);
  stats = signal<DashboardStats | null>(null);
  today = new Date();

  currencyFormatter = (v: number) => `₹${v.toLocaleString('en-IN')}`;

  collectionsTrendData = computed<BarChartPoint[]>(() => {
    const trend = this.stats()?.collectionsTrend ?? [];
    return trend.map((t) => ({
      label: new Date(t.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      value: t.total,
    }));
  });

  intentionsByMassData = computed<BarChartPoint[]>(() =>
    (this.stats()?.intentionsByMass ?? []).map((m) => ({ label: m.massName, value: m.count }))
  );

  ngOnInit(): void {
    this.prayerIntentionService.getDashboardStats().subscribe({
      next: (stats) => {
        this.stats.set(stats);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
