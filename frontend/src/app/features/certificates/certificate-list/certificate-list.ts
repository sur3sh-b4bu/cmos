import { Component, DestroyRef, Input, OnChanges, OnInit, TemplateRef, ViewChild, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { debounceTime, firstValueFrom } from 'rxjs';
import { DataTableComponent } from '../../../shared/components/data-table/data-table';
import { DataTableColumn } from '../../../shared/components/data-table/data-table.model';
import { FilterBarComponent } from '../../../shared/components/filter-bar/filter-bar';
import { FilterFieldDef } from '../../../shared/components/filter-bar/filter-bar.model';
import { MasterLookupService } from '../../../core/services/master-lookup.service';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { NotificationService } from '../../../core/services/notification.service';
import { FileDownloadService } from '../../../core/services/file-download.service';
import { extractErrorMessage } from '../../../core/utils/http-error.util';
import { AuthService } from '../../../core/services/auth.service';
import { RealtimeService } from '../../../core/services/realtime.service';
import { formatDateDMY } from '../../../core/utils/date-format.util';
import { CertificateService, CertificateType } from '../certificate.service';
import { ServerTransfer } from '../../../core/services/excel-transfer.service';
import { CERTIFICATE_CONFIGS } from '../certificate-config';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

const DATE_KEYS = new Set(['date_of_birth', 'date_of_baptism', 'marriage_date', 'date_of_confirmation', 'date_of_death', 'burial_date']);

@Component({
  selector: 'coms-certificate-list',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule, DataTableComponent, FilterBarComponent, TranslatePipe],
  templateUrl: './certificate-list.html',
  styleUrl: './certificate-list.scss',
})
export class CertificateListComponent implements OnChanges, OnInit {
  @Input({ required: true }) certType!: CertificateType;

  private certificateService = inject(CertificateService);
  private notification = inject(NotificationService);
  private fileDownload = inject(FileDownloadService);
  private dialog = inject(MatDialog);
  private translate = inject(TranslateService);
  private masterLookup = inject(MasterLookupService);
  private realtime = inject(RealtimeService);
  private destroyRef = inject(DestroyRef);
  authService = inject(AuthService);

  @ViewChild('actionsTpl', { static: true }) actionsTpl!: TemplateRef<unknown>;

  config = CERTIFICATE_CONFIGS.baptism;
  columns: DataTableColumn[] = [];
  /** Import / Export / template are done by the API (one code path for every certificate type; see certificateTransferService.js); rebuilt on every certType switch. */
  serverTransfer!: ServerTransfer;
  cellTemplates: Record<string, TemplateRef<unknown>> = {};

  rows = signal<any[]>([]);
  total = signal(0);
  loading = signal(false);
  pageIndex = signal(0);
  pageSize = signal(25);
  search = signal('');

  /** The certificate type's own structured filters (Priest, Gender, date
   * ranges, ...), rendered by coms-filter-bar -- see certificate-config.ts's
   * `filterFields`. Populated in buildFilterFields() below; 'select' fields'
   * `options` arrive a moment later, once their masters lookup resolves. */
  filterFields = signal<FilterFieldDef[]>([]);
  /** Currently active structured filters, already flattened to the exact
   * query-param shape the backend expects (see FilterBarComponent's own
   * `filtersChange` and certificateRepository.js's buildStructuredFilters)
   * -- merged straight into fetch()'s params below, AND'd with both each
   * other and the free-text search box. */
  filters = signal<Record<string, string>>({});

