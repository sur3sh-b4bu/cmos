import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';

export interface TrashItem {
  id: number;
  reference_no: string;
  record_title: string;
  record_detail?: string;
  deleted_at: string;
  deleted_by_name?: string;
}

export interface TrashListResponse {
  rows: TrashItem[];
  total: number;
  page: number;
  pageSize: number;
  moduleKey: string;
}

export interface TrashQueryParams {
  moduleKey: string;
  page?: number;
  pageSize?: number;
  search?: string;
}

@Injectable({ providedIn: 'root' })
export class TrashService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiBaseUrl}/trash`;

  list(params: TrashQueryParams): Observable<TrashListResponse> {
    let httpParams = new HttpParams()
      .set('moduleKey', params.moduleKey)
      .set('page', String(params.page || 1))
      .set('pageSize', String(params.pageSize || 25));

    if (params.search && params.search.trim()) {
      httpParams = httpParams.set('search', params.search.trim());
    }

    return this.http
      .get<ApiResponse<TrashListResponse>>(this.baseUrl, { params: httpParams })
      .pipe(map((res) => res.data));
  }

  restore(moduleKey: string, id: number): Observable<{ message: string }> {
    return this.http
      .post<ApiResponse<{ message: string }>>(`${this.baseUrl}/restore`, { moduleKey, id })
      .pipe(map((res) => ({ message: res.message || 'Restored successfully' })));
  }
}
