import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  ViewChild,
  signal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

export interface BarChartPoint {
  label: string;
  value: number;
}

interface VerticalBarViewModel extends BarChartPoint {
  x: number;
  barWidth: number;
  barHeight: number;
  y: number;
  displayLabel: string;
  showLabel: boolean;
}

interface HorizontalBarViewModel extends BarChartPoint {
  y: number;
  rowHeight: number;
  barWidth: number;
  displayLabel: string;
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
const AVG_CHAR_WIDTH_PX = 6.4;
const LABEL_AREA_MIN = 70;

const MIN_ROW_HEIGHT = 28;
const MAX_ROW_HEIGHT = 48;

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
 */
@Component({
  selector: 'coms-bar-chart',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './bar-chart.html',
  styleUrl: './bar-chart.scss',
})
export class BarChartComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input({ required: true }) data: BarChartPoint[] = [];
  @Input() ariaLabel = 'Bar chart';
  @Input() valueFormatter: (value: number) => string = (v) => v.toLocaleString('en-IN');
  @Input() color = 'var(--coms-color-primary)';
  @Input() orientation: 'vertical' | 'horizontal' = 'vertical';
  @Input() showTableToggle = true;

  @ViewChild('hostEl', { static: true }) private hostEl!: ElementRef<HTMLDivElement>;

  viewBoxWidth = signal(600);
  totalHeight = signal(PLOT_HEIGHT + AXIS_HEIGHT + TOP_PADDING);
  labelAreaWidth = signal(0);

  verticalBars = signal<VerticalBarViewModel[]>([]);
  horizontalBars = signal<HorizontalBarViewModel[]>([]);
  gridlinesV = signal<{ y: number; label: string; x1: number; x2: number; labelX: number }[]>([]);
  gridlinesH = signal<{ x: number; label: string }[]>([]);
  tooltip = signal<TooltipState | null>(null);
  showTable = signal(true);

  private measuredWidth = signal(0);
  private resizeObserver?: ResizeObserver;

  constructor(private ngZone: NgZone, private cdr: ChangeDetectorRef) {}

  ngOnChanges(): void {
    this.recompute();
  }

