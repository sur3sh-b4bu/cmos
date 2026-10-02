import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiListResponse, ApiResponse } from '../../core/models/api-response.model';
import { ServerTransfer } from '../../core/services/excel-transfer.service';

export type CertificateType = 'baptism' | 'marriage' | 'death' | 'confirmation';

@Injectable({ providedIn: 'root' })
export class CertificateService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiBaseUrl}/certificates`;

  // Extra keys beyond page/pageSize/search are the structured filter-bar
  // params (e.g. priest_id, date_of_baptismFrom/To) -- see certificate-
  // list.ts's fetch() and certificateRepository.js's buildStructuredFilters,
  // which is what actually reads them server-side.
  list(
    type: CertificateType,
    query: { page?: number; pageSize?: number; search?: string } & Record<string, string | number | undefined>
  ): Observable<ApiListResponse<any>> {
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

  /** Endpoints behind the list's Import / Export / template buttons; `exportParams` is read at click time. */
  transferConfig(type: CertificateType, exportParams: ServerTransfer['exportParams']): ServerTransfer {
    return {
      exportUrl: `${this.baseUrl}/${type}/export`,
      templateUrl: `${this.baseUrl}/${type}/import-template`,
      importUrl: `${this.baseUrl}/${type}/import`,
      fallbackFileName: `${type}-certificates.xlsx`,
      exportParams,
    };
  }

  getPrintUrl(type: CertificateType, id: number): string {
    return `${this.baseUrl}/${type}/${id}/print`;
  }
}
