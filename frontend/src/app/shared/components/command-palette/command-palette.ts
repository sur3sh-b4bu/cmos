import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import { NAV_ITEMS } from '../../../core/models/nav-item.model';

interface CommandItem {
  labelKey: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'coms-command-palette',
  standalone: true,
  imports: [FormsModule, MatIconModule, TranslatePipe],
  templateUrl: './command-palette.html',
  styleUrl: './command-palette.scss',
})
export class CommandPaletteComponent {
  private router = inject(Router);
  private authService = inject(AuthService);
  private translate = inject(TranslateService);
  private dialogRef = inject(MatDialogRef<CommandPaletteComponent>);

  query = signal('');

  // Re-resolves labels whenever the active language changes, so a command
  // typed/filtered against Tamil text still matches after a language switch.
  private langChange = toSignal(this.translate.onLangChange, { initialValue: null });

  private readonly quickActions: CommandItem[] = [
    { labelKey: 'commandPalette.newMassIntention', icon: 'add_circle', route: '/mass-intentions/new' },
    { labelKey: 'commandPalette.todaysPrayerRegister', icon: 'menu_book', route: '/mass-intentions/register' },
  ];

  private readonly navCommands: CommandItem[] = NAV_ITEMS.filter(
    (item) => !item.permissions?.length || this.authService.hasAnyPermission(item.permissions)
  ).map((item) => ({ labelKey: item.labelKey, icon: item.icon, route: item.route }));

  private readonly allCommands = [...this.quickActions, ...this.navCommands];

  readonly resolvedCommands = computed(() => {
    this.langChange(); // dependency only -- forces recompute on language change
    return this.allCommands.map((c) => ({ ...c, label: this.translate.instant(c.labelKey) as string }));
  });

  readonly results = computed(() => {
    const q = this.query().trim().toLowerCase();
    const commands = this.resolvedCommands();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q));
  });

  select(item: CommandItem): void {
    this.router.navigateByUrl(item.route);
    this.dialogRef.close();
  }

  close(): void {
    this.dialogRef.close();
  }
}
