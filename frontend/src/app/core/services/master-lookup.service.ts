import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiListResponse } from '../models/api-response.model';

/**
 * Masters whose rows belong to one church. A dropdown of these must offer only the church being
 * worked in -- which matters to a Master Administrator, who otherwise reads every church's rows
 * (see backend mastersController.readScopeFor). Sending `scoped=true` asks for that.
 */
const CHURCH_OWNED_MASTERS = new Set(['masses', 'priests', 'holidays']);

/** Generic read access to any /api/masters/:masterKey table -- used to populate dropdowns. */
@Injectable({ providedIn: 'root' })
export class MasterLookupService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiBaseUrl}/masters`;

  list<T = Record<string, unknown>>(masterKey: string, params: Record<string, string | number> = {}): Observable<T[]> {
    return this.http
      .get<ApiListResponse<T>>(`${this.baseUrl}/${masterKey}`, {
        params: { pageSize: 500, ...(CHURCH_OWNED_MASTERS.has(masterKey) ? { scoped: 'true' } : {}), ...params },
      })
      .pipe(map((res) => res.data));
  }

  getById<T = Record<string, unknown>>(masterKey: string, id: number): Observable<T> {
    return this.http
      .get<{ success: boolean; data: T }>(`${this.baseUrl}/${masterKey}/${id}`)
      .pipe(map((res) => res.data));
  }
}
