import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MasterLookupService } from '../../../core/services/master-lookup.service';
import { MassIntention, ReceivePaymentRequest } from '../mass-intention.model';
import { MassIntentionService } from '../mass-intention.service';
import { PaymentConfirmMethod, PaymentConfirmPanelComponent, PaymentConfirmedEvent } from '../../../shared/components/payment-confirm-panel/payment-confirm-panel';
import { CurrencyInrPipe } from '../../../shared/pipes/currency-inr.pipe';
import { TranslatePipe } from '@ngx-translate/core';

export interface ReceivePaymentDialogData {
  intention: MassIntention;
}

interface PaymentMethodOption {
  id: number;
  name: string;
  code: string;
}

/**
 * Thin dialog wrapper around PaymentConfirmPanelComponent for the Mass
 * Intentions list's "Receive Payment" row action -- the panel is the single
 * source of truth for the payment-confirmation UI (shared with
 * mass-intention-form.ts), so this component only supplies the already-known
 * payment method (chosen back when the intention was created) and closes
 * itself with the updated record once the panel confirms.
 */
@Component({
  selector: 'coms-receive-payment-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, PaymentConfirmPanelComponent, CurrencyInrPipe, TranslatePipe],
  templateUrl: './receive-payment-dialog.html',
  styleUrl: './receive-payment-dialog.scss',
})
export class ReceivePaymentDialogComponent {
  private masterLookup = inject(MasterLookupService);
  private massIntentionService = inject(MassIntentionService);
  private dialogRef = inject(MatDialogRef<ReceivePaymentDialogComponent>);
  data = inject<ReceivePaymentDialogData>(MAT_DIALOG_DATA);

  paymentMethods = signal<PaymentMethodOption[]>([]);

  /** Bound once for the payment panel's [receivePayment] @Input. */
  receivePaymentFn = (id: number, payload: { method: string; referenceNumber?: string }) =>
    this.massIntentionService.receivePayment(id, payload as ReceivePaymentRequest);

  method = computed<PaymentConfirmMethod | null>(
    () => this.paymentMethods().find((m) => m.id === this.data.intention.payment_method_id) ?? null
  );

  get purposeText(): string {
    return this.data.intention.intention_is_custom
      ? this.data.intention.custom_intention || 'Mass Intention Offering'
      : this.data.intention.intention_master_name || 'Mass Intention Offering';
  }

  constructor() {
    this.masterLookup.list<PaymentMethodOption>('payment_methods').subscribe((rows) => this.paymentMethods.set(rows));
  }

  close(): void {
    this.dialogRef.close(null);
  }

  onConfirmed(event: PaymentConfirmedEvent): void {
    if (event.updated) this.dialogRef.close(event.updated);
  }
}
