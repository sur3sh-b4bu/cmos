import { Component, OnInit, ViewChild, WritableSignal, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, FormGroupDirective, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MasterLookupService } from '../../../core/services/master-lookup.service';
import { NotificationService } from '../../../core/services/notification.service';
import { CurrencyService } from '../../../core/services/currency.service';
import { FileDownloadService } from '../../../core/services/file-download.service';
import { LanguageService } from '../../../core/services/language.service';
import { extractErrorMessage } from '../../../core/utils/http-error.util';
import { localizedName } from '../../../core/utils/localized-name.util';
import { parseDateOnly } from '../../../core/utils/date-format.util';
import { phoneValidator } from '../../../shared/utils/phone.validator';
import { baminiToUnicode } from '../../../core/utils/bamini-to-unicode.util';
import {
  DEFAULT_RESTRICTED_DATE_REASON,
  RestrictedDateRow,
  findRestrictedDate,
  isRestrictedDate,
} from '../../../core/utils/restricted-dates.util';
import { MassIntentionService } from '../mass-intention.service';
import { MassIntention, ReceivePaymentRequest } from '../mass-intention.model';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { PaymentConfirmMethod, PaymentConfirmPanelComponent, PaymentConfirmedEvent } from '../../../shared/components/payment-confirm-panel/payment-confirm-panel';
import { mapPaymentMethodCode } from '../../../shared/utils/payment-method.util';
import { DatepickerTodayHeaderComponent } from '../../../shared/components/datepicker-today-header/datepicker-today-header';

/** localStorage key for the in-progress "New Mass Intention" draft -- see
 * saveDraft()/restoreDraft() below. Not scoped per-user; this app is used
 * from a shared office machine, and the existing sidebar-collapsed
 * preference (shell.ts) follows the same unscoped convention. */
const DRAFT_KEY = 'coms-mass-intention-draft';

interface MassOption {
  id: number;
  name: string;
  name_ta: string | null;
  mass_time: string;
  day_type: string;
  default_offering_amount: string | number;
  offering_description: string | null;
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

@Component({
  selector: 'coms-mass-intention-form',
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
  templateUrl: './mass-intention-form.html',
  styleUrl: './mass-intention-form.scss',
})
export class MassIntentionFormComponent implements OnInit {
  // Material's default ErrorStateMatcher shows an error once EITHER the
  // control is touched OR the enclosing FormGroupDirective has ever been
  // submitted -- FormGroup.reset() only clears the former, so a plain
  // reset() leaves every required-and-empty field showing red forever
  // after the first successful save. FormGroupDirective.resetForm()
  // clears both; see submit() below.
  @ViewChild(FormGroupDirective) private formGroupDirective?: FormGroupDirective;
  @ViewChild(PaymentConfirmPanelComponent) private paymentPanel?: PaymentConfirmPanelComponent;

  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private masterLookup = inject(MasterLookupService);
  currencyService = inject(CurrencyService);
  private massIntentionService = inject(MassIntentionService);
  private notification = inject(NotificationService);
  private fileDownload = inject(FileDownloadService);
  private dialog = inject(MatDialog);
  private translate = inject(TranslateService);
  languageService = inject(LanguageService);

  editId = signal<number | null>(null);
  loading = signal(false);
  saving = signal(false);
  masses = signal<MassOption[]>([]);
  intentionOptions = signal<IntentionMasterOption[]>([]);
  paymentMethods = signal<PaymentMethodOption[]>([]);
  restrictedDates = signal<RestrictedDateRow[]>([]);
  selectedPrayerDate = signal<Date | null>(new Date());

  readonly filteredMasses = computed(() => {
    return this.masses();
  });

  readonly massGroups = computed(() => {
    const list = this.masses();
    const date = this.selectedPrayerDate();
    const isSunday = date ? new Date(date).getDay() === 0 : false;
    // Show the matching day type first, followed by others
    const dayTypes = isSunday ? ['Sunday', 'Daily', 'Special'] : ['Daily', 'Sunday', 'Special'];
    const groups: { category: string; label: string; masses: MassOption[] }[] = [];
    for (const t of dayTypes) {
      const matching = list.filter((m) => m.day_type === t);
      if (matching.length > 0) {
        groups.push({
          category: t,
          label: this.getDayTypeLabel(t),
          masses: matching,
        });
      }
    }
    const other = list.filter((m) => !dayTypes.includes(m.day_type));
    if (other.length > 0) {
      groups.push({
        category: 'Other',
        label: this.getDayTypeLabel('Other'),
        masses: other,
      });
    }
    return groups;
  });

