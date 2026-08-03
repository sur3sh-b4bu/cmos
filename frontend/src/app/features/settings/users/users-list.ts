import { Component, OnInit, TemplateRef, ViewChild, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { DataTableComponent } from '../../../shared/components/data-table/data-table';
import { DataTableColumn } from '../../../shared/components/data-table/data-table.model';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { NotificationService } from '../../../core/services/notification.service';
import { extractErrorMessage } from '../../../core/utils/http-error.util';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from './user.service';
import { AppUser } from './user.model';
import { TempPasswordDialogComponent } from './temp-password-dialog';

@Component({
  selector: 'coms-users-list',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatIconModule, MatMenuModule, MatChipsModule, MatTooltipModule, DataTableComponent],
  templateUrl: './users-list.html',
  styleUrl: './users-list.scss',
})
export class UsersListComponent implements OnInit {
  private userService = inject(UserService);
  private notification = inject(NotificationService);
  private dialog = inject(MatDialog);
  authService = inject(AuthService);

  @ViewChild('statusTpl', { static: true }) statusTpl!: TemplateRef<unknown>;
  @ViewChild('actionsTpl', { static: true }) actionsTpl!: TemplateRef<unknown>;

  columns: DataTableColumn[] = [];
  cellTemplates: Record<string, TemplateRef<unknown>> = {};

  rows = signal<AppUser[]>([]);
  total = signal(0);
  loading = signal(false);
  pageIndex = signal(0);
  pageSize = signal(25);
  search = signal('');

  ngOnInit(): void {
    this.columns = [
      { key: 'full_name', label: 'Name', sortable: true },
      { key: 'username', label: 'Username' },
      { key: 'role_name', label: 'Role' },
      { key: 'church_name', label: 'Church' },
      {
        key: 'last_login_at',
        label: 'Last Login',
        accessor: (r: AppUser) => (r.last_login_at ? new Date(r.last_login_at).toLocaleString('en-GB') : 'Never'),
      },
      { key: 'status', label: 'Status' },
      { key: 'actions', label: '', align: 'right' },
    ];
    this.cellTemplates = { status: this.statusTpl, actions: this.actionsTpl };
    this.fetch();
  }

  fetch(): void {
    this.loading.set(true);
    this.userService.list({ page: this.pageIndex() + 1, pageSize: this.pageSize(), search: this.search() || undefined }).subscribe({
      next: (res) => {
        this.rows.set(res.data);
        this.total.set(res.meta.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onPageChange(event: { pageIndex: number; pageSize: number }): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.fetch();
  }

  onSearchChange(term: string): void {
    this.search.set(term);
    this.pageIndex.set(0);
    this.fetch();
  }

  async toggleActive(row: AppUser): Promise<void> {
    try {
      if (row.is_active) {
        await firstValueFrom(this.userService.deactivate(row.id));
        this.notification.success(`${row.full_name} deactivated.`);
      } else {
        await firstValueFrom(this.userService.activate(row.id));
        this.notification.success(`${row.full_name} activated.`);
      }
      this.fetch();
    } catch (err) {
      this.notification.error(extractErrorMessage(err));
    }
  }

  async resetPassword(row: AppUser): Promise<void> {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Reset password?',
        message: `Generate a new temporary password for "${row.full_name}"? Their current password will stop working immediately.`,
        confirmLabel: 'Reset Password',
        danger: true,
      },
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      const { tempPassword } = await firstValueFrom(this.userService.resetPassword(row.id));
      this.dialog.open(TempPasswordDialogComponent, {
        data: { title: `New password for ${row.full_name}`, password: tempPassword },
      });
    } catch (err) {
      this.notification.error(extractErrorMessage(err));
    }
  }
}
