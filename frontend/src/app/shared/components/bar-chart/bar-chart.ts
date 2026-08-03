import { Component, Input, OnChanges, signal } from '@angular/core';

export interface BarChartPoint {
  label: string;
  value: number;
}

interface VerticalBarViewModel extends BarChartPoint {
  x: number;
  barWidth: number;
  barHeight: number;
  y: number;
}

interface HorizontalBarViewModel extends BarChartPoint {
  y: number;
  rowHeight: number;
  barWidth: number;
  valueLabelX: number;
  valueLabelAnchor: 'start' | 'end';
}

interface TooltipState {
  left: number;
  top?: number;
  label: string;
  value: string;
}

const PLOT_HEIGHT = 160;
const AXIS_HEIGHT = 22;
const TOP_PADDING = 12;
const MAX_BAR_THICKNESS = 24;
const BAR_RADIUS = 4;
const AVG_CHAR_WIDTH_PX = 5.6;
const LABEL_AREA_MAX = 150;
const LABEL_AREA_MIN = 60;
const ROW_HEIGHT = 34;

/** Produces round, human-friendly tick values (e.g. [0,1,2,3], not [0, 2.5, 5]) so gridline labels always match where the line is actually drawn. */
function niceTicks(maxValue: number, targetCount = 4): number[] {
  if (maxValue <= 0) return [0, 1];
  const rawStep = maxValue / targetCount;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;
  let step: number;
  if (normalized <= 1) step = 1;
  else if (normalized <= 2) step = 2;
  else if (normalized <= 5) step = 5;
  else step = 10;
  step *= magnitude;
  const niceMax = Math.ceil(maxValue / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= niceMax + step / 1000; v += step) {
    ticks.push(Math.round(v * 1000) / 1000);
  }
  return ticks;
}

/**
 * Single-series bar chart. Deliberately hand-rolled in SVG (no charting
 * library) to stay a few KB and follow our design tokens exactly.
 *
 * Vertical orientation suits short/ordered labels (dates). Horizontal suits
 * longer category names -- rotating labels on a vertical chart reads as
 * clutter and leaves the zero-value categories looking like floating,
 * disconnected text; a horizontal row-per-category layout keeps every
 * label flat and readable regardless of length or value.
 */
@Component({
  selector: 'coms-bar-chart',
  standalone: true,
  templateUrl: './bar-chart.html',
  styleUrl: './bar-chart.scss',
})
export class BarChartComponent implements OnChanges {
  @Input({ required: true }) data: BarChartPoint[] = [];
  @Input() ariaLabel = 'Bar chart';
  @Input() valueFormatter: (value: number) => string = (v) => v.toLocaleString('en-IN');
  @Input() color = 'var(--coms-color-primary)';
  @Input() orientation: 'vertical' | 'horizontal' = 'vertical';

  viewBoxWidth = 600;
  totalHeight = PLOT_HEIGHT + AXIS_HEIGHT + TOP_PADDING;
  labelAreaWidth = 0;

  verticalBars = signal<VerticalBarViewModel[]>([]);
  horizontalBars = signal<HorizontalBarViewModel[]>([]);
  gridlinesV = signal<{ y: number; label: string }[]>([]); // horizontal gridlines, for vertical bars
  gridlinesH = signal<{ x: number; label: string }[]>([]); // vertical gridlines, for horizontal bars
  tooltip = signal<TooltipState | null>(null);
  showTable = signal(false);

  ngOnChanges(): void {
    if (this.orientation === 'horizontal') this.recomputeHorizontal();
    else this.recomputeVertical();
  }

  private recomputeVertical(): void {
    const n = this.data.length;
    if (!n) {
      this.verticalBars.set([]);
      this.gridlinesV.set([]);
      return;
    }
    const max = Math.max(...this.data.map((d) => d.value));
    const ticks = niceTicks(max);
    const niceMax = ticks[ticks.length - 1];

    this.viewBoxWidth = Math.max(320, n * 70);
    this.totalHeight = PLOT_HEIGHT + AXIS_HEIGHT + TOP_PADDING;
    const bandWidth = this.viewBoxWidth / n;
    const barWidth = Math.min(MAX_BAR_THICKNESS, bandWidth * 0.5);

    this.verticalBars.set(
      this.data.map((point, i) => {
        const barHeight = niceMax === 0 ? 0 : (point.value / niceMax) * PLOT_HEIGHT;
        const centerX = i * bandWidth + bandWidth / 2;
        return {
          ...point,
          x: centerX - barWidth / 2,
          barWidth,
          barHeight,
          y: TOP_PADDING + (PLOT_HEIGHT - barHeight),
        };
      })
    );

    this.gridlinesV.set(
      ticks.map((tick) => ({
        y: TOP_PADDING + PLOT_HEIGHT * (1 - tick / niceMax),
        label: this.valueFormatter(tick),
      }))
    );
  }

