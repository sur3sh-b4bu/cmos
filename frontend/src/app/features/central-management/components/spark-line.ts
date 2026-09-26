import { Component, computed, input } from '@angular/core';

/**
 * A tiny trend line with no axes -- the "which way is this going" glance inside a KPI card or church card.
 * Drawn on a fixed 100x28 grid and stretched, so it needs no measuring.
 */
@Component({
  selector: 'coms-spark-line',
  standalone: true,
  template: `
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" role="img" [attr.aria-label]="label()">
      @if (line(); as d) {
        <path class="spark__area" [attr.d]="area()" />
        <path class="spark__line" [attr.d]="d" />
      } @else {
        <line class="spark__flat" x1="0" x2="100" y1="26" y2="26" />
      }
    </svg>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
        min-height: 0;
      }
      svg {
        width: 100%;
        height: 100%;
        display: block;
        overflow: visible;
      }
      .spark__line {
        fill: none;
        stroke: var(--spark-color, var(--coms-color-primary-light));
        stroke-width: 1.5;
        vector-effect: non-scaling-stroke;
        stroke-linejoin: round;
        stroke-linecap: round;
      }
      .spark__area {
        fill: var(--spark-color, var(--coms-color-primary-light));
        opacity: 0.12;
        stroke: none;
      }
      .spark__flat {
        stroke: var(--coms-border);
        stroke-width: 1;
        vector-effect: non-scaling-stroke;
      }
    `,
  ],
})
export class SparkLineComponent {
  values = input.required<number[]>();
  label = input('');

  private points = computed(() => {
    const v = this.values();
    if (v.length < 2 || v.every((n) => n === 0)) return null;
    const max = Math.max(...v);
    const min = Math.min(...v, 0);
    const range = max - min || 1;
    return v.map((n, i) => ({ x: (i / (v.length - 1)) * 100, y: 25 - ((n - min) / range) * 22 }));
  });

  line = computed(() => {
    const p = this.points();
    return p ? p.map((pt, i) => `${i ? 'L' : 'M'}${pt.x.toFixed(2)},${pt.y.toFixed(2)}`).join(' ') : null;
  });

  area = computed(() => {
    const p = this.points();
    const d = this.line();
    return p && d ? `${d} L100,28 L0,28 Z` : '';
  });
}
