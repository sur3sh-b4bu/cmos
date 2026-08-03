import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/models/api-response.model';

export interface DateRangeQuery {
  dateFrom?: string;
  dateTo?: string;
  [key: string]: string | number | undefined;
}

export interface PrayerIntentionReportRow {
  id: number;
  receipt_no: string;
  prayer_date: string;
  name: string;
  phone: string | null;
  offering_amount: string;
  mass_name: string;
  status_label: string;
  status_color: string;
  intention: string;
}
export interface PrayerIntentionReportData {
  rows: PrayerIntentionReportRow[];
  summary: { totalCount: number; totalOffering: number };
}

export interface CollectionsReportData {
  byDay: { date: string; total: number; count: number }[];
  byPaymentMethod: { method: string; total: number; count: number }[];
  summary: { totalCount: number; totalOffering: number };
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

  prayerIntentions(query: DateRangeQuery): Observable<PrayerIntentionReportData> {
    return this.http
      .get<ApiResponse<PrayerIntentionReportData>>(`${this.baseUrl}/prayer-intentions`, { params: this.buildParams(query) })
      .pipe(map((res) => res.data));
  }

  collections(query: DateRangeQuery): Observable<CollectionsReportData> {
    return this.http
      .get<ApiResponse<CollectionsReportData>>(`${this.baseUrl}/collections`, { params: this.buildParams(query) })
      .pipe(map((res) => res.data));
  }

  certificates(query: DateRangeQuery): Observable<CertificateReportData> {
    return this.http
      .get<ApiResponse<CertificateReportData>>(`${this.baseUrl}/certificates`, { params: this.buildParams(query) })
      .pipe(map((res) => res.data));
  }
}
