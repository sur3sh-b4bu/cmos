import { Component, Input, OnChanges, TemplateRef, ViewChild, inject, signal } from '@angular/core';
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
import { ImportColumn, coerceImportValue, toImportColumns } from '../../../shared/utils/excel-import.util';
import { fetchAllRows } from '../../../shared/utils/fetch-all-rows.util';
import { ImportIdResolverService } from '../../../core/services/import-id-resolver.service';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { NotificationService } from '../../../core/services/notification.service';
import { extractErrorMessage } from '../../../core/utils/http-error.util';
import { AuthService } from '../../../core/services/auth.service';
import { MasterService } from '../master.service';
import { MASTER_CONFIGS } from '../master-config';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../../../core/services/language.service';

@Component({
  selector: 'coms-master-list',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatIconModule, MatMenuModule, MatChipsModule, MatTooltipModule, DataTableComponent, TranslatePipe],
  templateUrl: './master-list.html',
  styleUrl: './master-list.scss',
})
export class MasterListComponent implements OnChanges {
  @Input({ required: true }) masterKey!: string;

  private masterService = inject(MasterService);
  private notification = inject(NotificationService);
  private dialog = inject(MatDialog);
  private translate = inject(TranslateService);
  private languageService = inject(LanguageService);
  private idResolver = inject(ImportIdResolverService);
  authService = inject(AuthService);

  /** Creating a brand-new church (the tenant itself) is Master
   * Administrator-only -- see mastersController.create()'s matching
   * backend check. Every other master table just needs the regular
   * masters.create permission. */
  canCreate(): boolean {
    if (!this.authService.hasPermission('masters.create')) return false;
    return this.masterKey !== 'churches' || this.authService.isMasterAdmin();
  }

  @ViewChild('activeTpl', { static: true }) activeTpl!: TemplateRef<unknown>;
  @ViewChild('defaultTpl', { static: true }) defaultTpl!: TemplateRef<unknown>;
  @ViewChild('actionsTpl', { static: true }) actionsTpl!: TemplateRef<unknown>;

  config = MASTER_CONFIGS['churches'];
  columns: DataTableColumn[] = [];
  /** Import maps by the create-form's own fields (config.formFields), not
   * the table's display `columns` -- the two can differ (churches' table
   * hides several address fields the form still has), and formFields is
   * what's actually needed to create a valid record. Relational fields
   * (type 'select' with a masterKey, e.g. Church on Branches) accept either
   * the raw numeric id or the referenced row's name -- see onImportRows(),
   * which also registers the corresponding list column's own header (e.g.
   * "Church") as an alias, since that's what a plain Export shows. */
  importColumns: ImportColumn[] = [];
  cellTemplates: Record<string, TemplateRef<unknown>> = {};

  rows = signal<any[]>([]);
  total = signal(0);
  loading = signal(false);
  pageIndex = signal(0);
  pageSize = signal(25);
  search = signal('');
  reordering = signal(false);
  importing = signal(false);

  ngOnChanges(): void {
    this.config = MASTER_CONFIGS[this.masterKey];
    this.columns = [
      ...this.config.columns,
      ...(this.config.hasDefaultFlag ? [{ key: 'is_default', label: 'masters.fields.default' } as DataTableColumn] : []),
      { key: 'is_active', label: 'common.active' },
      { key: 'actions', label: '', align: 'right' },
    ];
    this.importColumns = toImportColumns(this.config.formFields, this.config.columns);
    this.cellTemplates = { is_active: this.activeTpl, is_default: this.defaultTpl, actions: this.actionsTpl };
    this.pageIndex.set(0);
    // Angular reuses this same component instance across e.g.
    // /masters/departments -> /masters/countries (same route shape,
    // different :masterKey param), and `columns` above just switched to the
    // new table's shape *synchronously* -- but its rows haven't arrived yet
    // (fetch() below is async). Clearing rows here closes the window where
    // the old table's actual data would render under the new table's column
    // definitions.
    this.rows.set([]);
    this.total.set(0);
    this.fetch();
  }

