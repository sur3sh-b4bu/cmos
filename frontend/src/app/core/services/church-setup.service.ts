import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export type CertificateSeriesType = 'Baptism' | 'Marriage' | 'Death';

export interface SeriesValues {
  prefix: string;
  startNumber: number;
  padding: number;
}

export interface SuggestedMass {
  name: string;
  nameTa: string;
  massTime: string;
  dayType: 'Daily' | 'Sunday' | 'Special';
  defaultOfferingAmount: number;
}

/** What GET /church-setup/:churchId/status returns. */
export interface ChurchSetupStatus {
  churchId: number;
  churchName: string;
  /** True when nothing that blocks the office is missing (branch and priest are only recommended). */
  complete: boolean;
  missing: {
    receiptSeries: boolean;
    certificateSeries: CertificateSeriesType[];
    masses: boolean;
    branch: boolean;
    priest: boolean;
    /** No active Administrator login exists for the church yet. */
    admin: boolean;
  };
  defaults: {
    receiptSeries: SeriesValues;
    certificateSeries: Record<CertificateSeriesType, SeriesValues>;
    masses: SuggestedMass[];
  };
}

/** The body of POST /church-setup/:churchId -- only what is missing needs to be sent. */
export interface ChurchSetupPayload {
  receiptSeries?: SeriesValues;
  certificateSeries?: Partial<Record<CertificateSeriesType, SeriesValues>>;
  masses?: SuggestedMass[];
  branch?: { name: string };
  priest?: { name: string; title?: string };
  /** Creates the church's own Administrator login (a temporary password comes back once). */
  admin?: { fullName: string; username: string; email?: string; phone?: string };
}

/** What POST /church-setup/:churchId returns. `admin` is present only when a login was just created. */
export interface ChurchSetupResult {
  status: ChurchSetupStatus;
  created: Record<string, unknown>;
  skipped: string[];
  admin?: { id: number; username: string; tempPassword: string };
}

/**
 * "Is this church ready to use, and if not, what does it still need?" -- the data behind the
 * "Set up this church" popup and the reminder banner. The status of the church currently
 * being worked in is kept in `status` so the banner follows it.
 */
@Injectable({ providedIn: 'root' })
export class ChurchSetupService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiBaseUrl}/church-setup`;

  /** Status of the church currently in use; null when unknown, or none is selected (Central Management). */
  readonly status = signal<ChurchSetupStatus | null>(null);

  async getStatus(churchId: number): Promise<ChurchSetupStatus> {
    const res = await firstValueFrom(this.http.get<{ data: ChurchSetupStatus }>(`${this.baseUrl}/${churchId}/status`));
    return res.data;
  }

  /** Re-reads the status of the church in use. Never throws: a failure just leaves no reminder showing. */
  async refresh(churchId: number | null): Promise<ChurchSetupStatus | null> {
    if (!churchId) {
      this.status.set(null);
      return null;
    }
    try {
      const status = await this.getStatus(churchId);
      this.status.set(status);
      return status;
    } catch {
      this.status.set(null);
      return null;
    }
  }

  async apply(churchId: number, payload: ChurchSetupPayload): Promise<ChurchSetupResult> {
    const res = await firstValueFrom(this.http.post<{ data: ChurchSetupResult }>(`${this.baseUrl}/${churchId}`, payload));
    // Keep the banner right if this was the church currently in use.
    if (this.status()?.churchId === churchId) this.status.set(res.data.status);
    return res.data;
  }
}
