import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Observable, firstValueFrom } from 'rxjs';
import { PaymentService, UpiPaymentIntent } from '../../../core/services/payment.service';
import { NotificationService } from '../../../core/services/notification.service';
import { extractErrorMessage } from '../../../core/utils/http-error.util';
import { mapPaymentMethodCode } from '../../utils/payment-method.util';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

export interface PaymentConfirmMethod {
  id: number;
  name: string;
  code: string;
}

export interface PaymentConfirmedEvent {
  /** Fake/demo UPI transaction id, or undefined for non-UPI methods. */
  referenceNumber?: string;
  /** Set only when this panel called receivePayment (via the `receivePayment`
   * @Input) itself (entityId was provided) -- the caller should replace its
   * local record with this. Typed loosely since this panel is shared across
   * entities (Mass Intentions, Contributions, ...) that don't share a model --
   * the caller already knows its own real shape and can cast. */
  updated?: unknown;
}

/**
 * Confirms that payment was received for one record (a Mass Intention, a
 * Contribution, ...), using whichever payment method was already chosen on the
 * form -- this never asks the user to pick a method again (see
 * mass-intention-form.ts / contribution-form.ts and receive-payment-dialog.ts,
 * its callers).
 *
 * Deliberately doesn't know what kind of record it's confirming payment for
 * -- the caller supplies `receivePayment`, a function that actually records
 * the payment against its own entity's API endpoint. This is what lets the
 * same UPI-simulation UI (QR, Simulate Success/Failure) serve every module
 * that has a "receive payment" step, instead of duplicating it per module.
 *
 * Two modes, chosen by whether `entityId` is set:
 *  - Known id (editing an existing unpaid record, or the list/dialog
 *    context): confirming calls `receivePayment()` immediately and emits the
 *    updated, now-paid record.
 *  - No id yet (a brand-new, not-yet-saved record): confirming only records
 *    the confirmation locally and emits it -- the caller is responsible for
 *    creating the record and then calling receivePayment() itself right
 *    after, so the two happen together from the user's point of view
 *    ("saving itself is considered paid").
 *
 * UPI is the only method with anything to *show* (Step 1-3 of the mock UPI
 * flow: app list, demo QR, Simulate Success/Failure) -- every other method
 * is a single "Payment Received" confirmation, since there's nothing else
 * to demonstrate for cash/cheque/bank transfer/other.
 */
@Component({
  selector: 'coms-payment-confirm-panel',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule, TranslatePipe],
  templateUrl: './payment-confirm-panel.html',
  styleUrl: './payment-confirm-panel.scss',
})
export class PaymentConfirmPanelComponent {
  private paymentService = inject(PaymentService);
  private notification = inject(NotificationService);
  private translate = inject(TranslateService);

  @Input() method: PaymentConfirmMethod | null = null;
  @Input() amount = 0;
  @Input() purposeText = '';
  @Input() disabled = false;
  @Input() entityId: number | null = null;
  /** Records the payment against whichever entity this panel instance is
   * for -- e.g. `(id, payload) => this.massIntentionService.receivePayment(id, payload)`
   * or the equivalent ContributionService call. Only invoked when `entityId` is set. */
  @Input() receivePayment!: (id: number, payload: { method: string; referenceNumber?: string }) => Observable<unknown>;

  @Output() confirmed = new EventEmitter<PaymentConfirmedEvent>();

  confirmedState = signal(false);
  confirmedReference = signal<string | null>(null);

  upiPanelOpen = signal(false);
  loadingQr = signal(false);
  qrIntent = signal<UpiPaymentIntent | null>(null);
  simulating = signal(false);
  outcome = signal<'success' | 'failure' | null>(null);
  saving = signal(false);

  // A plain method, not computed() -- `method` is a regular @Input(), not a
  // signal, so computed() would never see it change after the first read.
  isUpi(): boolean {
    return this.method?.code === 'UPI';
  }

  readonly upiApps = [
    { label: 'Google Pay' },
    { label: 'PhonePe' },
    { label: 'Paytm' },
    { label: 'BHIM' },
  ];

  private fakeTransactionId(): string {
    const now = new Date();
    const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const seq = String(Math.floor(Math.random() * 900) + 100);
    return `TXN-${ymd}-${seq}`;
  }

  /** Non-UPI methods (and the UPI "Receive Payment" button before the QR
   * panel is open) both start here. */
  async onPrimaryClick(): Promise<void> {
    if (this.disabled || this.saving()) return;
    if (this.isUpi()) {
      await this.openUpiPanel();
    } else {
      await this.confirm(undefined);
    }
  }

  private async openUpiPanel(): Promise<void> {
    this.loadingQr.set(true);
    this.outcome.set(null);
    try {
      const intent = await firstValueFrom(
        this.paymentService.generateDemoQr({ amount: this.amount, purpose: this.purposeText })
      );
      this.qrIntent.set(intent);
      this.upiPanelOpen.set(true);
    } catch (err) {
      this.notification.error(extractErrorMessage(err, this.translate.instant('payment.qrGenerationFailed')));
    } finally {
      this.loadingQr.set(false);
    }
  }

  /** Demo-only -- the "Simulate Payment Success/Failure" buttons below the
   * QR. TODO(real gateway): this whole method goes away once a real
   * provider is integrated; a webhook route would call receivePayment()
   * the same way the success branch here does. */
  async simulateOutcome(result: 'success' | 'failure'): Promise<void> {
    if (this.simulating()) return;
    if (result === 'failure') {
      this.outcome.set('failure');
      return;
    }
    this.simulating.set(true);
    try {
      await this.confirm(this.fakeTransactionId());
      this.outcome.set('success');
    } finally {
      this.simulating.set(false);
    }
  }

  retryUpi(): void {
    this.cancelUpi();
  }

  /** Closes the UPI QR box without confirming payment, returning to the
   * "Receive Payment (UPI)" button -- used by the box's Cancel button and,
   * via retryUpi(), by the post-failure Retry button. */
  cancelUpi(): void {
    this.outcome.set(null);
    this.upiPanelOpen.set(false);
    this.qrIntent.set(null);
  }

  private async confirm(referenceNumber: string | undefined): Promise<void> {
    if (this.entityId) {
      this.saving.set(true);
      try {
        const updated = await firstValueFrom(
          this.receivePayment(this.entityId, {
            method: mapPaymentMethodCode(this.method?.code),
            referenceNumber,
          })
        );
        this.confirmedState.set(true);
        this.confirmedReference.set(referenceNumber ?? null);
        this.notification.success('Payment recorded successfully.');
        this.confirmed.emit({ referenceNumber, updated });
      } catch (err) {
        this.notification.error(extractErrorMessage(err, 'Could not record the payment.'));
        throw err;
      } finally {
        this.saving.set(false);
      }
    } else {
      this.confirmedState.set(true);
      this.confirmedReference.set(referenceNumber ?? null);
      this.confirmed.emit({ referenceNumber });
    }
  }

  /** Called by the parent after a full save-and-clear-form cycle so the
   * panel is ready for the next record. */
  reset(): void {
    this.confirmedState.set(false);
    this.confirmedReference.set(null);
    this.upiPanelOpen.set(false);
    this.qrIntent.set(null);
    this.outcome.set(null);
  }
}
