import { TranslateService } from '@ngx-translate/core';

const METHOD_KEYS: Record<string, string> = {
  cash: 'payment.methodCash',
  upi: 'payment.methodUpi',
  card: 'payment.methodCard',
  cheque: 'payment.methodCheque',
  bank_transfer: 'payment.methodBankTransfer',
  other: 'payment.methodOther',
};

/** The reverse direction of mapPaymentMethodCode below -- a
 * payment_transactions.method enum value ('cash'/'upi'/...) as translated
 * display text, for the on-screen Collections/Contributions detail dialogs.
 * Mirrors the backend's identical pdfLabels.js's paymentMethodLabel(), used
 * for the printed PDF version of the same tables. */
export function paymentMethodLabel(method: string | null | undefined, translate: TranslateService): string {
  if (!method) return translate.instant('payment.methodNotSpecified');
  const key = METHOD_KEYS[method.toLowerCase()];
  if (key) return translate.instant(key);
  return method.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Maps a payment_methods master row's `code` (CASH/UPI/CHEQUE/BANK_TRANSFER/
 * CARD/...) to the payment_transactions.method enum ('cash'/'upi'/'cheque'/
 * 'bank_transfer'/'other') used by ReceivePaymentRequest. Anything without a
 * direct match (e.g. CARD) falls back to 'other' rather than failing.
 * Shared by Mass Intentions and Contributions -- both record payment the same way. */
export function mapPaymentMethodCode(code: string | null | undefined): 'cash' | 'upi' | 'cheque' | 'bank_transfer' | 'other' {
  switch (code) {
    case 'CASH':
      return 'cash';
    case 'UPI':
      return 'upi';
    case 'CHEQUE':
      return 'cheque';
    case 'BANK_TRANSFER':
      return 'bank_transfer';
    default:
      return 'other';
  }
}
