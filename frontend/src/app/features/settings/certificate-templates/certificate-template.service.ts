import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api-response.model';

export type CertificateType = 'baptism' | 'marriage' | 'confirmation' | 'death';

export interface CertificateTemplate {
  id?: number;
  church_id?: number;
  certificate_type: CertificateType;
  title: string;
  subheader_prefix: string;
  diocese_label: string;
  signatory_title: string;
  seal_label: string;
  field_labels: Record<string, string>;
  is_customized?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class CertificateTemplateService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiBaseUrl}/certificate-templates`;

  getAll(): Observable<ApiResponse<Record<CertificateType, CertificateTemplate>>> {
    return this.http.get<ApiResponse<Record<CertificateType, CertificateTemplate>>>(this.baseUrl);
  }

  getByType(type: CertificateType): Observable<ApiResponse<CertificateTemplate>> {
    return this.http.get<ApiResponse<CertificateTemplate>>(`${this.baseUrl}/${type}`);
  }

  update(type: CertificateType, payload: Partial<CertificateTemplate>): Observable<ApiResponse<CertificateTemplate>> {
    return this.http.put<ApiResponse<CertificateTemplate>>(`${this.baseUrl}/${type}`, payload);
  }

  reset(type: CertificateType): Observable<ApiResponse<CertificateTemplate>> {
    return this.http.post<ApiResponse<CertificateTemplate>>(`${this.baseUrl}/${type}/reset`, {});
  }

  getPreviewPdf(type: CertificateType): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${type}/preview`, { responseType: 'blob' });
  }
}
