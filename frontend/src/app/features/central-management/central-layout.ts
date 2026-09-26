import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../../core/services/language.service';
import { CentralUiService } from './central-ui.service';
import { fullDate } from './central-format.util';
import { CentralFiltersComponent } from './components/central-filters';
import { ChurchDrawerComponent } from './components/church-drawer';
import { CompareDialogComponent, InsightDialogComponent, RankingDialogComponent } from './components/central-dialogs';

/**
 * The frame around every Central Management screen: title, the shared church/branch/period filters, and the drawer
 * and dialogs that open on top. It fills exactly the space the app shell gives it and never scrolls -- each screen
 * inside sizes itself to fit.
 */
@Component({
  selector: 'coms-central-layout',
  standalone: true,
  imports: [RouterOutlet, TranslatePipe, CentralFiltersComponent, ChurchDrawerComponent, CompareDialogComponent, RankingDialogComponent, InsightDialogComponent],
  template: `
    <div class="cl" data-testid="central-layout">
      <header class="cl__head">
        <div class="cl__titles">
          <h1>{{ titleKey() | translate }}</h1>
          <p>
            <span class="cl__sub" [title]="subtitleKey() | translate">{{ subtitleKey() | translate }}</span>
            @if (rangeText()) {
              <span class="cl__range" data-testid="period-range">{{ rangeText() }}</span>
            }
          </p>
        </div>
        <coms-central-filters />
      </header>
      <div class="cl__body"><router-outlet /></div>
    </div>
    <coms-church-drawer />
    <coms-compare-dialog />
    <coms-ranking-dialog />
    <coms-insight-dialog />
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
        min-height: 0;
      }
      .cl {
        height: 100%;
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-height: 0;
      }
      .cl__head {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 8px 16px;
        flex: none;
        flex-wrap: wrap;
      }
      /* Title on the left (its sub-line wraps if it must), filters on the right; they only stack on a narrow window. */
      .cl__titles {
        flex: 1 1 300px;
        min-width: 0;
      }
      /* Filters sit at the right; if they and the title cannot share a row (custom dates, narrow window) they drop below, still right-aligned. */
      coms-central-filters {
        flex: none;
        margin-left: auto;
      }
      h1 {
        margin: 0;
        white-space: nowrap;
        font-size: 18px;
        font-weight: 700;
        line-height: 1.2;
        color: var(--coms-text);
        letter-spacing: -0.005em;
      }
      p {
        margin: 1px 0 0;
        font-size: 12px;
        color: var(--coms-text-muted);
        line-height: 1.3;
      }
      .cl__sub {
        display: block;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .cl__range {
        display: block;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .cl__body {
        flex: 1;
        min-height: 0;
      }
    `,
  ],
})
export class CentralLayoutComponent {
  private router = inject(Router);
  private ui = inject(CentralUiService);
  private language = inject(LanguageService);

  titleKey = signal('central.title');
  subtitleKey = signal('');

  /** "1 Sep 2026 – 25 Sep 2026 · vs 1 Aug 2026 – 25 Aug 2026" for whatever the visible screen is showing. */
  rangeText = computed(() => {
    const c = this.ui.context();
    if (!c) return '';
    const lang = this.language.current();
    const p = c.period;
    const range = (from: string, to: string) => (from === to ? fullDate(from, lang) : `${fullDate(from, lang)} – ${fullDate(to, lang)}`);
    return `${range(p.from, p.to)} (vs ${range(p.previous.from, p.previous.to)})`;
  });

  constructor() {
    this.update();
    this.router.events.pipe(filter((e) => e instanceof NavigationStart), takeUntilDestroyed()).subscribe(() => {
      // A drawer or dialog left open must not follow the administrator to the next screen.
      this.ui.closeAll();
      this.ui.context.set(null);
    });
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd), takeUntilDestroyed()).subscribe(() => this.update());
  }

  private update(): void {
    let route = this.router.routerState.snapshot.root;
    let titleKey = 'central.title';
    let subtitleKey = '';
    while (route) {
      if (route.data['titleKey']) titleKey = route.data['titleKey'];
      if (route.data['subtitleKey']) subtitleKey = route.data['subtitleKey'];
      route = route.firstChild as typeof route;
    }
    this.titleKey.set(titleKey);
    this.subtitleKey.set(subtitleKey);
  }
}
