import { Component, computed, input, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { AppLang } from '../../../core/i18n/translations';
import { bucketLabel, niceTicks, thinIndices } from '../central-format.util';
import { Granularity, TrendPoint } from '../central.models';
import { observeSize } from './size';

const PAD_TOP = 8;
const PAD_BOTTOM = 20;
const PAD_RIGHT = 10;

/**
 * "How is this changing?" -- one line over time. Drawn at the element's real pixel size, so it fills whatever
 * height the screen gives it; hovering shows the exact value for that day/month.
 */
@Component({
  selector: 'coms-trend-chart',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="tc" (pointerleave)="hover.set(null)">
      @if (geometry(); as g) {
        <svg [attr.width]="g.w" [attr.height]="g.h" role="img" [attr.aria-label]="ariaLabel()" (pointermove)="onMove($event, g)">
          @for (t of g.ticks; track t.value) {
            <line class="tc__grid" [attr.x1]="g.padLeft" [attr.x2]="g.plotRight" [attr.y1]="t.y" [attr.y2]="t.y" />
            <text class="tc__ytick" [attr.x]="g.padLeft - 6" [attr.y]="t.y + 3.5" text-anchor="end">{{ t.label }}</text>
          }
          @if (g.points.length > 1) {
            <path class="tc__area" [attr.d]="g.area" />
            <path class="tc__line" [attr.d]="g.line" />
          } @else {
            <circle class="tc__dot tc__dot--solo" [attr.cx]="g.points[0].x" [attr.cy]="g.points[0].y" r="4" />
          }
          @for (i of g.labelIndices; track i) {
            <text class="tc__xtick" [attr.x]="g.points[i].x" [attr.y]="g.h - 5" [attr.text-anchor]="i === 0 && g.points.length > 1 ? 'start' : i === g.points.length - 1 && g.points.length > 1 ? 'end' : 'middle'">{{ g.points[i].label }}</text>
          }
          @if (hoverPoint(); as p) {
            <line class="tc__guide" [attr.x1]="p.x" [attr.x2]="p.x" [attr.y1]="g.plotTop" [attr.y2]="g.plotBottom" />
            <circle class="tc__dot" [attr.cx]="p.x" [attr.cy]="p.y" r="4" />
          }
        </svg>
        @if (allZero()) {
          <div class="tc__empty">{{ 'central.noData' | translate }}</div>
        }
        @if (hoverPoint(); as p) {
          <div class="tc__tip" [style.left.px]="tipLeft(p.x, g.w)" [style.top.px]="Math.max(0, p.y - 46)">
            <span class="tc__tip-label">{{ p.fullLabel }}</span>
            <strong>{{ p.display }}</strong>
          </div>
        }
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
      .tc {
        position: relative;
        width: 100%;
        height: 100%;
      }
      svg {
        display: block;
      }
      .tc__grid {
        stroke: var(--coms-border);
        stroke-width: 1;
        stroke-dasharray: 3 3;
      }
      .tc__ytick,
      .tc__xtick {
        font-size: 10.5px;
        fill: var(--coms-text-muted);
      }
      .tc__line {
        fill: none;
        stroke: var(--trend-color, var(--coms-color-primary-light));
        stroke-width: 2;
        stroke-linejoin: round;
        stroke-linecap: round;
      }
      .tc__area {
        fill: var(--trend-color, var(--coms-color-primary-light));
        opacity: 0.1;
      }
      .tc__guide {
        stroke: var(--coms-text-muted);
        stroke-width: 1;
        opacity: 0.5;
      }
      .tc__dot {
        fill: var(--coms-surface);
        stroke: var(--trend-color, var(--coms-color-primary-light));
        stroke-width: 2;
      }
      .tc__dot--solo {
        fill: var(--trend-color, var(--coms-color-primary-light));
      }
      .tc__empty {
        position: absolute;
        inset: 0 0 20px 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        color: var(--coms-text-muted);
        pointer-events: none;
      }
      .tc__tip {
        position: absolute;
        transform: translateX(-50%);
        display: flex;
        flex-direction: column;
        gap: 1px;
        padding: 4px 8px;
        border-radius: 6px;
        background: var(--coms-color-primary-dark);
        color: #fff;
        font-size: 11px;
        line-height: 1.25;
        white-space: nowrap;
        pointer-events: none;
        box-shadow: var(--coms-shadow-md);
        z-index: 2;
      }
      .tc__tip-label {
        opacity: 0.75;
      }
    `,
  ],
})
export class TrendChartComponent {
  readonly Math = Math;
  points = input.required<TrendPoint[]>();
  granularity = input<Granularity>('month');
  lang = input<AppLang>('en');
  /** Short text for an axis tick and tooltip, e.g. "₹1.2L". */
  format = input<(n: number) => string>((n) => String(Math.round(n)));
  /** The longer, exact text for the tooltip; defaults to `format`. */
  formatFull = input<((n: number) => string) | undefined>(undefined);
  ariaLabel = input('');

  hover = signal<number | null>(null);
  private size = observeSize();

  allZero = computed(() => this.points().every((p) => p.value === 0));

  geometry = computed(() => {
    const { w, h } = this.size();
    const pts = this.points();
    if (w < 80 || h < 60 || !pts.length) return null;
    const fmt = this.format();
    const fullFmt = this.formatFull() ?? fmt;
    const max = Math.max(...pts.map((p) => p.value), 0);
    const tickValues = niceTicks(max, h < 150 ? 3 : 4);
    const yMax = tickValues[tickValues.length - 1] || 1;
    const tickLabels = tickValues.map((v) => fmt(v));
    const padLeft = Math.max(28, Math.max(...tickLabels.map((t) => t.length)) * 6.2 + 12);
    const plotW = w - padLeft - PAD_RIGHT;
    const plotH = h - PAD_TOP - PAD_BOTTOM;
    const y = (v: number) => PAD_TOP + plotH * (1 - v / yMax);
    const gran = this.granularity();
    const lang = this.lang();
    const points = pts.map((p, i) => ({
      x: pts.length === 1 ? padLeft + plotW / 2 : padLeft + (i * plotW) / (pts.length - 1),
      y: y(p.value),
      label: bucketLabel(p.key, gran, lang),
      fullLabel: bucketLabel(p.key, gran, lang),
      display: fullFmt(p.value),
    }));
    const line = points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const base = PAD_TOP + plotH;
    return {
      w,
      h,
      padLeft,
      plotRight: padLeft + plotW,
      plotTop: PAD_TOP,
      plotBottom: PAD_TOP + plotH,
      plotW,
      points,
      line,
      area: `${line} L${points[points.length - 1].x.toFixed(1)},${base} L${points[0].x.toFixed(1)},${base} Z`,
      ticks: tickValues.map((value, i) => ({ value, label: tickLabels[i], y: y(value) })),
      labelIndices: thinIndices(points.length, Math.max(2, Math.floor(plotW / 58))),
    };
  });

  hoverPoint = computed(() => {
    const g = this.geometry();
    const i = this.hover();
    return g && i !== null && g.points[i] ? g.points[i] : null;
  });

  onMove(event: PointerEvent, g: { padLeft: number; plotW: number; points: unknown[] }): void {
    const box = (event.currentTarget as SVGElement).getBoundingClientRect();
    const x = event.clientX - box.left - g.padLeft;
    const n = g.points.length;
    const index = n === 1 ? 0 : Math.round((x / g.plotW) * (n - 1));
    this.hover.set(Math.max(0, Math.min(n - 1, index)));
  }

  /** Keeps the tooltip inside the chart near either edge. */
  tipLeft(x: number, width: number): number {
    return Math.max(50, Math.min(width - 50, x));
  }
}
