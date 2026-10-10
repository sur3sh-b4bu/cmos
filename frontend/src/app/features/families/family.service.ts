import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CensusStats, Family, FamilyMember, Ward } from './family.model';
import { environment } from '../../../environments/environment';

export interface FamilyListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  wardId?: number | null;
  status?: string;
  sortBy?: string;
  sortDir?: 'ASC' | 'DESC';
}

export interface FamilyListResponse {
  rows: Family[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable({
  providedIn: 'root',
})
export class FamilyService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiBaseUrl}/families`;

  list(params: FamilyListParams = {}): Observable<FamilyListResponse> {
    let httpParams = new HttpParams();
    if (params.page) httpParams = httpParams.set('page', params.page);
    if (params.pageSize) httpParams = httpParams.set('pageSize', params.pageSize);
    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.wardId) httpParams = httpParams.set('wardId', params.wardId);
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.sortBy) httpParams = httpParams.set('sortBy', params.sortBy);
    if (params.sortDir) httpParams = httpParams.set('sortDir', params.sortDir);

    return this.http.get<any>(this.baseUrl, { params: httpParams }).pipe(
      map((res) => ({
        rows: res.rows || [],
        total: res.total || 0,
        page: res.page || 1,
        pageSize: res.pageSize || 25,
      }))
    );
  }

  getById(id: number): Observable<Family> {
    return this.http.get<{ success: boolean; data: Family }>(`${this.baseUrl}/${id}`).pipe(map((res) => res.data));
  }

  getNextCode(): Observable<string> {
    return this.http
      .get<{ success: boolean; data: { family_code: string } }>(`${this.baseUrl}/next-code`)
      .pipe(map((res) => res.data.family_code));
  }

  create(payload: Partial<Family>): Observable<Family> {
    return this.http
      .post<{ success: boolean; data: Family }>(this.baseUrl, payload)
      .pipe(map((res) => res.data));
  }

  update(id: number, payload: Partial<Family>): Observable<Family> {
    return this.http
      .put<{ success: boolean; data: Family }>(`${this.baseUrl}/${id}`, payload)
      .pipe(map((res) => res.data));
  }

  delete(id: number): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.baseUrl}/${id}`);
  }

  addMember(familyId: number, member: Partial<FamilyMember>): Observable<FamilyMember> {
    return this.http
      .post<{ success: boolean; data: FamilyMember }>(`${this.baseUrl}/${familyId}/members`, member)
      .pipe(map((res) => res.data));
  }

  updateMember(memberId: number, member: Partial<FamilyMember>): Observable<FamilyMember> {
    return this.http
      .put<{ success: boolean; data: FamilyMember }>(`${this.baseUrl}/members/${memberId}`, member)
      .pipe(map((res) => res.data));
  }

  removeMember(memberId: number): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.baseUrl}/members/${memberId}`);
  }

  splitFamily(parentFamilyId: number, splitPayload: any): Observable<Family> {
    return this.http
      .post<{ success: boolean; data: Family }>(`${this.baseUrl}/${parentFamilyId}/split`, splitPayload)
      .pipe(map((res) => res.data));
  }

  migrateFamily(familyId: number, migrationPayload: any): Observable<Family> {
    return this.http
      .post<{ success: boolean; data: Family }>(`${this.baseUrl}/${familyId}/migrate`, migrationPayload)
      .pipe(map((res) => res.data));
  }

  getCensus(): Observable<CensusStats> {
    return this.http
      .get<{ success: boolean; data: CensusStats }>(`${this.baseUrl}/stats/census`)
      .pipe(map((res) => res.data));
  }

  getWards(): Observable<Ward[]> {
    return this.http
      .get<{ success: boolean; rows: Ward[] }>(`${environment.apiBaseUrl}/masters/wards?pageSize=500`)
      .pipe(map((res) => res.rows || []));
  }
}
