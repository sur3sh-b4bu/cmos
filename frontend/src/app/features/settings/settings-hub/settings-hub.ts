import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/services/auth.service';

interface SettingsCard {
  label: string;
  description: string;
  icon: string;
  route: string;
  permissions: string[];
}

@Component({
  selector: 'coms-settings-hub',
  standalone: true,
  imports: [RouterLink, MatIconModule],
  templateUrl: './settings-hub.html',
  styleUrl: './settings-hub.scss',
})
export class SettingsHubComponent {
  authService = inject(AuthService);

  cards: SettingsCard[] = [
    { label: 'User Management', description: 'Create staff accounts, assign roles, reset passwords.', icon: 'group', route: '/settings/users', permissions: ['users.view'] },
    { label: 'Roles & Permissions', description: 'Control what each role is allowed to do.', icon: 'admin_panel_settings', route: '/settings/roles', permissions: ['roles.view'] },
    { label: 'Audit Logs', description: 'Who did what, and when.', icon: 'history', route: '/settings/audit-logs', permissions: ['audit_logs.view'] },
    { label: 'Church Information', description: 'Church profile, address, and contact details.', icon: 'church', route: '/masters/churches', permissions: ['masters.view'] },
    { label: 'Receipt Settings', description: 'Receipt number series and prefixes.', icon: 'receipt_long', route: '/masters/receipt_series', permissions: ['masters.view'] },
    { label: 'Print Settings', description: 'Certificate & receipt print templates.', icon: 'print', route: '/masters/print_templates', permissions: ['masters.view'] },
  ];

  visibleCards(): SettingsCard[] {
    return this.cards.filter((c) => this.authService.hasAnyPermission(c.permissions));
  }
}
