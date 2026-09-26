import { Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * A weekday-by-time-of-day grid where a darker cell means more activity -- the busiest slots of the week at a
 * glance. Cells share the height they are given, so it never grows the screen.
 */
@Component({
  selector: 'coms-heat-grid',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="hg" [style.grid-template-columns]="'44px repeat(' + colLabels().length + ', minmax(0, 1fr))'" [style.grid-template-rows]="'auto repeat(' + rowLabels().length + ', minmax(0, 1fr))'">
      <span></span>
      @for (col of colLabels(); track col) {
        <span class="hg__col">{{ col }}</span>
      }
      @for (row of rowLabels(); track row; let r = $index) {
        <span class="hg__row">{{ row }}</span>
        @for (col of colLabels(); track col; let c = $index) {
          <span class="hg__cell" [style.--i]="intensity(matrix()[r][c])" [class.hg__cell--peak]="isPeak(matrix()[r][c])" [title]="row + ' · ' + col + ': ' + matrix()[r][c]">
            {{ matrix()[r][c] || '' }}
          </span>
        }
      }
      @if (max() === 0) {
        <div class="hg__none">{{ 'central.noData' | translate }}</div>
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
      .hg {
        position: relative;
        height: 100%;
        display: grid;
        gap: 3px;
      }
      .hg__col,
      .hg__row {
        font-size: 10.5px;
        color: var(--coms-text-muted);
        display: flex;
        align-items: center;
      }
      .hg__col {
        justify-content: center;
        padding-bottom: 1px;
      }
      .hg__cell {
        --i: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 0;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        background: color-mix(in srgb, var(--coms-color-primary-light) calc(var(--i) * 100%), var(--coms-surface-alt));
        color: color-mix(in srgb, #fff calc(var(--i) * 140%), var(--coms-text-muted));
        transition: transform var(--coms-transition-fast);
      }
      .hg__cell:hover {
        transform: scale(1.06);
      }
      .hg__cell--peak {
        box-shadow: inset 0 0 0 1.5px var(--coms-color-gold-light);
      }
      .hg__none {
        position: absolute;
        inset: 0;
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
export class HeatGridComponent {
  rowLabels = input.required<string[]>();
  colLabels = input.required<string[]>();
  /** matrix[row][column] */
  matrix = input.required<number[][]>();
  max = input.required<number>();

  intensity(value: number): number {
    const max = this.max();
    return max > 0 ? Math.round((value / max) * 100) / 100 : 0;
  }

  isPeak = (value: number): boolean => value > 0 && value === this.max();
}
