import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiListResponse, ApiResponse } from '../../core/models/api-response.model';

export type CertificateType = 'baptism' | 'marriage' | 'death';

@Injectable({ providedIn: 'root' })
export class CertificateService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiBaseUrl}/certificates`;

  list(type: CertificateType, query: { page?: number; pageSize?: number; search?: string }): Observable<ApiListResponse<any>> {
    let params = new HttpParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') params = params.set(key, String(value));
    });
    return this.http.get<ApiListResponse<any>>(`${this.baseUrl}/${type}`, { params });
  }

  getById(type: CertificateType, id: number): Observable<any> {
    return this.http.get<ApiResponse<any>>(`${this.baseUrl}/${type}/${id}`).pipe(map((res) => res.data));
  }

  create(type: CertificateType, payload: Record<string, unknown>): Observable<any> {
    return this.http.post<ApiResponse<any>>(`${this.baseUrl}/${type}`, payload).pipe(map((res) => res.data));
  }

  update(type: CertificateType, id: number, payload: Record<string, unknown>): Observable<any> {
    return this.http.put<ApiResponse<any>>(`${this.baseUrl}/${type}/${id}`, payload).pipe(map((res) => res.data));
  }

  delete(type: CertificateType, id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${type}/${id}`);
  }

  getPrintUrl(type: CertificateType, id: number): string {
    return `${this.baseUrl}/${type}/${id}/print`;
  }
}
