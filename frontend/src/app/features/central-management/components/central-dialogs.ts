import { Component, HostListener, computed, effect, inject, signal, untracked } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../../../core/services/language.service';
import { extractErrorMessage } from '../../../core/utils/http-error.util';
import { CentralAnalyticsService, CentralFilterService, createLoader } from '../central-analytics.service';
import { CentralUiService } from '../central-ui.service';
import { churchLabel, formatChange, formatCount, formatMoney, trendDirection } from '../central-format.util';
import { OverviewChurch, OverviewResponse } from '../central.models';
import { InsightSnapshotComponent } from './insight-snapshot';

/** Shared look for the centered dialogs: a dimmed backdrop and a compact white card that never grows past the screen. */
const DIALOG_STYLES = `
  .dlg__backdrop { position: fixed; inset: 0; z-index: 950; display: grid; place-items: center; background: rgba(4, 23, 61, 0.4); animation: dlg-fade 160ms ease; }
  @keyframes dlg-fade { from { opacity: 0; } }
  .dlg { width: min(640px, 94vw); max-height: min(560px, 88vh); display: flex; flex-direction: column; background: var(--coms-surface); border-radius: 12px; box-shadow: var(--coms-shadow-lg); overflow: hidden; animation: dlg-rise 200ms cubic-bezier(0.4, 0, 0.2, 1); }
  @keyframes dlg-rise { from { transform: translateY(8px); opacity: 0; } }
  .dlg__head { display: flex; align-items: center; gap: 8px; padding: 12px 14px 10px; border-bottom: 1px solid var(--coms-border); }
  .dlg__head h2 { flex: 1; margin: 0; font-size: 15px; font-weight: 700; color: var(--coms-text); }
  .dlg__close { border: 0; background: transparent; width: 28px; height: 28px; border-radius: 8px; cursor: pointer; color: var(--coms-text-muted); display: grid; place-items: center; }
  .dlg__close:hover { background: var(--coms-surface-alt); color: var(--coms-text); }
  .dlg__body { padding: 10px 14px 14px; overflow: auto; min-height: 0; }
`;

// ============================================================================ full ranking

/** The complete list behind a "View all" link: every church, not just the ones that fit the screen. */
@Component({
  selector: 'coms-ranking-dialog',
  standalone: true,
  imports: [MatIconModule, TranslatePipe],
  template: `
    @if (ui.ranking(); as r) {
      <div class="dlg__backdrop" role="presentation" (click)="backdropClick($event)" data-testid="ranking-dialog">
        <section class="dlg" role="dialog" aria-modal="true" [attr.aria-label]="r.title">
          <header class="dlg__head">
            <h2>{{ r.title }}</h2>
            <button type="button" class="dlg__close" (click)="close()" [attr.aria-label]="'central.close' | translate"><mat-icon>close</mat-icon></button>
          </header>
          <div class="dlg__body">
            <table class="rk">
              <tbody>
                @for (row of r.rows; track row.id; let i = $index) {
                  <tr (click)="open(row.churchId)" [class.rk__row--link]="row.churchId">
                    <td class="rk__n">{{ i + 1 }}</td>
                    <td class="rk__name">{{ row.label }}</td>
                    <td class="rk__val">{{ row.display }}</td>
                    <td class="rk__chg" [class]="'rk__chg rk__chg--' + direction(row.changePct)">{{ row.changePct === undefined ? '' : change(row.changePct) }}</td>
                    <td class="rk__share">{{ row.share === undefined ? '' : row.share + '%' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      </div>
    }
  `,
  styles: [
    DIALOG_STYLES +
      `
      .rk { width: 100%; border-collapse: collapse; font-size: 12.5px; }
      .rk td { padding: 6px 8px; border-top: 1px solid var(--coms-border); }
      .rk tr:first-child td { border-top: 0; }
      .rk__row--link { cursor: pointer; }
      .rk__row--link:hover { background: var(--coms-surface-alt); }
      .rk__n { width: 26px; color: var(--coms-text-muted); }
      .rk__name { font-weight: 500; }
      .rk__val, .rk__chg, .rk__share { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
      .rk__val { font-weight: 600; }
      .rk__chg--up { color: var(--coms-color-success); }
      .rk__chg--down { color: var(--coms-color-danger); }
      .rk__chg--flat, .rk__chg--new, .rk__share { color: var(--coms-text-muted); }
    `,
  ],
})
export class RankingDialogComponent {
  /** Only a click on the dimmed area itself closes the dialog, not one that started inside the card. */
  backdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.close();
  }

  ui = inject(CentralUiService);
  readonly change = formatChange;
  readonly direction = (c: number | null | undefined) => trendDirection(c ?? null);

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.ui.ranking()) this.close();
  }
  close(): void {
    this.ui.ranking.set(null);
  }
  open(churchId?: number): void {
    if (!churchId) return;
    this.close();
    this.ui.openChurch(churchId);
  }
}

