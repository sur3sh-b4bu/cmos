import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MasterLookupService } from '../../../core/services/master-lookup.service';
import { NotificationService } from '../../../core/services/notification.service';
import { CurrencyService } from '../../../core/services/currency.service';
import { FileDownloadService } from '../../../core/services/file-download.service';
import { LanguageService } from '../../../core/services/language.service';
import { extractErrorMessage } from '../../../core/utils/http-error.util';
import { formatDateDMY, parseDateOnly } from '../../../core/utils/date-format.util';
import { DatepickerTodayHeaderComponent } from '../../../shared/components/datepicker-today-header/datepicker-today-header';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog';
import {
  DEFAULT_RESTRICTED_DATE_REASON,
  RestrictedDateRow,
  findRestrictedDate,
  isRestrictedDate,
} from '../../../core/utils/restricted-dates.util';
import { MassIntentionService } from '../mass-intention.service';
import { BulkBatch, MassIntention } from '../mass-intention.model';

interface MassOption {
  id: number;
  name: string;
  mass_time: string;
}
interface IntentionMasterOption {
  id: number;
  name: string;
  is_custom: number;
}

export interface BulkBatchDetailDialogData {
  batch: BulkBatch;
}

/**
 * One Bulk Mass Intention batch's individual intentions -- opened by
 * clicking a row on the "Show Bulk Mass Intentions" page (see
 * bulk-batches-list.ts). Inline edit/delete/reprint here is the exact same
 * capability the Bulk form's own results table offers right after saving
 * (see that component's "Inline edit, right in the results table"
 * section), just reachable later instead of only in that one session.
 * Fetches its own data rather than being handed it, same pattern as
 * CollectionsDetailDialogComponent/ReceivePaymentDialogComponent -- the
 * parent page always refetches its own summary row when this dialog
 * closes (see bulk-batches-list.ts's openBatch()), so nothing needs to be
 * pushed back out of here.
 */
