import { Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { CentralAnalyticsService, createLoader } from '../central-analytics.service';
import { CentralPageBase } from '../central-page.base';
import { fullDate, weekdayShort } from '../central-format.util';
import { CentralPanelComponent } from '../components/central-panel';
import { HeatGridComponent } from '../components/heat-grid';
import { KpiCardComponent } from '../components/kpi-card';
import { ProgressSplitComponent } from '../components/progress-split';
import { RankBarsComponent } from '../components/rank-bars';
import { TrendChartComponent } from '../components/trend-chart';

/**
 * Prayer & Participation Overview. The register lists each day's Mass Intentions, so this measures REGISTRATIONS
 * (bookings made for a day) -- there is no attendance record in the system, and none is implied.
 */
@Component({
  selector: 'coms-central-register',
  standalone: true,
  imports: [TranslatePipe, KpiCardComponent, CentralPanelComponent, TrendChartComponent, RankBarsComponent, HeatGridComponent, ProgressSplitComponent],
  template: `
    <div class="pg" data-testid="page-register">
      <div class="pg__kpis">
        @if (data(); as d) {
          <coms-kpi-card [label]="'central.reg.registrations' | translate" [value]="count(d.kpis.registrations.value)" [changePct]="d.kpis.registrations.changePct" [note]="'central.vsPreviousShort' | translate: { value: count(d.kpis.registrations.previous) }" />
          <coms-kpi-card [label]="'central.reg.today' | translate" [value]="count(d.kpis.today.value)" [note]="day(d.kpis.today.date)" />
          <coms-kpi-card [label]="'central.reg.dailyAverage' | translate" [value]="decimal(d.kpis.dailyAverage.value)" [changePct]="d.kpis.dailyAverage.changePct" />
          <coms-kpi-card [label]="'central.reg.peakDay' | translate" [value]="d.kpis.peakDay ? day(d.kpis.peakDay.date) : '–'" [textValue]="true" [note]="d.kpis.peakDay ? d.kpis.peakDay.n + ' ' + ('central.reg.registrationsShort' | translate) : ''" />
          <coms-kpi-card [label]="'central.reg.mostActive' | translate" [value]="d.kpis.mostActiveChurch ? name(d.kpis.mostActiveChurch) : '–'" [textValue]="true" [note]="d.kpis.mostActiveChurch ? count(d.kpis.mostActiveChurch.value) : ''" />
          <coms-kpi-card [label]="'central.reg.consistency' | translate" [value]="d.kpis.activeDaysPct.value + '%'" [changePct]="d.kpis.activeDaysPct.changePct" [tooltip]="'central.reg.consistencyHint' | translate" />
        } @else {
          @for (i of placeholders; track i) {
            <coms-kpi-card [label]="'…'" [value]="error() ? '!' : '–'" />
          }
        }
      </div>

      <div class="pg__main">
        <coms-central-panel [title]="'central.reg.trend' | translate" [hint]="'central.reg.trendHint' | translate">
          @if (data(); as d) {
            <coms-trend-chart [points]="d.trend" [granularity]="d.context.period.granularity" [lang]="lang()" [format]="count" [ariaLabel]="'central.reg.trend' | translate" />
          }
        </coms-central-panel>
        <coms-central-panel [title]="'central.reg.byChurch' | translate" [hint]="'central.reg.byChurchHint' | translate">
          @if (data(); as d) {
            <coms-rank-bars [items]="ranks()" (itemSelect)="onChurch($event)" (viewAll)="showAllChurches()" />
          }
        </coms-central-panel>
      </div>

      <div class="pg__bottom">
        <coms-central-panel [title]="'central.reg.heat' | translate" [hint]="'central.reg.heatHint' | translate">
          @if (data(); as d) {
            <coms-heat-grid [rowLabels]="heatRows()" [colLabels]="heatCols()" [matrix]="heatMatrix()" [max]="d.heat.max" />
          }
        </coms-central-panel>
        <coms-central-panel [title]="'central.reg.days' | translate" [hint]="'central.reg.daysHint' | translate">
          @if (data(); as d) {
            <div class="pg__days">
              <coms-progress-split [parts]="dayParts()" [ariaLabel]="'central.reg.days' | translate" />
              <p class="pg__note">{{ 'central.reg.registrationNote' | translate }}</p>
            </div>
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
        grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
        gap: 10px;
        min-height: 0;
      }
      .pg__days {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding-top: 6px;
      }
      .pg__note {
        margin: 0;
        font-size: 11.5px;
        line-height: 1.45;
        color: var(--coms-text-muted);
      }
    `,
  ],
})
export class CentralRegisterComponent extends CentralPageBase {
  private analytics = inject(CentralAnalyticsService);
  private loader = createLoader((q) => this.analytics.register(q));

  readonly data = this.loader.data;
  readonly error = this.loader.error;
  readonly placeholders = [1, 2, 3, 4, 5, 6];

  constructor() {
    super();
    this.publishContext(this.loader);
  }

  day = (key: string) => fullDate(key, this.lang());
  ranks = computed(() => this.rankItems(this.data()?.byChurch ?? [], (r) => this.count(r.value)));

  heatRows = computed(() => (this.data()?.heat.rows ?? []).map((r) => weekdayShort(r.dow, this.lang())));
  heatCols = computed(() => (this.data()?.heat.slots ?? []).map((s) => this.t(`central.reg.slot.${s}`)));
  heatMatrix = computed(() => (this.data()?.heat.rows ?? []).map((r) => [r.morning, r.afternoon, r.evening]));

  /** Days in the period with at least one registration vs none. */
  dayParts = computed(() => {
    const d = this.data();
    if (!d) return [];
    const { active, total } = d.kpis.activeDays;
    return [
      { key: 'active', label: this.t('central.reg.activeDays'), value: active, tone: 'good' as const },
      { key: 'quiet', label: this.t('central.reg.quietDays'), value: Math.max(0, total - active), tone: 'neutral' as const },
    ];
  });

  showAllChurches(): void {
    this.showAll(this.t('central.reg.byChurch'), this.data()?.byChurch ?? [], (r) => this.count(r.value));
  }
}