  getDayTypeLabel(dayType: string): string {
    switch (dayType) {
      case 'Sunday':
        return this.translate.instant('churchSetup.daySunday');
      case 'Daily':
        return this.translate.instant('churchSetup.dayDaily');
      case 'Special':
        return this.translate.instant('churchSetup.daySpecial');
      default:
        return dayType;
    }
  }

  /** "Type in Bamini" toggles -- one per free-text field that can hold a
   * Tamil name/intention. While on, that field renders in the Bamini font
   * so typing looks right to someone used to a Bamini keyboard (still
   * common in Tamil Nadu despite predating Unicode Tamil); on blur the raw
   * value is converted to real Tamil Unicode (see bamini-to-unicode.util.ts)
   * and the toggle resets -- Bamini has zero real Tamil Unicode glyph
   * coverage, so leaving it on after conversion would render the
   * now-correct text as blank. A plain English name typed with the toggle
   * off is never touched. */
  nameBamini = signal(this.languageService.isTamilTextInput());
  bookedByBamini = signal(this.languageService.isTamilTextInput());
  customIntentionBamini = signal(this.languageService.isTamilTextInput());

  /** Keeps all three toggles above in sync if the text input mode changes
   * while this form is open, not just on initial load. */
  constructor() {
    effect(() => {
      const isTamil = this.languageService.isTamilTextInput();
      this.nameBamini.set(isTamil);
      this.bookedByBamini.set(isTamil);
      this.customIntentionBamini.set(isTamil);
    });
  }

  toggleBamini(mode: WritableSignal<boolean>): void {
    mode.update((v) => !v);
  }

  convertBaminiOnBlur(controlName: 'name' | 'bookedBy' | 'customIntention', mode: WritableSignal<boolean>): void {
    if (!mode()) return;
    const control = this.form.controls[controlName];
    control.setValue(baminiToUnicode(control.value));
    mode.set(false);
  }

  /** The just-saved (or just-loaded, in edit mode) record -- drives the
   * Generate Receipt action below the form. */
  savedIntention = signal<MassIntention | null>(null);

  /** Set only in create mode, when the payment panel confirms payment
   * *before* the record exists yet (see payment-confirm-panel.ts's
   * "local" mode) -- submit() applies it right after create() succeeds, so
   * "saving itself" ends up paid in one user-perceived action. */
  private pendingPaymentConfirmation = signal<{ referenceNumber?: string } | null>(null);

  readonly defaultRestrictedDateReason = DEFAULT_RESTRICTED_DATE_REASON;
  /** calendarHeaderComponent needs a class reference, not a template var. */
  readonly todayHeader = DatepickerTodayHeaderComponent;

  get todayDate(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    bookedBy: [''],
    phone: ['', phoneValidator],
    prayerDate: [this.todayDate, Validators.required],
    massId: [null as number | null, Validators.required],
    prayerIntentionMasterId: [null as number | null],
    customIntention: [''],
    offeringAmount: [0, [Validators.required, Validators.min(0.01)]],
    paymentMethodId: [null as number | null, Validators.required],
    remarks: [''],
  });

  get selectedIntentionIsCustom(): boolean {
    const id = this.form.controls.prayerIntentionMasterId.value;
    return this.intentionOptions().find((o) => o.id === id)?.is_custom === 1;
  }

  get showCustomIntentionInput(): boolean {
    return !!this.form.controls.prayerIntentionMasterId.value || this.selectedIntentionIsCustom;
  }

  /** Dropdown option label for a Mass Intention preset -- Tamil (name_ta)
   * when the site's language is Tamil and one's been filled in via Masters
   * > Mass Intention Presets, else the English name. See
   * localized-name.util.ts. */
  intentionLabel(opt: IntentionMasterOption): string {
    return localizedName(opt, this.languageService.current());
  }

