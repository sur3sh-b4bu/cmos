import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/models/api-response.model';
import { AppLang } from '../../core/i18n/translations';

export interface DateRangeQuery {
  dateFrom?: string;
  dateTo?: string;
  [key: string]: string | number | undefined;
}

export interface MassIntentionReportRow {
  id: number;
  receipt_no: string;
  prayer_date: string;
  name: string;
  phone: string | null;
  offering_amount: string;
  mass_name: string;
  is_paid: 0 | 1;
  paid_via: string | null;
  intention: string;
}
export interface MassIntentionReportData {
  rows: MassIntentionReportRow[];
  summary: { totalCount: number; totalOffering: number };
}

export interface CollectionsReportData {
  byDay: { date: string; total: number; count: number }[];
  byPaymentMethod: { method: string; total: number; count: number }[];
  summary: { totalCount: number; totalOffering: number };
}

export type CollectionsDateBasis = 'payment' | 'entered';

export interface CollectionsDetailRow {
  booked_by: string | null;
  receipt_no: string;
  mass_name: string;
  mass_name_ta: string | null;
  method: string | null;
  amount: number;
  /** When the payment was recorded -- see `CollectionsDateBasis`. */
  payment_date: string;
  /** When the Mass Intention itself was booked -- see `CollectionsDateBasis`. */
  entered_date: string;
}
export interface CollectionsDetailData {
  dateFrom: string;
  dateTo: string;
  rows: CollectionsDetailRow[];
  total: number;
  count: number;
}

// Contributions' own equivalent of CollectionsReportData/CollectionsDetailData
// above -- same shape, sourced from contribution_payment_transactions instead
// of payment_transactions (see report.service.ts's contributionCollections*
// methods / reportRepository.js's contributionCollectionsReport).
export interface ContributionCollectionsReportData {
  byDay: { date: string; total: number; count: number }[];
  byPaymentMethod: { method: string; total: number; count: number }[];
  summary: { totalCount: number; totalOffering: number };
}

export interface ContributionCollectionsDetailRow {
  name: string;
  receipt_no: string;
  contribution_type_name: string | null;
  contribution_type_name_ta: string | null;
  contribution_type_is_custom: 0 | 1;
  custom_contribution_type: string | null;
  method: string | null;
  amount: number;
  payment_date: string;
}
export interface ContributionCollectionsDetailData {
  dateFrom: string;
  dateTo: string;
  rows: ContributionCollectionsDetailRow[];
  total: number;
  count: number;
}

export interface CertificateReportRow {
  certificate_type: 'baptism' | 'marriage' | 'death';
  certificate_no: string;
  name: string;
  date: string;
}
export interface CertificateReportData {
  rows: CertificateReportRow[];
  summary: Record<string, number>;
}

