import { Component, computed, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { AppLang } from '../../../core/i18n/translations';
import { CurrencyInfo, churchLabel, formatCount, formatMoney } from '../central-format.util';
import { ChurchRef, Insight, InsightTone } from '../central.models';

const ICONS: Record<InsightTone, string> = {
  up: 'trending_up',
  down: 'trending_down',
  flat: 'trending_flat',
  new: 'fiber_new',
  attention: 'warning',
};

/** The insight kinds whose wording depends on the direction of the change; the others read the same either way. */
const TONED = new Set(['contributions', 'intentions', 'register']);

interface Line {
  key: string;
  tone: InsightTone;
  icon: string;
  textKey: string;
  params: Record<string, string>;
}

/**
 * "What changed?" in plain sentences. Every sentence is built from a number the server calculated from real records
 * (see backend centralService.getInsights) -- nothing here is written by hand or guessed.
 */
@Component({
  selector: 'coms-insight-snapshot',
  standalone: true,
  imports: [MatIconModule, TranslatePipe],
  template: `
    <ul class="ins" data-testid="insight-snapshot">
      @for (line of lines(); track line.key) {
        <li class="ins__line" [class]="'ins__line ins__line--' + line.tone">
          <mat-icon>{{ line.icon }}</mat-icon>
          <span>{{ line.textKey | translate: line.params }}</span>
        </li>
      } @empty {
        <li class="ins__empty">{{ 'central.insight.none' | translate }}</li>
      }
    </ul>
    @if (showMore() && total() > lines().length) {
      <button type="button" class="ins__more" (click)="viewFull.emit()">{{ 'central.insight.viewFull' | translate }}</button>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .ins {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 5px;
      }
      .ins__line {
        display: grid;
        grid-template-columns: 18px 1fr;
        gap: 7px;
        align-items: start;
        font-size: 12px;
        line-height: 1.4;
        color: var(--coms-text);
      }
      .ins__line mat-icon {
        width: 18px;
        height: 18px;
        font-size: 18px;
      }
      .ins__line--up mat-icon {
        color: var(--coms-color-success);
      }
      .ins__line--down mat-icon {
        color: var(--coms-color-danger);
      }
      .ins__line--flat mat-icon {
        color: var(--coms-text-muted);
      }
      .ins__line--new mat-icon {
        color: var(--coms-color-info);
      }
      .ins__line--attention mat-icon {
        color: var(--coms-color-warning);
      }
      .ins__empty {
        font-size: 12px;
        color: var(--coms-text-muted);
      }
      .ins__more {
        margin-top: 6px;
        padding: 0;
        border: 0;
        background: transparent;
        color: var(--coms-color-primary-light);
        font: inherit;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
      }
      .ins__more:hover {
        text-decoration: underline;
      }
    `,
  ],
})
export class InsightSnapshotComponent {
  items = input.required<Insight[]>();
  currency = input.required<CurrencyInfo>();
  lang = input<AppLang>('en');
  /** How many sentences to show; the rest are behind "View full insight". */
  max = input(4);
  showMore = input(true);
  viewFull = output<void>();

  total = computed(() => this.items().length);

  lines = computed<Line[]>(() =>
    this.items()
      .slice(0, this.max())
      .map((item) => this.toLine(item))
  );

  private toLine(item: Insight): Line {
    const p = item.params as Record<string, unknown>;
    const lang = this.lang();
    const money = (n: unknown) => formatMoney(Number(n), this.currency(), lang);
    const church = (c: unknown) => churchLabel(c as ChurchRef, lang);
    const abs = (n: unknown) => String(Math.abs(Number(n)));
    const params: Record<string, string> = {};

    if (item.key === 'contributions') Object.assign(params, { pct: abs(p['changePct']), amount: money(p['amount']), previous: money(p['previous']) });
    if (item.key === 'intentions') Object.assign(params, { pct: abs(p['changePct']), value: formatCount(Number(p['value']), lang), previous: formatCount(Number(p['previous']), lang) });
    if (item.key === 'certificatesTop') Object.assign(params, { church: church(p['church']), count: formatCount(Number(p['count']), lang) });
    if (item.key === 'register') Object.assign(params, { pct: String(p['activeDaysPct']), previous: String(p['previousPct']), points: abs(p['points']) });
    if (item.key === 'contributionShare') Object.assign(params, { church: church(p['church']), share: String(p['sharePct']) });
    if (item.key === 'inactive') {
      const names = (p['churches'] as ChurchRef[]).map((c) => church(c));
      Object.assign(params, { count: String(p['count']), names: names.join(', ') + (Number(p['count']) > names.length ? '…' : '') });
    }
    const variant = TONED.has(item.key) ? item.tone : 'default';
    return { key: item.key, tone: item.tone, icon: ICONS[item.tone], textKey: `central.insight.${item.key}.${variant}`, params };
  }
}
