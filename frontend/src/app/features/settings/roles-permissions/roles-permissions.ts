import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { firstValueFrom } from 'rxjs';
import { NotificationService } from '../../../core/services/notification.service';
import { extractErrorMessage } from '../../../core/utils/http-error.util';
import { RoleService, Role, Permission } from './role.service';

interface ModuleGroup {
  module: string;
  permissions: Permission[];
}

@Component({
  selector: 'coms-roles-permissions',
  standalone: true,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './roles-permissions.html',
  styleUrl: './roles-permissions.scss',
})
export class RolesPermissionsComponent implements OnInit {
  private roleService = inject(RoleService);
  private notification = inject(NotificationService);

  roles = signal<Role[]>([]);
  allPermissions = signal<Permission[]>([]);
  selectedRoleId = signal<number | null>(null);
  checkedIds = signal<Set<number>>(new Set());
  loading = signal(false);
  saving = signal(false);

  selectedRole = computed(() => this.roles().find((r) => r.id === this.selectedRoleId()) ?? null);

  groupedPermissions = computed<ModuleGroup[]>(() => {
    const map = new Map<string, Permission[]>();
    for (const p of this.allPermissions()) {
      if (!map.has(p.module)) map.set(p.module, []);
      map.get(p.module)!.push(p);
    }
    return Array.from(map.entries()).map(([module, permissions]) => ({ module, permissions }));
  });

  ngOnInit(): void {
    this.roleService.listRoles().subscribe((roles) => {
      this.roles.set(roles);
      if (roles.length) this.selectRole(roles[0].id);
    });
    this.roleService.listPermissions().subscribe((permissions) => this.allPermissions.set(permissions));
  }

  selectRole(roleId: number): void {
    this.selectedRoleId.set(roleId);
    this.loading.set(true);
    this.roleService.getRolePermissionIds(roleId).subscribe({
      next: (ids) => {
        this.checkedIds.set(new Set(ids));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  isChecked(permissionId: number): boolean {
    return this.checkedIds().has(permissionId);
  }

  toggle(permissionId: number): void {
    const next = new Set(this.checkedIds());
    if (next.has(permissionId)) next.delete(permissionId);
    else next.add(permissionId);
    this.checkedIds.set(next);
  }

  toggleModule(group: ModuleGroup, checked: boolean): void {
    const next = new Set(this.checkedIds());
    for (const p of group.permissions) {
      if (checked) next.add(p.id);
      else next.delete(p.id);
    }
    this.checkedIds.set(next);
  }

  formatModuleName(module: string): string {
    return module
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  isModuleFullyChecked(group: ModuleGroup): boolean {
    return group.permissions.every((p) => this.checkedIds().has(p.id));
  }

  isModulePartiallyChecked(group: ModuleGroup): boolean {
    const checkedCount = group.permissions.filter((p) => this.checkedIds().has(p.id)).length;
    return checkedCount > 0 && checkedCount < group.permissions.length;
  }

  async save(): Promise<void> {
    const roleId = this.selectedRoleId();
    if (!roleId) return;
    this.saving.set(true);
    try {
      await firstValueFrom(this.roleService.setRolePermissions(roleId, Array.from(this.checkedIds())));
      this.notification.success(`Permissions updated for ${this.selectedRole()?.name}.`);
    } catch (err) {
      this.notification.error(extractErrorMessage(err));
    } finally {
      this.saving.set(false);
    }
  }
}
