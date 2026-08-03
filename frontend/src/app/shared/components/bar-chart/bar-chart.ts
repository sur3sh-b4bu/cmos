import { Component, Input, OnChanges, signal } from '@angular/core';

export interface BarChartPoint {
  label: string;
  value: number;
}

interface BarViewModel extends BarChartPoint {
  x: number;
  barWidth: number;
  barHeight: number;
  y: number;
  labelX: number;
  labelY: number;
  labelTransform: string;
  labelAnchor: 'middle' | 'end';
}

interface TooltipState {
  left: number;
  label: string;
  value: string;
}

const PLOT_HEIGHT = 160;
const AXIS_HEIGHT = 22;
const ROTATED_AXIS_HEIGHT = 46;
const TOP_PADDING = 12;
const MAX_BAR_WIDTH = 24;
const BAR_RADIUS = 4;
const AVG_CHAR_WIDTH_PX = 5.6;

/**
 * Single-series bar chart. Deliberately hand-rolled in SVG (no charting
 * library) to stay a few KB, follow the design tokens exactly, and match
 * the mark spec: <=24px bars, 4px rounded top / square baseline, hairline
 * gridlines, per-bar hover+focus tooltip, values reachable without hover
 * via the table-view toggle.
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

  readonly plotHeight = PLOT_HEIGHT;
  axisHeight = AXIS_HEIGHT;
  totalHeight = PLOT_HEIGHT + AXIS_HEIGHT + TOP_PADDING;
  viewBoxWidth = 600;

  bars = signal<BarViewModel[]>([]);
  gridlines = signal<{ y: number; label: string }[]>([]);
  tooltip = signal<TooltipState | null>(null);
  showTable = signal(false);

  ngOnChanges(): void {
    this.recompute();
  }

  private niceMax(max: number): number {
    if (max <= 0) return 10;
    const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
    const normalized = max / magnitude;
    let niceNormalized: number;
    if (normalized <= 1) niceNormalized = 1;
    else if (normalized <= 2) niceNormalized = 2;
    else if (normalized <= 5) niceNormalized = 5;
    else niceNormalized = 10;
    return niceNormalized * magnitude;
  }

  private recompute(): void {
    const n = this.data.length;
    if (!n) {
      this.bars.set([]);
      this.gridlines.set([]);
      return;
    }
    const max = Math.max(...this.data.map((d) => d.value));
    const niceMax = this.niceMax(max);

    this.viewBoxWidth = Math.max(320, n * 70);
    const bandWidth = this.viewBoxWidth / n;
    const barWidth = Math.min(MAX_BAR_WIDTH, bandWidth * 0.5);

    // Rotate category labels whenever the longest one wouldn't fit its own
    // band un-rotated -- prevents the classic "labels overlap" failure
    // instead of only fixing it for today's specific dataset.
    const longestLabelPx = Math.max(...this.data.map((d) => d.label.length)) * AVG_CHAR_WIDTH_PX;
    const rotate = longestLabelPx > bandWidth * 0.95;
    this.axisHeight = rotate ? ROTATED_AXIS_HEIGHT : AXIS_HEIGHT;
    this.totalHeight = this.plotHeight + this.axisHeight + TOP_PADDING;

    this.bars.set(
      this.data.map((point, i) => {
        const barHeight = niceMax === 0 ? 0 : (point.value / niceMax) * this.plotHeight;
        const centerX = i * bandWidth + bandWidth / 2;
        return {
          ...point,
          x: centerX - barWidth / 2,
          barWidth,
          barHeight,
          y: TOP_PADDING + (this.plotHeight - barHeight),
          labelX: centerX,
          labelY: TOP_PADDING + this.plotHeight + (rotate ? 10 : 16),
          labelAnchor: rotate ? 'end' : 'middle',
          labelTransform: rotate
            ? `rotate(-35 ${centerX} ${TOP_PADDING + this.plotHeight + 10})`
            : '',
        };
      })
    );

    this.gridlines.set(
      [0, 0.5, 1].map((fraction) => ({
        y: TOP_PADDING + this.plotHeight * (1 - fraction),
        label: this.valueFormatter(Math.round(niceMax * fraction)),
      }))
    );
  }

  barTopPath(bar: BarViewModel): string {
    const r = Math.min(BAR_RADIUS, bar.barWidth / 2, Math.max(bar.barHeight, 0.01));
    const { x, y, barWidth: w, barHeight: h } = bar;
    if (h <= 0) return '';
    // Rounded top-left/top-right corners, square bottom -- a rect would
    // round all four; this path rounds only the two top corners.
    return `M ${x} ${y + h}
            L ${x} ${y + r}
            Q ${x} ${y} ${x + r} ${y}
            L ${x + w - r} ${y}
            Q ${x + w} ${y} ${x + w} ${y + r}
            L ${x + w} ${y + h}
            Z`;
  }

  showTooltip(bar: BarViewModel, event: Event): void {
    const target = event.currentTarget as SVGElement;
    const rect = target.ownerSVGElement?.getBoundingClientRect();
    const svgWidth = rect?.width ?? this.viewBoxWidth;
    const leftPercent = ((bar.x + bar.barWidth / 2) / this.viewBoxWidth) * 100;
    this.tooltip.set({
      left: (leftPercent / 100) * svgWidth,
      label: bar.label,
      value: this.valueFormatter(bar.value),
    });
  }

  hideTooltip(): void {
    this.tooltip.set(null);
  }

  toggleTable(): void {
    this.showTable.update((v) => !v);
  }
}
