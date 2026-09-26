import { Component, computed, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { AppLang } from '../../../core/i18n/translations';
import { CurrencyInfo, churchLabel, formatChange, formatCount, formatMoney, trendDirection } from '../central-format.util';
import { OverviewChurch } from '../central.models';
import { SparkLineComponent } from './spark-line';
import { observeSize } from './size';

const CARD_HEIGHT = 86;
const CARD_MAX_HEIGHT = 210;
const CARD_MIN_WIDTH = 196;
const GAP = 8;

/**
 * One compact card per church: activity level, its key numbers and a mini trend. It works out how many cards fit the
 * space it is given and turns the rest into a "View all" card, so the network view never scrolls however many churches exist.
 */
@Component({
  selector: 'coms-church-cards',
  standalone: true,
  imports: [MatIconModule, TranslatePipe, SparkLineComponent],
  template: `
    <div class="cc" [style.grid-template-columns]="'repeat(' + layout().cols + ', minmax(0, 1fr))'" [style.grid-auto-rows.px]="layout().rowHeight">
      @for (c of layout().shown; track c.id) {
        <button type="button" class="cc__card" [class]="'cc__card cc__card--' + c.level" (click)="churchSelect.emit(c.id)" [attr.data-testid]="'church-card-' + c.id">
          <span class="cc__top">
            <span class="cc__name" [title]="label(c)">{{ label(c) }}</span>
            <span class="cc__level" [class]="'cc__level cc__level--' + c.level">{{ 'central.level.' + c.level | translate }}</span>
          </span>
          <span class="cc__stats">
            <span [title]="'central.kpi.massIntentions' | translate"><mat-icon>volunteer_activism</mat-icon>{{ count(c.intentions.value) }}</span>
            <span [title]="'central.kpi.certificates' | translate"><mat-icon>description</mat-icon>{{ count(c.certificates.value) }}</span>
            <span [title]="money(c.contributions.value, true)"><mat-icon>redeem</mat-icon>{{ money(c.contributions.value) }}</span>
            <span class="cc__branches" [title]="'central.drawer.branchesTitle' | translate"><mat-icon>alt_route</mat-icon>{{ c.branches }}</span>
          </span>
          <span class="cc__foot">
            <span class="cc__spark"><coms-spark-line [values]="c.spark" [label]="label(c)" /></span>
            <span class="cc__chg" [class]="'cc__chg cc__chg--' + direction(c.activity.changePct)">{{ change(c.activity.changePct) }}</span>
          </span>
        </button>
      }
      @if (layout().hidden > 0) {
        <button type="button" class="cc__card cc__card--more" (click)="viewAll.emit()" data-testid="church-cards-view-all">
          <mat-icon>apps</mat-icon>
          <span>{{ 'central.viewAllChurches' | translate: { count: churches().length } }}</span>
        </button>
      }
    </div>
    @if (!churches().length) {
      <div class="cc__empty">{{ 'central.noData' | translate }}</div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
        min-height: 0;
        overflow: hidden;
      }
      .cc {
        display: grid;
        gap: ${GAP}px;
        align-content: start;
      }
      .cc__card {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 8px 10px 6px;
        border: 1px solid var(--coms-border);
        border-left: 3px solid var(--coms-border);
        border-radius: 9px;
        background: var(--coms-surface);
        color: var(--coms-text);
        font: inherit;
        text-align: left;
        cursor: pointer;
        min-width: 0;
        overflow: hidden;
        transition:
          box-shadow var(--coms-transition-fast),
          transform var(--coms-transition-fast),
          border-color var(--coms-transition-fast);
      }
      .cc__card:hover,
      .cc__card:focus-visible {
        box-shadow: var(--coms-shadow-md);
        transform: translateY(-1px);
        outline: none;
        border-color: color-mix(in srgb, var(--coms-color-primary-light) 45%, var(--coms-border));
      }
      .cc__card--high {
        border-left-color: var(--coms-color-success);
      }
      .cc__card--medium {
        border-left-color: var(--coms-color-gold);
      }
      .cc__card--low {
        border-left-color: var(--coms-color-warning);
      }
      .cc__top {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .cc__name {
        flex: 1;
        min-width: 0;
        font-size: 12.5px;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .cc__level {
        flex: none;
        padding: 0 6px;
        border-radius: 999px;
        font-size: 9.5px;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        line-height: 16px;
        background: var(--coms-surface-alt);
        color: var(--coms-text-muted);
      }
      .cc__level--high {
        background: color-mix(in srgb, var(--coms-color-success) 14%, transparent);
        color: var(--coms-color-success);
      }
      .cc__level--medium {
        background: color-mix(in srgb, var(--coms-color-gold) 16%, transparent);
        color: var(--coms-color-gold-dark);
      }
      .cc__level--low {
        background: color-mix(in srgb, var(--coms-color-warning) 18%, transparent);
        color: #9a6a06;
      }
      .cc__stats {
        display: flex;
        align-items: center;
        gap: 9px;
        font-size: 11.5px;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      .cc__stats span {
        display: inline-flex;
        align-items: center;
        gap: 2px;
      }
      .cc__stats mat-icon {
        width: 13px;
        height: 13px;
        font-size: 13px;
        color: var(--coms-text-muted);
      }
      .cc__branches {
        margin-left: auto;
        color: var(--coms-text-muted);
      }
      .cc__foot {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
        min-height: 0;
      }
      .cc__spark {
        flex: 1;
        height: 100%;
        min-height: 16px;
        max-height: 110px;
      }
      .cc__chg {
        flex: none;
        font-size: 11px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
      }
      .cc__chg--up {
        color: var(--coms-color-success);
      }
      .cc__chg--down {
        color: var(--coms-color-danger);
      }
      .cc__chg--flat,
      .cc__chg--new {
        color: var(--coms-text-muted);
      }
      .cc__card--more {
        align-items: center;
        justify-content: center;
        gap: 3px;
        border-style: dashed;
        border-left-width: 1px;
        color: var(--coms-color-primary-light);
        font-size: 12px;
        font-weight: 600;
        text-align: center;
      }
      .cc__empty {
        padding: 14px 4px;
        font-size: 12px;
        color: var(--coms-text-muted);
      }
    `,
  ],
})
export class ChurchCardsComponent {
  churches = input.required<OverviewChurch[]>();
  currency = input.required<CurrencyInfo>();
  lang = input<AppLang>('en');
  churchSelect = output<number>();
  viewAll = output<void>();

