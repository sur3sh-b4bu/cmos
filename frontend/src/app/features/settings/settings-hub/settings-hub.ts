import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';

interface SettingsCard {
  labelKey: string;
  descriptionKey: string;
  icon: string;
  route: string;
  permissions: string[];
  /** Shown only to the Master Administrator role, regardless of `permissions` --
   * see AuthService.isMasterAdmin. */
  masterAdminOnly?: boolean;
  /** Shown only to the per-church ADMIN role, regardless of `permissions`. */
  adminOnly?: boolean;
}

@Component({
  selector: 'coms-settings-hub',
  standalone: true,
  imports: [RouterLink, MatIconModule, TranslatePipe],
  templateUrl: './settings-hub.html',
  styleUrl: './settings-hub.scss',
})
export class SettingsHubComponent {
  authService = inject(AuthService);

  cards: SettingsCard[] = [
    { labelKey: 'settings.changeChurchBranch', descriptionKey: 'settings.changeChurchBranchDesc', icon: 'sync_alt', route: '/settings/change-church-branch', permissions: [], masterAdminOnly: true },
    { labelKey: 'settings.changeBranch', descriptionKey: 'settings.changeBranchDesc', icon: 'alt_route', route: '/settings/change-branch', permissions: [], adminOnly: true },
    { labelKey: 'settings.userManagement', descriptionKey: 'settings.userManagementDesc', icon: 'group', route: '/settings/users', permissions: ['users.view'] },
    { labelKey: 'breadcrumb.rolesPermissions', descriptionKey: 'settings.rolesDesc', icon: 'admin_panel_settings', route: '/settings/roles', permissions: ['roles.view'] },
    { labelKey: 'breadcrumb.auditLogs', descriptionKey: 'settings.auditLogsDesc', icon: 'history', route: '/settings/audit-logs', permissions: ['audit_logs.view'] },
    { labelKey: 'settings.recycleBin', descriptionKey: 'settings.recycleBinDesc', icon: 'restore_from_trash', route: '/settings/trash', permissions: ['users.view', 'masters.view', 'roles.view'] },
    { labelKey: 'settings.churchInfo', descriptionKey: 'settings.churchInfoDesc', icon: 'church', route: '/masters/churches', permissions: ['masters.view'] },
    { labelKey: 'settings.receiptSettings', descriptionKey: 'settings.receiptSettingsDesc', icon: 'receipt_long', route: '/masters/receipt_series', permissions: ['masters.view'] },
    { labelKey: 'settings.printSettings', descriptionKey: 'settings.printSettingsDesc', icon: 'print', route: '/masters/print_templates', permissions: ['masters.view'] },
  ];

  visibleCards(): SettingsCard[] {
    return this.cards.filter((c) => {
      if (c.masterAdminOnly) return this.authService.isMasterAdmin();
      if (c.adminOnly) return this.authService.currentUser()?.roleCode === 'ADMIN';
      return this.authService.hasAnyPermission(c.permissions);
    });
  }
}
