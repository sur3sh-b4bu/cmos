import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiListResponse, ApiResponse } from '../../core/models/api-response.model';
import {
  CreatePrayerIntentionRequest,
  DashboardStats,
  PrayerIntention,
  UpdatePrayerIntentionRequest,
} from './prayer-intention.model';

export interface PrayerIntentionQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  prayerDate?: string;
  prayerDateFrom?: string;
  prayerDateTo?: string;
  massId?: number;
  statusId?: number;
}

@Injectable({ providedIn: 'root' })
export class PrayerIntentionService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiBaseUrl}/prayer-intentions`;

  list(query: PrayerIntentionQuery): Observable<ApiListResponse<PrayerIntention>> {
    let params = new HttpParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return this.http.get<ApiListResponse<PrayerIntention>>(this.baseUrl, { params });
  }

  getById(id: number): Observable<PrayerIntention> {
    return this.http
      .get<ApiResponse<PrayerIntention>>(`${this.baseUrl}/${id}`)
      .pipe(map((res) => res.data));
  }

  create(payload: CreatePrayerIntentionRequest): Observable<PrayerIntention> {
    return this.http
      .post<ApiResponse<PrayerIntention>>(this.baseUrl, payload)
      .pipe(map((res) => res.data));
  }

  update(id: number, payload: UpdatePrayerIntentionRequest): Observable<PrayerIntention> {
    return this.http
      .put<ApiResponse<PrayerIntention>>(`${this.baseUrl}/${id}`, payload)
      .pipe(map((res) => res.data));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  markCompleted(id: number): Observable<PrayerIntention> {
    return this.http
      .post<ApiResponse<PrayerIntention>>(`${this.baseUrl}/${id}/mark-completed`, {})
      .pipe(map((res) => res.data));
  }

  markAllCompleted(prayerDate: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/mark-all-completed`, { prayerDate });
  }

  getReceiptUrl(id: number): string {
    return `${this.baseUrl}/${id}/receipt`;
  }

  getRegisterPreview(date: string): Observable<PrayerIntention[]> {
    return this.http
      .get<ApiListResponse<PrayerIntention>>(`${this.baseUrl}/register/preview`, { params: { date } })
      .pipe(map((res) => res.data));
  }

  getRegisterPrintUrl(date: string): string {
    return `${this.baseUrl}/register/print?date=${date}`;
  }

  getDashboardStats(): Observable<DashboardStats> {
    return this.http
      .get<ApiResponse<DashboardStats>>(`${this.baseUrl}/dashboard-stats`)
      .pipe(map((res) => res.data));
  }
}
