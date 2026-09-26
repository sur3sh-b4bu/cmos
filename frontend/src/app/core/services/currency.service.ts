import { Injectable, inject, signal } from '@angular/core';
import { MasterLookupService } from './master-lookup.service';

export interface DefaultCurrency {
  code: string;
  symbol: string;
  name: string;
}

const FALLBACK: DefaultCurrency = { code: 'INR', symbol: '₹', name: 'Indian Rupee' };

/**
 * The application's current default currency (Masters -> Currencies ->
 * Set Default). Loaded once and cached for the session -- an administrator
 * changing the default takes effect on next login/refresh, which is the
 * same "reflects on next fetch" contract every other master-driven value in
 * this app already follows (MasterLookupService itself never caches; this
 * service does, deliberately, so CurrencyInrPipe doesn't re-fetch on every
 * single formatted amount on a page).
 */
@Injectable({ providedIn: 'root' })
export class CurrencyService {
  private masterLookup = inject(MasterLookupService);

  /** INR fallback until the real value loads, so nothing renders blank. */
  current = signal<DefaultCurrency>(FALLBACK);
  private loaded = false;

  load(): void {
    if (this.loaded) return;
    this.loaded = true;
    this.masterLookup.list<DefaultCurrency & { is_default: 0 | 1 }>('currencies').subscribe({
      next: (rows) => {
        const def = rows.find((r) => r.is_default);
        if (def) this.current.set({ code: def.code, symbol: def.symbol, name: def.name });
      },
      error: () => {
        this.loaded = false; // allow a retry on next load() call (e.g. after login)
      },
    });
  }
}
