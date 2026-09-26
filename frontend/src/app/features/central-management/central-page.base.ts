import { effect, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { AppLang } from '../../core/i18n/translations';
import { LanguageService } from '../../core/services/language.service';
import { Loader } from './central-analytics.service';
import { CentralUiService } from './central-ui.service';
import { CurrencyInfo, churchLabel, formatCount, formatDecimal, formatMoney } from './central-format.util';
import { ChurchRank, ChurchRef, Context, TrendPoint } from './central.models';
import { RankItem } from './components/rank-bars';

/**
 * What every Central Management screen needs: the language, number/money formatting, church names, and the two
 * "open a church" / "see the whole list" actions. Screens extend it so none of them repeats this.
 */
export abstract class CentralPageBase {
  protected language = inject(LanguageService);
  protected ui = inject(CentralUiService);
  protected translate = inject(TranslateService);

  protected lang = (): AppLang => this.language.current();
  readonly count = (n: number): string => formatCount(n, this.lang());
  readonly decimal = (n: number): string => formatDecimal(n, this.lang());
  readonly name = (ref: Pick<ChurchRef, 'name' | 'nameTa'> | null | undefined): string => churchLabel(ref, this.lang());
  readonly t = (key: string, params?: Record<string, unknown>): string => this.translate.instant(key, params);

  /** Money in the network's currency: compact by default, exact for a tooltip. */
  readonly moneyFn = (currency: CurrencyInfo | undefined) => (n: number, full = false): string => formatMoney(n, currency ?? { code: 'INR', symbol: '₹' }, this.lang(), full);

  /** Tells the header which period this screen is showing, once its data has arrived. */
  protected publishContext<T extends { context: Context }>(loader: Loader<T>): void {
    effect(() => {
      const data = loader.data();
      if (data) this.ui.context.set(data.context);
    });
  }

  /** Church rows -> bars, longest first (the server already orders them). */
  protected rankItems(rows: ChurchRank[], display: (r: ChurchRank) => string, withChange = true): RankItem[] {
    return rows.map((r) => ({
      id: r.id,
      label: this.name(r),
      value: r.value,
      display: display(r),
      changePct: withChange ? r.changePct : undefined,
      tooltip: `${this.name(r)} — ${display(r)}`,
    }));
  }

  onChurch(id: number | string): void {
    this.ui.openChurch(Number(id));
  }

  /** The complete ranking in a dialog, for a "View all" link. */
  protected showAll(title: string, rows: ChurchRank[], display: (r: ChurchRank) => string): void {
    this.ui.openRanking({
      title,
      rows: rows.map((r) => ({ id: r.id, churchId: r.id, label: this.name(r), display: display(r), changePct: r.changePct, share: r.share })),
    });
  }

  /** A trend line's values, paired with the period's bucket keys. */
  protected points(values: number[], buckets: string[]): TrendPoint[] {
    return buckets.map((key, i) => ({ key, value: values[i] ?? 0 }));
  }
}