@Component({
  selector: 'coms-bulk-batch-detail-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    TranslatePipe,
  ],
  templateUrl: './bulk-batch-detail-dialog.html',
  styleUrl: './bulk-batch-detail-dialog.scss',
})
export class BulkBatchDetailDialogComponent {
  data = inject<BulkBatchDetailDialogData>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<BulkBatchDetailDialogComponent>);
  private dialog = inject(MatDialog);
  private fb = inject(FormBuilder);
  private masterLookup = inject(MasterLookupService);
  private massIntentionService = inject(MassIntentionService);
  private notification = inject(NotificationService);
  private translate = inject(TranslateService);
  private fileDownload = inject(FileDownloadService);
  currencyService = inject(CurrencyService);
  languageService = inject(LanguageService);

  readonly todayHeader = DatepickerTodayHeaderComponent;
  readonly defaultRestrictedDateReason = DEFAULT_RESTRICTED_DATE_REASON;
  formatDate = formatDateDMY;

  loading = signal(true);
  printing = signal(false);
  rows = signal<MassIntention[]>([]);

  masses = signal<MassOption[]>([]);
  intentionOptions = signal<IntentionMasterOption[]>([]);
  restrictedDates = signal<RestrictedDateRow[]>([]);

  readonly formattedDate = formatDateDMY(this.data.batch.createdAt);

  constructor() {
    this.currencyService.load();
    this.masterLookup.list<MassOption>('masses').subscribe((rows) => this.masses.set(rows));
    this.masterLookup
      .list<IntentionMasterOption>('prayer_intention_master')
      .subscribe((rows) => this.intentionOptions.set(rows));
    this.masterLookup.list<RestrictedDateRow>('holidays').subscribe((rows) => this.restrictedDates.set(rows));

    this.massIntentionService.list({ bulkBatchId: this.data.batch.batchId, pageSize: 100 }).subscribe({
      next: (res) => {
        this.rows.set(res.data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  currency(v: number | string): string {
    return `${this.currencyService.current().symbol}${Number(v).toFixed(2)}`;
  }

  get total(): number {
    return this.rows().reduce((sum, r) => sum + Number(r.offering_amount), 0);
  }

  get paidCount(): number {
    return this.rows().filter((r) => r.is_paid).length;
  }

  async print(): Promise<void> {
    if (this.printing() || !this.paidCount) return;
    this.printing.set(true);
    try {
      await this.fileDownload.printPdf(
        this.massIntentionService.getBulkReceiptUrlByBatch(this.data.batch.batchId, this.languageService.current())
      );
    } finally {
      this.printing.set(false);
    }
  }

  async printRow(id: number): Promise<void> {
    await this.fileDownload.printHtml(this.massIntentionService.getReceiptPrintUrl(id, this.languageService.current()));
  }

  intentionText(rec: MassIntention): string {
    return rec.intention_is_custom ? rec.custom_intention || '-' : rec.intention_master_name || rec.custom_intention || '-';
  }

  close(): void {
    this.dialogRef.close();
  }

  // ---- Inline edit, right in this table (same pattern as
  // bulk-mass-intention-form.ts's own results table) -----------------------

  editingId = signal<number | null>(null);
  editRowForm: FormGroup = this.buildRow();
  private editOriginalDate: string | null = null;

  get tomorrowDate(): Date {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  get minPrayerDate(): Date | null {
    return this.editingId() ? null : this.tomorrowDate;
  }

  dateFilter = (date: Date | null): boolean => {
    if (!date) return false;
    if (this.editingId()) return true;
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.getTime() >= this.tomorrowDate.getTime();
  };

  private buildRow(): FormGroup {
    return this.fb.group({
      prayerDate: this.fb.control<Date>(this.tomorrowDate, Validators.required),
      name: this.fb.control('', [Validators.required, Validators.maxLength(150)]),
      massId: this.fb.control<number | null>(null, Validators.required),
      offeringAmount: this.fb.control<number>(0, [Validators.required, Validators.min(0.01)]),
      prayerIntentionMasterId: this.fb.control<number | null>(null),
      customIntention: this.fb.control(''),
    });
  }

  dateClass = (date: Date): string =>
    isRestrictedDate(this.restrictedDates(), date) ? 'bbdd-dialog__restricted-date-cell' : '';

  rowRestrictedDate(row: FormGroup): RestrictedDateRow | null {
    return findRestrictedDate(this.restrictedDates(), row.controls['prayerDate'].value);
  }

  rowIsCustomIntention(row: FormGroup): boolean {
    const id = row.controls['prayerIntentionMasterId'].value;
    return this.intentionOptions().find((o) => o.id === id)?.is_custom === 1;
  }

  startEdit(rec: MassIntention): void {
    this.editRowForm = this.buildRow();
    this.editRowForm.patchValue({
      prayerDate: parseDateOnly(rec.prayer_date),
      name: rec.name,
      massId: rec.mass_id,
      offeringAmount: Number(rec.offering_amount),
      prayerIntentionMasterId: rec.prayer_intention_master_id,
      customIntention: rec.custom_intention ?? '',
    });
    this.editOriginalDate = rec.prayer_date;
    this.editingId.set(rec.id);
  }

  cancelEdit(): void {
    this.editingId.set(null);
  }

  private toDateOnly(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  async saveEdit(): Promise<void> {
    const id = this.editingId();
    if (!id) return;
    this.editRowForm.markAllAsTouched();
    if (this.editRowForm.invalid) return;
    if (this.rowIsCustomIntention(this.editRowForm) && !String(this.editRowForm.controls['customIntention'].value ?? '').trim()) {
      this.notification.error(this.translate.instant('massIntentions.describeIntentionRequired'));
      return;
    }

    const raw = this.editRowForm.getRawValue();
    const newDate = this.toDateOnly(raw.prayerDate);
    if (newDate !== this.editOriginalDate) {
      const restricted = this.rowRestrictedDate(this.editRowForm);
      if (restricted) {
        this.notification.error(this.translate.instant('massIntentions.restrictedDateError', { name: restricted.name }));
        return;
      }
    }
    try {
      const updated = await firstValueFrom(
        this.massIntentionService.update(id, {
          name: raw.name,
          prayerDate: newDate,
          massId: raw.massId!,
          prayerIntentionMasterId: raw.prayerIntentionMasterId ?? undefined,
          customIntention: raw.customIntention || undefined,
          offeringAmount: raw.offeringAmount,
        })
      );
      this.rows.set(this.rows().map((r) => (r.id === id ? updated : r)));
      this.editingId.set(null);
      this.notification.success(this.translate.instant('massIntentions.updated'));
    } catch (err) {
      this.notification.error(extractErrorMessage(err));
    }
  }

  async deleteRow(rec: MassIntention): Promise<void> {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.translate.instant('massIntentions.deleteConfirmTitle'),
        message: this.translate.instant('massIntentions.deleteConfirmMessage', { name: rec.name, receipt: rec.receipt_no }),
        confirmLabel: this.translate.instant('common.delete'),
        danger: true,
      },
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await firstValueFrom(this.massIntentionService.delete(rec.id));
      const remaining = this.rows().filter((r) => r.id !== rec.id);
      this.rows.set(remaining);
      this.notification.success(this.translate.instant('massIntentions.deleted'));
      // Nothing left in this batch -- there's no more detail to show.
      if (!remaining.length) this.dialogRef.close();
    } catch (err) {
      this.notification.error(extractErrorMessage(err));
    }
  }
}
