import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api-response.model';

export interface Role {
  id: number;
  name: string;
  code: string;
  description: string | null;
  is_system_role: number;
}

export interface Permission {
  id: number;
  module: string;
  action: string;
  code: string;
  description: string | null;
}

@Injectable({ providedIn: 'root' })
export class RoleService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiBaseUrl}/roles`;

  listRoles(): Observable<Role[]> {
    return this.http.get<ApiResponse<Role[]>>(this.baseUrl).pipe(map((res) => res.data));
  }

  listPermissions(): Observable<Permission[]> {
    return this.http.get<ApiResponse<Permission[]>>(`${this.baseUrl}/permissions/all`).pipe(map((res) => res.data));
  }

  getRolePermissionIds(roleId: number): Observable<number[]> {
    return this.http.get<ApiResponse<number[]>>(`${this.baseUrl}/${roleId}/permissions`).pipe(map((res) => res.data));
  }

  setRolePermissions(roleId: number, permissionIds: number[]): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${roleId}/permissions`, { permissionIds });
  }
}