  /** Same idea, for the Mass dropdown -- see localized-name.util.ts. */
  massLabel(opt: MassOption): string {
    return localizedName(opt, this.languageService.current());
  }

  /** The Restricted Date row the currently-picked date falls on, if any.
   * The datepicker itself never blocks selection (see dateClass below) --
   * this drives the warning banner and disables Save/Receive Payment,
   * mirroring what the backend independently re-checks on submit. */
  get selectedRestrictedDate(): RestrictedDateRow | null {
    return findRestrictedDate(this.restrictedDates(), this.form.controls.prayerDate.value);
  }

  /** Visually distinguishes Restricted Dates in the calendar (badge/color)
   * without removing them from selection, per the "warn, don't block" rule. */
  dateClass = (date: Date): string =>
    isRestrictedDate(this.restrictedDates(), date) ? 'pi-form__restricted-date-cell' : '';

  /** Drives the payment panel -- the method chosen right here in the form,
   * never re-asked. A plain getter (not computed()) because it reads a
   * reactive-forms control value, which isn't itself a signal -- computed()
   * would never re-run on mat-select changes. */
  get selectedPaymentMethod(): PaymentConfirmMethod | null {
    const id = this.form.controls.paymentMethodId.value;
    return this.paymentMethods().find((m) => m.id === id) ?? null;
  }

  get paymentPurposeText(): string {
    const id = this.form.controls.prayerIntentionMasterId.value;
    const opt = this.intentionOptions().find((o) => o.id === id);
    const custom = this.form.controls.customIntention.value?.trim();
    if (opt && !opt.is_custom) {
      const base = this.intentionLabel(opt);
      return custom ? `${base} - ${custom}` : base;
    }
    return custom || this.translate.instant('massIntentions.defaultPurposeText');
  }

  /** The record the payment panel should act against. Only set in edit mode
   * -- in create mode the form always refers to a brand-new, not-yet-saved
   * intention (even right after a save, since the form resets for the next
   * entry), so the panel stays in local-confirm mode there. See submit(). */
  paymentIntentionId = computed(() => this.editId());

  /** Bound once for the payment panel's [receivePayment] @Input -- see
   * PaymentConfirmPanelComponent's doc comment for why it takes this rather
   * than knowing about MassIntentionService itself. */
  receivePaymentFn = (id: number, payload: { method: string; referenceNumber?: string }) =>
    this.massIntentionService.receivePayment(id, payload as ReceivePaymentRequest);

  /** Saving is gated on payment -- there's no "save now, pay later" state
   * anymore, so Save stays disabled until the panel above it confirms:
   * locally in create mode (pendingPaymentConfirmation), or against the API
   * immediately in edit mode (savedIntention().is_paid). A plain getter, not
   * computed(), for the same reason as selectedPaymentMethod above -- it's
   * re-read on every change detection pass, which is fine for a cheap check. */
  get paymentConfirmed(): boolean {
    return this.editId() ? !!this.savedIntention()?.is_paid : !!this.pendingPaymentConfirmation();
  }

  /** Every required field except Payment Method (which the payment panel
   * already gates and messages on its own -- "Select a payment method
   * first") -- true once there's nothing left that could make submit()'s
   * own validation fail silently. */
  get otherRequiredFieldsFilled(): boolean {
    const c = this.form.controls;
    return (
      c.name.valid &&
      c.prayerDate.valid &&
      c.massId.valid &&
      c.offeringAmount.valid &&
      (!this.selectedIntentionIsCustom || !!c.customIntention.value.trim())
    );
  }

  /** Gates the payment panel itself: it only becomes usable once there's
   * genuinely something valid to save. This is what makes it safe to not
   * have a separate Save button in the normal flow -- payment can never be
   * confirmed while the record wouldn't actually save, so onPaymentConfirmed
   * calling submit() right away always has something real to persist. */
  get readyToConfirmPayment(): boolean {
    return this.otherRequiredFieldsFilled && !this.selectedRestrictedDate;
  }

  /** True only when an auto-save genuinely failed after payment was already
   * confirmed (a network/API error, or the user declining an "add anyway?"
   * duplicate prompt) -- never for validation, which readyToConfirmPayment
   * prevents upfront. Drives a small Retry action instead of a permanent,
   * always-present Save button. */
  saveFailed = signal(false);

