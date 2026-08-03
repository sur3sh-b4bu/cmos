import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiListResponse, ApiResponse } from '../../core/models/api-response.model';

@Injectable({ providedIn: 'root' })
export class MasterService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiBaseUrl}/masters`;

  list(masterKey: string, query: { page?: number; pageSize?: number; search?: string } = {}): Observable<ApiListResponse<any>> {
    let params = new HttpParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') params = params.set(key, String(value));
    });
    return this.http.get<ApiListResponse<any>>(`${this.baseUrl}/${masterKey}`, { params });
  }

  getById(masterKey: string, id: number): Observable<any> {
    return this.http.get<ApiResponse<any>>(`${this.baseUrl}/${masterKey}/${id}`).pipe(map((res) => res.data));
  }

  create(masterKey: string, payload: Record<string, unknown>): Observable<any> {
    return this.http.post<ApiResponse<any>>(`${this.baseUrl}/${masterKey}`, payload).pipe(map((res) => res.data));
  }

  update(masterKey: string, id: number, payload: Record<string, unknown>): Observable<any> {
    return this.http.put<ApiResponse<any>>(`${this.baseUrl}/${masterKey}/${id}`, payload).pipe(map((res) => res.data));
  }

  delete(masterKey: string, id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${masterKey}/${id}`);
  }

  reorder(masterKey: string, orderedIds: number[]): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${masterKey}/reorder`, { orderedIds });
  }
}
