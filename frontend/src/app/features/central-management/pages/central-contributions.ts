import { Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { CentralAnalyticsService, createLoader } from '../central-analytics.service';
import { CentralPageBase } from '../central-page.base';
import { formatChange, namedLabel, trendDirection } from '../central-format.util';
import { CentralPanelComponent } from '../components/central-panel';
import { DonutChartComponent } from '../components/donut-chart';
import { InsightSnapshotComponent } from '../components/insight-snapshot';
import { KpiCardComponent } from '../components/kpi-card';
import { MomentumRow, MomentumTableComponent } from '../components/momentum-table';
import { RankBarsComponent } from '../components/rank-bars';
import { TrendChartComponent } from '../components/trend-chart';

/** Contribution Intelligence: money RECEIVED (a recorded successful payment), by church, over time, and by kind. */
@Component({
  selector: 'coms-central-contributions',
  standalone: true,
  imports: [TranslatePipe, KpiCardComponent, MomentumTableComponent, CentralPanelComponent, TrendChartComponent, RankBarsComponent, DonutChartComponent, InsightSnapshotComponent],
  template: `
    <div class="pg" data-testid="page-contributions">
      <div class="pg__kpis">
        @if (data(); as d) {
          <coms-kpi-card [label]="'central.con.received' | translate" [value]="money(d.kpis.received.value)" [tooltip]="money(d.kpis.received.value, true)" [changePct]="d.kpis.received.changePct" [note]="'central.vsPreviousShort' | translate: { value: money(d.kpis.received.previous) }" />
          <coms-kpi-card [label]="'central.con.yearToDate' | translate" [value]="money(d.kpis.yearToDate.value)" [tooltip]="money(d.kpis.yearToDate.value, true)" />
          <coms-kpi-card [label]="'central.con.avgPerChurch' | translate" [value]="money(d.kpis.avgPerChurch.value)" [tooltip]="money(d.kpis.avgPerChurch.value, true)" [changePct]="d.kpis.avgPerChurch.changePct" />
          <coms-kpi-card [label]="'central.con.count' | translate" [value]="count(d.kpis.count.value)" [changePct]="d.kpis.count.changePct" />
          <coms-kpi-card [label]="'central.con.growth' | translate" [value]="growth(d.kpis.received.changePct)" [tooltip]="'central.con.growthHint' | translate" />
          <coms-kpi-card [label]="'central.con.top' | translate" [value]="d.kpis.topChurch ? name(d.kpis.topChurch) : '–'" [textValue]="true" [note]="d.kpis.topChurch ? money(d.kpis.topChurch.value) : ''" />
        } @else {
          @for (i of placeholders; track i) {
            <coms-kpi-card [label]="'…'" [value]="error() ? '!' : '–'" />
          }
        }
      </div>

      <div class="pg__main">
        <coms-central-panel [title]="'central.con.trend' | translate" [hint]="'central.con.trendHint' | translate">
          @if (data(); as d) {
            <coms-trend-chart [points]="d.trend" [granularity]="d.context.period.granularity" [lang]="lang()" [format]="money" [formatFull]="moneyFull" [ariaLabel]="'central.con.trend' | translate" />
          }
        </coms-central-panel>
        <coms-central-panel [title]="'central.con.byChurch' | translate" [hint]="'central.con.byChurchHint' | translate">
          @if (data(); as d) {
            <coms-rank-bars [items]="ranks()" (itemSelect)="onChurch($event)" (viewAll)="showAllChurches()" />
          }
        </coms-central-panel>
      </div>

      <div class="pg__bottom">
        <coms-central-panel [title]="'central.con.composition' | translate" [hint]="'central.con.compositionHint' | translate">
          @if (data(); as d) {
            <coms-donut-chart [items]="compositionItems()" [centerValue]="money(d.kpis.received.value)" [centerLabel]="'central.con.centerLabel' | translate" [othersLabel]="'central.others' | translate" [ariaLabel]="'central.con.composition' | translate" />
          }
        </coms-central-panel>

        <coms-central-panel [title]="'central.con.momentum' | translate" [hint]="'central.con.momentumHint' | translate">
          @if (data(); as d) {
            <coms-momentum-table [rows]="momentumRows()" (churchSelect)="onChurch($event)" (viewAll)="showAllChurches()" />
          }
        </coms-central-panel>

        <coms-central-panel [title]="'central.insight.title' | translate">
          @if (insights.data(); as i) {
            <coms-insight-snapshot [items]="i.items" [currency]="i.context.currency" [lang]="lang()" [max]="3" (viewFull)="ui.insightsOpen.set(true)" />
          }
        </coms-central-panel>
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
      .pg {
        height: 100%;
        display: grid;
        grid-template-rows: 78px minmax(0, 1.2fr) minmax(0, 1fr);
        gap: 10px;
      }
      .pg__kpis {
        display: grid;
        grid-template-columns: repeat(6, minmax(0, 1fr));
        grid-template-rows: minmax(0, 1fr); /* a card never outgrows the row */
        gap: 10px;
      }
      .pg__main {
        display: grid;
        grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
        gap: 10px;
        min-height: 0;
      }
      .pg__bottom {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr) minmax(0, 0.9fr);
        gap: 10px;
        min-height: 0;
      }
    `,
  ],
})
export class CentralContributionsComponent extends CentralPageBase {
  private analytics = inject(CentralAnalyticsService);
  private loader = createLoader((q) => this.analytics.contributions(q));
  insights = createLoader((q) => this.analytics.insights(q));

  readonly data = this.loader.data;
  readonly error = this.loader.error;
  readonly placeholders = [1, 2, 3, 4, 5, 6];

  constructor() {
    super();
    this.publishContext(this.loader);
  }

  readonly money = (n: number, full = false): string => this.moneyFn(this.data()?.context.currency)(n, full);
  readonly moneyFull = (n: number): string => this.money(n, true);
  readonly growth = (changePct: number | null): string => formatChange(changePct);

  ranks = computed(() => this.rankItems(this.data()?.byChurch ?? [], (r) => this.money(r.value)));

  compositionItems = computed(() =>
    (this.data()?.composition ?? []).map((c) => ({
      key: c.key,
      label: c.key === 'other' ? this.t('central.con.unspecified') : namedLabel(c, this.lang(), this.t('central.con.unspecified')),
      value: c.value,
      display: this.money(c.value),
    }))
  );

  momentumRows = computed<MomentumRow[]>(() =>
    (this.data()?.byChurch ?? []).map((r) => ({
      id: r.id,
      name: this.name(r),
      current: this.money(r.value),
      previous: this.money(r.previous),
      change: formatChange(r.changePct),
      // Nothing received in either period is "no change", not "new".
      direction: r.value === 0 && r.previous === 0 ? 'flat' : trendDirection(r.changePct),
    }))
  );

  showAllChurches(): void {
    this.showAll(this.t('central.con.byChurch'), this.data()?.byChurch ?? [], (r) => this.money(r.value));
  }
}
