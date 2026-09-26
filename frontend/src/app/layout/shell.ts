import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { filter } from 'rxjs';
import { AuthService } from '../core/services/auth.service';
import { ChurchSetupService } from '../core/services/church-setup.service';
import { openChurchSetupDialog } from '../shared/components/church-setup-dialog/church-setup-dialog';
import { SidebarComponent } from './sidebar';
import { HeaderComponent } from './header';

const PROMPTED_KEY_PREFIX = 'coms.setupPrompted.';

@Component({
  selector: 'coms-shell',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, HeaderComponent, MatButtonModule, MatIconModule, TranslatePipe],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class ShellComponent {
  private auth = inject(AuthService);
  private setup = inject(ChurchSetupService);
  private dialog = inject(MatDialog);
  private router = inject(Router);

  collapsed = signal(localStorage.getItem('coms-sidebar-collapsed') === 'true');

  /** Central Management screens fill the viewport and never scroll; every other screen scrolls its own content as before. */
  fit = signal(this.router.url.startsWith('/central'));

  /** A reminder stays on screen while the church being worked in is missing something that stops the office. */
  readonly showSetupBanner = computed(() => {
    const status = this.setup.status();
    return !!status && !status.complete && status.churchId === this.auth.effectiveChurchId();
  });

  constructor() {
    // Whenever the church being worked in changes (login, or a Master Administrator switching
    // church), find out whether it is ready -- and offer the setup popup once per browser session
    // if it isn't. Only for people who may set a church up; everyone else has nothing to act on.
    effect(() => {
      const churchId = this.auth.effectiveChurchId();
      const allowed = this.auth.isAuthenticated() && this.auth.hasPermission('masters.create');
      untracked(() => void this.check(allowed ? churchId : null));
    });

    // The reminder goes away by itself once the missing pieces are added (e.g. under Masters).
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe((e) => {
        this.fit.set((e as NavigationEnd).urlAfterRedirects.startsWith('/central'));
        if (this.showSetupBanner()) void this.setup.refresh(this.auth.effectiveChurchId());
      });
  }

  onCollapsedChange(value: boolean): void {
    this.collapsed.set(value);
    localStorage.setItem('coms-sidebar-collapsed', String(value));
  }

  openSetup(): void {
    const status = this.setup.status();
    if (!status) return;
    openChurchSetupDialog(this.dialog, { churchId: status.churchId, churchName: status.churchName })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) void this.setup.refresh(this.auth.effectiveChurchId());
      });
  }

  private async check(churchId: number | null): Promise<void> {
    const status = await this.setup.refresh(churchId);
    if (status && !status.complete && !this.wasPrompted(status.churchId)) {
      this.markPrompted(status.churchId);
      this.openSetup();
    }
  }

  private wasPrompted(churchId: number): boolean {
    try {
      return sessionStorage.getItem(PROMPTED_KEY_PREFIX + churchId) === '1';
    } catch {
      return false;
    }
  }

  private markPrompted(churchId: number): void {
    try {
      sessionStorage.setItem(PROMPTED_KEY_PREFIX + churchId, '1');
    } catch {
      // Storage blocked: the popup may reappear on the next switch, which is harmless.
    }
  }
}
