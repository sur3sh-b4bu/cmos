import { Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { CentralAnalyticsService, createLoader } from '../central-analytics.service';
import { CentralPageBase } from '../central-page.base';
import { ChurchCardsComponent } from '../components/church-cards';
import { CentralPanelComponent } from '../components/central-panel';
import { InsightSnapshotComponent } from '../components/insight-snapshot';
import { KpiCardComponent } from '../components/kpi-card';
import { TrendChartComponent } from '../components/trend-chart';

/** Church Network Overview: what is happening across every church, and which churches are most and least active. */
@Component({
  selector: 'coms-central-overview',
  standalone: true,
  imports: [TranslatePipe, KpiCardComponent, CentralPanelComponent, ChurchCardsComponent, InsightSnapshotComponent, TrendChartComponent],
  template: `
    <div class="ov" data-testid="page-overview">
      <div class="ov__kpis">
        @if (data(); as d) {
          <coms-kpi-card [label]="'central.kpi.churches' | translate" [value]="count(d.kpis.churches.value)" [note]="d.kpis.churches.newInPeriod ? ('central.kpi.newInPeriod' | translate: { count: d.kpis.churches.newInPeriod }) : ''" />
          <coms-kpi-card [label]="'central.kpi.branches' | translate" [value]="count(d.kpis.branches.value)" />
          <coms-kpi-card [label]="'central.kpi.activities' | translate" [value]="count(d.kpis.activity.value)" [changePct]="d.kpis.activity.changePct" [spark]="d.kpis.activity.spark" [tooltip]="'central.kpi.activitiesHint' | translate" />
          <coms-kpi-card [label]="'central.kpi.massIntentions' | translate" [value]="count(d.kpis.intentions.value)" [changePct]="d.kpis.intentions.changePct" [spark]="d.kpis.intentions.spark" />
          <coms-kpi-card [label]="'central.kpi.certificates' | translate" [value]="count(d.kpis.certificates.value)" [changePct]="d.kpis.certificates.changePct" [spark]="d.kpis.certificates.spark" [tooltip]="'central.kpi.certificatesHint' | translate" />
          <coms-kpi-card [label]="'central.kpi.contributions' | translate" [value]="money(d.kpis.contributions.value)" [tooltip]="money(d.kpis.contributions.value, true)" [changePct]="d.kpis.contributions.changePct" [spark]="d.kpis.contributions.spark" />
        } @else {
          @for (i of placeholders; track i) {
            <coms-kpi-card [label]="'…'" [value]="error() ? '!' : '–'" />
          }
        }
      </div>

      <div class="ov__main">
        <coms-central-panel [title]="'central.overview.network' | translate" [hint]="'central.overview.networkHint' | translate">
          @if (data(); as d) {
            <coms-church-cards [churches]="d.churches" [currency]="d.context.currency" [lang]="lang()" (churchSelect)="onChurch($event)" (viewAll)="showChurches()" />
          } @else if (error()) {
            <p class="ov__error">{{ error() }}</p>
          }
        </coms-central-panel>

        <div class="ov__side">
          <coms-central-panel [title]="'central.insight.title' | translate">
            @if (insights.data(); as i) {
              <coms-insight-snapshot [items]="i.items" [currency]="i.context.currency" [lang]="lang()" [max]="3" (viewFull)="ui.insightsOpen.set(true)" />
            }
          </coms-central-panel>
          <coms-central-panel [title]="'central.overview.activityTrend' | translate" [hint]="'central.overview.activityTrendHint' | translate">
            @if (data(); as d) {
              <coms-trend-chart [points]="trend()" [granularity]="d.context.period.granularity" [lang]="lang()" [format]="count" [ariaLabel]="'central.overview.activityTrend' | translate" />
            }
          </coms-central-panel>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
        min-height: 0;
      }
      .ov {
        height: 100%;
        display: grid;
        grid-template-rows: 78px minmax(0, 1fr);
        gap: 10px;
      }
      .ov__kpis {
        display: grid;
        grid-template-columns: repeat(6, minmax(0, 1fr));
        grid-template-rows: minmax(0, 1fr);
        gap: 10px;
      }
      .ov__main {
        display: grid;
        grid-template-columns: minmax(0, 1.75fr) minmax(0, 1fr);
        gap: 10px;
        min-height: 0;
      }
      .ov__side {
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        gap: 10px;
        min-height: 0;
      }
      .ov__error {
        font-size: 13px;
        color: var(--coms-color-danger);
      }
      @media (max-width: 1100px) {
        .ov__kpis {
          grid-template-columns: repeat(3, minmax(0, 1fr));
          grid-template-rows: repeat(2, 1fr);
        }
        .ov {
          grid-template-rows: 164px minmax(0, 1fr);
        }
      }
    `,
  ],
})
export class CentralOverviewComponent extends CentralPageBase {
  private analytics = inject(CentralAnalyticsService);
  private loader = createLoader((q) => this.analytics.overview(q));
  insights = createLoader((q) => this.analytics.insights(q));

  readonly data = this.loader.data;
  readonly error = this.loader.error;
  readonly placeholders = [1, 2, 3, 4, 5, 6];

  constructor() {
    super();
    this.publishContext(this.loader);
  }

  readonly money = (n: number, full = false): string => this.moneyFn(this.data()?.context.currency)(n, full);
  trend = computed(() => {
    const d = this.data();
    return d ? this.points(d.kpis.activity.spark, d.context.period.buckets) : [];
  });

  showChurches(): void {
    const d = this.data();
    if (!d) return;
    const money = this.moneyFn(d.context.currency);
    this.ui.openRanking({
      title: this.t('central.overview.network'),
      rows: d.churches.map((c) => ({
        id: c.id,
        churchId: c.id,
        label: this.name(c),
        display: `${this.count(c.intentions.value)} · ${this.count(c.certificates.value)} · ${money(c.contributions.value)}`,
        changePct: c.activity.changePct,
      })),
    });
  }
}
