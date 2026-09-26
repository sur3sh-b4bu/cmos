import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';
import { formatDateDMY } from '../../../core/utils/date-format.util';
import { DatepickerTodayHeaderComponent } from '../datepicker-today-header/datepicker-today-header';
import { FilterFieldDef, FilterSelectOption } from './filter-bar.model';

interface RangeValue {
  from: Date | null;
  to: Date | null;
}

/**
 * A row of independent, always-visible filter controls that combine via AND
 * -- unlike coms-data-table's own quick-search box (one free-text term OR'd
 * across a handful of columns), this lets a list be narrowed by several
 * *specific* fields at once (e.g. Priest AND Gender AND a date-of-baptism
 * range for Certificates), each set/cleared independently of the others.
 * Driven entirely by `fields` (see filter-bar.model.ts) so the same
 * component serves Certificates' baptism/marriage/death filter sets (or any
 * future list) without new component code -- only the caller's own config
 * changes (see certificate-config.ts's `filterFields`).
 */
@Component({
  selector: 'coms-filter-bar',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatMenuModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatTooltipModule,
    TranslatePipe,
  ],
  templateUrl: './filter-bar.html',
  styleUrl: './filter-bar.scss',
})
export class FilterBarComponent implements OnChanges {
  @Input({ required: true }) fields: FilterFieldDef[] = [];
  /** The combined AND-filters, flattened to exactly the query-param shape
   * the backend expects (see certificateRepository.js's
   * buildStructuredFilters): a 'select' field emits its raw value under its
   * own key; a 'dateRange' field emits `<key>From`/`<key>To`. Re-emitted
   * (with every currently-active filter, not just what changed) on every
   * change, so the caller can assign it straight into its own fetch()
   * params without tracking deltas itself. */
  @Output() filtersChange = new EventEmitter<Record<string, string>>();

  readonly todayHeader = DatepickerTodayHeaderComponent;

  selected = signal<Record<string, string>>({});
  ranges = signal<Record<string, RangeValue>>({});
  /** Per-field text typed into a 'select' field's own in-menu search box
   * (dateRange fields have no option list to search) -- keyed the same way
   * as `selected`/`ranges`, purely local UI state, never emitted. */
  menuSearch = signal<Record<string, string>>({});

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['fields']) return;
    const prevFields = changes['fields'].previousValue as FilterFieldDef[] | undefined;
    const prevKeys = prevFields?.map((f) => f.key).join('|');
    const nextKeys = this.fields.map((f) => f.key).join('|');
    // Only reset on an actual SHAPE change (switching certificate type swaps
    // out which fields even exist) -- not on every re-render of the same
    // fields once their `options` arrive asynchronously (masters lookup),
    // which would otherwise wipe out whatever the user had already picked.
    if (prevKeys !== undefined && prevKeys !== nextKeys) {
      this.selected.set({});
      this.ranges.set({});
      this.menuSearch.set({});
      this.emit();
    }
  }

  isActive(key: string): boolean {
    const range = this.ranges()[key];
    return !!this.selected()[key] || !!(range?.from || range?.to);
  }

  hasActive(): boolean {
    return this.fields.some((f) => this.isActive(f.key));
  }

  /** The bit shown after the field's own label on its trigger button (e.g.
   * "Priest: Fr. John") -- null while unset, so the template can fall back
   * to just the plain label. */
  activeValueText(field: FilterFieldDef): string | null {
    if (field.type === 'select') {
      const value = this.selected()[field.key];
      if (!value) return null;
      return field.options?.find((o) => String(o.value) === value)?.label ?? null;
    }
    const range = this.ranges()[field.key];
    if (!range?.from && !range?.to) return null;
    const from = range.from ? formatDateDMY(range.from) : '…';
    const to = range.to ? formatDateDMY(range.to) : '…';
    return `${from} - ${to}`;
  }

  /** `field.options` narrowed by that field's own in-menu search box --
   * case-insensitive substring match on the option's label. Empty search
   * (the common case: menu just opened) returns every option unfiltered. */
  filteredOptions(field: FilterFieldDef): FilterSelectOption[] {
    const options = field.options ?? [];
    const term = (this.menuSearch()[field.key] ?? '').trim().toLowerCase();
    if (!term) return options;
    return options.filter((o) => o.label.toLowerCase().includes(term));
  }

  setMenuSearch(key: string, value: string): void {
    this.menuSearch.update((current) => ({ ...current, [key]: value }));
  }

  /** Fired on the mat-menu's own (closed) -- clears that field's search text
   * so reopening the menu later starts from the full option list again,
   * rather than silently still being filtered by whatever was last typed. */
  clearMenuSearch(key: string): void {
    this.menuSearch.update((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  selectOption(key: string, value: string): void {
    this.selected.update((current) => {
      const next = { ...current };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
    this.emit();
  }

  rangeFrom(key: string): Date | null {
    return this.ranges()[key]?.from ?? null;
  }

  rangeTo(key: string): Date | null {
    return this.ranges()[key]?.to ?? null;
  }

  setRangeFrom(key: string, value: Date | null): void {
    this.ranges.update((current) => {
      const existingTo = current[key]?.to ?? null;
      return { ...current, [key]: { from: value, to: existingTo } };
    });
  }

  setRangeTo(key: string, value: Date | null): void {
    this.ranges.update((current) => {
      const existingFrom = current[key]?.from ?? null;
      return { ...current, [key]: { from: existingFrom, to: value } };
    });
  }

  /** Both ends of a range are live-bound as the user picks them
   * (setRangeFrom/setRangeTo above) -- this fires the actual emit once
   * they're done, ensuring from <= to so the backend query always produces
   * the expected matching rows. */
  applyRange(): void {
    this.ranges.update((current) => {
      const updated = { ...current };
      for (const key of Object.keys(updated)) {
        let { from, to } = updated[key] || {};
        if (from && to && from > to) {
          const temp = from;
          from = to;
          to = temp;
          updated[key] = { from, to };
        }
      }
      return updated;
    });
    this.emit();
  }

  clearOne(key: string): void {
    this.selected.update((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    this.ranges.update((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    this.emit();
  }

  clearAll(): void {
    this.selected.set({});
    this.ranges.set({});
    this.emit();
  }

  private toIso(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private emit(): void {
    const out: Record<string, string> = { ...this.selected() };
    for (const [key, range] of Object.entries(this.ranges())) {
      let from = range.from;
      let to = range.to;
      if (from && to && from > to) {
        const temp = from;
        from = to;
        to = temp;
      }
      if (from) out[`${key}From`] = this.toIso(from);
      if (to) out[`${key}To`] = this.toIso(to);
    }
    this.filtersChange.emit(out);
  }
}
