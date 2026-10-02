import { Component, OnInit, ViewChild, WritableSignal, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Observable, firstValueFrom, throwError } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MasterLookupService } from '../../../core/services/master-lookup.service';
import { NotificationService } from '../../../core/services/notification.service';
import { CurrencyService } from '../../../core/services/currency.service';
import { FileDownloadService } from '../../../core/services/file-download.service';
import { LanguageService } from '../../../core/services/language.service';
import { extractErrorMessage } from '../../../core/utils/http-error.util';
import { formatDateDMY, parseDateOnly } from '../../../core/utils/date-format.util';
import { phoneValidator } from '../../../shared/utils/phone.validator';
import { localizedName } from '../../../core/utils/localized-name.util';
import { baminiToUnicode } from '../../../core/utils/bamini-to-unicode.util';
import { MassIntentionService } from '../mass-intention.service';
import { CreateMassIntentionRequest, MassIntention } from '../mass-intention.model';
import { DatepickerTodayHeaderComponent } from '../../../shared/components/datepicker-today-header/datepicker-today-header';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog';
import {
  DEFAULT_RESTRICTED_DATE_REASON,
  RestrictedDateRow,
  findRestrictedDate,
  isRestrictedDate,
} from '../../../core/utils/restricted-dates.util';
import {
  PaymentConfirmMethod,
  PaymentConfirmPanelComponent,
  PaymentConfirmedEvent,
} from '../../../shared/components/payment-confirm-panel/payment-confirm-panel';
import { mapPaymentMethodCode } from '../../../shared/utils/payment-method.util';

interface MassOption {
  id: number;
  name: string;
  name_ta: string | null;
  mass_time: string;
  default_offering_amount: string | number;
}
interface IntentionMasterOption {
  id: number;
  name: string;
  name_ta: string | null;
  is_custom: number;
}
interface PaymentMethodOption {
  id: number;
  name: string;
  code: string;
}

interface RowFailure {
  row: number;
  message: string;
}

/**
 * A second, deliberately different entry point from mass-intention-form.ts
 * for the case of one person booking several Mass Intentions across several
 * different dates/Masses in one visit (e.g. a novena) -- Booked By, Phone
 * and Payment Method are asked ONCE and shared across every row, instead of
 * re-typing the same answers N times through the single-entry form. Each
 * grid row still becomes its own independent Mass Intention record on save
 * (its own receipt number, its own date/Mass/offering amount) -- there is
 * no combined/aggregate receipt here, same "1 booking = 1 receipt" rule as
 * everywhere else in this module.
 *
 * Offering Amount is NOT a shared header field -- exactly like the
 * single-entry form, each row's amount is auto-filled from whichever Mass
 * that row selects (Masters > Masses > Default Offering Amount), since
 * different Masses legitimately cost different amounts. It's still
 * per-row editable after the auto-fill, same as the single form.
 *
 * Payment works the same way it does in the single-entry form: confirming
 * payment (via the shared PaymentConfirmPanelComponent -- including the
 * full UPI QR / Simulate Success flow) is what actually triggers the save,
 * for the WHOLE batch at once -- there is no separate "just save, unpaid"
 * action. The amount shown on the UPI QR / confirmation is the *sum* of
 * every row's own (Mass-driven) offering amount, since one payment covers
 * the whole batch. Under the hood each row still gets its own create() +
 * receivePayment() call for its own amount (the DB has no concept of one
 * payment spanning many bookings), all sharing the one payment method/
 * reference the panel confirmed.
 */
@Component({
  selector: 'coms-bulk-mass-intention-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    PaymentConfirmPanelComponent,
    TranslatePipe,
  ],
  templateUrl: './bulk-mass-intention-form.html',
  styleUrl: './bulk-mass-intention-form.scss',
})
export class BulkMassIntentionFormComponent implements OnInit {
  @ViewChild('mainPaymentPanel') private paymentPanel?: PaymentConfirmPanelComponent;
  @ViewChild('addPaymentPanel') private addPaymentPanel?: PaymentConfirmPanelComponent;

  private fb = inject(FormBuilder);
  private masterLookup = inject(MasterLookupService);
  private massIntentionService = inject(MassIntentionService);
  private notification = inject(NotificationService);
  private translate = inject(TranslateService);
  private fileDownload = inject(FileDownloadService);
  private dialog = inject(MatDialog);
  currencyService = inject(CurrencyService);
  languageService = inject(LanguageService);

