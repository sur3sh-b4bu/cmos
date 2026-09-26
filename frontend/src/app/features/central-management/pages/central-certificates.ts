import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { CentralAnalyticsService, createLoader } from '../central-analytics.service';
import { CentralPageBase } from '../central-page.base';
import { monthShort } from '../central-format.util';
import { CertificateType } from '../central.models';
import { CentralPanelComponent } from '../components/central-panel';
import { ColumnChartComponent } from '../components/column-chart';
import { DonutChartComponent } from '../components/donut-chart';
import { KpiCardComponent } from '../components/kpi-card';
import { ProgressSplitComponent } from '../components/progress-split';
import { RankBarsComponent } from '../components/rank-bars';
import { TrendChartComponent } from '../components/trend-chart';

/**
 * Baptism, Marriage and Death activity across the network. Certificates have no processing status in the system, so the
 * "progress" shown is real: when each certificate was ENTERED relative to the event (within 30 days, or later).
 * Death analytics stay aggregated -- no individual-level information is shown here.
 */
@Component({
  selector: 'coms-central-certificates',
  standalone: true,
  imports: [TranslatePipe, KpiCardComponent, CentralPanelComponent, TrendChartComponent, RankBarsComponent, ColumnChartComponent, DonutChartComponent, ProgressSplitComponent],
  template: `
    <div class="pg" [attr.data-testid]="'page-certificates-' + type">
      <div class="pg__kpis">
        @if (data(); as d) {
          <coms-kpi-card [label]="'central.cert.inPeriod.' + type | translate" [value]="count(d.kpis.inPeriod.value)" [changePct]="d.kpis.inPeriod.changePct" [note]="'central.vsPreviousShort' | translate: { value: count(d.kpis.inPeriod.previous) }" />
          <coms-kpi-card [label]="'central.cert.yearToDate' | translate" [value]="count(d.kpis.yearToDate.value)" />
          <coms-kpi-card [label]="'central.cert.recorded' | translate" [value]="count(d.kpis.recorded.value)" [tooltip]="'central.cert.recordedHint' | translate" />
          <coms-kpi-card [label]="'central.cert.onTime' | translate" [value]="d.kpis.onTimePct.value + '%'" [changePct]="d.kpis.onTimePct.changePct" [tooltip]="'central.cert.onTimeHint' | translate" />
          <coms-kpi-card [label]="'central.cert.mostActive' | translate" [value]="d.kpis.mostActiveChurch ? name(d.kpis.mostActiveChurch) : '–'" [textValue]="true" [note]="d.kpis.mostActiveChurch ? count(d.kpis.mostActiveChurch.value) : ''" />
        } @else {
          @for (i of placeholders; track i) {
            <coms-kpi-card [label]="'…'" [value]="error() ? '!' : '–'" />
          }
        }
      </div>

      <div class="pg__main">
        <coms-central-panel [title]="'central.cert.trend.' + type | translate" [hint]="'central.cert.trendHint' | translate">
          @if (data(); as d) {
            <coms-trend-chart [points]="d.trend" [granularity]="d.context.period.granularity" [lang]="lang()" [format]="count" [ariaLabel]="'central.cert.trend.' + type | translate" />
          }
        </coms-central-panel>
        <coms-central-panel [title]="'central.cert.byChurch' | translate">
          @if (data(); as d) {
            <coms-rank-bars [items]="ranks()" (itemSelect)="onChurch($event)" (viewAll)="showAllChurches()" />
          }
        </coms-central-panel>
      </div>

      <div class="pg__bottom" [class.pg__bottom--three]="type === 'baptism'">
        <coms-central-panel [title]="firstTitle() | translate" [hint]="firstHint() | translate">
          @if (data(); as d) {
            <coms-column-chart [items]="firstItems()" />
          }
        </coms-central-panel>
        @if (type === 'baptism') {
          <coms-central-panel [title]="'central.cert.gender' | translate">
            @if (data(); as d) {
              <coms-donut-chart [items]="genderItems()" [centerValue]="count(d.kpis.inPeriod.value)" [centerLabel]="'central.cert.centerLabel' | translate" [othersLabel]="'central.others' | translate" [ariaLabel]="'central.cert.gender' | translate" />
            }
          </coms-central-panel>
        }
        <coms-central-panel [title]="'central.cert.timeliness' | translate" [hint]="'central.cert.timelinessHint' | translate">
          @if (data(); as d) {
            <div class="pg__time">
              <coms-progress-split [parts]="timeParts()" [ariaLabel]="'central.cert.timeliness' | translate" />
              <p class="pg__note">{{ 'central.cert.timelinessNote' | translate }}</p>
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
        grid-template-columns: repeat(5, minmax(0, 1fr));
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
        grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
        gap: 10px;
        min-height: 0;
      }
      .pg__bottom--three {
        grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1fr);
      }
      .pg__time {
        padding-top: 4px;
      }
      .pg__note {
        margin: 10px 0 0;
        font-size: 11.5px;
        line-height: 1.45;
        color: var(--coms-text-muted);
      }
    `,
  ],
})
export class CentralCertificatesComponent extends CentralPageBase {
  private analytics = inject(CentralAnalyticsService);
  readonly type: CertificateType = inject(ActivatedRoute).snapshot.data['type'];
  private loader = createLoader((q) => this.analytics.certificates(this.type, q));

  readonly data = this.loader.data;
  readonly error = this.loader.error;
  readonly placeholders = [1, 2, 3, 4, 5];

  constructor() {
    super();
    this.publishContext(this.loader);
  }

  ranks = computed(() => this.rankItems(this.data()?.byChurch ?? [], (r) => this.count(r.value)));

  /** The first distribution: age at baptism for baptisms, the months of the year for marriages and deaths. */
  firstTitle = () => (this.type === 'baptism' ? 'central.cert.ageBands' : 'central.cert.seasonality');
  firstHint = () => (this.type === 'baptism' ? 'central.cert.ageBandsHint' : 'central.cert.seasonalityHint');

  firstItems = computed(() => {
    const d = this.data();
    if (!d) return [];
    const dist = d.distributions[0];
    return dist.items.map((i) => ({
      key: i.key,
      value: i.value,
      label: dist.key === 'ageBands' ? this.t(`central.cert.band.${i.key}`) : monthShort(Number(i.key), this.lang()),
    }));
  });

  genderItems = computed(() => {
    const dist = this.data()?.distributions.find((x) => x.key === 'gender');
    return (dist?.items ?? []).map((i) => ({ key: i.key, label: i.key, value: i.value, display: this.count(i.value) }));
  });

  timeParts = computed(() => {
    const t = this.data()?.timeliness;
    return t
      ? [
          { key: 'onTime', label: this.t('central.cert.enteredOnTime'), value: t.onTime, tone: 'good' as const },
          { key: 'late', label: this.t('central.cert.enteredLater'), value: t.late, tone: 'warn' as const },
        ]
      : [];
  });

  showAllChurches(): void {
    this.showAll(this.t('central.cert.byChurch'), this.data()?.byChurch ?? [], (r) => this.count(r.value));
  }
}
