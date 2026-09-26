import { Component, ViewEncapsulation, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DateAdapter } from '@angular/material/core';
import { MatCalendarHeader, MatCalendarUserEvent } from '@angular/material/datepicker';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * Drop-in replacement for the default mat-datepicker calendar header that
 * adds a "Today" button below the month navigation, so any date field in the
 * app can jump straight to today without paging through months. Wire it up
 * per-picker:
 *
 *   readonly todayHeader = DatepickerTodayHeaderComponent;
 *   <mat-datepicker [calendarHeaderComponent]="todayHeader" />
 *
 * (Angular's calendarHeaderComponent input needs a class reference, not a
 * template variable, hence the field.)
 *
 * Extends MatCalendarHeader directly -- Angular Material's own documented
 * extension point for custom headers -- so the existing period-label and
 * prev/next controls keep their default markup, styling and behaviour
 * untouched; only the "Today" row is new. Rendered inside the datepicker's
 * CDK overlay (outside any component's view), so ViewEncapsulation.None is
 * required for its styles to actually apply there.
 */
@Component({
  selector: 'coms-datepicker-today-header',
  standalone: true,
  templateUrl: './datepicker-today-header.html',
  styleUrl: './datepicker-today-header.scss',
  encapsulation: ViewEncapsulation.None,
  imports: [MatButtonModule, MatIconModule, TranslatePipe],
})
export class DatepickerTodayHeaderComponent<D> extends MatCalendarHeader<D> {
  // No constructor of our own -- Angular generates this component's DI
  // factory straight from MatCalendarHeader's own decorated constructor
  // (intl, host calendar, date adapter/formats, change detector), so there's
  // nothing to forward manually.
  private dateAdapter = inject<DateAdapter<D>>(DateAdapter);

  /** Jumps the calendar to today's month and selects it, exactly as if the
   * user had clicked today's cell -- closes the picker like any other pick.
   *
   * `selectedChange` alone only updates the calendar's own displayed
   * selection; the surrounding popup (MatDatepickerContent) actually commits
   * the value into the field and closes in response to `_userSelection`
   * (verified against @angular/material's compiled source), so both need
   * to fire here. */
  goToToday(): void {
    const today = this.dateAdapter.today();
    this.calendar.activeDate = today;
    this.calendar.selectedChange.emit(today);
    const event: MatCalendarUserEvent<D | null> = { value: today, event: new Event('click') };
    this.calendar._userSelection.emit(event);
  }
}
