import { Component, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroupDirective, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { firstValueFrom } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MasterLookupService } from '../../../core/services/master-lookup.service';
import { CurrencyService } from '../../../core/services/currency.service';
import { FileDownloadService } from '../../../core/services/file-download.service';
import { LanguageService } from '../../../core/services/language.service';
import { NotificationService } from '../../../core/services/notification.service';
import { extractErrorMessage } from '../../../core/utils/http-error.util';
import { localizedName } from '../../../core/utils/localized-name.util';
import { ContributionService } from '../contribution.service';
import { Contribution, ReceiveContributionPaymentRequest } from '../contribution.model';
import {
  PaymentConfirmMethod,
  PaymentConfirmPanelComponent,
  PaymentConfirmedEvent,
} from '../../../shared/components/payment-confirm-panel/payment-confirm-panel';
import { mapPaymentMethodCode } from '../../../shared/utils/payment-method.util';
import { phoneValidator } from '../../../shared/utils/phone.validator';

/** localStorage key for the in-progress "New Contribution" draft -- same
 * unscoped-shared-machine convention as mass-intention-form.ts's own draft key. */
const DRAFT_KEY = 'coms-contribution-draft';

interface ContributionTypeOption {
  id: number;
  name: string;
  name_ta: string | null;
  code: string;
}
interface PaymentMethodOption {
  id: number;
  name: string;
  code: string;
}

/**
 * A Contribution is money given with no Mass/date booking attached -- this form
 * is deliberately a slimmed-down replica of mass-intention-form.ts: no
 * Mass/Prayer Date fields, no Restricted Date check (nothing is being
 * scheduled), no duplicate-booking detection (a person donating twice in one
 * day for different purposes is normal, not a mistake). Everything else --
 * the draft-restore, the "confirming payment also saves" flow via the shared
 * payment panel, Generate Receipt -- mirrors it exactly.
 */
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { ReceiptLivePreviewComponent } from '../../../shared/components/receipt-live-preview/receipt-live-preview';
import { LivePreviewDialogComponent } from '../../../shared/components/live-preview-dialog/live-preview-dialog';

@Component({
  selector: 'coms-contribution-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    PaymentConfirmPanelComponent,
    ReceiptLivePreviewComponent,
    TranslatePipe,
  ],
  templateUrl: './contribution-form.html',
  styleUrl: './contribution-form.scss',
})
export class ContributionFormComponent implements OnInit {
  @ViewChild(FormGroupDirective) private formGroupDirective?: FormGroupDirective;
  @ViewChild(PaymentConfirmPanelComponent) private paymentPanel?: PaymentConfirmPanelComponent;

  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private masterLookup = inject(MasterLookupService);
  currencyService = inject(CurrencyService);
  private contributionService = inject(ContributionService);
  private notification = inject(NotificationService);
  private fileDownload = inject(FileDownloadService);
  private translate = inject(TranslateService);
  private languageService = inject(LanguageService);
  private dialog = inject(MatDialog);

  editId = signal<number | null>(null);
  loading = signal(false);
  saving = signal(false);
  contributionTypes = signal<ContributionTypeOption[]>([]);
  paymentMethods = signal<PaymentMethodOption[]>([]);
  showSidePreview = signal<boolean>(false);

  toggleSidePreview(): void {
    this.showSidePreview.update((v) => !v);
  }

  openPreviewModal(): void {
    const title = this.translate.instant('common.previewReceipt');
    this.dialog.open(LivePreviewDialogComponent, {
      width: '680px',
      maxWidth: '96vw',
      autoFocus: false,
      restoreFocus: true,
      data: {
        title: `${title} - ${this.translate.instant('common.livePreview')}`,
        previewType: 'receipt',
        receiptType: 'contribution',
        formGroup: this.form,
        receiptNo: this.savedContribution()?.receipt_no || (this.editId() ? `RCT-${this.editId()}` : 'PREVIEW-001'),
      },
    });
  }

  /** The just-saved (or just-loaded, in edit mode) record -- drives the
   * Generate Receipt action below the form. */
  savedContribution = signal<Contribution | null>(null);

