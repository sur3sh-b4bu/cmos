import { Component, HostListener, computed, effect, inject, signal, untracked } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../../../core/services/language.service';
import { extractErrorMessage } from '../../../core/utils/http-error.util';
import { CentralAnalyticsService, CentralFilterService } from '../central-analytics.service';
import { CentralUiService } from '../central-ui.service';
import { churchLabel, formatChange, formatCount, formatMoney, fullDate, trendDirection } from '../central-format.util';
import { ChurchDetailResponse } from '../central.models';
import { KpiCardComponent } from './kpi-card';
import { SparkLineComponent } from './spark-line';

/**
 * Drill-down for one church, opened from any church name on any Central Management screen. It slides in over the
 * current screen instead of replacing it, so the administrator never loses their place in the network view.
 */
@Component({
  selector: 'coms-church-drawer',
  standalone: true,
  imports: [MatIconModule, TranslatePipe, KpiCardComponent, SparkLineComponent],
  template: `
    @if (open()) {
      <div class="cd__backdrop" role="presentation" (click)="ui.closeChurch()"></div>
    }
    <aside class="cd" [class.cd--open]="open()" [attr.inert]="open() ? null : ''" role="dialog" aria-modal="true" [attr.aria-label]="'central.drawer.title' | translate" data-testid="church-drawer">
      @if (detail(); as d) {
        <header class="cd__head">
          <div class="cd__titles">
            <h2>{{ name() }}</h2>
            <span>{{ 'central.drawer.branches' | translate: { count: d.church.branches } }} · {{ periodText() }}</span>
          </div>
          <button type="button" class="cd__close" (click)="ui.closeChurch()" [attr.aria-label]="'central.close' | translate" data-testid="drawer-close"><mat-icon>close</mat-icon></button>
        </header>

        <div class="cd__tiles">
          <coms-kpi-card [label]="'central.kpi.massIntentions' | translate" [value]="count(d.metrics.intentions.value)" [changePct]="d.metrics.intentions.changePct" />
          <coms-kpi-card
            [label]="'central.kpi.certificates' | translate"
            [value]="count(d.metrics.certificates.value)"
            [changePct]="d.metrics.certificates.changePct"
            [note]="'B ' + d.metrics.certificates.baptism + ' · M ' + d.metrics.certificates.marriage + ' · D ' + d.metrics.certificates.death"
          />
          <coms-kpi-card [label]="'central.kpi.contributions' | translate" [value]="money(d.metrics.contributions.value)" [tooltip]="money(d.metrics.contributions.value, true)" [changePct]="d.metrics.contributions.changePct" />
          <coms-kpi-card [label]="'central.drawer.activeDays' | translate" [value]="d.metrics.registerActiveDaysPct.value + '%'" [changePct]="d.metrics.registerActiveDaysPct.changePct" />
        </div>

        <section class="cd__spark">
          <span class="cd__label">{{ 'central.drawer.activityTrend' | translate }}</span>
          <div class="cd__sparkbox"><coms-spark-line [values]="d.spark" [label]="'central.drawer.activityTrend' | translate" /></div>
        </section>

        <section class="cd__recent">
          <span class="cd__label">{{ 'central.drawer.recent' | translate }}</span>
          <table>
            <thead>
              <tr>
                <th></th>
                <th>{{ 'central.kpi.massIntentions' | translate }}</th>
                <th>{{ 'central.drawer.contributionsReceived' | translate }}</th>
                <th>{{ 'central.drawer.certificatesRecorded' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (r of d.recent; track r.date) {
                <tr>
                  <td>{{ day(r.date) }}</td>
                  <td>{{ r.intentions || '–' }}</td>
                  <td>{{ r.contributions || '–' }}</td>
                  <td>{{ r.certificatesRecorded || '–' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </section>

        @if (branchRows().length) {
          <section class="cd__branches">
            <span class="cd__label">{{ 'central.drawer.branchesTitle' | translate }}</span>
            <ul>
              @for (b of branchRows(); track $index) {
                <li>
                  <span class="cd__bname">{{ b.name ?? ('central.drawer.churchWide' | translate) }}</span>
                  <span>{{ b.intentions }} <small>{{ 'central.drawer.intentionsShort' | translate }}</small></span>
                  <span>{{ money(b.money) }}</span>
                </li>
              }
            </ul>
            @if (moreBranches() > 0) {
              <span class="cd__more">{{ 'central.drawer.moreBranches' | translate: { count: moreBranches() } }}</span>
            }
          </section>
        }

        <footer class="cd__foot">
          <button type="button" class="cd__open" (click)="ui.openChurchManagement(d.church.id)" data-testid="open-church-management">
            <mat-icon>login</mat-icon>{{ 'central.drawer.openChurch' | translate }}
          </button>
        </footer>
      } @else if (error()) {
        <div class="cd__state cd__state--error">{{ error() }}</div>
      } @else if (open()) {
        <div class="cd__state">{{ 'central.loading' | translate }}</div>
      }
    </aside>
  `,
  styles: [
    `
      .cd__backdrop {
        position: fixed;
        inset: var(--coms-header-height) 0 0 0;
        background: rgba(4, 23, 61, 0.32);
        z-index: 900;
        animation: cd-fade 200ms ease;
      }
      @keyframes cd-fade {
        from {
          opacity: 0;
        }
      }
      .cd {
        position: fixed;
        top: var(--coms-header-height);
        right: 0;
        bottom: 0;
        width: min(430px, 94vw);
        z-index: 901;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px 14px;
        background: var(--coms-bg);
        border-left: 1px solid var(--coms-border);
        box-shadow: var(--coms-shadow-lg);
        transform: translateX(105%);
        transition: transform 240ms cubic-bezier(0.4, 0, 0.2, 1);
        overflow: hidden;
      }
      .cd--open {
        transform: translateX(0);
      }
      .cd__head {
        display: flex;
        align-items: flex-start;
        gap: 8px;
      }
      .cd__titles {
        flex: 1;
        min-width: 0;
      }
      .cd__titles h2 {
        margin: 0;
        font-size: 17px;
        font-weight: 700;
        color: var(--coms-text);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .cd__titles span {
        font-size: 11.5px;
        color: var(--coms-text-muted);
      }
      .cd__close {
        border: 0;
        background: transparent;
        color: var(--coms-text-muted);
        width: 30px;
        height: 30px;
        border-radius: 8px;
        cursor: pointer;
        display: grid;
        place-items: center;
      }
      .cd__close:hover {
        background: var(--coms-surface-alt);
        color: var(--coms-text);
      }
      .cd__tiles {
        display: grid;
        grid-template-columns: 1fr 1fr;
        grid-auto-rows: 78px;
        gap: 8px;
      }
      .cd__label {
        display: block;
        font-size: 10.5px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--coms-text-muted);
        margin-bottom: 3px;
      }
      .cd__spark {
        flex: none;
      }
      .cd__sparkbox {
        height: 34px;
        padding: 2px 4px;
        background: var(--coms-surface);
        border: 1px solid var(--coms-border);
        border-radius: 8px;
      }
      .cd__recent table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
        background: var(--coms-surface);
        border: 1px solid var(--coms-border);
        border-radius: 8px;
        overflow: hidden;
      }
      .cd__recent th {
        font-size: 10px;
        font-weight: 600;
        color: var(--coms-text-muted);
        text-align: right;
        padding: 4px 8px;
        background: var(--coms-surface-alt);
        white-space: nowrap;
      }
      .cd__recent td {
        padding: 2px 8px;
        text-align: right;
        font-variant-numeric: tabular-nums;
        border-top: 1px solid var(--coms-border);
        line-height: 18px;
      }
      .cd__recent td:first-child {
        text-align: left;
        color: var(--coms-text-muted);
      }
      .cd__branches {
        min-height: 0;
      }
      .cd__branches ul {
        list-style: none;
        margin: 0;
        padding: 0;
        background: var(--coms-surface);
        border: 1px solid var(--coms-border);
        border-radius: 8px;
      }
      .cd__branches li {
        display: grid;
        grid-template-columns: 1fr auto 64px;
        gap: 10px;
        padding: 4px 10px;
        font-size: 12px;
        border-top: 1px solid var(--coms-border);
      }
      .cd__branches li:first-child {
        border-top: 0;
      }
      .cd__branches li span:not(:first-child) {
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
      .cd__branches small {
        color: var(--coms-text-muted);
      }
      .cd__bname {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .cd__more {
        display: block;
        margin-top: 3px;
        font-size: 11px;
        color: var(--coms-text-muted);
      }
      .cd__foot {
        margin-top: auto;
      }
      .cd__open {
        width: 100%;
        height: 36px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        border: 0;
        border-radius: 8px;
        background: var(--coms-color-primary);
        color: #fff;
        font: inherit;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: background-color var(--coms-transition-fast);
      }
      .cd__open:hover {
        background: var(--coms-color-primary-light);
      }
      .cd__state {
        margin: auto;
        font-size: 13px;
        color: var(--coms-text-muted);
      }
      .cd__state--error {
        color: var(--coms-color-danger);
      }
    `,
  ],
})
export class ChurchDrawerComponent {
  ui = inject(CentralUiService);
  private filters = inject(CentralFilterService);
  private analytics = inject(CentralAnalyticsService);
  private language = inject(LanguageService);

