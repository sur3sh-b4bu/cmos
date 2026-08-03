import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

/**
 * PDF/export endpoints require the Bearer access token, which only exists
 * in memory (see AuthService) -- a plain <a href> or window.open() can't
 * attach it. Fetching as a blob through HttpClient (so the auth
 * interceptor applies) and opening/downloading the object URL is the
 * standard workaround for authenticated file downloads in an SPA.
 */
@Injectable({ providedIn: 'root' })
export class FileDownloadService {
  private http = inject(HttpClient);

  async openInNewTab(url: string): Promise<void> {
    const blob = await firstValueFrom(this.http.get(url, { responseType: 'blob' }));
    const objectUrl = URL.createObjectURL(blob);
    window.open(objectUrl, '_blank');
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  }

  async download(url: string, filename: string): Promise<void> {
    const blob = await firstValueFrom(this.http.get(url, { responseType: 'blob' }));
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  }
}