  /** calendarHeaderComponent needs a class reference, not a template var. */
  readonly todayHeader = DatepickerTodayHeaderComponent;
  formatDateDMY = formatDateDMY;
  readonly defaultRestrictedDateReason = DEFAULT_RESTRICTED_DATE_REASON;

  get tomorrowDate(): Date {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  get minPrayerDate(): Date {
    return this.tomorrowDate;
  }

  dateFilter = (date: Date | null): boolean => {
    if (!date) return false;
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.getTime() >= this.tomorrowDate.getTime();
  };

  futureDateValidator = (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) return null;
    const d = new Date(control.value);
    d.setHours(0, 0, 0, 0);
    return d.getTime() >= this.tomorrowDate.getTime() ? null : { pastOrToday: true };
  };

  masses = signal<MassOption[]>([]);
  intentionOptions = signal<IntentionMasterOption[]>([]);
  paymentMethods = signal<PaymentMethodOption[]>([]);
  restrictedDates = signal<RestrictedDateRow[]>([]);

  saving = signal(false);
  results = signal<{ succeeded: MassIntention[]; failed: RowFailure[] } | null>(null);

  /** One id per form instance (i.e. per visit to this page), stamped on
   * every row this save creates -- including ones added afterward via
   * "Add one more" (see onAddRowPaymentConfirmed), since those are still
   * part of the same bulk booking session. Lets the combined receipt be
   * reprinted later from "Show Bulk Mass Intentions" on the list page,
   * instead of only ever being printable once, right after saving. */
  private readonly bulkBatchId = crypto.randomUUID();

  readonly quickCountPresets = [2, 4, 6, 8, 10, 15, 20, 30];

  /** Shared across every row -- see this component's own doc comment above. */
  headerForm = this.fb.group({
    bookedBy: [''],
    phone: ['', phoneValidator],
    paymentMethodId: [null as number | null, Validators.required],
    massCount: [2, [Validators.required, Validators.min(2), Validators.max(100)]],
  });

  rowsArray = this.fb.array([this.buildRow(), this.buildRow()]);

  private buildRow(): FormGroup {
    const group = this.fb.group({
      prayerDate: this.fb.control<Date>(this.tomorrowDate, [Validators.required, this.futureDateValidator]),
      name: this.fb.control('', [Validators.required, Validators.maxLength(150)]),
      massId: this.fb.control<number | null>(null, Validators.required),
      offeringAmount: this.fb.control<number>(0, [Validators.required, Validators.min(0)]),
      prayerIntentionMasterId: this.fb.control<number | null>(null),
      customIntention: this.fb.control(''),
    });
    // "On selecting the Mass, the default offering amount should appear" --
    // same behaviour as mass-intention-form.ts, just per grid row here.
    group.controls.massId.valueChanges.subscribe((massId) => {
      group.controls.offeringAmount.setValue(this.massDefaultOffering(massId));
    });
    return group;
  }

  private massDefaultOffering(massId: number | null): number {
    return Number(this.masses().find((m) => m.id === massId)?.default_offering_amount) || 0;
  }

  get rows(): FormGroup[] {
    return this.rowsArray.controls as FormGroup[];
  }

  get targetCount(): number {
    const count = Number(this.headerForm.controls.massCount.value);
    return !isNaN(count) && count >= 2 ? count : Math.max(2, this.rowsArray.length);
  }

  get remainingNeeded(): number {
    return Math.max(0, this.targetCount - this.validRowCount);
  }

  get isCountSatisfied(): boolean {
    return this.targetCount >= 2 && this.validRowCount === this.targetCount && this.rowsArray.length === this.targetCount;
  }

  get progressPercent(): number {
    if (!this.targetCount) return 0;
    return Math.min(100, Math.round((this.validRowCount / this.targetCount) * 100));
  }

  setMassCount(count: number): void {
    if (count < 2 || count > 100) return;
    this.headerForm.controls.massCount.setValue(count);
  }

  private syncRowsToTargetCount(target: number): void {
    if (target < 2 || target > 100) return;
    const current = this.rowsArray.length;
    if (target > current) {
      for (let i = current; i < target; i++) {
        this.rowsArray.push(this.buildRow());
      }
    } else if (target < current) {
      while (this.rowsArray.length > target && this.rowsArray.length > 2) {
        this.rowsArray.removeAt(this.rowsArray.length - 1);
      }
    }
  }

