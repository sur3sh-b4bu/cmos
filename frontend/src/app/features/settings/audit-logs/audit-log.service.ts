import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiListResponse } from '../../../core/models/api-response.model';
import { AuditLog } from './audit-log.model';

export interface AuditLogQuery {
  page?: number;
  pageSize?: number;
  module?: string;
  search?: string;
  fromDate?: string;
  toDate?: string;
}

@Injectable({ providedIn: 'root' })
export class AuditLogService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiBaseUrl}/audit-logs`;

  list(query: AuditLogQuery): Observable<ApiListResponse<AuditLog>> {
    let params = new HttpParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') params = params.set(key, String(value));
    });
    return this.http.get<ApiListResponse<AuditLog>>(this.baseUrl, { params });
  }
}