  /** Guards the massId valueChanges subscription below (see ngOnInit) against
   * firing on a *programmatic* value assignment -- edit-mode's own
   * patchValue(), restoreDraft()'s patchValue(), and the post-save
   * resetForm() all set massId too, and none of those should silently
   * overwrite an already-known/just-typed Offering Amount with the newly-
   * (re)selected Mass's default. Only a genuine user pick through the
   * dropdown should trigger the auto-fill. */
  private suppressMassAutoFill = false;

  /** The selected Mass's own configured default (Masters > Masses >
   * "Default Offering Amount", see master-config.ts) -- different Masses
   * legitimately have different customary offering amounts, so this reads
   * per-selection rather than a single per-church constant. */
  private massDefaultOffering(massId: number | null): number {
    return Number(this.masses().find((m) => m.id === massId)?.default_offering_amount) || 0;
  }

  /** The selected Mass's own Offering Description (Masters > Masses), shown
   * as a read-only note under the Mass dropdown so office staff see what
   * the offering is customarily intended for before booking -- see
   * mass-intention-form.html. A plain getter, not computed(), for the same
   * reason as selectedPaymentMethod above (reads a reactive-forms control
   * value, not a signal). Null when the Mass has none set, or none is
   * selected yet. */
  get selectedMassOfferingDescription(): string | null {
    const massId = this.form.controls.massId.value;
    return this.masses().find((m) => m.id === massId)?.offering_description || null;
  }

