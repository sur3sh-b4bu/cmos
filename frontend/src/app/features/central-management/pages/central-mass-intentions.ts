import { Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { CentralAnalyticsService, createLoader } from '../central-analytics.service';
import { CentralPageBase } from '../central-page.base';
import { namedLabel } from '../central-format.util';
import { CentralPanelComponent } from '../components/central-panel';
import { DonutChartComponent } from '../components/donut-chart';
import { KpiCardComponent } from '../components/kpi-card';
import { ProgressSplitComponent } from '../components/progress-split';
import { RankBarsComponent } from '../components/rank-bars';
import { TrendChartComponent } from '../components/trend-chart';

/** Mass Intention intelligence: how many bookings, where, of what kind, and how many are paid. */
@Component({
  selector: 'coms-central-mass-intentions',
  standalone: true,
  imports: [TranslatePipe, KpiCardComponent, CentralPanelComponent, TrendChartComponent, RankBarsComponent, DonutChartComponent, ProgressSplitComponent],
  template: `
    <div class="pg" data-testid="page-mass-intentions">
      <div class="pg__kpis">
        @if (data(); as d) {
          <coms-kpi-card [label]="'central.mi.total' | translate" [value]="count(d.kpis.total.value)" [changePct]="d.kpis.total.changePct" [note]="'central.vsPreviousShort' | translate: { value: count(d.kpis.total.previous) }" />
          <coms-kpi-card [label]="'central.mi.paid' | translate" [value]="count(d.kpis.paid.value)" [note]="d.kpis.paid.ofTotalPct + '%'" />
          <coms-kpi-card [label]="'central.mi.unpaid' | translate" [value]="count(d.kpis.unpaid.value)" [note]="d.kpis.unpaid.ofTotalPct + '%'" />
          <coms-kpi-card [label]="'central.mi.avgPerChurch' | translate" [value]="decimal(d.kpis.avgPerChurch.value)" [changePct]="d.kpis.avgPerChurch.changePct" />
          <coms-kpi-card [label]="'central.mi.busiest' | translate" [value]="d.kpis.busiestChurch ? name(d.kpis.busiestChurch) : '–'" [textValue]="true" [note]="d.kpis.busiestChurch ? count(d.kpis.busiestChurch.value) : ''" />
        } @else {
          @for (i of placeholders; track i) {
            <coms-kpi-card [label]="'…'" [value]="error() ? '!' : '–'" />
          }
        }
      </div>

      <div class="pg__main">
        <coms-central-panel [title]="'central.mi.trend' | translate" [hint]="'central.mi.trendHint' | translate">
          @if (data(); as d) {
            <coms-trend-chart [points]="d.trend" [granularity]="d.context.period.granularity" [lang]="lang()" [format]="count" [ariaLabel]="'central.mi.trend' | translate" />
          }
        </coms-central-panel>
        <coms-central-panel [title]="'central.mi.byChurch' | translate" [hint]="'central.mi.byChurchHint' | translate">
          @if (data(); as d) {
            <coms-rank-bars [items]="ranks()" (itemSelect)="onChurch($event)" (viewAll)="showAllChurches()" />
          }
        </coms-central-panel>
      </div>

      <div class="pg__bottom">
        <coms-central-panel [title]="'central.mi.types' | translate" [hint]="'central.mi.typesHint' | translate">
          @if (data(); as d) {
            <coms-donut-chart [items]="typeItems()" [centerValue]="count(d.kpis.total.value)" [centerLabel]="'central.mi.centerLabel' | translate" [othersLabel]="'central.others' | translate" [ariaLabel]="'central.mi.types' | translate" />
          }
        </coms-central-panel>
        <coms-central-panel [title]="'central.mi.payment' | translate" [hint]="'central.mi.paymentHint' | translate">
          @if (data(); as d) {
            <div class="pg__pay">
              <coms-progress-split [parts]="paymentParts()" [ariaLabel]="'central.mi.payment' | translate" />
              <div class="pg__unpaid">
                <span class="pg__sub">{{ 'central.mi.unpaidByChurch' | translate }}</span>
                <coms-rank-bars [items]="unpaidRanks()" (itemSelect)="onChurch($event)" />
              </div>
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
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: 10px;
        min-height: 0;
      }
      .pg__pay {
        height: 100%;
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-height: 0;
      }
      .pg__unpaid {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
      }
      .pg__unpaid coms-rank-bars {
        flex: 1;
      }
      .pg__sub {
        font-size: 10.5px;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--coms-text-muted);
        margin-bottom: 2px;
      }
    `,
  ],
})
export class CentralMassIntentionsComponent extends CentralPageBase {
  private analytics = inject(CentralAnalyticsService);
  private loader = createLoader((q) => this.analytics.massIntentions(q));

  readonly data = this.loader.data;
  readonly error = this.loader.error;
  readonly placeholders = [1, 2, 3, 4, 5];

  constructor() {
    super();
    this.publishContext(this.loader);
  }

  ranks = computed(() => this.rankItems(this.data()?.byChurch ?? [], (r) => this.count(r.value)));

  unpaidRanks = computed(() =>
    (this.data()?.byChurch ?? [])
      .filter((r) => r.unpaid > 0)
      .sort((a, b) => b.unpaid - a.unpaid)
      .map((r) => ({ id: r.id, label: this.name(r), value: r.unpaid, display: this.count(r.unpaid), tooltip: `${this.name(r)} — ${r.unpaid}` }))
  );

  paymentParts = computed(() => {
    const k = this.data()?.kpis;
    return k
      ? [
          { key: 'paid', label: this.t('central.mi.paid'), value: k.paid.value, tone: 'good' as const },
          { key: 'unpaid', label: this.t('central.mi.unpaid'), value: k.unpaid.value, tone: 'warn' as const },
        ]
      : [];
  });

  typeItems = computed(() =>
    (this.data()?.types ?? []).map((ty) => ({
      key: ty.key,
      label: ty.key === 'custom' ? this.t('central.mi.customIntention') : ty.key === 'other' ? this.t('central.others') : namedLabel(ty, this.lang(), this.t('central.mi.customIntention')),
      value: ty.value,
      display: this.count(ty.value),
    }))
  );

  showAllChurches(): void {
    this.showAll(this.t('central.mi.byChurch'), this.data()?.byChurch ?? [], (r) => this.count(r.value));
  }
}