  ngOnChanges(): void {
    this.config = CERTIFICATE_CONFIGS[this.certType];
    this.columns = this.config.listColumns.map((col) =>
      DATE_KEYS.has(col.key)
        ? { ...col, accessor: (row: any) => formatDateDMY(row[col.key]) }
        : col
    );
    this.buildServerTransfer();
    // A different certType has a different (possibly empty) set of
    // filterFields, so whatever was active for the old type is meaningless
    // here -- clear it rather than carrying, say, Baptism's gender_id filter
    // silently into a Marriage fetch.
    this.filters.set({});
    this.buildFilterFields();
    this.cellTemplates = { actions: this.actionsTpl };
    this.pageIndex.set(0);
    // Angular reuses this same component instance across
    // /certificates/baptism -> /marriage -> /death (same route shape,
    // different :certType param), and `columns` above just switched to the
    // new type's shape *synchronously* -- but the rows for that new type
    // haven't arrived yet (fetch() below is async). Clearing rows here
    // closes the window where the old type's actual data would render
    // under the new type's column definitions (e.g. a Baptism row's
    // child_name/date_of_baptism cells showing blank/wrong once columns
    // have already flipped to Death's deceased_name/date_of_death).
    this.rows.set([]);
    this.total.set(0);
    this.fetch();
  }

  /** Builds this certType's filterFields immediately (a 'dateRange' field
   * needs nothing else), then fills in each 'select' field's `options` as
   * its masters lookup (Priests, Genders, ...) resolves. Safe to do on every
   * certType switch even though options load async -- FilterBarComponent
   * only clears the user's picks when the *set* of field keys changes, not
   * when an existing field's options are merged in afterwards. */
  private buildFilterFields(): void {
    this.filterFields.set(this.config.filterFields.map((f) => ({ key: f.key, label: f.label, type: f.type })));
    for (const field of this.config.filterFields) {
      if (!field.masterKey) continue;
      this.masterLookup.list<{ id: number; name: string }>(field.masterKey).subscribe((rows) => {
        this.filterFields.update((current) =>
          current.map((existing) =>
            existing.key === field.key
              ? { ...existing, options: rows.map((r) => ({ value: r.id, label: r.name })) }
              : existing
          )
        );
      });
    }
  }

  onFiltersChange(filters: Record<string, string>): void {
    this.filters.set(filters);
    this.pageIndex.set(0);
    this.fetch();
  }

  /** Set up once (unlike ngOnChanges, which re-fires every time Angular
   * reuses this same component instance for a different certType -- see its
   * own comment) -- another user of this church just changed a certificate;
   * only refetch if it's the type currently on screen, reading certType
   * fresh at event time rather than whatever it was when this subscribed. */
  ngOnInit(): void {
    this.realtime
      .on<{ type: CertificateType }>('certificates:changed')
      .pipe(debounceTime(400), takeUntilDestroyed(this.destroyRef))
      .subscribe((payload) => {
        if (payload.type === this.certType) this.fetch();
      });

  }

  private buildServerTransfer(): void {
    // Export follows the search box and filters on screen, like the list itself.
    this.serverTransfer = this.certificateService.transferConfig(this.certType, () => ({
      search: this.search() || undefined,
      ...this.filters(),
    }));
  }

  fetch(): void {
    this.loading.set(true);
    // Captured so a late-arriving response from a certType the user has
    // since navigated away from (out-of-order under rapid switching, or
    // just slow) can't overwrite what's now on screen for a different type.
    const requestedType = this.certType;
    this.certificateService
      .list(this.certType, {
        page: this.pageIndex() + 1,
        pageSize: this.pageSize(),
        search: this.search() || undefined,
        ...this.filters(),
      })
      .subscribe({
        next: (res) => {
          if (requestedType !== this.certType) return;
          this.rows.set(res.data);
          this.total.set(res.meta.total);
          this.loading.set(false);
        },
        error: () => {
          if (requestedType !== this.certType) return;
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

  async printCertificate(row: any): Promise<void> {
    await this.fileDownload.printPdf(this.certificateService.getPrintUrl(this.certType, row.id));
  }

  async deleteRow(row: any): Promise<void> {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.translate.instant('certificates.common.deleteConfirmTitle'),
        message: this.translate.instant('certificates.common.deleteConfirmMessage', {
          subject: this.config.subjectAccessor(row),
          no: row.certificate_no,
        }),
        confirmLabel: this.translate.instant('common.delete'),
        danger: true,
      },
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await firstValueFrom(this.certificateService.delete(this.certType, row.id));
      this.notification.success(this.translate.instant('certificates.common.deleted'));
      this.fetch();
    } catch (err) {
      this.notification.error(extractErrorMessage(err));
    }
  }
}
