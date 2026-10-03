import { Component, EventEmitter, OnInit, Output, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { formatDateDMY } from '../../../core/utils/date-format.util';
import { DatepickerTodayHeaderComponent } from '../datepicker-today-header/datepicker-today-header';

export interface DateRange {
  from: string;
  to: string;
}

type PresetKey = 'today' | 'week' | 'month' | 'year' | 'custom';

@Component({
  selector: 'coms-date-range-filter',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatMenuModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    TranslatePipe,
  ],
  templateUrl: './date-range-filter.html',
  styleUrl: './date-range-filter.scss',
})
export class DateRangeFilterComponent implements OnInit {
  private translate = inject(TranslateService);

  /** calendarHeaderComponent needs a class reference, not a template var. */
  readonly todayHeader = DatepickerTodayHeaderComponent;

  /** Needed only to force-close the menu from applyCustom() -- the Apply
   * button sits inside .date-range-filter__custom, which stops click
   * propagation (see date-range-filter.html's comment) so the datepicker
   * inputs/toggles don't prematurely close the menu while picking a date.
   * That same stopPropagation() also swallows the Apply button's own
   * click before MatMenu ever sees it, so it never auto-closes on click
   * the way the preset buttons (plain mat-menu-item, outside that div) do
   * -- closeMenu() here is what actually closes it instead. */
  @ViewChild(MatMenuTrigger) private menuTrigger?: MatMenuTrigger;

  @Output() rangeChange = new EventEmitter<DateRange>();
  /** Same human-readable text the filter's own trigger button shows
   * ("This Month", "This Week", or a formatted custom range) -- lets a
   * consumer label whatever it's displaying with the exact period picked
   * (see dashboard.ts's period-scoped stat cards) instead of re-deriving
   * the same preset-name logic a second time. */
  @Output() labelChange = new EventEmitter<string>();

  presets: { key: PresetKey; labelKey: string }[] = [
    { key: 'today', labelKey: 'dateRange.today' },
    { key: 'week', labelKey: 'dateRange.thisWeek' },
    { key: 'month', labelKey: 'dateRange.thisMonth' },
    { key: 'year', labelKey: 'dateRange.thisYear' },
  ];

  activePreset = signal<PresetKey>('month');
  customFrom: Date | null = null;
  customTo: Date | null = null;
  label = signal('');

  ngOnInit(): void {
    this.applyPreset('month');
    this.translate.onLangChange.subscribe(() => {
      if (this.activePreset() === 'custom') {
        this.applyCustom();
      } else {
        this.applyPreset(this.activePreset());
      }
    });
  }

  private toIso(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private setLabel(text: string): void {
    this.label.set(text);
    this.labelChange.emit(text);
  }

  applyPreset(preset: PresetKey): void {
    this.activePreset.set(preset);
    const now = new Date();
    let from: Date;
    // Every preset except 'today' covers its FULL period (e.g. the whole
    // month, 1st to last day) rather than stopping at today -- this is a
    // Mass Intentions/Contributions *booking* report as much as a collections
    // one, and bookings are routinely made for future dates within the
    // same period (a Mass booked for the 27th shouldn't disappear from
    // "This Month" just because today is only the 10th). Collections/
    // Contributions naturally have nothing to show for days that haven't
    // happened yet regardless, so widening `to` here is harmless there.
    let to: Date = now;

    switch (preset) {
      case 'today':
        from = now;
        this.setLabel(this.translate.instant('dateRange.today'));
        break;
      case 'week': {
        const day = now.getDay();
        from = new Date(now);
        from.setDate(now.getDate() - day);
        to = new Date(from);
        to.setDate(from.getDate() + 6);
        this.setLabel(this.translate.instant('dateRange.thisWeek'));
        break;
      }
      case 'month':
        from = new Date(now.getFullYear(), now.getMonth(), 1);
        to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        this.setLabel(this.translate.instant('dateRange.thisMonth'));
        break;
      case 'year':
        from = new Date(now.getFullYear(), 0, 1);
        to = new Date(now.getFullYear(), 11, 31);
        this.setLabel(this.translate.instant('dateRange.thisYear'));
        break;
      default:
        return; // custom handled separately via applyCustom()
    }

    this.rangeChange.emit({ from: this.toIso(from), to: this.toIso(to) });
  }

  applyCustom(): void {
    if (!this.customFrom || !this.customTo) return;
    if (this.customFrom > this.customTo) {
      const temp = this.customFrom;
      this.customFrom = this.customTo;
      this.customTo = temp;
    }
    this.activePreset.set('custom');
    const from = this.translate.instant('common.from').toLowerCase();
    const to = this.translate.instant('common.to').toLowerCase();
    this.setLabel(`${from} ${formatDateDMY(this.customFrom)} ${to} ${formatDateDMY(this.customTo)}`);
    this.rangeChange.emit({ from: this.toIso(this.customFrom), to: this.toIso(this.customTo) });
    this.menuTrigger?.closeMenu();
  }
}
