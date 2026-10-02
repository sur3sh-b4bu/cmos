import { Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../core/services/auth.service';
import { HealthService } from '../core/services/health.service';
import { NAV_ITEMS, NavItem } from '../core/models/nav-item.model';
import { centralRouteFor, inCentralManagement } from '../core/guards/central-mode.guard';
import { resolveUploadUrl } from '../core/utils/asset-url.util';

@Component({
  selector: 'coms-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, MatIconModule, MatTooltipModule, TranslatePipe],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class SidebarComponent {
  authService = inject(AuthService);
  healthService = inject(HealthService);
  private router = inject(Router);

  @Input() collapsed = false;
  @Output() collapsedChange = new EventEmitter<boolean>();

  expandedGroups = signal<Record<string, boolean>>({});

  isGroupExpanded(item: NavItem): boolean {
    if (this.expandedGroups()[item.labelKey] !== undefined) {
      return !!this.expandedGroups()[item.labelKey];
    }
    return item.children?.some((c) => this.router.url.startsWith(c.route)) ?? true;
  }

  toggleGroup(item: NavItem): void {
    if (this.collapsed) {
      // In collapsed mode, clicking navigates to the group's main route
      this.router.navigate([item.route]);
      return;
    }
    const current = this.isGroupExpanded(item);
    this.expandedGroups.update((g) => ({ ...g, [item.labelKey]: !current }));
  }

  constructor() {
    this.healthService.start();
  }

  /** The church logo uploaded in Masters > Churches (see master-form.ts),
   * shown in place of the crest emoji once one exists. Reads
   * authService.effectiveChurchLogoUrl() rather than
   * currentUser().churchLogoUrl directly so a Master Administrator's crest
   * follows whichever church it's currently acting as (see
   * ThemeService for the same reasoning on theme color). A plain getter,
   * not computed(), since these are signals read fresh on every
   * change-detection pass -- same reasoning as similar getters elsewhere in
   * the app (e.g. mass-intention-form's selectedPaymentMethod). */
  get churchLogoUrl(): string | null {
    return resolveUploadUrl(this.authService.effectiveChurchLogoUrl());
  }

  /** True for a Master Administrator who has not chosen a church: every module then opens its organization-wide analytics. */
  readonly central = computed(() => inCentralManagement(this.authService));

  /** The sidebar's links. In Central Management each module points at its analytics screen; inside a church, at that church's records. */
  readonly navItems = computed(() =>
    NAV_ITEMS.filter((item) => !item.permissions?.length || this.authService.hasAnyPermission(item.permissions)).map((item) => ({
      ...item,
      route: this.central() ? (centralRouteFor(item.route) ?? item.route) : item.route,
      children: item.children
        ?.filter((c) => !c.permissions?.length || this.authService.hasAnyPermission(c.permissions))
        .map((c) => ({
          ...c,
          route: this.central() ? (centralRouteFor(c.route) ?? c.route) : c.route,
        })),
    }))
  );

  toggleCollapsed(): void {
    this.collapsedChange.emit(!this.collapsed);
  }

  /** Icon + tooltip key for the health indicator at the bottom of the
   * sidebar (see health.service.ts) -- a plain getter since
   * healthService.status is a signal read fresh each change-detection
   * pass, same reasoning as churchLogoUrl above. */
  get healthIcon(): string {
    return { checking: 'pending', ok: 'check_circle', down: 'error' }[this.healthService.status()];
  }

  get healthTooltipKey(): string {
    return {
      checking: 'sidebar.healthChecking',
      ok: 'sidebar.healthOk',
      down: 'sidebar.healthDown',
    }[this.healthService.status()];
  }
}
