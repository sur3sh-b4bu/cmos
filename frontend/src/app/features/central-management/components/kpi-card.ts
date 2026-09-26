import { Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { formatChange, trendDirection } from '../central-format.util';
import { SparkLineComponent } from './spark-line';

/**
 * One headline number: label, value, how it moved against the previous period, and a tiny trend line.
 * `changePct` undefined means "no comparison applies" (no chip); null means "nothing to compare with" ("new").
 */
@Component({
  selector: 'coms-kpi-card',
  standalone: true,
  imports: [MatIconModule, MatTooltipModule, SparkLineComponent],
  template: `
    <div class="kpi" [matTooltip]="hover()" [matTooltipDisabled]="!hover()" matTooltipShowDelay="300">
      <span class="kpi__label">{{ label() }}</span>
      <span class="kpi__value" [class.kpi__value--text]="textValue()">{{ value() }}</span>
      <span class="kpi__foot">
        @if (showDelta()) {
          <span class="kpi__chip" [class]="'kpi__chip kpi__chip--' + direction()">
            <mat-icon>{{ icon() }}</mat-icon>{{ change() }}
          </span>
        }
        @if (note()) {
          <span class="kpi__note">{{ note() }}</span>
        }
      </span>
      @if (spark()?.length) {
        <span class="kpi__spark"><coms-spark-line [values]="spark()!" [label]="label()" /></span>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }
      .kpi {
        position: relative;
        height: 100%;
        display: flex;
        flex-direction: column;
        gap: 1px;
        padding: 9px 12px 8px;
        background: var(--coms-surface);
        border: 1px solid var(--coms-border);
        border-radius: 10px;
        box-shadow: var(--coms-shadow-sm);
        overflow: hidden;
        transition:
          box-shadow var(--coms-transition-fast),
          border-color var(--coms-transition-fast),
          transform var(--coms-transition-fast);
      }
      .kpi:hover {
        border-color: color-mix(in srgb, var(--coms-color-primary-light) 40%, var(--coms-border));
        box-shadow: var(--coms-shadow-md);
        transform: translateY(-1px);
      }
      .kpi__label {
        flex: none;
        line-height: 1.25;
        font-size: 10.5px;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--coms-text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .kpi__value {
        flex: none;
        font-size: 22px;
        font-weight: 700;
        line-height: 1.15;
        color: var(--coms-text);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        padding-right: 58px;
      }
      .kpi__value--text {
        font-size: 14.5px;
        line-height: 1.6;
      }
      .kpi__foot {
        flex: none;
        line-height: 16px;
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
        font-size: 11px;
        color: var(--coms-text-muted);
      }
      .kpi__note {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .kpi__chip {
        display: inline-flex;
        align-items: center;
        gap: 1px;
        padding: 0 5px 0 2px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 600;
        line-height: 16px;
        flex: none;
      }
      .kpi__chip mat-icon {
        width: 14px;
        height: 14px;
        font-size: 14px;
      }
      .kpi__chip--up {
        color: var(--coms-color-success);
        background: color-mix(in srgb, var(--coms-color-success) 12%, transparent);
      }
      .kpi__chip--down {
        color: var(--coms-color-danger);
        background: color-mix(in srgb, var(--coms-color-danger) 12%, transparent);
      }
      .kpi__chip--flat,
      .kpi__chip--new {
        color: var(--coms-text-muted);
        background: var(--coms-surface-alt);
      }
      .kpi__spark {
        position: absolute;
        right: 10px;
        top: 26px;
        width: 52px;
        height: 22px;
        opacity: 0.9;
      }
    `,
  ],
})
export class KpiCardComponent {
  label = input.required<string>();
  value = input.required<string>();
  /** A smaller, single-line style for a text value such as a church name. */
  textValue = input(false);
  tooltip = input('');
  note = input('');
  changePct = input<number | null | undefined>(undefined);
  spark = input<number[] | undefined>(undefined);

  /** What hovering shows: the explanation if there is one, else the full text of a name that had to be cut short. */
  hover = computed(() => this.tooltip() || (this.textValue() ? this.value() : ""));

  showDelta = computed(() => this.changePct() !== undefined);
  direction = computed(() => trendDirection(this.changePct() ?? null));
  change = computed(() => formatChange(this.changePct() ?? null));
  icon = computed(() => ({ up: 'arrow_upward', down: 'arrow_downward', flat: 'remove', new: 'fiber_new' })[this.direction()]);
}
