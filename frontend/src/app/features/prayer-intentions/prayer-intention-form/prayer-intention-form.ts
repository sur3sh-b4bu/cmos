import { Component, OnInit, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroupDirective, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { MasterLookupService } from '../../../core/services/master-lookup.service';
import { NotificationService } from '../../../core/services/notification.service';
import { FileDownloadService } from '../../../core/services/file-download.service';
import { extractErrorMessage } from '../../../core/utils/http-error.util';
import { PrayerIntentionService } from '../prayer-intention.service';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog';

interface MassOption {
  id: number;
  name: string;
  mass_time: string;
  day_type: string;
}
interface IntentionMasterOption {
  id: number;
  name: string;
  is_custom: number;
}
interface PaymentMethodOption {
  id: number;
  name: string;
}

@Component({
  selector: 'coms-prayer-intention-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './prayer-intention-form.html',
  styleUrl: './prayer-intention-form.scss',
})
export class PrayerIntentionFormComponent implements OnInit {
  // Material's default ErrorStateMatcher shows an error once EITHER the
  // control is touched OR the enclosing FormGroupDirective has ever been
  // submitted -- FormGroup.reset() only clears the former, so a plain
  // reset() leaves every required-and-empty field showing red forever
  // after the first successful save. FormGroupDirective.resetForm()
  // clears both; see submit() below.
  @ViewChild(FormGroupDirective) private formGroupDirective?: FormGroupDirective;

  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private masterLookup = inject(MasterLookupService);
  private prayerIntentionService = inject(PrayerIntentionService);
  private notification = inject(NotificationService);
  private fileDownload = inject(FileDownloadService);
  private dialog = inject(MatDialog);

  editId = signal<number | null>(null);
  loading = signal(false);
  saving = signal(false);
  masses = signal<MassOption[]>([]);
  intentionOptions = signal<IntentionMasterOption[]>([]);
  paymentMethods = signal<PaymentMethodOption[]>([]);
  justSavedId = signal<number | null>(null);
  justSavedReceiptNo = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    phone: [''],
    prayerDate: [new Date(), Validators.required],
    massId: [null as number | null, Validators.required],
    prayerIntentionMasterId: [null as number | null],
    customIntention: [''],
    offeringAmount: [0, [Validators.required, Validators.min(0.01)]],
    paymentMethodId: [null as number | null],
    remarks: [''],
  });

  get selectedIntentionIsCustom(): boolean {
    const id = this.form.controls.prayerIntentionMasterId.value;
    return this.intentionOptions().find((o) => o.id === id)?.is_custom === 1;
  }

  ngOnInit(): void {
    this.masterLookup.list<MassOption>('masses').subscribe((rows) => this.masses.set(rows));
    this.masterLookup
      .list<IntentionMasterOption>('prayer_intention_master')
      .subscribe((rows) => this.intentionOptions.set(rows));
    this.masterLookup.list<PaymentMethodOption>('payment_methods').subscribe((rows) => this.paymentMethods.set(rows));

    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      const id = Number(idParam);
      this.editId.set(id);
      this.loading.set(true);
      this.prayerIntentionService.getById(id).subscribe({
        next: (pi) => {
          this.form.patchValue({
            name: pi.name,
            phone: pi.phone ?? '',
            prayerDate: new Date(pi.prayer_date),
            massId: pi.mass_id,
            prayerIntentionMasterId: pi.prayer_intention_master_id,
            customIntention: pi.custom_intention ?? '',
            offeringAmount: Number(pi.offering_amount),
            paymentMethodId: pi.payment_method_id,
            remarks: pi.remarks ?? '',
          });
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    }
  }

  private toDateOnly(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  async submit(allowDuplicate = false): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.selectedIntentionIsCustom && !this.form.controls.customIntention.value.trim()) {
      this.notification.error('Please describe the prayer intention (required when "Others" is selected).');
      return;
    }

    this.saving.set(true);
    const raw = this.form.getRawValue();
    const payload = {
      name: raw.name,
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
        await firstValueFrom(this.prayerIntentionService.update(editId, payload));
        this.notification.success('Prayer intention updated successfully.');
        this.router.navigate(['/prayer-intentions']);
      } else {
        const created = await firstValueFrom(this.prayerIntentionService.create(payload));
        this.notification.success(`Saved. Receipt ${created.receipt_no} generated.`);
        this.justSavedId.set(created.id);
        this.justSavedReceiptNo.set(created.receipt_no);
        this.formGroupDirective?.resetForm({
          name: '',
          phone: '',
          prayerDate: new Date(),
          massId: raw.massId,
          prayerIntentionMasterId: null,
          customIntention: '',
          offeringAmount: 0,
          paymentMethodId: null,
          remarks: '',
        });
      }
    } catch (err: any) {
      if (err?.status === 409) {
        const confirmed = await this.confirmDuplicate(err);
        if (confirmed) {
          this.saving.set(false);
          return this.submit(true);
        }
      } else {
        this.notification.error(extractErrorMessage(err));
      }
    } finally {
      this.saving.set(false);
    }
  }

  private async confirmDuplicate(err: any): Promise<boolean> {
    const message = extractErrorMessage(err);
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Possible duplicate entry',
        message,
        confirmLabel: 'Add anyway',
        cancelLabel: 'Cancel',
      },
    });
    return firstValueFrom(ref.afterClosed());
  }

  async printReceipt(): Promise<void> {
    const id = this.justSavedId();
    if (!id) return;
    await this.fileDownload.openInNewTab(this.prayerIntentionService.getReceiptUrl(id));
  }
}
