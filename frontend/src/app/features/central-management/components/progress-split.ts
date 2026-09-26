import { Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

export interface SplitSegment {
  key: string;
  label: string;
  value: number;
  tone: 'good' | 'warn' | 'bad' | 'neutral';
}

/** "How much of the whole is each part?" -- one stacked bar with a legend, for status splits such as paid / unpaid. */
@Component({
  selector: 'coms-progress-split',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    @if (total() > 0) {
      <div class="ps" role="img" [attr.aria-label]="ariaLabel()">
        <div class="ps__bar">
          @for (s of segments(); track s.key) {
            @if (s.value > 0) {
            <span class="ps__seg" [class]="'ps__seg ps__seg--' + s.tone" [style.flex-grow]="s.value" [title]="s.label + ': ' + s.value + ' (' + s.pct + '%)'"></span>
            }
          }
        </div>
        <ul class="ps__legend">
          @for (s of segments(); track s.key) {
            <li>
              <span class="ps__dot" [class]="'ps__dot ps__seg--' + s.tone"></span>
              <span class="ps__label">{{ s.label }}</span>
              <strong>{{ s.value }}</strong>
              <span class="ps__pct">{{ s.pct }}%</span>
            </li>
          }
        </ul>
      </div>
    } @else {
      <div class="ps__empty">{{ 'central.noData' | translate }}</div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        min-height: 0;
      }
      .ps__bar {
        display: flex;
        gap: 2px;
        height: 12px;
        border-radius: 6px;
        overflow: hidden;
        background: var(--coms-surface-alt);
      }
      .ps__seg {
        flex-basis: 0;
        min-width: 3px;
        transition: flex-grow var(--coms-transition-base);
      }
      .ps__seg--good {
        background: var(--coms-color-success);
      }
      .ps__seg--warn {
        background: var(--coms-color-warning);
      }
      .ps__seg--bad {
        background: var(--coms-color-danger);
      }
      .ps__seg--neutral {
        background: var(--coms-color-primary-light);
      }
      .ps__legend {
        list-style: none;
        margin: 8px 0 0;
        padding: 0;
        display: grid;
        gap: 3px;
      }
      .ps__legend li {
        display: grid;
        grid-template-columns: 10px 1fr auto 44px;
        align-items: center;
        gap: 7px;
        font-size: 12px;
      }
      .ps__dot {
        width: 9px;
        height: 9px;
        border-radius: 3px;
      }
      .ps__pct {
        text-align: right;
        color: var(--coms-text-muted);
        font-variant-numeric: tabular-nums;
      }
      .ps__empty {
        font-size: 12px;
        color: var(--coms-text-muted);
        padding: 6px 0;
      }
    `,
  ],
})
export class ProgressSplitComponent {
  parts = input.required<SplitSegment[]>();
  ariaLabel = input('');

  total = computed(() => this.parts().reduce((t, p) => t + p.value, 0));
  segments = computed(() => {
    const total = this.total();
    return this.parts().map((p) => ({ ...p, pct: total > 0 ? Math.round((p.value / total) * 1000) / 10 : 0 }));
  });
}
