import { Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { AuthService } from '../core/services/auth.service';
import { ThemeService } from '../core/services/theme.service';
import { BreadcrumbService } from '../core/services/breadcrumb.service';
import { CommandPaletteComponent } from '../shared/components/command-palette/command-palette';
import { PrayerIntentionService } from '../features/prayer-intentions/prayer-intention.service';

@Component({
  selector: 'coms-header',
  standalone: true,
  imports: [RouterLink, MatIconModule, MatButtonModule, MatMenuModule, MatTooltipModule, MatBadgeModule],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class HeaderComponent implements OnInit {
  authService = inject(AuthService);
  themeService = inject(ThemeService);
  breadcrumbService = inject(BreadcrumbService);
  private dialog = inject(MatDialog);
  private prayerIntentionService = inject(PrayerIntentionService);

  pendingCount = signal(0);

  ngOnInit(): void {
    if (this.authService.hasPermission('dashboard.view')) {
      this.prayerIntentionService.getDashboardStats().subscribe({
        next: (stats) => this.pendingCount.set(stats.pendingCount),
        error: () => this.pendingCount.set(0),
      });
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

  toggleTheme(): void {
    this.themeService.toggle();
  }

  async logout(): Promise<void> {
    await this.authService.logout();
  }
}