  /** The payment panel never operates against a single already-known record
   * here (entityId is always null -- "local confirm" mode, same as the
   * single-entry form's create mode) -- see the class doc comment above for
   * why receivePayment() genuinely happens per row instead, in
   * onPaymentConfirmed(). This is only bound to satisfy the panel's
   * required @Input; it should never actually run. */
  receivePaymentFn = (): Observable<never> =>
    throwError(() => new Error('Bulk Mass Intention payment is confirmed once for the whole batch, not per row.'));

  ngOnInit(): void {
    this.currencyService.load();
    this.masterLookup.list<MassOption>('masses').subscribe((rows) => this.masses.set(rows));
    this.masterLookup
      .list<IntentionMasterOption>('prayer_intention_master')
      .subscribe((rows) => this.intentionOptions.set(rows));
    this.masterLookup.list<PaymentMethodOption>('payment_methods').subscribe((rows) => this.paymentMethods.set(rows));
    this.masterLookup.list<RestrictedDateRow>('holidays').subscribe((rows) => this.restrictedDates.set(rows));

    this.headerForm.controls.massCount.valueChanges.subscribe((val) => {
      const target = Number(val);
      if (target && target >= 2 && target <= 100) {
        this.syncRowsToTargetCount(target);
      }
    });
  }

  /** Visually badges Restricted Dates in every calendar (grid rows, inline
   * edit, add-row) without blocking selection -- same "warn, don't block"
   * rule as mass-intention-form.ts's own dateClass. */
  dateClass = (date: Date): string =>
    isRestrictedDate(this.restrictedDates(), date) ? 'bulk-form__restricted-date-cell' : '';

  /** The Restricted Date row a given row's currently-picked date falls on,
   * if any -- drives the small inline warning shown right under that row's
   * date field, and blocks payment until it's changed (see
   * readyToConfirmPayment/addRowReady). The backend independently
   * re-checks on save regardless (see assertNotRestrictedDate). */
  rowRestrictedDate(row: FormGroup): RestrictedDateRow | null {
    return findRestrictedDate(this.restrictedDates(), row.controls['prayerDate'].value);
  }

  addRow(): void {
    this.rowsArray.push(this.buildRow());
    this.headerForm.controls.massCount.setValue(this.rowsArray.length, { emitEvent: false });
  }

  removeRow(index: number): void {
    if (this.rowsArray.length <= 2) return; // always at least 2 rows for bulk booking
    this.rowsArray.removeAt(index);
    this.headerForm.controls.massCount.setValue(this.rowsArray.length, { emitEvent: false });
  }

  rowIsCustomIntention(row: FormGroup): boolean {
    const id = row.controls['prayerIntentionMasterId'].value;
    return this.intentionOptions().find((o) => o.id === id)?.is_custom === 1;
  }

  /** Dropdown option labels -- Tamil when the site's language is Tamil and
   * one's been filled in via Masters, else English. See
   * localized-name.util.ts / mass-intention-form.ts's identical methods. */
  intentionLabel(opt: IntentionMasterOption): string {
    return localizedName(opt, this.languageService.current());
  }

  massLabel(opt: MassOption): string {
    return localizedName(opt, this.languageService.current());
  }

  /** "Type in Bamini" toggles for the header's Booked By and every row's
   * Name/Custom Intention -- see mass-intention-form.ts's identical doc
   * comment for why this exists and how the conversion/reset works. Keyed
   * by (FormGroup, field) via a WeakMap rather than a signal per row array
   * entry, since rows here are created/destroyed freely (addRow/removeRow,
   * the separate editRowForm/addRowForm) -- this way any FormGroup (a main
   * grid row, headerForm, editRowForm, or addRowForm) gets its own signal
   * lazily, with nothing to manually clean up when a row is removed. */
  private baminiState = new WeakMap<FormGroup, Record<string, WritableSignal<boolean>>>();

  /** Parallel flat list of every signal `baminiSignal()` below has ever
   * created, purely so the language-change effect (see constructor) has
   * something to iterate -- a WeakMap can't be enumerated by design. Only
   * holds the small boolean signal objects, never the FormGroups
   * themselves, so it doesn't defeat baminiState's own GC-friendliness for
   * removed rows. */
  private allBaminiSignals: WritableSignal<boolean>[] = [];

