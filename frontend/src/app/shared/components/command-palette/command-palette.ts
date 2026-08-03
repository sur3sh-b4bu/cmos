import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/services/auth.service';
import { NAV_ITEMS } from '../../../core/models/nav-item.model';

interface CommandItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'coms-command-palette',
  standalone: true,
  imports: [FormsModule, MatIconModule],
  templateUrl: './command-palette.html',
  styleUrl: './command-palette.scss',
})
export class CommandPaletteComponent {
  private router = inject(Router);
  private authService = inject(AuthService);
  private dialogRef = inject(MatDialogRef<CommandPaletteComponent>);

  query = signal('');

  private readonly quickActions: CommandItem[] = [
    { label: 'New Prayer Intention', icon: 'add_circle', route: '/prayer-intentions/new' },
    { label: "Today's Prayer Register", icon: 'menu_book', route: '/prayer-intentions/register' },
  ];

  private readonly navCommands: CommandItem[] = NAV_ITEMS.filter(
    (item) => !item.permissions?.length || this.authService.hasAnyPermission(item.permissions)
  ).map((item) => ({ label: item.label, icon: item.icon, route: item.route }));

  private readonly allCommands = [...this.quickActions, ...this.navCommands];

  readonly results = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.allCommands;
    return this.allCommands.filter((c) => c.label.toLowerCase().includes(q));
  });

  select(item: CommandItem): void {
    this.router.navigateByUrl(item.route);
    this.dialogRef.close();
  }

  close(): void {
    this.dialogRef.close();
  }
}
