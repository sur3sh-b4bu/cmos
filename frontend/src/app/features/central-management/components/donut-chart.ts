import { Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { observeSize } from './size';

export interface DonutItem {
  key: string;
  label: string;
  value: number;
  /** The value as shown in the legend ("₹2.5L"); defaults to the plain number. */
  display?: string;
}

/** A restrained, navy-led palette with one gold accent -- distinct enough to tell 6 slices apart, calm enough to look professional. */
export const CHART_PALETTE = ['#1f4a9b', '#b08d2b', '#4f7fd6', '#2e7d32', '#8a6f22', '#7aa2e3', '#9fb3d9', '#64748b'];

const LEGEND_ROW = 21;

/**
 * "What is it made of?" -- a donut with its share legend beside it. Only used for a handful of parts, so it stays
 * readable; the legend shows as many rows as fit and rolls the remainder into a single "others" line.
 */
@Component({
  selector: 'coms-donut-chart',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="dn" [class.dn--stacked]="stacked()" [class.dn--tight]="tight()">
      @if (total() > 0) {
        <svg class="dn__svg" [attr.width]="diameter()" [attr.height]="diameter()" [attr.viewBox]="'0 0 100 100'" role="img" [attr.aria-label]="ariaLabel()">
          <circle class="dn__base" cx="50" cy="50" r="38" />
          @for (s of segments(); track s.key) {
            <circle class="dn__slice" cx="50" cy="50" r="38" [attr.stroke]="s.color" [attr.stroke-dasharray]="s.dash" [attr.stroke-dashoffset]="s.offset" transform="rotate(-90 50 50)">
              <title>{{ s.label }}: {{ s.display }} ({{ s.pct }}%)</title>
            </circle>
          }
          <text class="dn__total" x="50" y="49" text-anchor="middle">{{ centerValue() }}</text>
          <text class="dn__caption" x="50" y="61" text-anchor="middle">{{ centerLabel() }}</text>
        </svg>
        <ul class="dn__legend">
          @for (s of shown(); track s.key) {
            <li>
              <span class="dn__dot" [style.background]="s.color"></span>
              <span class="dn__name" [title]="s.label">{{ s.label }}</span>
              <span class="dn__val">{{ s.display }}</span>
              <span class="dn__pct">{{ s.pct }}%</span>
            </li>
          }
        </ul>
      } @else {
        <div class="dn__empty">{{ 'central.noData' | translate }}</div>
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
      .dn {
        height: 100%;
        display: flex;
        align-items: center;
        gap: 14px;
      }
      .dn--stacked {
        flex-direction: column;
        justify-content: center;
        gap: 6px;
      }
      .dn__svg {
        flex: none;
      }
      .dn__base {
        fill: none;
        stroke: var(--coms-surface-alt);
        stroke-width: 15;
      }
      .dn__slice {
        fill: none;
        stroke-width: 15;
        transition: stroke-width var(--coms-transition-fast);
      }
      .dn__slice:hover {
        stroke-width: 18;
      }
      .dn__total {
        font-size: 15px;
        font-weight: 700;
        fill: var(--coms-text);
      }
      .dn__caption {
        font-size: 7.5px;
        fill: var(--coms-text-muted);
      }
      .dn__legend {
        list-style: none;
        margin: 0;
        padding: 0;
        flex: 1;
        min-width: 0;
        width: 100%;
      }
      .dn__legend li {
        display: grid;
        grid-template-columns: 10px minmax(0, 1fr) auto 38px;
        align-items: center;
        gap: 7px;
        height: ${LEGEND_ROW}px;
        font-size: 12px;
      }
      /* Beside the donut there is little room for names, so the share column gives way to them. */
      .dn--tight .dn__pct {
        display: none;
      }
      .dn--tight .dn__legend li {
        grid-template-columns: 10px minmax(0, 1fr) auto;
      }
      .dn__dot {
        width: 9px;
        height: 9px;
        border-radius: 3px;
      }
      .dn__name {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .dn__val {
        font-weight: 600;
        font-variant-numeric: tabular-nums;
      }
      .dn__pct {
        color: var(--coms-text-muted);
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
      .dn__empty {
        width: 100%;
        text-align: center;
        font-size: 12px;
        color: var(--coms-text-muted);
      }
    `,
  ],
})
export class DonutChartComponent {
  items = input.required<DonutItem[]>();
  centerValue = input('');
  centerLabel = input('');
  ariaLabel = input('');
  /** What to call the parts that did not fit the legend. */
  othersLabel = input('Others');

  private size = observeSize();

  /** A narrow box puts the legend under the donut instead of beside it. */
  stacked = computed(() => this.size().w > 0 && this.size().w < 250);

  tight = computed(() => !this.stacked() && this.size().w > 0 && this.size().w < 420);

  diameter = computed(() => {
    const { w, h } = this.size();
    if (!w || !h) return 96;
    const legendRoom = this.stacked() ? Math.min(h * 0.4, 84) : 0;
    return Math.max(64, Math.min(150, h - legendRoom - 4, this.stacked() ? w : w * (this.tight() ? 0.4 : 0.45)));
  });

  total = computed(() => this.items().reduce((t, i) => t + i.value, 0));

  segments = computed(() => {
    const total = this.total();
    const circumference = 2 * Math.PI * 38;
    let offset = 0;
    return this.items()
      .filter((i) => i.value > 0)
      .map((item, index) => {
        const fraction = item.value / total;
        const seg = {
          key: item.key,
          label: item.label,
          display: item.display ?? String(item.value),
          color: CHART_PALETTE[index % CHART_PALETTE.length],
          pct: Math.round(fraction * 1000) / 10,
          dash: `${Math.max(0, fraction * circumference - 1).toFixed(2)} ${circumference.toFixed(2)}`,
          offset: (-offset).toFixed(2),
        };
        offset += fraction * circumference;
        return seg;
      });
  });

  /** Legend rows that fit; the rest are summed into one line so the total still reads 100%. */
  shown = computed(() => {
    const all = this.segments();
    const stackedRoom = this.stacked() ? Math.max(2, Math.floor((this.size().h * 0.4) / LEGEND_ROW)) : Math.floor(this.size().h / LEGEND_ROW);
    const room = Math.max(2, stackedRoom || all.length);
    if (all.length <= room) return all;
    const kept = all.slice(0, room - 1);
    const rest = all.slice(room - 1);
    const restPct = Math.round(rest.reduce((t, s) => t + s.pct, 0) * 10) / 10;
    return [...kept, { key: '__others', label: `${this.othersLabel()} (${rest.length})`, display: '', color: '#94a3b8', pct: restPct, dash: '', offset: '' }];
  });
}
