import { Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { observeSize } from './size';

export interface ColumnItem {
  key: string;
  label: string;
  value: number;
}

/**
 * A small vertical bar chart for a short, fixed set of categories (age bands, the 12 months of the year).
 * Bars fill the height they are given; each shows its exact value in a tooltip.
 */
@Component({
  selector: 'coms-column-chart',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="cc" [class.cc--empty]="allZero()">
      @for (item of items(); track item.key) {
        <div class="cc__col" [title]="item.label + ': ' + item.value">
          <span class="cc__num">{{ item.value || '' }}</span>
          <span class="cc__barwrap"><span class="cc__bar" [style.height.%]="barPct(item)" [class.cc__bar--peak]="item.value > 0 && item.value === max()"></span></span>
          <span class="cc__label">{{ item.label }}</span>
        </div>
      }
      @if (allZero()) {
        <div class="cc__none">{{ 'central.noData' | translate }}</div>
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
      }
      .cc {
        position: relative;
        height: 100%;
        display: flex;
        align-items: stretch;
        gap: 4px;
      }
      .cc__col {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .cc__num {
        height: 14px;
        font-size: 10.5px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        color: var(--coms-text);
      }
      .cc__barwrap {
        flex: 1;
        min-height: 0;
        width: 100%;
        display: flex;
        align-items: flex-end;
        justify-content: center;
      }
      .cc__bar {
        display: block;
        width: min(70%, 26px);
        min-height: 2px;
        border-radius: 4px 4px 0 0;
        background: color-mix(in srgb, var(--coms-color-primary-light) 78%, #fff);
        transition: height var(--coms-transition-base);
      }
      .cc__bar--peak {
        background: linear-gradient(180deg, var(--coms-color-gold-light), var(--coms-color-gold-dark));
      }
      .cc__col:hover .cc__bar {
        background: var(--coms-color-primary-light);
      }
      .cc__label {
        height: 16px;
        line-height: 16px;
        font-size: 10.5px;
        color: var(--coms-text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
      }
      .cc--empty .cc__bar {
        opacity: 0.25;
      }
      .cc__none {
        position: absolute;
        inset: 0 0 16px 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        color: var(--coms-text-muted);
        pointer-events: none;
      }
    `,
  ],
})
export class ColumnChartComponent {
  items = input.required<ColumnItem[]>();
  private size = observeSize();

  max = computed(() => Math.max(...this.items().map((i) => i.value), 0));
  allZero = computed(() => this.max() === 0);

  barPct(item: ColumnItem): number {
    return this.max() > 0 ? (item.value / this.max()) * 100 : 0;
  }
}
