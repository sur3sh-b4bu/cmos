import { Injectable, inject, signal } from '@angular/core';
import { ActivatedRoute, ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

export interface Breadcrumb {
  label: string;
  url: string;
}

@Injectable({ providedIn: 'root' })
export class BreadcrumbService {
  private router = inject(Router);
  private rootRoute = inject(ActivatedRoute);
  private translate = inject(TranslateService);

  readonly breadcrumbs = signal<Breadcrumb[]>([]);

  constructor() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      this.breadcrumbs.set(this.build(this.rootRoute.snapshot));
    });
    // route.data['breadcrumb'] holds a translation key, not display text --
    // rebuild on every language switch so crumbs don't stay in the old
    // language until the next navigation.
    this.translate.onLangChange.subscribe(() => {
      this.breadcrumbs.set(this.build(this.rootRoute.snapshot));
    });
  }

  private build(snapshot: ActivatedRouteSnapshot): Breadcrumb[] {
    const raw: Breadcrumb[] = [];
    let current: ActivatedRouteSnapshot | null = snapshot;
    let url = '';

    while (current) {
      const segment = current.url.map((s) => s.path).join('/');
      if (segment) url += `/${segment}`;
      const breadcrumbKey = current.data?.['breadcrumb'] as string | undefined;
      const breadcrumbParam = current.data?.['breadcrumbParam'] as string | undefined;
      const label = breadcrumbKey
        ? breadcrumbParam
          ? this.titleCase(current.paramMap.get(breadcrumbParam) ?? '') + ' ' + this.translate.instant(breadcrumbKey)
          : (this.translate.instant(breadcrumbKey) as string)
        : undefined;
      if (label) raw.push({ label, url });
      current = current.firstChild;
    }

    // Angular's route-data inheritance can repeat a parent's (or
    // grandparent's, through an intermediate param segment) label onto a
    // descendant node -- rather than trying to predict every shape that
    // produces, collapse adjacent same-label crumbs here and keep the
    // deepest (most specific) URL.
    const crumbs: Breadcrumb[] = [];
    for (const crumb of raw) {
      const last = crumbs[crumbs.length - 1];
      if (last && last.label === crumb.label) {
        last.url = crumb.url;
      } else {
        crumbs.push({ ...crumb });
      }
    }
    return crumbs;
  }

  private titleCase(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}