  ngOnInit(): void {
    this.currencyService.load();
    this.masterLookup.list<MassOption>('masses').subscribe((rows) => this.masses.set(rows));
    this.masterLookup
      .list<IntentionMasterOption>('prayer_intention_master')
      .subscribe((rows) => {
        this.intentionOptions.set(rows);
        if (!this.editId() && !this.form.controls.prayerIntentionMasterId.value) {
          const others = rows.find(
            (o) => o.is_custom === 1 || o.name?.toLowerCase() === 'others' || o.name_ta === 'மற்றவை'
          );
          if (others) {
            this.form.controls.prayerIntentionMasterId.setValue(others.id);
          }
        }
      });
    this.masterLookup.list<PaymentMethodOption>('payment_methods').subscribe((rows) => this.paymentMethods.set(rows));
    this.masterLookup.list<RestrictedDateRow>('holidays').subscribe((rows) => this.restrictedDates.set(rows));

    // When prayer date changes, re-evaluate filtered masses and clear massId if no longer valid
    this.form.controls.prayerDate.valueChanges.subscribe((date) => {
      this.selectedPrayerDate.set(date);
      const currentMassId = this.form.controls.massId.value;
      if (currentMassId && !this.filteredMasses().some((m) => m.id === currentMassId)) {
        this.form.controls.massId.setValue(null);
      }
    });

    // "On selecting the Mass, the default offering amount should appear" --
    // fires for genuine user selections only (see suppressMassAutoFill).
    this.form.controls.massId.valueChanges.subscribe((massId) => {
      if (this.suppressMassAutoFill) return;
      this.form.controls.offeringAmount.setValue(this.massDefaultOffering(massId));
    });

    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      const id = Number(idParam);
      this.editId.set(id);
      this.loading.set(true);
      this.massIntentionService.getById(id).subscribe({
        next: (pi) => {
          this.suppressMassAutoFill = true;
          this.form.patchValue({
            name: pi.name,
            bookedBy: pi.booked_by ?? '',
            phone: pi.phone ?? '',
            prayerDate: parseDateOnly(pi.prayer_date) ?? undefined,
            massId: pi.mass_id,
            prayerIntentionMasterId: pi.prayer_intention_master_id,
            customIntention: pi.custom_intention ?? '',
            offeringAmount: Number(pi.offering_amount),
            paymentMethodId: pi.payment_method_id,
            remarks: pi.remarks ?? '',
          });
          this.suppressMassAutoFill = false;
          this.savedIntention.set(pi);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    } else {
      // Create mode only -- restore whatever was last typed before an
      // accidental navigation away, then keep persisting on every change so
      // the next accidental exit is covered too. Cleared once the entry
      // actually saves (see submit()).
      this.restoreDraft();
      this.form.valueChanges.subscribe(() => this.saveDraft());
    }
  }

  private saveDraft(): void {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(this.form.getRawValue()));
  }

  private restoreDraft(): void {
    const stored = localStorage.getItem(DRAFT_KEY);
    if (!stored) return;
    try {
      const draft = JSON.parse(stored);
      this.suppressMassAutoFill = true;
      this.form.patchValue({
        ...draft,
        // Mass (and therefore its default Offering Amount) is deliberately
        // NOT restored -- unlike the rest of the draft, it determines
        // pricing, and its default may have changed since the draft was
        // saved. A fresh "New Mass Intention" page should always make the
        // user pick the Mass themselves rather than silently reappearing
        // pre-selected with a possibly-stale amount; picking it (even the
        // same one again) re-triggers the auto-fill with today's default.
        massId: null,
        offeringAmount: 0,
        // Dates don't survive JSON round-tripping -- everything else does.
        prayerDate: draft.prayerDate ? new Date(draft.prayerDate) : this.todayDate,
      });
      this.suppressMassAutoFill = false;
      this.notification.info(this.translate.instant('massIntentions.draftRestored'));
    } catch {
      // Corrupted/unparseable draft -- treat it as if there wasn't one.
      localStorage.removeItem(DRAFT_KEY);
    }
  }

  private clearDraft(): void {
    localStorage.removeItem(DRAFT_KEY);
  }

  private toDateOnly(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /** Fired by the payment panel. In edit mode (paymentIntentionId already
   * set) it already called the API itself and hands back the updated
   * record; in create mode it's only a local confirmation to apply once
   * submit() actually creates the record. Either way, this is also the
   * trigger that actually saves the mass intention -- there's no separate
   * Save button in this flow (see the template); readyToConfirmPayment
   * already guaranteed the rest of the form was valid before the panel was
   * even clickable, so this should always succeed short of a genuine
   * network/API failure (which shows a Retry action instead). */
  onPaymentConfirmed(event: PaymentConfirmedEvent): void {
    if (event.updated) {
      this.savedIntention.set(event.updated as MassIntention);
    } else {
      this.pendingPaymentConfirmation.set({ referenceNumber: event.referenceNumber });
    }
    this.submit();
  }

  async submit(allowDuplicate = false): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      // Now that Save can fire automatically the moment payment is
      // confirmed (see onPaymentConfirmed) rather than only from an
      // explicit button click, silently red-lining other empty required
      // fields (Name, Mass, etc. -- the payment panel only requires a
      // Payment Method to be pickable) is no longer enough feedback: there
      // was no click to make the user expect something to react at all.
      this.notification.error(this.translate.instant('massIntentions.fillRequiredFields'));
      return;
    }
    if (this.selectedRestrictedDate) {
      this.notification.error(
        this.translate.instant('massIntentions.restrictedDateError', { name: this.selectedRestrictedDate.name })
      );
      return;
    }
    if (this.selectedIntentionIsCustom && !this.form.controls.customIntention.value.trim()) {
      this.notification.error(this.translate.instant('massIntentions.describeIntentionRequired'));
      return;
    }
    if (!this.paymentConfirmed) {
      this.notification.error(this.translate.instant('massIntentions.confirmPaymentFirst'));
      return;
    }

    this.saveFailed.set(false);
    this.saving.set(true);
    const raw = this.form.getRawValue();
    const payload = {
      name: raw.name,
      bookedBy: raw.bookedBy || undefined,
      phone: raw.phone || undefined,
      prayerDate: this.toDateOnly(raw.prayerDate),
      massId: raw.massId!,
      prayerIntentionMasterId: raw.prayerIntentionMasterId ?? undefined,
      customIntention: raw.customIntention || undefined,
      offeringAmount: raw.offeringAmount,
      paymentMethodId: raw.paymentMethodId ?? undefined,
      remarks: raw.remarks || undefined,
      allowDuplicate,
    };

    try {
      const editId = this.editId();
      if (editId) {
        const updated = await firstValueFrom(this.massIntentionService.update(editId, payload));
        this.savedIntention.set(updated);
        this.notification.success(this.translate.instant('massIntentions.updated'));
        this.router.navigate(['/mass-intentions']);
      } else {
        let created = await firstValueFrom(this.massIntentionService.create(payload));

        const pending = this.pendingPaymentConfirmation();
        if (pending) {
          try {
            const method = this.paymentMethods().find((m) => m.id === raw.paymentMethodId);
            created = await firstValueFrom(
              this.massIntentionService.receivePayment(created.id, {
                method: mapPaymentMethodCode(method?.code),
                referenceNumber: pending.referenceNumber,
              })
            );
            this.notification.success(
              this.translate.instant('massIntentions.savedAndPaid', { receipt: created.receipt_no })
            );
          } catch (err) {
            this.notification.error(
              extractErrorMessage(
                err,
                this.translate.instant('massIntentions.savedPaymentFailed', { receipt: created.receipt_no })
              )
            );
          }
        } else {
          this.notification.success(this.translate.instant('massIntentions.saved', { receipt: created.receipt_no }));
        }

        this.savedIntention.set(created);
        this.pendingPaymentConfirmation.set(null);
        this.paymentPanel?.reset();
        // The entry the draft was tracking is now actually saved -- clear it
        // so a later accidental exit doesn't resurrect stale, already-saved
        // values. The form.reset() below immediately starts a fresh draft
        // for whatever comes next via the valueChanges subscription.
        this.clearDraft();

        // Mass is deliberately NOT carried over to the next entry (even
        // though the rest of a back-to-back run's fields would reasonably
        // repeat) -- same reasoning as restoreDraft(): it drives the
        // Offering Amount default, so the next booking should always start
        // from an explicit, fresh pick rather than silently reappearing
        // pre-selected.
        const others = this.intentionOptions().find(
          (o) => o.is_custom === 1 || o.name?.toLowerCase() === 'others' || o.name_ta === 'மற்றவை'
        );
        this.suppressMassAutoFill = true;
        this.formGroupDirective?.resetForm({
          name: '',
          bookedBy: '',
          phone: '',
          prayerDate: this.todayDate,
          massId: null,
          prayerIntentionMasterId: others ? others.id : null,
          customIntention: '',
          offeringAmount: 0,
          paymentMethodId: null,
          remarks: '',
        });
        this.selectedPrayerDate.set(this.todayDate);
        this.suppressMassAutoFill = false;
      }
    } catch (err: any) {
      if (err?.status === 409) {
        const confirmed = await this.confirmDuplicate(err);
        if (confirmed) {
          this.saving.set(false);
          return this.submit(true);
        }
        // Declined the duplicate -- payment may already be confirmed
        // (edit mode persists it immediately) with nothing else saved yet.
        this.saveFailed.set(true);
      } else {
        this.notification.error(extractErrorMessage(err));
        this.saveFailed.set(true);
      }
    } finally {
      this.saving.set(false);
    }
  }