@Injectable({ providedIn: 'root' })
export class ReportService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiBaseUrl}/reports`;

  private buildParams(query: DateRangeQuery): HttpParams {
    let params = new HttpParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') params = params.set(key, String(value));
    });
    return params;
  }

  massIntentions(query: DateRangeQuery): Observable<MassIntentionReportData> {
    return this.http
      .get<ApiResponse<MassIntentionReportData>>(`${this.baseUrl}/mass-intentions`, { params: this.buildParams(query) })
      .pipe(map((res) => res.data));
  }

  collections(query: DateRangeQuery): Observable<CollectionsReportData> {
    return this.http
      .get<ApiResponse<CollectionsReportData>>(`${this.baseUrl}/collections`, { params: this.buildParams(query) })
      .pipe(map((res) => res.data));
  }

  /** `dateBasis` defaults to 'payment' -- Reports' own per-day drill-down
   * print relies on that default so its detail rows stay consistent with
   * that page's payment_date-grouped by-day totals. The Dashboard's stat
   * cards pass 'entered' instead -- see collections-detail-dialog.ts. */
  collectionsDetail(
    dateFrom: string,
    dateTo: string = dateFrom,
    dateBasis: CollectionsDateBasis = 'payment'
  ): Observable<CollectionsDetailData> {
    return this.http
      .get<ApiResponse<CollectionsDetailData>>(`${this.baseUrl}/collections/detail`, { params: { dateFrom, dateTo, dateBasis } })
      .pipe(map((res) => res.data));
  }

  /** `mine: true` -> the "print my collections" button every user can reach
   * (their own billed transactions only). Omitted/false -> the all-users,
   * per-row "who billed it" breakdown -- gated server-side to
   * reports.print_all (see reportController.js's assertCanPrintAllUsers),
   * so this URL 403s for anyone without it regardless of what's passed. */
  getCollectionsDetailPrintUrl(
    dateFrom: string,
    dateTo: string = dateFrom,
    mine = false,
    dateBasis: CollectionsDateBasis = 'payment',
    lang: AppLang = 'en'
  ): string {
    return `${this.baseUrl}/collections/detail/print?dateFrom=${dateFrom}&dateTo=${dateTo}${mine ? '&mine=true' : ''}&dateBasis=${dateBasis}${lang === 'ta' ? '&lang=ta' : ''}`;
  }

  contributionCollections(query: DateRangeQuery): Observable<ContributionCollectionsReportData> {
    return this.http
      .get<ApiResponse<ContributionCollectionsReportData>>(`${this.baseUrl}/contributions`, { params: this.buildParams(query) })
      .pipe(map((res) => res.data));
  }

  contributionCollectionsDetail(dateFrom: string, dateTo: string = dateFrom): Observable<ContributionCollectionsDetailData> {
    return this.http
      .get<ApiResponse<ContributionCollectionsDetailData>>(`${this.baseUrl}/contributions/detail`, { params: { dateFrom, dateTo } })
      .pipe(map((res) => res.data));
  }

  /** Contributions' own equivalent of getCollectionsDetailPrintUrl's `mine` split. */
  getContributionCollectionsDetailPrintUrl(dateFrom: string, dateTo: string = dateFrom, mine = false, lang: AppLang = 'en'): string {
    return `${this.baseUrl}/contributions/detail/print?dateFrom=${dateFrom}&dateTo=${dateTo}${mine ? '&mine=true' : ''}${lang === 'ta' ? '&lang=ta' : ''}`;
  }

  getMassIntentionsPrintUrl(query: DateRangeQuery, lang: AppLang = 'en'): string {
    const params = new URLSearchParams();
    if (query.dateFrom) params.set('dateFrom', query.dateFrom);
    if (query.dateTo) params.set('dateTo', query.dateTo);
    if (query['massId']) params.set('massId', String(query['massId']));
    if (query['paidOnly'] !== undefined) params.set('paidOnly', String(query['paidOnly']));
    if (lang === 'ta') params.set('lang', 'ta');
    return `${this.baseUrl}/mass-intentions/print?${params.toString()}`;
  }

  certificates(query: DateRangeQuery): Observable<CertificateReportData> {
    return this.http
      .get<ApiResponse<CertificateReportData>>(`${this.baseUrl}/certificates`, { params: this.buildParams(query) })
      .pipe(map((res) => res.data));
  }

  getCertificatesPrintUrl(query: DateRangeQuery, lang: AppLang = 'en'): string {
    const params = new URLSearchParams();
    if (query.dateFrom) params.set('dateFrom', query.dateFrom);
    if (query.dateTo) params.set('dateTo', query.dateTo);
    if (query['type']) params.set('type', String(query['type']));
    if (lang === 'ta') params.set('lang', 'ta');
    return `${this.baseUrl}/certificates/print?${params.toString()}`;
  }

  overallFinancial(query: DateRangeQuery): Observable<any> {
    return this.http
      .get<ApiResponse<any>>(`${this.baseUrl}/overall-financial`, { params: this.buildParams(query) })
      .pipe(map((res) => res.data));
  }

  getOverallFinancialPrintUrl(dateFrom: string, dateTo: string = dateFrom, lang: AppLang = 'en'): string {
    return `${this.baseUrl}/overall-financial/print?dateFrom=${dateFrom}&dateTo=${dateTo}${lang === 'ta' ? '&lang=ta' : ''}`;
  }
}
