import { Component, EventEmitter, OnInit, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';

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
    MatNativeDateModule,
  ],
  templateUrl: './date-range-filter.html',
  styleUrl: './date-range-filter.scss',
})
export class DateRangeFilterComponent implements OnInit {
  @Output() rangeChange = new EventEmitter<DateRange>();

  presets: { key: PresetKey; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' },
    { key: 'year', label: 'This Year' },
  ];

  activePreset = signal<PresetKey>('month');
  customFrom: Date | null = null;
  customTo: Date | null = null;
  label = signal('This Month');

  ngOnInit(): void {
    this.applyPreset('month');
  }

  private toIso(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  applyPreset(preset: PresetKey): void {
    this.activePreset.set(preset);
    const now = new Date();
    let from: Date;
    let to: Date = now;

    switch (preset) {
      case 'today':
        from = now;
        this.label.set('Today');
        break;
      case 'week': {
        const day = now.getDay();
        from = new Date(now);
        from.setDate(now.getDate() - day);
        this.label.set('This Week');
        break;
      }
      case 'month':
        from = new Date(now.getFullYear(), now.getMonth(), 1);
        this.label.set('This Month');
        break;
      case 'year':
        from = new Date(now.getFullYear(), 0, 1);
        this.label.set('This Year');
        break;
      default:
        return; // custom handled separately via applyCustom()
    }

    this.rangeChange.emit({ from: this.toIso(from), to: this.toIso(to) });
  }

  applyCustom(): void {
    if (!this.customFrom || !this.customTo) return;
    this.activePreset.set('custom');
    this.label.set(`${this.toIso(this.customFrom)} to ${this.toIso(this.customTo)}`);
    this.rangeChange.emit({ from: this.toIso(this.customFrom), to: this.toIso(this.customTo) });
  }
}
