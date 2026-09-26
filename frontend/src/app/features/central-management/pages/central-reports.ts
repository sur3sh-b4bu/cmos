import { Component, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { NotificationService } from '../../../core/services/notification.service';
import { extractErrorMessage } from '../../../core/utils/http-error.util';
import { CentralAnalyticsService, CentralFilterService, createLoader } from '../central-analytics.service';
import { CentralPageBase } from '../central-page.base';
import { CentralPanelComponent } from '../components/central-panel';
import { InsightSnapshotComponent } from '../components/insight-snapshot';
import { fullDate } from '../central-format.util';
import { CATEGORIES, REPORTS, ReportCategory, ReportDefinition } from '../report-definitions';
import { downloadWorkbook } from '../report-builder';

const STORAGE_KEY = 'coms.central.reportsGenerated';

/**
 * Reports & Insights: a compact workspace of ready reports. "Generate" builds a real Excel file from the live
 * analytics for the church, branch and period chosen at the top; "Last generated" is remembered in this browser.
 */
@Component({
  selector: 'coms-central-reports',
  standalone: true,
  imports: [TranslatePipe, MatIconModule, CentralPanelComponent, InsightSnapshotComponent],
  template: `
    <div class="rp" data-testid="page-reports">
      <div class="rp__main">
        @for (cat of categories; track cat) {
          <section class="rp__cat">
            <h3 class="rp__cathead">{{ 'central.reports.category.' + cat | translate }}</h3>
            <div class="rp__tiles">
              @for (r of byCategory(cat); track r.id) {
                <article class="rp__tile" [attr.data-testid]="'report-' + r.id">
                  <span class="rp__icon"><mat-icon>{{ r.icon }}</mat-icon></span>
                  <div class="rp__text">
                    <strong>{{ 'central.reports.name.' + r.id | translate }}</strong>
                    <span class="rp__desc">{{ 'central.reports.desc.' + r.id | translate }}</span>
                  </div>
                  <div class="rp__foot">
                    <span class="rp__last" [title]="lastText(r.id)"><mat-icon>history</mat-icon><span>{{ lastText(r.id) }}</span></span>
                  <button type="button" class="rp__btn" [disabled]="busy() !== null" (click)="generate(r)" [attr.data-testid]="'generate-' + r.id">
                    @if (busy() === r.id) {
                      <mat-icon class="rp__spin">progress_activity</mat-icon>
                    } @else {
                      <mat-icon>download</mat-icon>
                    }
                    {{ 'central.reports.generate' | translate }}
                  </button>
                  </div>
                </article>
              }
            </div>
          </section>
        }
      </div>

      <aside class="rp__side">
        <coms-central-panel [title]="'central.insight.title' | translate" [hint]="'central.insight.hint' | translate">
          @if (insights.data(); as i) {
            <coms-insight-snapshot [items]="i.items" [currency]="i.context.currency" [lang]="lang()" [max]="5" (viewFull)="ui.insightsOpen.set(true)" />
          }
        </coms-central-panel>
        <p class="rp__note"><mat-icon>info</mat-icon>{{ 'central.reports.note' | translate }}</p>
      </aside>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
        min-height: 0;
      }
      .rp {
        height: 100%;
        display: grid;
        grid-template-columns: minmax(0, 1fr) 290px;
        gap: 12px;
        min-height: 0;
      }
      .rp__main {
        display: grid;
        grid-template-rows: repeat(4, minmax(0, 1fr));
        gap: 6px;
        min-height: 0;
      }
      .rp__cat {
        display: flex;
        flex-direction: column;
        min-height: 0;
      }
      .rp__cathead {
        margin: 0 0 3px;
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--coms-color-gold-dark);
      }
      .rp__tiles {
        flex: 1;
        min-height: 0;
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 8px;
      }
      .rp__tile {
        display: grid;
        grid-template-columns: 30px minmax(0, 1fr);
        grid-template-rows: minmax(0, 1fr) auto;
        gap: 4px 8px;
        padding: 8px 10px;
        background: var(--coms-surface);
        border: 1px solid var(--coms-border);
        border-radius: 10px;
        box-shadow: var(--coms-shadow-sm);
        min-height: 0;
        transition:
          box-shadow var(--coms-transition-fast),
          transform var(--coms-transition-fast),
          border-color var(--coms-transition-fast);
      }
      .rp__tile:hover {
        box-shadow: var(--coms-shadow-md);
        transform: translateY(-1px);
        border-color: color-mix(in srgb, var(--coms-color-primary-light) 40%, var(--coms-border));
      }
      .rp__icon {
        width: 30px;
        height: 30px;
        display: grid;
        place-items: center;
        border-radius: 8px;
        background: color-mix(in srgb, var(--coms-color-primary-light) 12%, transparent);
        color: var(--coms-color-primary-light);
      }
      .rp__icon mat-icon {
        width: 18px;
        height: 18px;
        font-size: 18px;
      }
      .rp__text {
        display: flex;
        flex-direction: column;
        gap: 1px;
        min-width: 0;
        min-height: 0;
        overflow: hidden;
      }
      .rp__text strong {
        font-size: 12.5px;
        line-height: 1.25;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .rp__desc {
        font-size: 11px;
        line-height: 1.3;
        color: var(--coms-text-muted);
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .rp__last {
        display: flex;
        align-items: center;
        gap: 3px;
        font-size: 10.5px;
        color: var(--coms-text-muted);
        opacity: 0.85;
        flex: 1;
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .rp__foot {
        grid-column: 1 / -1;
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
      }
      .rp__last mat-icon {
        flex: none;
        width: 13px;
        height: 13px;
        font-size: 13px;
      }
      .rp__last span {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .rp__btn {
        flex: none;
        display: inline-flex;
        align-items: center;
        gap: 3px;
        height: 24px;
        padding: 0 9px 0 6px;
        border: 1px solid var(--coms-color-primary);
        border-radius: 7px;
        background: var(--coms-color-primary);
        color: #fff;
        font: inherit;
        font-size: 11.5px;
        font-weight: 600;
        cursor: pointer;
        transition: background-color var(--coms-transition-fast);
      }
      .rp__btn:hover:not(:disabled) {
        background: var(--coms-color-primary-light);
      }
      .rp__btn:disabled {
        opacity: 0.55;
        cursor: progress;
      }
      .rp__btn mat-icon {
        width: 15px;
        height: 15px;
        font-size: 15px;
      }
      .rp__spin {
        animation: rp-spin 900ms linear infinite;
      }
      @keyframes rp-spin {
        to {
          transform: rotate(360deg);
        }
      }
      .rp__side {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-height: 0;
      }
      .rp__side coms-central-panel {
        flex: 1;
        min-height: 0;
      }
      .rp__note {
        display: flex;
        gap: 6px;
        margin: 0;
        font-size: 11px;
        line-height: 1.4;
        color: var(--coms-text-muted);
      }
      .rp__note mat-icon {
        flex: none;
        width: 15px;
        height: 15px;
        font-size: 15px;
      }
      @media (prefers-reduced-motion: reduce) {
        .rp__spin {
          animation: none;
        }
      }
    `,
  ],
})
export class CentralReportsComponent extends CentralPageBase {
  private analytics = inject(CentralAnalyticsService);
  private filters = inject(CentralFilterService);
  private notification = inject(NotificationService);
  insights = createLoader((q) => this.analytics.insights(q));

