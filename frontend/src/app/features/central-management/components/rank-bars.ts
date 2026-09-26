import { Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { formatChange, trendDirection } from '../central-format.util';
import { observeSize } from './size';

export interface RankItem {
  id: number | string;
  label: string;
  value: number;
  /** The value as shown at the end of the bar ("₹1.24L", "248"). */
  display: string;
  /** Change against the previous period: undefined hides the chip, null shows "new". */
  changePct?: number | null;
  tooltip?: string;
}

const ROW_HEIGHT = 27;

/**
 * "Which church is highest?" -- a horizontal bar per church, longest first, so long names stay readable. It
 * shows as many rows as fit the space it is given and turns the rest into a "View all" link, so a network of
 * 5 churches or 50 never makes the screen scroll.
 */
@Component({
  selector: 'coms-rank-bars',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="rb">
      @for (item of visible(); track item.id) {
        <button type="button" class="rb__row" [title]="item.tooltip ?? item.label" (click)="itemSelect.emit(item.id)">
          <span class="rb__label">{{ item.label }}</span>
          <span class="rb__track"><span class="rb__bar" [style.width.%]="widthPct(item)"></span></span>
          <span class="rb__value">{{ item.display }}</span>
          @if (item.changePct !== undefined) {
            <span class="rb__chg" [class]="'rb__chg rb__chg--' + direction(item.changePct)">{{ change(item.changePct) }}</span>
          }
        </button>
      }
      @if (hiddenCount() > 0) {
        <button type="button" class="rb__more" (click)="viewAll.emit()">{{ 'central.viewAll' | translate: { count: items().length } }}</button>
      }
      @if (!items().length) {
        <div class="rb__empty">{{ 'central.noData' | translate }}</div>
      }
    </div>
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
      .rb {
        display: flex;
        flex-direction: column;
      }
      .rb__row {
        display: grid;
        grid-template-columns: minmax(70px, 34%) 1fr auto auto;
        align-items: center;
        gap: 8px;
        height: ${ROW_HEIGHT}px;
        padding: 0 4px;
        border: 0;
        border-radius: 6px;
        background: transparent;
        color: var(--coms-text);
        font: inherit;
        text-align: left;
        cursor: pointer;
        transition: background-color var(--coms-transition-fast);
      }
      .rb__row:hover,
      .rb__row:focus-visible {
        background: var(--coms-surface-alt);
        outline: none;
      }
      .rb__label {
        font-size: 12px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .rb__track {
        height: 8px;
        border-radius: 4px;
        background: var(--coms-surface-alt);
        overflow: hidden;
      }
      .rb__bar {
        display: block;
        height: 100%;
        min-width: 2px;
        border-radius: 4px;
        background: linear-gradient(90deg, var(--coms-color-primary-light), color-mix(in srgb, var(--coms-color-primary-light) 70%, #fff));
        transition: width var(--coms-transition-base);
      }
      .rb__row:first-child .rb__bar {
        background: linear-gradient(90deg, var(--coms-color-gold-dark), var(--coms-color-gold-light));
      }
      .rb__value {
        font-size: 12px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        min-width: 42px;
        text-align: right;
      }
      .rb__chg {
        font-size: 10.5px;
        font-weight: 600;
        min-width: 44px;
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
      .rb__chg--up {
        color: var(--coms-color-success);
      }
      .rb__chg--down {
        color: var(--coms-color-danger);
      }
      .rb__chg--flat,
      .rb__chg--new {
        color: var(--coms-text-muted);
      }
      .rb__more {
        height: ${ROW_HEIGHT}px;
        border: 0;
        background: transparent;
        color: var(--coms-color-primary-light);
        font: inherit;
        font-size: 12px;
        font-weight: 600;
        text-align: left;
        padding: 0 4px;
        cursor: pointer;
      }
      .rb__more:hover {
        text-decoration: underline;
      }
      .rb__empty {
        padding: 12px 4px;
        font-size: 12px;
        color: var(--coms-text-muted);
      }
    `,
  ],
})
export class RankBarsComponent {
  items = input.required<RankItem[]>();
  itemSelect = output<number | string>();
  viewAll = output<void>();

  private size = observeSize();

  /** How many rows the current height allows; when some must be hidden, the last slot becomes the "View all" link. */
  private capacity = computed(() => Math.max(1, Math.floor(this.size().h / ROW_HEIGHT)));

  visible = computed(() => {
    const all = this.items();
    const room = this.capacity();
    return all.length <= room ? all : all.slice(0, Math.max(1, room - 1));
  });

  hiddenCount = computed(() => this.items().length - this.visible().length);

  private max = computed(() => Math.max(...this.items().map((i) => i.value), 0));

  widthPct(item: RankItem): number {
    return this.max() > 0 ? Math.max(1, (item.value / this.max()) * 100) : 0;
  }

  change(changePct: number | null): string {
    return formatChange(changePct);
  }

  direction(changePct: number | null): string {
    return trendDirection(changePct);
  }
}