  private recomputeHorizontal(): void {
    const n = this.data.length;
    if (!n) {
      this.horizontalBars.set([]);
      this.gridlinesH.set([]);
      return;
    }
    const max = Math.max(...this.data.map((d) => d.value));
    const ticks = niceTicks(max);
    const niceMax = ticks[ticks.length - 1];

    const longestLabelPx = Math.max(...this.data.map((d) => d.label.length)) * AVG_CHAR_WIDTH_PX;
    this.labelAreaWidth = Math.min(LABEL_AREA_MAX, Math.max(LABEL_AREA_MIN, longestLabelPx + 12));

    this.viewBoxWidth = 600;
    const plotWidth = this.viewBoxWidth - this.labelAreaWidth - 16;
    this.totalHeight = n * ROW_HEIGHT + AXIS_HEIGHT + TOP_PADDING;

    this.horizontalBars.set(
      this.data.map((point, i) => {
        const barWidth = niceMax === 0 ? 0 : (point.value / niceMax) * plotWidth;
        const barPixelWidth = Math.max(barWidth, point.value > 0 ? 3 : 0);
        const fitsInside = barPixelWidth > 40;
        return {
          ...point,
          y: TOP_PADDING + i * ROW_HEIGHT + (ROW_HEIGHT - MAX_BAR_THICKNESS) / 2,
          rowHeight: ROW_HEIGHT,
          barWidth: barPixelWidth,
          valueLabelX: fitsInside ? this.labelAreaWidth + barPixelWidth - 8 : this.labelAreaWidth + barPixelWidth + 8,
          valueLabelAnchor: fitsInside ? 'end' : 'start',
        };
      })
    );

    this.gridlinesH.set(
      ticks.map((tick) => ({
        x: this.labelAreaWidth + (niceMax === 0 ? 0 : (tick / niceMax) * plotWidth),
        label: this.valueFormatter(tick),
      }))
    );
  }

  barTopPath(bar: VerticalBarViewModel): string {
    const r = Math.min(BAR_RADIUS, bar.barWidth / 2, Math.max(bar.barHeight, 0.01));
    const { x, y, barWidth: w, barHeight: h } = bar;
    if (h <= 0) return '';
    return `M ${x} ${y + h}
            L ${x} ${y + r}
            Q ${x} ${y} ${x + r} ${y}
            L ${x + w - r} ${y}
            Q ${x + w} ${y} ${x + w} ${y + r}
            L ${x + w} ${y + h}
            Z`;
  }

  barRightPath(bar: HorizontalBarViewModel): string {
    const r = Math.min(BAR_RADIUS, MAX_BAR_THICKNESS / 2, Math.max(bar.barWidth, 0.01));
    const x = this.labelAreaWidth;
    const y = bar.y;
    const w = bar.barWidth;
    const h = MAX_BAR_THICKNESS;
    if (w <= 0) return '';
    // Square at the baseline (left edge, x=labelAreaWidth), rounded at the data-end (right).
    return `M ${x} ${y}
            L ${x + w - r} ${y}
            Q ${x + w} ${y} ${x + w} ${y + r}
            L ${x + w} ${y + h - r}
            Q ${x + w} ${y + h} ${x + w - r} ${y + h}
            L ${x} ${y + h}
            Z`;
  }

  showTooltip(point: BarChartPoint, event: Event, top?: number): void {
    const target = event.currentTarget as SVGElement;
    const svg = target.ownerSVGElement;
    const rect = svg?.getBoundingClientRect();
    const scaleX = rect ? rect.width / this.viewBoxWidth : 1;
    const scaleY = rect ? rect.height / this.totalHeight : 1;
    const bar = this.orientation === 'horizontal' ? this.horizontalBars().find((b) => b.label === point.label) : undefined;
    const vbar = this.orientation === 'vertical' ? this.verticalBars().find((b) => b.label === point.label) : undefined;

    const leftVb = vbar ? (vbar.x + vbar.barWidth / 2) * scaleX : undefined;
    const leftHb = bar ? (this.labelAreaWidth + bar.barWidth / 2) * scaleX : undefined;

    this.tooltip.set({
      left: leftVb ?? leftHb ?? 0,
      top: bar ? (bar.y + MAX_BAR_THICKNESS / 2) * scaleY : undefined,
      label: point.label,
      value: this.valueFormatter(point.value),
    });
  }

  hideTooltip(): void {
    this.tooltip.set(null);
  }

  toggleTable(): void {
    this.showTable.update((v) => !v);
  }
}
