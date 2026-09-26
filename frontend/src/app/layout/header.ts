import { Component, HostListener, OnInit, effect, inject, signal, untracked } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../core/services/auth.service';
import { BiometricAuthService } from '../core/services/biometric-auth.service';
import { BreadcrumbService } from '../core/services/breadcrumb.service';
import { NotificationService } from '../core/services/notification.service';
import { LanguageService } from '../core/services/language.service';
import { DashboardFilterService } from '../core/services/dashboard-filter.service';
import { AppLang } from '../core/i18n/translations';
import { localizedName } from '../core/utils/localized-name.util';
import { CommandPaletteComponent } from '../shared/components/command-palette/command-palette';
import { MassIntentionService } from '../features/mass-intentions/mass-intention.service';
import { DateRangeFilterComponent } from '../shared/components/date-range-filter/date-range-filter';

@Component({
  selector: 'coms-header',
  standalone: true,
  imports: [
    RouterLink,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatTooltipModule,
    MatBadgeModule,
    DateRangeFilterComponent,
    TranslatePipe,
  ],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class HeaderComponent implements OnInit {
  authService = inject(AuthService);
  biometric = inject(BiometricAuthService);
  breadcrumbService = inject(BreadcrumbService);
  languageService = inject(LanguageService);
  dashboardFilter = inject(DashboardFilterService);
  private router = inject(Router);
  private dialog = inject(MatDialog);
  private notification = inject(NotificationService);
  private massIntentionService = inject(MassIntentionService);

  pendingCount = signal(0);

  // The pending count belongs to one church, so it follows the church being worked in; Central Management (none chosen) has none.
  private readonly pendingWatch = effect(() => {
    const churchId = this.authService.effectiveChurchId();
    const allowed = this.authService.hasPermission('dashboard.view');
    untracked(() => {
      if (!allowed || churchId === null) {
        this.pendingCount.set(0);
        return;
      }
      this.massIntentionService.getDashboardStats().subscribe({
        next: (stats) => this.pendingCount.set(stats.pendingCount),
        error: () => this.pendingCount.set(0),
      });
    });
  });
  biometricEnrolled = signal(false);

  /** Tamil church name (Masters > Churches) when the site's language is
   * Tamil and one's been filled in, else the English name -- see
   * localized-name.util.ts. A plain getter (not computed()) since
   * languageService.current() and authService.currentUser() are both read
   * fresh on every change detection pass, same reasoning as similar
   * getters elsewhere (see mass-intention-form.ts's selectedPaymentMethod). */
  get churchName(): string | null | undefined {
    const user = this.authService.currentUser();
    if (!user?.churchName) return user?.churchName;
    return localizedName({ name: user.churchName, name_ta: user.churchNameTa }, this.languageService.current());
  }
  enrollingBiometrics = signal(false);

  /** The date-range filter appears up here beside "Search or jump to..."
   * on the Dashboard ONLY (see DashboardFilterService's own comment) --
   * every other page keeps its own inline filter, if it has one. */
  isDashboardRoute = signal(false);

  async ngOnInit(): Promise<void> {
    this.isDashboardRoute.set(this.router.url.split('?')[0] === '/dashboard');
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e) => {
      this.isDashboardRoute.set((e as NavigationEnd).urlAfterRedirects.split('?')[0] === '/dashboard');
    });

    // Header mounts on every authenticated page, so this is the one place
    // that reliably picks up Masters -> Languages -> Set Default for anyone
    // who hasn't personally chosen a language yet (see LanguageService).
    this.languageService.loadOrgDefault();

    if (await this.biometric.detectAvailability()) {
      this.refreshBiometricState();
    }
  }

  private async refreshBiometricState(): Promise<void> {
    try {
      const devices = await this.biometric.listDevices();
      this.biometricEnrolled.set(devices.length > 0);
    } catch {
      this.biometricEnrolled.set(false);
    }
  }

  async setUpBiometrics(): Promise<void> {
    if (this.enrollingBiometrics()) return;
    this.enrollingBiometrics.set(true);
    try {
      await this.biometric.enrollThisDevice(navigator.platform || 'This device');
      this.biometricEnrolled.set(true);
      this.notification.success(
        'Biometric sign-in enabled. Next time, unlock with your fingerprint or face.'
      );
    } catch (err) {
      this.notification.error(this.biometric.describeError(err));
    } finally {
      this.enrollingBiometrics.set(false);
    }
  }

  @HostListener('window:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.openCommandPalette();
    }
  }

  openCommandPalette(): void {
    this.dialog.open(CommandPaletteComponent, {
      panelClass: 'coms-command-palette-panel',
      position: { top: '96px' },
    });
  }

  async logout(): Promise<void> {
    await this.authService.logout();
  }

  setLanguage(lang: AppLang): void {
    this.languageService.setLanguage(lang);
  }
}