  /** Set only in create mode, when the payment panel confirms payment
   * *before* the record exists yet -- submit() applies it right after
   * create() succeeds. */
  private pendingPaymentConfirmation = signal<{ referenceNumber?: string } | null>(null);

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    phone: ['', phoneValidator],
    contributionTypeId: [null as number | null],
    customContributionType: [''],
    contributionAmount: [0, [Validators.required, Validators.min(0.01)]],
    paymentMethodId: [null as number | null, Validators.required],
    remarks: [''],
  });

  /** contribution_types has no is_custom column -- 'Others' is matched by its
   * fixed code, same as the backend's resolveContributionType(). */
  get selectedTypeIsCustom(): boolean {
    const id = this.form.controls.contributionTypeId.value;
    return this.contributionTypes().find((o) => o.id === id)?.code === 'OTHERS';
  }

  /** Dropdown option label for a Contribution Type -- Tamil (name_ta) when
   * the site's language is Tamil and one's been filled in via Masters >
   * Contribution Types, else the English name. See mass-intention-form.ts's
   * identical intentionLabel/massLabel and localized-name.util.ts. */
  typeLabel(opt: ContributionTypeOption): string {
    return localizedName(opt, this.languageService.current());
  }

  get selectedPaymentMethod(): PaymentConfirmMethod | null {
    const id = this.form.controls.paymentMethodId.value;
    return this.paymentMethods().find((m) => m.id === id) ?? null;
  }

  get paymentPurposeText(): string {
    const id = this.form.controls.contributionTypeId.value;
    const opt = this.contributionTypes().find((o) => o.id === id);
    const text = opt && opt.code !== 'OTHERS' ? this.typeLabel(opt) : this.form.controls.customContributionType.value;
    return text || this.translate.instant('contributions.defaultPurposeText');
  }

  /** The record the payment panel should act against. Only set in edit mode
   * -- see mass-intention-form.ts's identical paymentIntentionId for why. */
  paymentContributionId = computed(() => this.editId());

  receivePaymentFn = (id: number, payload: { method: string; referenceNumber?: string }) =>
    this.contributionService.receivePayment(id, payload as ReceiveContributionPaymentRequest);

  get paymentConfirmed(): boolean {
    return this.editId() ? !!this.savedContribution()?.is_paid : !!this.pendingPaymentConfirmation();
  }

  get otherRequiredFieldsFilled(): boolean {
    const c = this.form.controls;
    return c.name.valid && c.contributionAmount.valid && (!this.selectedTypeIsCustom || !!c.customContributionType.value.trim());
  }

  get readyToConfirmPayment(): boolean {
    return this.otherRequiredFieldsFilled;
  }

  saveFailed = signal(false);

  private draftRestored = false;

  ngOnInit(): void {
    this.currencyService.load();
    this.masterLookup.list<ContributionTypeOption>('contribution_types').subscribe((rows) => this.contributionTypes.set(rows));
    this.masterLookup.list<PaymentMethodOption>('payment_methods').subscribe((rows) => this.paymentMethods.set(rows));

    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      const id = Number(idParam);
      this.editId.set(id);
      this.loading.set(true);
      this.contributionService.getById(id).subscribe({
        next: (d) => {
          this.form.patchValue({
            name: d.name,
            phone: d.phone ?? '',
            contributionTypeId: d.contribution_type_id,
            customContributionType: d.custom_contribution_type ?? '',
            contributionAmount: Number(d.contribution_amount),
            paymentMethodId: d.payment_method_id,
            remarks: d.remarks ?? '',
          });
          this.savedContribution.set(d);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    } else {
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
      this.form.patchValue(draft);
      this.draftRestored = true;
      this.notification.info(this.translate.instant('contributions.draftRestored'));
    } catch {
      localStorage.removeItem(DRAFT_KEY);
    }
  }

  private clearDraft(): void {
    localStorage.removeItem(DRAFT_KEY);
  }

  onPaymentConfirmed(event: PaymentConfirmedEvent): void {
    if (event.updated) {
      this.savedContribution.set(event.updated as Contribution);
    } else {
      this.pendingPaymentConfirmation.set({ referenceNumber: event.referenceNumber });
    }
    this.submit();
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notification.error(this.translate.instant('contributions.fillRequiredFields'));
      return;
    }
    if (this.selectedTypeIsCustom && !this.form.controls.customContributionType.value.trim()) {
      this.notification.error(this.translate.instant('contributions.describeTypeRequired'));
      return;
    }
    if (!this.paymentConfirmed) {
      this.notification.error(this.translate.instant('contributions.confirmPaymentFirst'));
      return;
    }

    this.saveFailed.set(false);
    this.saving.set(true);
    const raw = this.form.getRawValue();
    const payload = {
      name: raw.name,
      phone: raw.phone || undefined,
      contributionTypeId: raw.contributionTypeId ?? undefined,
      customContributionType: raw.customContributionType || undefined,
      contributionAmount: raw.contributionAmount,
      paymentMethodId: raw.paymentMethodId ?? undefined,
      remarks: raw.remarks || undefined,
    };

    try {
      const editId = this.editId();
      if (editId) {
        const updated = await firstValueFrom(this.contributionService.update(editId, payload));
        this.savedContribution.set(updated);
        this.notification.success(this.translate.instant('contributions.updated'));
        this.router.navigate(['/contributions']);
      } else {
        let created = await firstValueFrom(this.contributionService.create(payload));

        const pending = this.pendingPaymentConfirmation();
        if (pending) {
          try {
            const method = this.paymentMethods().find((m) => m.id === raw.paymentMethodId);
            created = await firstValueFrom(
              this.contributionService.receivePayment(created.id, {
                method: mapPaymentMethodCode(method?.code),
                referenceNumber: pending.referenceNumber,
              })
            );
            this.notification.success(
              this.translate.instant('contributions.savedAndPaid', { receipt: created.receipt_no })
            );
          } catch (err) {
            this.notification.error(
              extractErrorMessage(err, this.translate.instant('contributions.savedPaymentFailed', { receipt: created.receipt_no }))
            );
          }
        } else {
          this.notification.success(this.translate.instant('contributions.saved', { receipt: created.receipt_no }));
        }

        this.savedContribution.set(created);
        this.pendingPaymentConfirmation.set(null);
        this.paymentPanel?.reset();
        this.clearDraft();

        this.formGroupDirective?.resetForm({
          name: '',
          phone: '',
          contributionTypeId: null,
          customContributionType: '',
          contributionAmount: 0,
          paymentMethodId: null,
          remarks: '',
        });
      }
    } catch (err) {
      this.notification.error(extractErrorMessage(err));
      this.saveFailed.set(true);
    } finally {
      this.saving.set(false);
    }
  }

  async printReceipt(): Promise<void> {
    const contribution = this.savedContribution();
    if (!contribution) return;
    await this.fileDownload.printHtml(this.contributionService.getReceiptPrintUrl(contribution.id, this.languageService.current()));
  }
}