// ============================================================================ compare churches

interface CompareMetric {
  key: string;
  label: string;
  a: number;
  b: number;
  format: (n: number) => string;
}

/** Two churches side by side on every measure the network view tracks, for the period currently selected. */
@Component({
  selector: 'coms-compare-dialog',
  standalone: true,
  imports: [MatIconModule, TranslatePipe],
  template: `
    @if (ui.compareOpen()) {
      <div class="dlg__backdrop" role="presentation" (click)="backdropClick($event)" data-testid="compare-dialog">
        <section class="dlg" role="dialog" aria-modal="true" [attr.aria-label]="'central.compare.title' | translate">
          <header class="dlg__head">
            <h2>{{ 'central.compare.title' | translate }}</h2>
            <button type="button" class="dlg__close" (click)="close()" [attr.aria-label]="'central.close' | translate"><mat-icon>close</mat-icon></button>
          </header>
          <div class="dlg__body">
            @if (churches().length >= 2) {
              <div class="cmp__pick">
                <select [value]="aId()" (change)="aId.set(+$any($event.target).value)" [attr.aria-label]="'central.compare.churchA' | translate" data-testid="compare-a">
                  @for (c of churches(); track c.id) {
                    <option [value]="c.id" [selected]="c.id === aId()">{{ label(c) }}</option>
                  }
                </select>
                <span class="cmp__vs">{{ 'central.compare.vs' | translate }}</span>
                <select [value]="bId()" (change)="bId.set(+$any($event.target).value)" [attr.aria-label]="'central.compare.churchB' | translate" data-testid="compare-b">
                  @for (c of churches(); track c.id) {
                    <option [value]="c.id" [selected]="c.id === bId()">{{ label(c) }}</option>
                  }
                </select>
              </div>
              <table class="cmp">
                <thead>
                  <tr>
                    <th>{{ 'central.compare.metric' | translate }}</th>
                    <th class="cmp__side">{{ nameA() }}</th>
                    <th class="cmp__bars"></th>
                    <th class="cmp__side">{{ nameB() }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (m of metrics(); track m.key) {
                    <tr [attr.data-testid]="'compare-row-' + m.key">
                      <td class="cmp__metric">{{ m.label }}</td>
                      <td class="cmp__num" [class.cmp__num--win]="m.a > m.b">{{ m.format(m.a) }}</td>
                      <td class="cmp__bars">
                        <span class="cmp__pair">
                          <span class="cmp__bar cmp__bar--a" [style.width.%]="pct(m.a, m)"></span>
                          <span class="cmp__bar cmp__bar--b" [style.width.%]="pct(m.b, m)"></span>
                        </span>
                      </td>
                      <td class="cmp__num" [class.cmp__num--win]="m.b > m.a">{{ m.format(m.b) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            } @else if (error()) {
              <p class="cmp__msg">{{ error() }}</p>
            } @else if (loading()) {
              <p class="cmp__msg">{{ 'central.loading' | translate }}</p>
            } @else {
              <p class="cmp__msg">{{ 'central.compare.needTwo' | translate }}</p>
            }
          </div>
        </section>
      </div>
    }
  `,
  styles: [
    DIALOG_STYLES +
      `
      .cmp__pick { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
      .cmp__pick select { flex: 1; min-width: 0; height: 32px; padding: 0 8px; border: 1px solid var(--coms-border); border-radius: 8px; background: var(--coms-surface); color: var(--coms-text); font: inherit; font-size: 13px; font-weight: 500; }
      .cmp__vs { font-size: 11px; font-weight: 700; color: var(--coms-text-muted); letter-spacing: 0.08em; text-transform: uppercase; }
      .cmp { width: 100%; border-collapse: collapse; font-size: 12.5px; }
      .cmp th { font-size: 11px; font-weight: 600; color: var(--coms-text-muted); text-align: left; padding: 4px 6px; }
      .cmp td { padding: 7px 6px; border-top: 1px solid var(--coms-border); }
      .cmp__side { text-align: right !important; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--coms-text) !important; font-weight: 600 !important; }
      .cmp__num { text-align: right; font-variant-numeric: tabular-nums; width: 96px; }
      .cmp__num--win { font-weight: 700; color: var(--coms-color-primary-light); }
      .cmp__bars { width: 32%; }
      .cmp__pair { display: flex; flex-direction: column; gap: 3px; }
      .cmp__bar { display: block; height: 6px; min-width: 2px; border-radius: 3px; transition: width var(--coms-transition-base); }
      .cmp__bar--a { background: var(--coms-color-primary-light); }
      .cmp__bar--b { background: var(--coms-color-gold); }
      .cmp__msg { margin: 18px 0; text-align: center; font-size: 13px; color: var(--coms-text-muted); }
    `,
  ],
})
export class CompareDialogComponent {
  /** Only a click on the dimmed area itself closes the dialog, not one that started inside the card. */
  backdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.close();
  }

  ui = inject(CentralUiService);
  private filters = inject(CentralFilterService);
  private analytics = inject(CentralAnalyticsService);
  private language = inject(LanguageService);

  churches = signal<OverviewChurch[]>([]);
  currency = signal({ code: 'INR', symbol: '₹' });
  loading = signal(false);
  error = signal<string | null>(null);
  aId = signal(0);
  bId = signal(0);

  constructor() {
    effect(() => {
      if (!this.ui.compareOpen()) return;
      const query = { ...this.filters.query(), churchId: null, branchId: null };
      untracked(() => {
        this.loading.set(true);
        this.error.set(null);
        this.analytics.overview(query).subscribe({
          next: (o: OverviewResponse) => {
            this.churches.set(o.churches);
            this.currency.set(o.context.currency);
            const chosen = this.filters.churchId();
            const first = o.churches.find((c) => c.id === chosen) ?? o.churches[0];
            const second = o.churches.find((c) => c.id !== first?.id);
            if (!o.churches.some((c) => c.id === this.aId())) this.aId.set(first ? first.id : 0);
            if (!o.churches.some((c) => c.id === this.bId()) || this.bId() === this.aId()) this.bId.set(second ? second.id : 0);
            this.loading.set(false);
          },
          error: (err) => {
            this.error.set(extractErrorMessage(err));
            this.loading.set(false);
          },
        });
      });
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.ui.compareOpen()) this.close();
  }
  close(): void {
    this.ui.compareOpen.set(false);
  }

  label = (c: OverviewChurch) => churchLabel(c, this.language.current());
  private a = computed(() => this.churches().find((c) => c.id === this.aId()) ?? null);
  private b = computed(() => this.churches().find((c) => c.id === this.bId()) ?? null);
  nameA = computed(() => (this.a() ? this.label(this.a()!) : ''));
  nameB = computed(() => (this.b() ? this.label(this.b()!) : ''));

  private translate = inject(TranslateService);
  private t(key: string): string {
    return this.translate.instant(`central.compare.metrics.${key}`);
  }

  metrics = computed<CompareMetric[]>(() => {
    const a = this.a();
    const b = this.b();
    if (!a || !b) return [];
    const lang = this.language.current();
    const count = (n: number) => formatCount(n, lang);
    const money = (n: number) => formatMoney(n, this.currency(), lang);
    const row = (key: string, av: number, bv: number, format: (n: number) => string): CompareMetric => ({ key, label: this.t(key), a: av, b: bv, format });
    return [
      row('intentions', a.intentions.value, b.intentions.value, count),
      row('baptism', a.certificates.baptism, b.certificates.baptism, count),
      row('marriage', a.certificates.marriage, b.certificates.marriage, count),
      row('death', a.certificates.death, b.certificates.death, count),
      row('contributions', a.contributions.value, b.contributions.value, money),
      row('activity', a.activity.value, b.activity.value, count),
      row('branches', a.branches, b.branches, count),
    ];
  });

  pct(value: number, m: CompareMetric): number {
    const max = Math.max(m.a, m.b);
    return max > 0 ? Math.max(2, (value / max) * 100) : 0;
  }
}