  private size = observeSize();

  layout = computed(() => {
    const { w, h } = this.size();
    const all = this.churches();
    const cols = Math.max(1, Math.floor((w + GAP) / (CARD_MIN_WIDTH + GAP)));
    const rows = Math.max(0, Math.floor((h + GAP) / (CARD_HEIGHT + GAP)));
    const capacity = cols * rows;
    const empty = { cols, shown: [] as OverviewChurch[], hidden: all.length, rowHeight: CARD_HEIGHT };
    if (!capacity) return empty;
    const shown = all.length <= capacity ? all : all.slice(0, capacity - 1);
    const hidden = all.length - shown.length;
    // Spare height is shared out between the rows the cards actually use, so a small network doesn't leave a hollow panel.
    const used = Math.max(1, Math.ceil((shown.length + (hidden ? 1 : 0)) / cols));
    const rowHeight = Math.min(CARD_MAX_HEIGHT, Math.max(CARD_HEIGHT, Math.floor((h - (used - 1) * GAP) / used)));
    return { cols, shown, hidden, rowHeight };
  });

  label = (c: OverviewChurch) => churchLabel(c, this.lang());
  count = (n: number) => formatCount(n, this.lang());
  money = (n: number, full = false) => formatMoney(n, this.currency(), this.lang(), full);
  readonly change = formatChange;
  readonly direction = trendDirection;
}
