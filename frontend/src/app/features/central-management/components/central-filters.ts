import { Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../../../core/services/language.service';
import { CentralFilterService } from '../central-analytics.service';
import { CentralUiService } from '../central-ui.service';
import { churchLabel } from '../central-format.util';
import { Period } from '../central.models';

const PERIODS: Period[] = ['today', 'week', 'month', 'quarter', 'year', 'custom'];

/**
 * The one compact filter bar every Central Management screen shares: church, branch, period. "All churches / All
 * branches" is the default, so the screen starts as the organization-wide view.
 */
@Component({
  selector: 'coms-central-filters',
  standalone: true,
  imports: [MatIconModule, RouterLink, TranslatePipe],
  template: `
    <div class="cf" data-testid="central-filters">
      <label class="cf__field">
        <mat-icon>church</mat-icon>
        <select [value]="filters.churchId() ?? ''" (change)="onChurch($any($event.target).value)" [attr.aria-label]="'central.filters.church' | translate" data-testid="filter-church">
          <option value="">{{ 'central.filters.allChurches' | translate }}</option>
          @for (c of churchOptions(); track c.id) {
            <option [value]="c.id" [selected]="c.id === filters.churchId()">{{ c.label }}</option>
          }
        </select>
      </label>
      <label class="cf__field">
        <mat-icon>alt_route</mat-icon>
        <select [value]="filters.branchId() ?? ''" [disabled]="!filters.churchId()" (change)="onBranch($any($event.target).value)" [attr.aria-label]="'central.filters.branch' | translate" data-testid="filter-branch">
          <option value="">{{ 'central.filters.allBranches' | translate }}</option>
          @for (b of filters.branches(); track b.id) {
            <option [value]="b.id" [selected]="b.id === filters.branchId()">{{ b.name }}</option>
          }
        </select>
      </label>
      <label class="cf__field">
        <mat-icon>calendar_month</mat-icon>
        <select [value]="filters.preset()" (change)="onPeriod($any($event.target).value)" [attr.aria-label]="'central.filters.period' | translate" data-testid="filter-period">
          @for (p of periods; track p) {
            <option [value]="p" [selected]="p === filters.preset()">{{ 'central.period.' + p | translate }}</option>
          }
        </select>
      </label>
      @if (filters.preset() === 'custom') {
        <span class="cf__custom">
          <input type="date" [value]="filters.from()" [max]="filters.to() || null" (change)="onFrom($any($event.target).value)" [attr.aria-label]="'central.filters.from' | translate" />
          <span>–</span>
          <input type="date" [value]="filters.to()" [min]="filters.from() || null" (change)="onTo($any($event.target).value)" [attr.aria-label]="'central.filters.to' | translate" />
        </span>
      }
      <button type="button" class="cf__btn" (click)="ui.openCompare()" data-testid="compare-open">
        <mat-icon>compare_arrows</mat-icon>{{ 'central.compare.open' | translate }}
      </button>
      <a class="cf__btn cf__btn--ghost" routerLink="/settings/change-church-branch" [title]="'central.switchContextHint' | translate">
        <mat-icon>sync_alt</mat-icon>{{ 'central.switchContext' | translate }}
      </a>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }
      .cf {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }
      .cf__field {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        height: 30px;
        padding: 0 6px 0 8px;
        border: 1px solid var(--coms-border);
        border-radius: 8px;
        background: var(--coms-surface);
        color: var(--coms-text-muted);
        transition: border-color var(--coms-transition-fast);
      }
      .cf__field:hover,
      .cf__field:focus-within {
        border-color: var(--coms-color-primary-light);
      }
      .cf__field mat-icon {
        width: 16px;
        height: 16px;
        font-size: 16px;
      }
      select,
      input[type='date'] {
        border: 0;
        outline: 0;
        background: transparent;
        color: var(--coms-text);
        font: inherit;
        font-size: 12.5px;
        font-weight: 500;
        max-width: 168px;
        cursor: pointer;
      }
      select:disabled {
        color: var(--coms-text-muted);
        cursor: not-allowed;
      }
      .cf__custom {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        height: 30px;
        padding: 0 8px;
        border: 1px solid var(--coms-border);
        border-radius: 8px;
        background: var(--coms-surface);
        color: var(--coms-text-muted);
      }
      .cf__btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        height: 30px;
        padding: 0 10px 0 8px;
        border: 1px solid var(--coms-color-primary);
        border-radius: 8px;
        background: var(--coms-color-primary);
        color: #fff;
        font: inherit;
        font-size: 12.5px;
        font-weight: 600;
        text-decoration: none;
        cursor: pointer;
        transition:
          background-color var(--coms-transition-fast),
          box-shadow var(--coms-transition-fast);
      }
      .cf__btn:hover {
        background: var(--coms-color-primary-light);
        box-shadow: var(--coms-shadow-sm);
      }
      .cf__btn mat-icon {
        width: 16px;
        height: 16px;
        font-size: 16px;
      }
      .cf__btn--ghost {
        background: transparent;
        color: var(--coms-text);
        border-color: var(--coms-border);
      }
      .cf__btn--ghost:hover {
        background: var(--coms-surface-alt);
      }
    `,
  ],
})
export class CentralFiltersComponent implements OnInit {
  filters = inject(CentralFilterService);
  ui = inject(CentralUiService);
  private language = inject(LanguageService);

  readonly periods = PERIODS;

  churchOptions = computed(() => this.filters.churches().map((c) => ({ id: c.id, label: churchLabel({ name: c.name, nameTa: c.name_ta ?? null }, this.language.current()) })));

  ngOnInit(): void {
    this.filters.loadOptions();
  }

  onChurch(value: string): void {
    this.filters.setChurch(value ? Number(value) : null);
  }
  onBranch(value: string): void {
    this.filters.setBranch(value ? Number(value) : null);
  }
  onPeriod(value: string): void {
    // Choosing Custom starts from the range already on screen, so the figures do not jump while the dates are being picked.
    const shown = this.ui.context()?.period;
    if (value === "custom" && shown && !(this.filters.from() && this.filters.to())) {
      this.filters.setCustom(shown.from, shown.to);
      return;
    }
    this.filters.setPreset(value as Period);
  }
  onFrom(value: string): void {
    this.filters.setCustom(value, this.filters.to());
  }
  onTo(value: string): void {
    this.filters.setCustom(this.filters.from(), value);
  }
}
