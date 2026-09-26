import { Component, DestroyRef, OnInit, TemplateRef, ViewChild, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { ImportColumn, coerceImportValue } from '../../../shared/utils/excel-import.util';
import { fetchAllRows } from '../../../shared/utils/fetch-all-rows.util';
import { ImportIdResolverService } from '../../../core/services/import-id-resolver.service';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { NotificationService } from '../../../core/services/notification.service';
import { extractErrorMessage } from '../../../core/utils/http-error.util';
import { AuthService } from '../../../core/services/auth.service';
import { formatDateTimeDMY } from '../../../core/utils/date-format.util';
import { UserService } from './user.service';
import { AppUser, CreateUserRequest } from './user.model';
import { RoleService } from '../roles-permissions/role.service';
import { TempPasswordDialogComponent } from './temp-password-dialog';
import { BulkTempPasswordsDialogComponent } from './bulk-temp-passwords-dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'coms-users-list',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatIconModule, MatMenuModule, MatChipsModule, MatTooltipModule, DataTableComponent, TranslatePipe],
  templateUrl: './users-list.html',
  styleUrl: './users-list.scss',
})
export class UsersListComponent implements OnInit {
  private userService = inject(UserService);
  private roleService = inject(RoleService);
  private notification = inject(NotificationService);
  private dialog = inject(MatDialog);
  private translate = inject(TranslateService);
  private idResolver = inject(ImportIdResolverService);
  private destroyRef = inject(DestroyRef);
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
  importing = signal(false);

  /** Built in ngOnInit() (needs `translate`) using the exact same
   * translation keys the New User form's own mat-labels use (see
   * user-form.html), so a sheet built by copying what's on screen actually
   * matches. Sheet needs Role as either its raw numeric id (Settings >
   * Roles & Permissions) or its name, e.g. "Office Staff" -- see
   * onImportRows(). Church is never asked for -- it's always the importing
   * admin's own church, same as the New User form. Each row gets its own
   * auto-generated temp password server-side, same as a normal create --
   * all of them are shown together afterward (see onImportRows) since
   * there's no single-user dialog for N users. */
  importColumns: ImportColumn[] = [];

  ngOnInit(): void {
    this.columns = [
      { key: 'full_name', label: 'common.name', sortable: true },
      { key: 'username', label: 'auth.username' },
      { key: 'role_name', label: 'settings.role' },
      { key: 'church_name', label: 'masters.churches.singularLabel' },
      {
        key: 'last_login_at',
        label: 'settings.lastLogin',
        accessor: (r: AppUser) =>
          r.last_login_at ? formatDateTimeDMY(r.last_login_at) : this.translate.instant('settings.never'),
      },
      { key: 'status', label: 'common.status' },
      { key: 'actions', label: '', align: 'right' },
    ];
    this.buildImportColumns();
    // Rebuild if the site's language changes while this page is already
    // open -- see MassIntentionsListComponent's identical subscription for
    // why (LanguageService.setLanguage updates in place, no navigation).
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.buildImportColumns());
    this.cellTemplates = { status: this.statusTpl, actions: this.actionsTpl };
    this.fetch();
  }

  private buildImportColumns(): void {
    const t = (key: string) => this.translate.instant(key);
    this.importColumns = [
      { label: t('settings.fullName'), key: 'full_name' },
      { label: t('auth.username'), key: 'username' },
      { label: t('settings.email'), key: 'email' },
      { label: t('settings.phone'), key: 'phone' },
      { label: `${t('settings.role')} (Name or ID)`, key: 'role_id', masterKey: 'roles' },
      { label: t('settings.employeeCode'), key: 'employee_code' },
    ];
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

  /** Export Excel must cover every User matching the current search, not
   * just the page on screen -- see fetchAllRows. Bound as coms-data-table's
   * [exportAllFn]. */
  exportAllRows = (): Promise<AppUser[]> =>
    fetchAllRows((page, pageSize) => this.userService.list({ page, pageSize, search: this.search() || undefined }));

  /** Fired by coms-data-table once a picked .xlsx file has been parsed into
   * plain row objects. Creates one user per row via the same create() the
   * New User form uses -- sequential, not parallel, so a username collision
   * or other failure is attributable to a specific row. Every generated temp
   * password is collected and shown together at the end (see
   * BulkTempPasswordsDialogComponent), since they can only ever be seen
   * once. */
  async onImportRows(rows: Record<string, unknown>[]): Promise<void> {
    if (this.importing()) return;
    // A Master Administrator's own churchId is always null (see
    // CurrentUser.churchId) -- what matters for "which church do these
    // rows belong to" is its current switcher selection instead.
    const churchId = this.authService.activeChurchBranch()?.churchId ?? this.authService.currentUser()?.churchId;
    if (!churchId) return;

    this.importing.set(true);
    const created: { username: string; tempPassword: string }[] = [];
    const failures: string[] = [];

    // Roles aren't under the generic masters API (/api/roles is its own
    // resource), so preload() needs an explicit fetcher for this one key.
    await this.idResolver.preload(['roles'], { roles: () => firstValueFrom(this.roleService.listRoles()) });

    for (const [index, row] of rows.entries()) {
      const payload: CreateUserRequest = {
        full_name: String(coerceImportValue('text', row['full_name']) ?? ''),
        username: String(coerceImportValue('text', row['username']) ?? ''),
        email: coerceImportValue('text', row['email']) as string | undefined,
        phone: coerceImportValue('text', row['phone']) as string | undefined,
        role_id: this.idResolver.resolve('roles', row['role_id'])!,
        church_id: churchId,
        employee_code: coerceImportValue('text', row['employee_code']) as string | undefined,
      };
      try {
        const { user, tempPassword } = await firstValueFrom(this.userService.create(payload));
        created.push({ username: user.username, tempPassword });
      } catch (err) {
        failures.push(`${this.translate.instant('masters.importRow', { row: index + 2 })}: ${extractErrorMessage(err)}`);
      }
    }

    this.importing.set(false);
    if (created.length) {
      this.dialog.open(BulkTempPasswordsDialogComponent, { data: { rows: created }, width: '520px' });
      this.fetch();
    }
    if (failures.length) {
      const shown = failures.slice(0, 3).join(' | ') + (failures.length > 3 ? '…' : '');
      this.notification.error(
        `${this.translate.instant('masters.importSummaryFailed', { count: failures.length })} ${shown}`
      );
    }
  }

  async toggleActive(row: AppUser): Promise<void> {
    try {
      if (row.is_active) {
        await firstValueFrom(this.userService.deactivate(row.id));
        this.notification.success(this.translate.instant('settings.userDeactivated', { name: row.full_name }));
      } else {
        await firstValueFrom(this.userService.activate(row.id));
        this.notification.success(this.translate.instant('settings.userActivated', { name: row.full_name }));
      }
      this.fetch();
    } catch (err) {
      this.notification.error(extractErrorMessage(err));
    }
  }

  async resetPassword(row: AppUser): Promise<void> {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.translate.instant('settings.resetPasswordConfirmTitle'),
        message: this.translate.instant('settings.resetPasswordConfirmMessage', { name: row.full_name }),
        confirmLabel: this.translate.instant('settings.resetPassword'),
        danger: true,
      },
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      const { tempPassword } = await firstValueFrom(this.userService.resetPassword(row.id));
      this.dialog.open(TempPasswordDialogComponent, {
        data: { title: this.translate.instant('settings.newPasswordFor', { name: row.full_name }), password: tempPassword },
      });
    } catch (err) {
      this.notification.error(extractErrorMessage(err));
    }
  }
}
