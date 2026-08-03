import { Injectable, inject, signal } from '@angular/core';
import { ActivatedRoute, ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

export interface Breadcrumb {
  label: string;
  url: string;
}

@Injectable({ providedIn: 'root' })
export class BreadcrumbService {
  private router = inject(Router);
  private rootRoute = inject(ActivatedRoute);

  readonly breadcrumbs = signal<Breadcrumb[]>([]);

  constructor() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      this.breadcrumbs.set(this.build(this.rootRoute.snapshot));
    });
  }

  private build(snapshot: ActivatedRouteSnapshot): Breadcrumb[] {
    const crumbs: Breadcrumb[] = [];
    let current: ActivatedRouteSnapshot | null = snapshot;
    let url = '';

    while (current) {
      const segment = current.url.map((s) => s.path).join('/');
      if (segment) url += `/${segment}`;
      const breadcrumbParam = current.data?.['breadcrumbParam'] as string | undefined;
      const label = breadcrumbParam
        ? this.titleCase(current.paramMap.get(breadcrumbParam) ?? '') + ' ' + current.data?.['breadcrumb']
        : current.data?.['breadcrumb'];
      // Angular's default 'emptyOnly' param/data inheritance copies the
      // parent's `data` onto empty-path child routes, which would otherwise
      // duplicate the parent's crumb here -- only add a crumb when this
      // node actually introduced a new URL segment (or is the first one).
      const last = crumbs[crumbs.length - 1];
      if (label && (segment || !last || last.label !== label)) {
        crumbs.push({ label, url });
      }
      current = current.firstChild;
    }
    return crumbs;
  }

  private titleCase(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}
