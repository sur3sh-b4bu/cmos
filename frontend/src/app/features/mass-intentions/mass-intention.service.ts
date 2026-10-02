import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiListResponse, ApiResponse } from '../../core/models/api-response.model';
import { AppLang } from '../../core/i18n/translations';
import { ServerTransfer } from '../../core/services/excel-transfer.service';
import {
  BulkBatch,
  CreateMassIntentionRequest,
  DashboardStats,
  MassIntention,
  ReceivePaymentRequest,
  UpdateMassIntentionRequest,
} from './mass-intention.model';

export interface MassIntentionQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  prayerDate?: string;
  prayerDateFrom?: string;
  prayerDateTo?: string;
  /** Structured filter-bar values (see mass-intentions-list.ts's
   * filterFields) -- always sent, and read server-side, as plain
   * query-string values rather than a number/boolean. paidOnly is '1' | '0';
   * see massIntentionRepository.js's own comment on why a bare
   * `paidOnly ? 1 : 0` there would be wrong. */
  massId?: string;
  paymentMethodId?: string;
  paidOnly?: string;
  /** The individual intentions belonging to one Bulk Mass Intention save --
   * see bulk-batch-detail-dialog.ts. */
  bulkBatchId?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export interface BulkBatchQuery {
  page?: number;
  pageSize?: number;
}

@Injectable({ providedIn: 'root' })
export class MassIntentionService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiBaseUrl}/mass-intentions`;

  /** Endpoints behind the list's Import / Export / template buttons; `exportParams` is read at click time. */
  transferConfig(exportParams: ServerTransfer['exportParams']): ServerTransfer {
    return {
      exportUrl: `${this.baseUrl}/export`,
      templateUrl: `${this.baseUrl}/import-template`,
      importUrl: `${this.baseUrl}/import`,
      fallbackFileName: 'mass-intentions.xlsx',
      exportParams,
    };
  }

  list(query: MassIntentionQuery): Observable<ApiListResponse<MassIntention>> {
    let params = new HttpParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return this.http.get<ApiListResponse<MassIntention>>(this.baseUrl, { params });
  }

  getById(id: number): Observable<MassIntention> {
    return this.http
      .get<ApiResponse<MassIntention>>(`${this.baseUrl}/${id}`)
      .pipe(map((res) => res.data));
  }

  create(payload: CreateMassIntentionRequest): Observable<MassIntention> {
    return this.http
      .post<ApiResponse<MassIntention>>(this.baseUrl, payload)
      .pipe(map((res) => res.data));
  }

  update(id: number, payload: UpdateMassIntentionRequest): Observable<MassIntention> {
    return this.http
      .put<ApiResponse<MassIntention>>(`${this.baseUrl}/${id}`, payload)
      .pipe(map((res) => res.data));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  receivePayment(id: number, payload: ReceivePaymentRequest): Observable<MassIntention> {
    return this.http
      .post<ApiResponse<MassIntention>>(`${this.baseUrl}/${id}/payment/receive`, payload)
      .pipe(map((res) => res.data));
  }

  getReceiptUrl(id: number, lang: AppLang = 'en'): string {
    return `${this.baseUrl}/${id}/receipt${lang === 'ta' ? '?lang=ta' : ''}`;
  }

  /** The print-preview HTML version of the same receipt -- see backend's
   * receiptHtml.js for why the "Print" action uses this URL (with
   * FileDownloadService.printHtml) instead of getReceiptUrl's PDF above. */
  getReceiptPrintUrl(id: number, lang: AppLang = 'en'): string {
    return `${this.baseUrl}/${id}/receipt/print${lang === 'ta' ? '?lang=ta' : ''}`;
  }

  /** One combined receipt covering every id -- see bulk-mass-intention-form.ts. */
  getBulkReceiptUrl(ids: number[], lang: AppLang = 'en'): string {
    return `${this.baseUrl}/receipt/bulk?ids=${ids.join(',')}${lang === 'ta' ? '&lang=ta' : ''}`;
  }

  /** Same combined receipt, resolved server-side from a batch instead of
   * explicit ids -- for reprinting later, once the caller no longer has the
   * ids to hand (see "Show Bulk Mass Intentions" in mass-intentions-list.ts). */
  getBulkReceiptUrlByBatch(batchId: string, lang: AppLang = 'en'): string {
    return `${this.baseUrl}/receipt/bulk?batchId=${encodeURIComponent(batchId)}${lang === 'ta' ? '&lang=ta' : ''}`;
  }

  /** "Show Bulk Mass Intentions" -- one row per past Bulk Mass Intention save. */
  listBulkBatches(query: BulkBatchQuery): Observable<ApiListResponse<BulkBatch>> {
    let params = new HttpParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return this.http.get<ApiListResponse<BulkBatch>>(`${this.baseUrl}/bulk-batches`, { params });
  }

  getRegisterPreview(date: string): Observable<MassIntention[]> {
    return this.http
      .get<ApiListResponse<MassIntention>>(`${this.baseUrl}/register/preview`, { params: { date } })
      .pipe(map((res) => res.data));
  }

  getRegisterPrintUrl(date: string, namesOnly = false, lang: AppLang = 'en', reasonsOnly = false): string {
    const extra = reasonsOnly ? '&reasonsOnly=true' : namesOnly ? '&namesOnly=true' : '';
    return `${this.baseUrl}/register/print?date=${date}${extra}${lang === 'ta' ? '&lang=ta' : ''}`;
  }

  getRegisterReasonsOnlyPrintUrl(date: string, lang: AppLang = 'en'): string {
    return this.getRegisterPrintUrl(date, false, lang, true);
  }

  getDashboardStats(): Observable<DashboardStats> {
    return this.http
      .get<ApiResponse<DashboardStats>>(`${this.baseUrl}/dashboard-stats`)
      .pipe(map((res) => res.data));
  }
}
