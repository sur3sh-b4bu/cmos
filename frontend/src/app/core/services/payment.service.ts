import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';

export interface UpiPaymentIntent {
  qrDataUrl: string;
  payUri: string;
  isMock: boolean;
  display: {
    churchName: string;
    upiId: string;
    amount: string;
    currency: string;
    symbol: string;
    purpose: string;
  };
}

/**
 * The one place the frontend talks to the UPI QR-generation concern. Calls
 * the backend's provider-agnostic endpoint and never needs to know whether
 * mock or (later) a real gateway is behind it -- see
 * backend/src/payments/PaymentProvider.js for the server-side half of this
 * abstraction. Recording that a payment actually succeeded is a SEPARATE
 * concern handled by MassIntentionService.receivePayment(), not this service
 * -- see payment-confirm-panel.ts for how the two are composed.
 *
 * TODO(real gateway): a hosted-checkout provider (Razorpay, Cashfree, ...)
 * may need a small client SDK step here too (e.g. opening their widget with
 * a server-issued order id). That addition stays isolated to this service.
 */
@Injectable({ providedIn: 'root' })
export class PaymentService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiBaseUrl}/mass-intentions`;

  generateDemoQr(payload: { amount: number; purpose?: string }): Observable<UpiPaymentIntent> {
    return this.http
      .post<ApiResponse<UpiPaymentIntent>>(`${this.baseUrl}/payment/demo-qr`, payload)
      .pipe(map((res) => res.data));
  }
}
