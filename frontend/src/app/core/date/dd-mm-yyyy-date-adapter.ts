import { Injectable } from '@angular/core';
import { MatDateFormats, NativeDateAdapter } from '@angular/material/core';

/**
 * Forces every mat-datepicker in the app to display and accept DD-MM-YYYY,
 * regardless of the browser/OS locale.
 *
 * NativeDateAdapter.format() delegates to Intl.DateTimeFormat, which orders
 * day/month/year by LOCALE convention, not by the field order given in the
 * format object -- 'en-US' renders {day,month,year} as MM/DD/YYYY no matter
 * what, and no built-in Intl locale uses dashes for a numeric date. So the
 * only reliable way to get literal "04-08-2026" everywhere is to bypass Intl
 * for the date-input format and build the string by hand.
 */
@Injectable()
export class DdMmYyyyDateAdapter extends NativeDateAdapter {
  // Angular Material's own DateAdapter.format() declares this parameter as
  // `Object` (the boxed wrapper type, not the lowercase `object`) -- an
  // override's parameter type has to stay assignable to/from the base
  // method's, and `super.format()` below is called with it directly, so
  // this can't switch to `object`/`unknown` without breaking that call.
  // eslint-disable-next-line @typescript-eslint/no-wrapper-object-types
  override format(date: Date, displayFormat: Object): string {
    if (displayFormat === 'ddMMyyyy') {
      if (!this.isValid(date)) {
        throw Error('DdMmYyyyDateAdapter: Cannot format invalid date.');
      }
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    }
    // Month/year labels, a11y labels, etc. still go through the normal
    // locale-aware formatting -- only the literal date-input text is pinned.
    return super.format(date, displayFormat);
  }

  /**
   * Accepts what the field itself displays (DD-MM-YYYY) plus DD/MM/YYYY as a
   * forgiving fallback for anyone used to typing slashes. Anything else falls
   * through to the default parser (handles ISO strings, Date objects, etc.).
   */
  override parse(value: unknown): Date | null {
    if (typeof value === 'string') {
      const match = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(value.trim());
      if (match) {
        const [, day, month, year] = match;
        try {
          return this.createDate(Number(year), Number(month) - 1, Number(day));
        } catch {
          // createDate() throws for a day that does not exist (31-02-2020);
          // an invalid Date lets the input show its normal "invalid date" error.
          return this.invalid();
        }
      }
    }
    return super.parse(value);
  }
}

/** Only `display.dateInput` is special-cased above; everything else keeps
 * normal locale-aware Intl formatting (month names, accessibility labels). */
export const DD_MM_YYYY_FORMATS: MatDateFormats = {
  parse: {
    dateInput: 'ddMMyyyy',
  },
  display: {
    dateInput: 'ddMMyyyy',
    monthYearLabel: { year: 'numeric', month: 'short' },
    dateA11yLabel: { year: 'numeric', month: 'long', day: 'numeric' },
    monthYearA11yLabel: { year: 'numeric', month: 'long' },
  },
};