  private async confirmDuplicate(err: any): Promise<boolean> {
    const details = err?.error?.details;
    let message = extractErrorMessage(err);
    if (details) {
      message += '\n\n' + this.translate.instant('massIntentions.existingDetails') + ':\n' +
        `• ${this.translate.instant('massIntentions.receiptNo')}: ${details.receiptNo}\n` +
        `• ${this.translate.instant('common.name')}: ${details.name}` +
        (details.bookedBy ? `\n• ${this.translate.instant('massIntentions.bookedBy')}: ${details.bookedBy}` : '') +
        (details.phone ? `\n• ${this.translate.instant('massIntentions.phoneNumber')}: ${details.phone}` : '') +
        `\n• ${this.translate.instant('massIntentions.prayerDate')}: ${details.prayerDate}` +
        `\n• ${this.translate.instant('massIntentions.offeringAmount')}: ₹${details.offeringAmount}`;
    }
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.translate.instant('massIntentions.duplicateTitle'),
        message,
        confirmLabel: this.translate.instant('massIntentions.addAnyway'),
        cancelLabel: this.translate.instant('common.cancel'),
      },
    });
    return firstValueFrom(ref.afterClosed());
  }

  async printReceipt(): Promise<void> {
    const intention = this.savedIntention();
    if (!intention) return;
    await this.fileDownload.printHtml(this.massIntentionService.getReceiptPrintUrl(intention.id, this.languageService.current()));
  }
}
