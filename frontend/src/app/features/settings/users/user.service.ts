import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiListResponse, ApiResponse } from '../../../core/models/api-response.model';
import { AppUser, CreateUserRequest, UpdateUserRequest } from './user.model';

@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiBaseUrl}/users`;

  list(query: { page?: number; pageSize?: number; search?: string }): Observable<ApiListResponse<AppUser>> {
    let params = new HttpParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') params = params.set(key, String(value));
    });
    return this.http.get<ApiListResponse<AppUser>>(this.baseUrl, { params });
  }

  getById(id: number): Observable<AppUser> {
    return this.http.get<ApiResponse<AppUser>>(`${this.baseUrl}/${id}`).pipe(map((res) => res.data));
  }

  create(payload: CreateUserRequest): Observable<{ user: AppUser; tempPassword: string }> {
    return this.http
      .post<ApiResponse<{ user: AppUser; tempPassword: string }>>(this.baseUrl, payload)
      .pipe(map((res) => res.data));
  }

  update(id: number, payload: UpdateUserRequest): Observable<AppUser> {
    return this.http.put<ApiResponse<AppUser>>(`${this.baseUrl}/${id}`, payload).pipe(map((res) => res.data));
  }

  activate(id: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${id}/activate`, {});
  }

  deactivate(id: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${id}/deactivate`, {});
  }

  resetPassword(id: number): Observable<{ tempPassword: string }> {
    return this.http
      .post<ApiResponse<{ tempPassword: string }>>(`${this.baseUrl}/${id}/reset-password`, {})
      .pipe(map((res) => res.data));
  }
}
