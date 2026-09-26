import { Pipe, PipeTransform, inject } from '@angular/core';
import { CurrencyService } from '../../core/services/currency.service';

/**
 * Formats a number using the application's current default currency symbol
 * (Masters -> Currencies -> Set Default; INR/₹ unless an administrator has
 * changed it -- see CurrencyService). Named `currencyInr` for historical
 * reasons (it was hardcoded to ₹ when first written); kept rather than
 * renamed across every template that already uses it.
 */
@Pipe({ name: 'currencyInr', standalone: true, pure: false })
export class CurrencyInrPipe implements PipeTransform {
  private currencyService = inject(CurrencyService);

  constructor() {
    this.currencyService.load();
  }

  /** decimals defaults to 2 (paise-accurate) for every existing caller --
   * receipts/registers/payment dialogs need that precision. Dashboard's
   * stat cards pass 0 for a cleaner at-a-glance whole-currency figure;
   * nothing else needs to. */
  transform(value: number | string | null | undefined, decimals = 2): string {
    const amount = Number(value ?? 0);
    const symbol = this.currencyService.current().symbol;
    return `${symbol}${amount.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
  }
}
