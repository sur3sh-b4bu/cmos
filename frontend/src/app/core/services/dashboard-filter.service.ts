import { Injectable, signal } from '@angular/core';
import { DateRange } from '../../shared/components/date-range-filter/date-range-filter';

/**
 * Bridges the Dashboard's date-range filter back to DashboardComponent.
 * For the Dashboard page ONLY, that filter lives up in the persistent
 * global header (beside "Search or jump to...", see header.html/
 * header.ts's isDashboardRoute) rather than inline on the page itself --
 * DashboardComponent has no other way to reach a sibling in the layout
 * shell, so both sides read/write this shared signal pair instead.
 */
@Injectable({ providedIn: 'root' })
export class DashboardFilterService {
  readonly range = signal<DateRange>({ from: '', to: '' });
  readonly label = signal('');

  setRange(range: DateRange): void {
    this.range.set(range);
  }

  setLabel(label: string): void {
    this.label.set(label);
  }
}
