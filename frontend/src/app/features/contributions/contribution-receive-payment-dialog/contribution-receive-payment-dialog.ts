import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MasterLookupService } from '../../../core/services/master-lookup.service';
import { LanguageService } from '../../../core/services/language.service';
import { localizedName } from '../../../core/utils/localized-name.util';
import { Contribution, ReceiveContributionPaymentRequest } from '../contribution.model';
import { ContributionService } from '../contribution.service';
import {
  PaymentConfirmMethod,
  PaymentConfirmPanelComponent,
  PaymentConfirmedEvent,
} from '../../../shared/components/payment-confirm-panel/payment-confirm-panel';
import { CurrencyInrPipe } from '../../../shared/pipes/currency-inr.pipe';
import { TranslatePipe } from '@ngx-translate/core';

export interface ContributionReceivePaymentDialogData {
  contribution: Contribution;
}

interface PaymentMethodOption {
  id: number;
  name: string;
  code: string;
}

/** Replica of ReceivePaymentDialogComponent -- thin wrapper around the
 * shared PaymentConfirmPanelComponent for the Contributions list's "Receive
 * Payment" row action. */
@Component({
  selector: 'coms-contribution-receive-payment-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, PaymentConfirmPanelComponent, CurrencyInrPipe, TranslatePipe],
  templateUrl: './contribution-receive-payment-dialog.html',
  styleUrl: './contribution-receive-payment-dialog.scss',
})
export class ContributionReceivePaymentDialogComponent {
  private masterLookup = inject(MasterLookupService);
  private contributionService = inject(ContributionService);
  private languageService = inject(LanguageService);
  private dialogRef = inject(MatDialogRef<ContributionReceivePaymentDialogComponent>);
  data = inject<ContributionReceivePaymentDialogData>(MAT_DIALOG_DATA);

  paymentMethods = signal<PaymentMethodOption[]>([]);

  receivePaymentFn = (id: number, payload: { method: string; referenceNumber?: string }) =>
    this.contributionService.receivePayment(id, payload as ReceiveContributionPaymentRequest);

  method = computed<PaymentConfirmMethod | null>(
    () => this.paymentMethods().find((m) => m.id === this.data.contribution.payment_method_id) ?? null
  );

  get purposeText(): string {
    const c = this.data.contribution;
    if (c.contribution_type_is_custom) return c.custom_contribution_type || 'Contribution';
    return localizedName({ name: c.contribution_type_name || '', name_ta: c.contribution_type_name_ta }, this.languageService.current()) || 'Contribution';
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