  detail = signal<ChurchDetailResponse | null>(null);
  error = signal<string | null>(null);
  open = computed(() => this.ui.drawerChurchId() !== null);
  private latest = 0;

  constructor() {
    effect(() => {
      const id = this.ui.drawerChurchId();
      const query = this.filters.query();
      untracked(() => {
        const mine = (this.latest += 1);
        if (id === null) return;
        this.error.set(null);
        if (this.detail()?.church.id !== id) this.detail.set(null);
        this.analytics.church(id, query).subscribe({
          next: (d) => {
            if (mine === this.latest) this.detail.set(d);
          },
          error: (err) => {
            if (mine === this.latest) this.error.set(extractErrorMessage(err));
          },
        });
      });
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) this.ui.closeChurch();
  }

  name = computed(() => (this.detail() ? churchLabel(this.detail()!.church, this.language.current()) : ''));

  periodText = computed(() => {
    const d = this.detail();
    if (!d) return '';
    const { from, to } = d.context.period;
    return from === to ? fullDate(from, this.language.current()) : `${fullDate(from, this.language.current())} – ${fullDate(to, this.language.current())}`;
  });

  /** The church's branches, most active first; only the first few are listed, the rest counted. */
  private allBranches = computed(() => {
    const d = this.detail();
    if (!d) return [];
    return d.branches
      .map((b) => ({ name: b.branch ? b.branch.name : null, intentions: b.intentions.value, money: b.contributions.value }))
      .sort((a, b) => b.intentions + b.money / 1000 - (a.intentions + a.money / 1000));
  });
  branchRows = computed(() => this.allBranches().slice(0, 3));
  moreBranches = computed(() => Math.max(0, this.allBranches().length - 3));

  count = (n: number) => formatCount(n, this.language.current());
  money = (n: number, full = false) => formatMoney(n, this.detail()?.context.currency ?? { code: 'INR', symbol: '₹' }, this.language.current(), full);
  day = (key: string) => fullDate(key, this.language.current());
  readonly change = formatChange;
  readonly direction = trendDirection;
}