  ngAfterViewInit(): void {
    const initialWidth = this.hostEl.nativeElement.getBoundingClientRect().width;
    if (initialWidth > 0) {
      this.measuredWidth.set(Math.floor(initialWidth));
      this.recompute();
      this.cdr.detectChanges();
    }

    this.resizeObserver = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width > 0 && Math.abs(width - this.measuredWidth()) > 1) {
        this.ngZone.run(() => {
          this.measuredWidth.set(Math.floor(width));
          this.recompute();
          this.cdr.markForCheck();
        });
      }
    });
    this.resizeObserver.observe(this.hostEl.nativeElement);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  private recompute(): void {
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

    const currentW = Math.max(this.measuredWidth() || 600, 320);
    this.viewBoxWidth.set(currentW);
    this.totalHeight.set(PLOT_HEIGHT + AXIS_HEIGHT + TOP_PADDING);

    const maxTickLabelLen = Math.max(...ticks.map((t) => this.valueFormatter(t).length), 1);
    const gutterLeft = Math.max(48, Math.min(85, maxTickLabelLen * 6.5 + 14));
    const plotRight = 10;
    const plotWidth = Math.max(100, currentW - gutterLeft - plotRight);
    const bandWidth = plotWidth / n;
    const barWidth = Math.max(4, Math.min(MAX_BAR_THICKNESS, bandWidth * 0.55));

    // Determine label formatting and density:
    // Full date like "01 Sept" needs ~45px.
    // Day number like "01" needs ~16px.
    const isShortDate = bandWidth < 50;
    const step = bandWidth < 22 ? Math.ceil(24 / bandWidth) : 1;

    this.verticalBars.set(
      this.data.map((point, i) => {
        const barHeight = niceMax === 0 ? 0 : (point.value / niceMax) * PLOT_HEIGHT;
        const centerX = gutterLeft + i * bandWidth + bandWidth / 2;

        let displayLabel = point.label;
        if (isShortDate) {
          const match = point.label.match(/^(\d{1,2})\s+[A-Za-z]+$/);
          if (match) {
            displayLabel = match[1];
          } else if (point.label.length > 4) {
            displayLabel = point.label.slice(0, 3);
          }
        }

        const showLabel = step === 1 || i % step === 0 || i === n - 1;

        return {
          ...point,
          x: centerX - barWidth / 2,
          barWidth,
          barHeight,
          y: TOP_PADDING + (PLOT_HEIGHT - barHeight),
          displayLabel,
          showLabel,
        };
      })
    );

    this.gridlinesV.set(
      ticks.map((tick) => ({
        y: TOP_PADDING + PLOT_HEIGHT * (1 - tick / niceMax),
        label: this.valueFormatter(tick),
        x1: gutterLeft,
        x2: currentW - plotRight,
        labelX: gutterLeft - 6,
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

    const currentW = Math.max(this.measuredWidth() || 600, 320);
    this.viewBoxWidth.set(currentW);

    // Label area allocation: between 100px and 42% of width (up to 240px)
    const maxAllowedLabelArea = Math.min(240, Math.max(100, Math.floor(currentW * 0.42)));
    const longestLabelPx = Math.max(...this.data.map((d) => d.label.length)) * 7.4;
    const calculatedLabelArea = Math.min(maxAllowedLabelArea, Math.max(110, longestLabelPx + 20));
    this.labelAreaWidth.set(calculatedLabelArea);

    const plotWidth = Math.max(60, currentW - calculatedLabelArea - 20);
    const rowHeight = Math.min(MAX_ROW_HEIGHT, Math.max(MIN_ROW_HEIGHT, PLOT_HEIGHT / n));
    const calcTotalH = n * rowHeight + AXIS_HEIGHT + TOP_PADDING;
    this.totalHeight.set(calcTotalH);

    // Max characters that can safely fit inside calculatedLabelArea without negative X
    const maxChars = Math.max(6, Math.floor((calculatedLabelArea - 16) / 7.5));

    this.horizontalBars.set(
      this.data.map((point, i) => {
        const barWidth = niceMax === 0 ? 0 : (point.value / niceMax) * plotWidth;
        const barPixelWidth = Math.max(barWidth, point.value > 0 ? 3 : 0);
        const fitsInside = barPixelWidth > 40;
        const displayLabel = point.label.length > maxChars ? point.label.slice(0, maxChars - 1) + '…' : point.label;
        return {
          ...point,
          y: TOP_PADDING + i * rowHeight + (rowHeight - MAX_BAR_THICKNESS) / 2,
          rowHeight,
          barWidth: barPixelWidth,
          displayLabel,
          valueLabelX: fitsInside ? calculatedLabelArea + barPixelWidth - 8 : calculatedLabelArea + barPixelWidth + 8,
          valueLabelAnchor: fitsInside ? 'end' : 'start',
        };
      })
    );

    this.gridlinesH.set(
      ticks.map((tick) => ({
        x: calculatedLabelArea + (niceMax === 0 ? 0 : (tick / niceMax) * plotWidth),
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
    const x = this.labelAreaWidth();
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

  showTooltip(point: BarChartPoint, event: Event): void {
    const target = event.currentTarget as SVGElement;
    const svg = target.ownerSVGElement;
    const rect = svg?.getBoundingClientRect();
    const scaleX = rect ? rect.width / this.viewBoxWidth() : 1;
    const scaleY = rect ? rect.height / this.totalHeight() : 1;
    const bar = this.orientation === 'horizontal' ? this.horizontalBars().find((b) => b.label === point.label) : undefined;
    const vbar = this.orientation === 'vertical' ? this.verticalBars().find((b) => b.label === point.label) : undefined;

    const leftVb = vbar ? (vbar.x + vbar.barWidth / 2) * scaleX : undefined;
    const leftHb = bar ? (this.labelAreaWidth() + bar.barWidth / 2) * scaleX : undefined;

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