  /** Keeps every already-created toggle above in sync if the site language
   * changes while this form is open, not just on initial load -- see
   * LanguageService.isTamil's own doc comment. */
  constructor() {
    effect(() => {
      const isTamil = this.languageService.isTamilTextInput();
      for (const sig of this.allBaminiSignals) sig.set(isTamil);
    });
  }

  baminiSignal(group: FormGroup, field: string): WritableSignal<boolean> {
    let fields = this.baminiState.get(group);
    if (!fields) {
      fields = {};
      this.baminiState.set(group, fields);
    }
    if (!fields[field]) {
      fields[field] = signal(this.languageService.isTamilTextInput());
      this.allBaminiSignals.push(fields[field]);
    }
    return fields[field];
  }

  toggleBamini(mode: WritableSignal<boolean>): void {
    mode.update((v) => !v);
  }

  convertBaminiOnBlur(group: FormGroup, field: string): void {
    const mode = this.baminiSignal(group, field);
    if (!mode()) return;
    const control = group.controls[field];
    control.setValue(baminiToUnicode(control.value));
    mode.set(false);
  }

  /** Drives the payment panel -- a plain getter, not computed(), since it
   * reads reactive-forms control values which aren't themselves signals
   * (same reasoning as mass-intention-form.ts's own selectedPaymentMethod). */
  get selectedPaymentMethod(): PaymentConfirmMethod | null {
    const id = this.headerForm.controls.paymentMethodId.value;
    return this.paymentMethods().find((m) => m.id === id) ?? null;
  }

  /** Shown on the UPI QR / demo panel and actually charged -- the sum of
   * every row's own (Mass-driven) offering amount, since one payment (one
   * QR scan, one "Payment Received" click) covers the whole batch even
   * though each row is still recorded as its own individual payment behind
   * the scenes, each for its own amount. */
  get totalAmount(): number {
    return this.rows.reduce((sum, row) => sum + (Number(row.controls['offeringAmount'].value) || 0), 0);
  }

  get paymentPurposeText(): string {
    return this.translate.instant('massIntentions.bulkPurposeText', { count: this.rowsArray.length });
  }

  isRowValid(row: FormGroup): boolean {
    if (row.invalid) return false;
    const name = String(row.controls['name']?.value ?? '').trim();
    const massId = row.controls['massId']?.value;
    const prayerDate = row.controls['prayerDate']?.value;
    if (!name || !massId || !prayerDate) return false;
    if (this.rowIsCustomIntention(row) && !String(row.controls['customIntention']?.value ?? '').trim()) {
      return false;
    }
    if (this.rowRestrictedDate(row)) return false;
    return true;
  }

  get validRowCount(): number {
    return this.rows.filter((r) => this.isRowValid(r)).length;
  }

  get readyToConfirmPayment(): boolean {
    if (this.headerForm.invalid || !this.rowsArray.length || this.rowsArray.invalid) return false;
    if (!this.isCountSatisfied) return false;
    return this.rows.every(
      (row) =>
        (!this.rowIsCustomIntention(row) || !!String(row.controls['customIntention'].value ?? '').trim()) &&
        !this.rowRestrictedDate(row)
    );
  }