// ============================================================================ full insights

@Component({
  selector: 'coms-insight-dialog',
  standalone: true,
  imports: [MatIconModule, TranslatePipe, InsightSnapshotComponent],
  template: `
    @if (ui.insightsOpen()) {
      <div class="dlg__backdrop" role="presentation" (click)="backdropClick($event)" data-testid="insight-dialog">
        <section class="dlg" role="dialog" aria-modal="true" [attr.aria-label]="'central.insight.title' | translate">
          <header class="dlg__head">
            <h2>{{ 'central.insight.title' | translate }}</h2>
            <button type="button" class="dlg__close" (click)="close()" [attr.aria-label]="'central.close' | translate"><mat-icon>close</mat-icon></button>
          </header>
          <div class="dlg__body">
            @if (insights.data(); as d) {
              <coms-insight-snapshot [items]="d.items" [currency]="d.context.currency" [lang]="language.current()" [max]="50" [showMore]="false" />
            } @else {
              <p class="msg">{{ 'central.loading' | translate }}</p>
            }
          </div>
        </section>
      </div>
    }
  `,
  styles: [DIALOG_STYLES + `.msg { font-size: 13px; color: var(--coms-text-muted); }`],
})
export class InsightDialogComponent {
  /** Only a click on the dimmed area itself closes the dialog, not one that started inside the card. */
  backdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.close();
  }

  ui = inject(CentralUiService);
  language = inject(LanguageService);
  private analytics = inject(CentralAnalyticsService);
  insights = createLoader((q) => this.analytics.insights(q));

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.ui.insightsOpen()) this.close();
  }
  close(): void {
    this.ui.insightsOpen.set(false);
  }
}