  readonly categories = CATEGORIES;
  busy = signal<string | null>(null);
  private generated = signal<Record<string, string>>(this.readGenerated());

  constructor() {
    super();
    this.publishContext(this.insights);
  }

  byCategory = (cat: ReportCategory): ReportDefinition[] => REPORTS.filter((r) => r.category === cat);

  lastText = (id: string): string => {
    const at = this.generated()[id];
    if (!at) return this.t('central.reports.never');
    const date = new Date(at);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const time = new Intl.DateTimeFormat(this.lang() === 'ta' ? 'ta-IN' : 'en-IN', { hour: '2-digit', minute: '2-digit' }).format(date);
    return this.t('central.reports.last', { when: key === todayKey ? `${this.t('central.reports.today')} ${time}` : fullDate(key, this.lang()) });
  };

  async generate(report: ReportDefinition): Promise<void> {
    if (this.busy()) return;
    this.busy.set(report.id);
    try {
      const env = { analytics: this.analytics, query: this.filters.query(), name: this.name, t: this.t };
      const result = await report.run(env);
      const p = result.context.period;
      const scopeName = this.scopeText();
      await downloadWorkbook({
        fileName: `${report.id}-${p.from}_${p.to}`,
        title: this.t(`central.reports.name.${report.id}`),
        sheets: result.sheets,
        about: [
          [this.t('central.reports.about.report'), this.t(`central.reports.name.${report.id}`)],
          [this.t('central.reports.about.scope'), scopeName],
          [this.t('central.reports.about.period'), `${p.from} – ${p.to}`],
          [this.t('central.reports.about.previous'), `${p.previous.from} – ${p.previous.to}`],
          [this.t('central.reports.about.currency'), result.context.currency.code],
          [this.t('central.reports.about.generated'), new Date().toLocaleString()],
          [this.t('central.reports.about.source'), this.t('central.reports.about.sourceValue')],
        ],
      });
      const next = { ...this.generated(), [report.id]: new Date().toISOString() };
      this.generated.set(next);
      this.writeGenerated(next);
      this.notification.success(this.t('central.reports.done', { name: this.t(`central.reports.name.${report.id}`) }));
    } catch (err) {
      this.notification.error(extractErrorMessage(err));
    } finally {
      this.busy.set(null);
    }
  }

  private scopeText(): string {
    const q = this.filters.query();
    const church = this.filters.churches().find((c) => c.id === q.churchId);
    const branch = this.filters.branches().find((b) => b.id === q.branchId);
    const parts = [church ? this.name({ name: church.name, nameTa: church.name_ta ?? null }) : this.t('central.filters.allChurches')];
    parts.push(branch ? branch.name : this.t('central.filters.allBranches'));
    return parts.join(' / ');
  }

  private readGenerated(): Record<string, string> {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  }

  private writeGenerated(value: Record<string, string>): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      // Storage blocked: the file was still generated; only "last generated" is not remembered.
    }
  }

}
