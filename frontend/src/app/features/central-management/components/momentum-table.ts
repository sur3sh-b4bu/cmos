import { Component, computed, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { observeSize } from './size';

export interface MomentumRow {
  id: number;
  name: string;
  current: string;
  previous: string;
  change: string;
  direction: 'up' | 'down' | 'flat' | 'new';
}

const ROW_HEIGHT = 25;
const HEAD_HEIGHT = 20;

const ICONS = { up: 'arrow_upward', down: 'arrow_downward', flat: 'remove', new: 'fiber_new' } as const;

/**
 * This period against the previous one, per church. Shows as many rows as fit the space it is given and turns the
 * rest into a "View all" link, so it never makes the screen scroll.
 */
@Component({
  selector: 'coms-momentum-table',
  standalone: true,
  imports: [MatIconModule, TranslatePipe],
  template: `
    <div class="mo" data-testid="momentum">
      <div class="mo__head">
        <span>{{ 'central.con.church' | translate }}</span>
        <span>{{ 'central.con.current' | translate }}</span>
        <span>{{ 'central.con.previous' | translate }}</span>
        <span>{{ 'central.con.change' | translate }}</span>
      </div>
      @for (r of visible(); track r.id) {
        <button type="button" class="mo__row" (click)="churchSelect.emit(r.id)">
          <span class="mo__name" [title]="r.name">{{ r.name }}</span>
          <span class="mo__num">{{ r.current }}</span>
          <span class="mo__num mo__num--muted">{{ r.previous }}</span>
          <span [class]="'mo__chg mo__chg--' + r.direction"><mat-icon>{{ icon(r.direction) }}</mat-icon>{{ r.change }}</span>
        </button>
      }
      @if (hidden() > 0) {
        <button type="button" class="mo__more" (click)="viewAll.emit()">{{ 'central.viewAll' | translate: { count: rows().length } }}</button>
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
      .mo {
        font-size: 12px;
      }
      .mo__head,
      .mo__row {
        display: grid;
        grid-template-columns: minmax(0, 1.4fr) 0.8fr 0.8fr 0.9fr;
        gap: 6px;
        align-items: center;
        height: ${ROW_HEIGHT}px;
        padding: 0 4px;
      }
      .mo__head {
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--coms-text-muted);
        border-bottom: 1px solid var(--coms-border);
        height: ${HEAD_HEIGHT}px;
      }
      .mo__head span:not(:first-child),
      .mo__num,
      .mo__chg {
        text-align: right;
        justify-content: flex-end;
      }
      .mo__row {
        width: 100%;
        border: 0;
        background: transparent;
        font: inherit;
        color: var(--coms-text);
        cursor: pointer;
        border-radius: 6px;
        transition: background-color var(--coms-transition-fast);
      }
      .mo__row:hover {
        background: var(--coms-surface-alt);
      }
      .mo__name {
        text-align: left;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-weight: 500;
      }
      .mo__num {
        font-variant-numeric: tabular-nums;
        font-weight: 600;
      }
      .mo__num--muted {
        font-weight: 400;
        color: var(--coms-text-muted);
      }
      .mo__chg {
        display: inline-flex;
        align-items: center;
        font-size: 11.5px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
      }
      .mo__chg mat-icon {
        width: 14px;
        height: 14px;
        font-size: 14px;
      }
      .mo__chg--up {
        color: var(--coms-color-success);
      }
      .mo__chg--down {
        color: var(--coms-color-danger);
      }
      .mo__chg--flat,
      .mo__chg--new {
        color: var(--coms-text-muted);
      }
      .mo__more {
        height: ${ROW_HEIGHT}px;
        border: 0;
        background: transparent;
        color: var(--coms-color-primary-light);
        font: inherit;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        padding: 0 4px;
      }
    `,
  ],
})
export class MomentumTableComponent {
  rows = input.required<MomentumRow[]>();
  churchSelect = output<number>();
  viewAll = output<void>();

  private size = observeSize();

  /** Rows that fit under the header; when some don't, one row of space goes to the "View all" link. */
  private capacity = computed(() => {
    const h = this.size().h;
    if (!h) return this.rows().length;
    const fit = Math.max(1, Math.floor((h - HEAD_HEIGHT) / ROW_HEIGHT));
    return this.rows().length > fit ? Math.max(1, fit - 1) : fit;
  });

  visible = computed(() => this.rows().slice(0, this.capacity()));
  hidden = computed(() => Math.max(0, this.rows().length - this.capacity()));

  icon(direction: MomentumRow['direction']): string {
    return ICONS[direction];
  }
}