  private toDateOnly(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /** Fired once the payment panel confirms -- for cash/cheque/bank
   * transfer/other this happens on the "Payment Received" click; for UPI,
   * after "Simulate Payment Success" on the demo QR. Either way this is
   * what actually creates (and pays) every row -- there's no separate Save
   * button, same design as the single-entry form. */
  async onPaymentConfirmed(event: PaymentConfirmedEvent): Promise<void> {
    if (this.saving()) return;
    this.headerForm.markAllAsTouched();
    this.rowsArray.markAllAsTouched();
    if (!this.readyToConfirmPayment) {
      this.notification.error(this.translate.instant('massIntentions.fillRequiredFields'));
      return;
    }

    this.saving.set(true);
    this.results.set(null);
    const header = this.headerForm.getRawValue();
    const method = mapPaymentMethodCode(this.selectedPaymentMethod?.code);
    const succeeded: MassIntention[] = [];
    const failed: RowFailure[] = [];
    const unresolvedRows: FormGroup[] = [];

    // Sequential, not parallel -- failures are attributable to a specific
    // row, and the receipt-number series (assigned server-side per row)
    // can't race itself, same reasoning as Excel Import.
    for (const [index, row] of this.rows.entries()) {
      const raw = row.getRawValue();
      const payload: CreateMassIntentionRequest = {
        name: raw.name,
        bookedBy: header.bookedBy || undefined,
        phone: header.phone || undefined,
        prayerDate: this.toDateOnly(raw.prayerDate),
        massId: raw.massId!,
        prayerIntentionMasterId: raw.prayerIntentionMasterId ?? undefined,
        customIntention: raw.customIntention || undefined,
        offeringAmount: raw.offeringAmount,
        paymentMethodId: header.paymentMethodId ?? undefined,
        bulkBatchId: this.bulkBatchId,
      };
      try {
        const created = await firstValueFrom(this.massIntentionService.create(payload));
        try {
          const paid = await firstValueFrom(
            this.massIntentionService.receivePayment(created.id, { method, referenceNumber: event.referenceNumber })
          );
          succeeded.push(paid);
        } catch {
          // Booked, but recording the payment failed -- already has a
          // receipt number, so it's payable from the list's own "Receive
          // Payment" action rather than being resubmitted here.
          failed.push({
            row: index + 1,
            message: this.translate.instant('massIntentions.savedPaymentFailed', { receipt: created.receipt_no }),
          });
        }
      } catch (err) {
        failed.push({ row: index + 1, message: extractErrorMessage(err) });
        unresolvedRows.push(row); // never created -- worth keeping to fix and retry
      }
    }

    this.saving.set(false);
    this.results.set({ succeeded, failed });

    if (succeeded.length) {
      this.notification.success(this.translate.instant('massIntentions.bulkSummarySuccess', { count: succeeded.length }));
    }
    if (failed.length) {
      this.notification.error(this.translate.instant('massIntentions.bulkSummaryFailed', { count: failed.length }));
      // Only the rows that never even got created are left in the grid --
      // re-confirming payment must not recreate/re-pay ones that already
      // succeeded. The panel resets so the user can confirm again for just
      // what's left.
      this.rowsArray.clear();
      (unresolvedRows.length >= 2 ? unresolvedRows : [this.buildRow(), this.buildRow()]).forEach((r) => this.rowsArray.push(r));
      this.headerForm.controls.massCount.setValue(this.rowsArray.length, { emitEvent: false });
      this.paymentPanel?.reset();
    } else if (succeeded.length) {
      // Everything in the batch saved and paid -- clear the grid for a
      // fresh batch, but stay on the page: the results panel below now
      // lists exactly what was just created, each with its own Print
      // Receipt action, same as the single-entry form's own success panel.
      this.rowsArray.clear();
      this.rowsArray.push(this.buildRow());
      this.rowsArray.push(this.buildRow());
      this.headerForm.controls.massCount.setValue(2, { emitEvent: false });
      this.paymentPanel?.reset();
    }

  }

  async printReceipt(id: number): Promise<void> {
    await this.fileDownload.printHtml(this.massIntentionService.getReceiptPrintUrl(id, this.languageService.current()));
  }

  /** One combined receipt for the whole just-saved batch -- every row's
   * details in one document, total offering at the end -- instead of
   * printing each one individually. See bulkReceiptPdf.js. */
  async printBulkReceipt(): Promise<void> {
    const ids = this.results()?.succeeded.map((r) => r.id) ?? [];
    if (!ids.length) return;
    await this.fileDownload.printPdf(this.massIntentionService.getBulkReceiptUrl(ids, this.languageService.current()));
  }

  private replaceResultRow(id: number, updated: MassIntention): void {
    const current = this.results();
    if (!current) return;
    this.results.set({ ...current, succeeded: current.succeeded.map((r) => (r.id === id ? updated : r)) });
  }

  // ---- Inline edit, right in the results table -------------------------

  editingId = signal<number | null>(null);
  editRowForm: FormGroup = this.buildRow();
  /** Only re-check Restricted Dates when the date is actually moving --
   * same reasoning as mass-intention-form.ts's own update(): an intention
   * already sitting on a date later marked Restricted shouldn't become
   * un-editable for its other fields. */
  private editOriginalDate: string | null = null;

  intentionText(rec: MassIntention): string {
    if (rec.intention_is_custom) return rec.custom_intention || '-';
    if (!rec.intention_master_name) return rec.custom_intention || '-';
    return localizedName({ name: rec.intention_master_name, name_ta: rec.intention_master_name_ta }, this.languageService.current());
  }

  massText(rec: MassIntention): string {
    return localizedName({ name: rec.mass_name, name_ta: rec.mass_name_ta }, this.languageService.current());
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
          prayerDate: this.toDateOnly(raw.prayerDate),
          massId: raw.massId!,
          prayerIntentionMasterId: raw.prayerIntentionMasterId ?? undefined,
          customIntention: raw.customIntention || undefined,
          offeringAmount: raw.offeringAmount,
        })
      );
      this.replaceResultRow(id, updated);
      this.editingId.set(null);
      this.notification.success(this.translate.instant('massIntentions.updated'));
    } catch (err) {
      this.notification.error(extractErrorMessage(err));
    }
  }

  async deleteResultRow(rec: MassIntention): Promise<void> {
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
      const current = this.results();
      if (current) {
        this.results.set({ ...current, succeeded: current.succeeded.filter((r) => r.id !== rec.id) });
      }
      this.notification.success(this.translate.instant('massIntentions.deleted'));
    } catch (err) {
      this.notification.error(extractErrorMessage(err));
    }
  }

  // ---- Adding one more paid intention straight from the results table --

  addingRow = signal(false);
  addRowForm: FormGroup = this.buildRow();

  get addRowReady(): boolean {
    if (this.addRowForm.invalid) return false;
    if (this.rowRestrictedDate(this.addRowForm)) return false;
    return (
      !this.rowIsCustomIntention(this.addRowForm) || !!String(this.addRowForm.controls['customIntention'].value ?? '').trim()
    );
  }

  get addRowAmount(): number {
    return Number(this.addRowForm.controls['offeringAmount'].value) || 0;
  }

  showAddRow(): void {
    this.addRowForm = this.buildRow();
    this.addingRow.set(true);
  }

  cancelAddRow(): void {
    this.addingRow.set(false);
  }

  /** Reuses this batch's own Booked By/Phone/Payment Method -- same shared-
   * fields idea as the main batch, just for one extra row added after the
   * fact. Confirming payment here (its own small panel, full UPI support
   * included) is what actually creates and pays this one new intention. */
  async onAddRowPaymentConfirmed(event: PaymentConfirmedEvent): Promise<void> {
    this.addRowForm.markAllAsTouched();
    if (!this.addRowReady) {
      this.notification.error(this.translate.instant('massIntentions.fillRequiredFields'));
      return;
    }

    const header = this.headerForm.getRawValue();
    const raw = this.addRowForm.getRawValue();
    const method = mapPaymentMethodCode(this.selectedPaymentMethod?.code);
    const payload: CreateMassIntentionRequest = {
      name: raw.name,
      bookedBy: header.bookedBy || undefined,
      phone: header.phone || undefined,
      prayerDate: this.toDateOnly(raw.prayerDate),
      massId: raw.massId!,
      prayerIntentionMasterId: raw.prayerIntentionMasterId ?? undefined,
      customIntention: raw.customIntention || undefined,
      offeringAmount: raw.offeringAmount,
      paymentMethodId: header.paymentMethodId ?? undefined,
      bulkBatchId: this.bulkBatchId,
    };

    try {
      const created = await firstValueFrom(this.massIntentionService.create(payload));
      try {
        const paid = await firstValueFrom(
          this.massIntentionService.receivePayment(created.id, { method, referenceNumber: event.referenceNumber })
        );
        const current = this.results();
        this.results.set({ succeeded: [...(current?.succeeded ?? []), paid], failed: current?.failed ?? [] });
        this.notification.success(this.translate.instant('massIntentions.saved', { receipt: paid.receipt_no }));
        this.addRowForm = this.buildRow();
        this.addPaymentPanel?.reset();
        this.addingRow.set(false);
      } catch (payErr) {
        this.notification.error(
          extractErrorMessage(payErr, this.translate.instant('massIntentions.savedPaymentFailed', { receipt: created.receipt_no }))
        );
      }
    } catch (err) {
      this.notification.error(extractErrorMessage(err));
    }
  }
}