  fetch(): void {
    this.loading.set(true);
    // Captured so a late-arriving response from a masterKey the user has
    // since navigated away from (out-of-order under rapid switching, or
    // just slow) can't overwrite what's now on screen for a different table.
    const requestedKey = this.masterKey;
    this.masterService
      .list(this.masterKey, { page: this.pageIndex() + 1, pageSize: this.pageSize(), search: this.search() || undefined })
      .subscribe({
        next: (res) => {
          if (requestedKey !== this.masterKey) return;
          this.rows.set(res.data);
          this.total.set(res.meta.total);
          this.loading.set(false);
        },
        error: () => {
          if (requestedKey !== this.masterKey) return;
          this.loading.set(false);
        },
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

  /** Export Excel must cover every row of this masterKey matching the
   * current search, not just the page on screen -- see fetchAllRows. Bound
   * as coms-data-table's [exportAllFn]; reads this.masterKey fresh at call
   * time, same reasoning as fetch()'s own requestedKey capture. */
  exportAllRows = (): Promise<any[]> => {
    const masterKey = this.masterKey;
    return fetchAllRows((page, pageSize) =>
      this.masterService.list(masterKey, { page, pageSize, search: this.search() || undefined })
    );
  };

  async deleteRow(row: any): Promise<void> {
    const label = row.name ?? row.label ?? row.setting_key ?? row.series_name ?? row.certificate_type ?? `#${row.id}`;
    const singular = this.translate.instant(this.config.singularLabel);
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.translate.instant('masters.deleteConfirmTitle', { name: singular.toLowerCase() }),
        message: this.translate.instant('masters.deleteConfirmDropdownNote', { label }),
        confirmLabel: this.translate.instant('common.delete'),
        danger: true,
      },
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await firstValueFrom(this.masterService.delete(this.masterKey, row.id));
      this.notification.success(this.translate.instant('masters.deleted', { name: singular }));
      this.fetch();
    } catch (err) {
      this.notification.error(extractErrorMessage(err));
    }
  }

  /** Announcements and Restricted Dates only: a 'permanent' Announcement
   * (see lookupRepository.getActiveAnnouncements) or a Yearly-recurring
   * Restricted Date (see lookupRepository.getActiveRestrictedDates) never
   * auto-expires off the Dashboard on its own -- a one-time Restricted Date
   * or a dated Announcement just falls off once it passes, same as ever.
   * This is how the "never expires on its own" ones come on/off the
   * Dashboard instead -- a reversible toggle on is_active, deliberately NOT
   * deleteRow()'s soft-delete, so the row always stays here in Masters,
   * still editable, regardless of which state it's in. Kept as a one-off
   * masterKey check rather than a generic config flag since no other master
   * has this "stays in Masters, toggles on/off the Dashboard" distinction
   * (mirrors the existing one-off `this.masterKey === 'languages'` check in
   * setDefaultRow() below). Hiding asks for confirmation (it's live on the
   * Dashboard right now); restoring doesn't -- there's nothing to lose. */
  async toggleDashboardVisibility(row: any): Promise<void> {
    const makeActive = !row.is_active;
    // Announcements name themselves via `title`, Restricted Dates via `name`.
    const name = this.masterKey === 'holidays' ? row.name : row.title;
    // removeConfirmMessage is the only wording that actually differs between
    // the two ("Dashboard's Announcements" vs "...Upcoming Restricted
    // Dates") -- see masters.holidays.removeConfirmMessage in en.ts/ta.ts.
    // Everything else ("Remove/Restore to Dashboard", the toasts) reads
    // generically enough to share as-is.
    const messageKey = this.masterKey === 'holidays' ? 'masters.holidays.removeConfirmMessage' : 'masters.announcements.removeConfirmMessage';

    if (!makeActive) {
      const ref = this.dialog.open(ConfirmDialogComponent, {
        data: {
          title: this.translate.instant('masters.announcements.removeConfirmTitle', { name }),
          message: this.translate.instant(messageKey, { label: name }),
          confirmLabel: this.translate.instant('masters.announcements.removeFromDashboard'),
        },
      });
      const confirmed = await firstValueFrom(ref.afterClosed());
      if (!confirmed) return;
    }

    try {
      await firstValueFrom(this.masterService.update(this.masterKey, row.id, { is_active: makeActive }));
      this.notification.success(
        this.translate.instant(makeActive ? 'masters.announcements.restored' : 'masters.announcements.removed', { name })
      );
      this.fetch();
    } catch (err) {
      this.notification.error(extractErrorMessage(err));
    }
  }

  async setDefaultRow(row: any): Promise<void> {
    try {
      await firstValueFrom(this.masterService.setDefault(this.masterKey, row.id));

      // Masters -> Languages -> Set Default doesn't just flip a DB flag --
      // it drives the actual UI language (see LanguageService). Switch
      // *before* building the confirmation toast below, so the toast itself
      // reads in the newly-applied language rather than the old one.
      let unsupportedLanguage = false;
      if (this.masterKey === 'languages') {
        const mapped = this.languageService.mapCode(row.code);
        if (mapped) {
          this.languageService.setLanguage(mapped);
        } else {
          unsupportedLanguage = true;
        }
      }

      const singular = this.translate.instant(this.config.singularLabel);
      this.notification.success(
        this.translate.instant('masters.nowDefault', { name: row.name, singular: singular.toLowerCase() })
      );
      if (unsupportedLanguage) {
        this.notification.info(this.translate.instant('masters.languageNotTranslated', { name: row.name }));
      }
      this.fetch();
    } catch (err) {
      this.notification.error(extractErrorMessage(err));
    }
  }

  /** Fired by coms-data-table once a picked .xlsx file has been parsed into
   * plain row objects (see excel-import.util.ts). Creates one record per row
   * via the same generic create() every other Masters save already uses --
   * sequential, not parallel, so failures are attributable to a specific row
   * and the server isn't hit with a burst of N concurrent requests. */
  async onImportRows(rows: Record<string, unknown>[]): Promise<void> {
    if (this.importing()) return;
    this.importing.set(true);
    let succeeded = 0;
    const failures: string[] = [];

    const masterKeys = this.config.formFields.filter((f) => f.masterKey).map((f) => f.masterKey!);
    await this.idResolver.preload(masterKeys);

    for (const [index, row] of rows.entries()) {
      const payload: Record<string, unknown> = {};
      for (const field of this.config.formFields) {
        const coerced = field.masterKey
          ? this.idResolver.resolve(field.masterKey, row[field.key])
          : coerceImportValue(field.type, row[field.key]);
        if (coerced !== undefined) payload[field.key] = coerced;
      }
      try {
        await firstValueFrom(this.masterService.create(this.masterKey, payload));
        succeeded++;
      } catch (err) {
        // +2: the sheet's header row plus 1-based row numbering, so this
        // matches the row number the user actually sees in Excel.
        failures.push(`${this.translate.instant('masters.importRow', { row: index + 2 })}: ${extractErrorMessage(err)}`);
      }
    }

    this.importing.set(false);
    if (succeeded) {
      this.notification.success(this.translate.instant('masters.importSummarySuccess', { count: succeeded }));
      this.fetch();
    }
    if (failures.length) {
      const shown = failures.slice(0, 3).join(' | ') + (failures.length > 3 ? '…' : '');
      this.notification.error(
        `${this.translate.instant('masters.importSummaryFailed', { count: failures.length })} ${shown}`
      );
    }
  }

  async moveRow(row: any, direction: -1 | 1): Promise<void> {
    const ids = this.rows().map((r) => r.id);
    const index = ids.indexOf(row.id);
    const swapWith = index + direction;
    if (swapWith < 0 || swapWith >= ids.length) return;
    [ids[index], ids[swapWith]] = [ids[swapWith], ids[index]];

    this.reordering.set(true);
    try {
      await firstValueFrom(this.masterService.reorder(this.masterKey, ids));
      this.fetch();
    } catch (err) {
      this.notification.error(extractErrorMessage(err));
    } finally {
      this.reordering.set(false);
    }
  }
}
