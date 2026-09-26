import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiListResponse, ApiResponse } from '../../core/models/api-response.model';
import { AppLang } from '../../core/i18n/translations';
import { ServerTransfer } from '../../core/services/excel-transfer.service';
import { CreateContributionRequest, Contribution, ReceiveContributionPaymentRequest, UpdateContributionRequest } from './contribution.model';

export interface ContributionQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  paidOnly?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ContributionService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiBaseUrl}/contributions`;

  /** Endpoints behind the list's Import / Export / template buttons; `exportParams` is read at click time. */
  transferConfig(exportParams: ServerTransfer['exportParams']): ServerTransfer {
    return {
      exportUrl: `${this.baseUrl}/export`,
      templateUrl: `${this.baseUrl}/import-template`,
      importUrl: `${this.baseUrl}/import`,
      fallbackFileName: 'contributions.xlsx',
      exportParams,
    };
  }

  list(query: ContributionQuery): Observable<ApiListResponse<Contribution>> {
    let params = new HttpParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return this.http.get<ApiListResponse<Contribution>>(this.baseUrl, { params });
  }

  getById(id: number): Observable<Contribution> {
    return this.http
      .get<ApiResponse<Contribution>>(`${this.baseUrl}/${id}`)
      .pipe(map((res) => res.data));
  }

  create(payload: CreateContributionRequest): Observable<Contribution> {
    return this.http
      .post<ApiResponse<Contribution>>(this.baseUrl, payload)
      .pipe(map((res) => res.data));
  }

  update(id: number, payload: UpdateContributionRequest): Observable<Contribution> {
    return this.http
      .put<ApiResponse<Contribution>>(`${this.baseUrl}/${id}`, payload)
      .pipe(map((res) => res.data));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  receivePayment(id: number, payload: ReceiveContributionPaymentRequest): Observable<Contribution> {
    return this.http
      .post<ApiResponse<Contribution>>(`${this.baseUrl}/${id}/payment/receive`, payload)
      .pipe(map((res) => res.data));
  }

  getReceiptUrl(id: number, lang: AppLang = 'en'): string {
    return `${this.baseUrl}/${id}/receipt${lang === 'ta' ? '?lang=ta' : ''}`;
  }

  /** The print-preview HTML version of the same receipt -- see backend's
   * receiptHtml.js (Mass Intentions' equivalent, contributionReceiptHtml.js
   * here) for why the "Print" action uses this URL instead of
   * getReceiptUrl's PDF above. */
  getReceiptPrintUrl(id: number, lang: AppLang = 'en'): string {
    return `${this.baseUrl}/${id}/receipt/print${lang === 'ta' ? '?lang=ta' : ''}`;
  }
}
