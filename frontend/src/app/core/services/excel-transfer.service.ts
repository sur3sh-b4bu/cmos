import { HttpClient, HttpErrorResponse, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { LanguageService } from './language.service';
import { ImportMapping, ImportPreview } from '../../shared/utils/excel-import.util';

/** One problem found in an uploaded sheet -- `column` is the heading the user sees in their own file. */
export interface ImportRowError {
  row: number;
  column: string;
  message: string;
}

/** What POST .../import returns once the whole file has been read and every valid row saved. */
export interface ImportReport {
  total: number;
  imported: number;
  failed: number;
  errors: ImportRowError[];
  ignoredColumns: string[];
}

/** The API endpoints behind a list's Import / Export / template buttons. */
export interface ServerTransfer {
  exportUrl: string;
  templateUrl: string;
  importUrl: string;
  /** Extra query params for the export (search text, filters, date range) so it matches what is on screen. */
  exportParams?: () => Record<string, string | number | undefined>;
  /** File name used if the server sends none, e.g. "baptism-certificates.xlsx". */
  fallbackFileName: string;
}

/** A whole-file rejection (wrong type, empty, wrong headings, too large...). */
export class TransferFileError extends Error {
  constructor(
    message: string,
    readonly expectedHeadings: string[] = [],
    readonly foundHeadings: string[] = []
  ) {
    super(message);
  }
}

export const IMPORT_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Excel import/export/template for the record lists that do it on the server
 * (Certificates, Mass Intentions, Contributions). Everything here is
 * timezone/locale neutral: dates are read and written by the API as plain
 * calendar dates, the browser only moves bytes.
 */
@Injectable({ providedIn: 'root' })
export class ExcelTransferService {
  private http = inject(HttpClient);
  private language = inject(LanguageService);

  /** Downloads the export and resolves with how many records it holds. */
  async exportFile(transfer: ServerTransfer): Promise<number> {
    const response = await this.getBlob(transfer.exportUrl, transfer.exportParams?.() ?? {});
    this.saveBlob(response, transfer.fallbackFileName);
    return Number(response.headers.get('X-Export-Count') ?? 0);
  }

  async downloadTemplate(transfer: ServerTransfer): Promise<void> {
    const response = await this.getBlob(transfer.templateUrl, {});
    this.saveBlob(response, `${transfer.fallbackFileName.replace(/\.xlsx$/, '')}-import-template.xlsx`);
  }

  /** First step of an import: uploads the file only to have the API read its columns, with a few
   * sample values each and the field every heading matched -- nothing is saved. Feeds the
   * "match columns" popup. A whole-file problem throws a TransferFileError. */
  async previewImport(transfer: ServerTransfer, file: File): Promise<ImportPreview> {
    const body = new FormData();
    body.append('lang', this.language.current());
    body.append('file', file, file.name);
    try {
      const res = await firstValueFrom(this.http.post<{ data: ImportPreview }>(`${transfer.importUrl}/preview`, body));
      return res.data;
    } catch (err) {
      throw await this.toFileError(err);
    }
  }

  /** Uploads the file; a whole-file problem throws a TransferFileError with the server's own clear message.
   * `mapping` is the user's choice from the "match columns" popup; without it the API matches by heading. */
  async importFile(transfer: ServerTransfer, file: File, mapping?: ImportMapping): Promise<ImportReport> {
    const body = new FormData();
    body.append('lang', this.language.current());
    if (mapping) body.append('mapping', JSON.stringify(mapping));
    body.append('file', file, file.name);
    try {
      const res = await firstValueFrom(this.http.post<{ data: ImportReport }>(transfer.importUrl, body));
      return res.data;
    } catch (err) {
      throw await this.toFileError(err);
    }
  }

  private async getBlob(url: string, extra: Record<string, string | number | undefined>): Promise<HttpResponse<Blob>> {
    let params = new HttpParams().set('lang', this.language.current());
    for (const [key, value] of Object.entries(extra)) {
      if (value !== undefined && value !== null && value !== '') params = params.set(key, String(value));
    }
    try {
      return await firstValueFrom(this.http.get(url, { params, responseType: 'blob', observe: 'response' }));
    } catch (err) {
      throw await this.toFileError(err);
    }
  }

  /** Error bodies of a blob request arrive as a Blob too -- read them back into the API's JSON message. */
  private async toFileError(err: unknown): Promise<TransferFileError> {
    if (err instanceof HttpErrorResponse) {
      let body: unknown = err.error;
      if (body instanceof Blob) {
        try {
          body = JSON.parse(await body.text());
        } catch {
          body = null;
        }
      }
      const parsed = body as { message?: string; details?: { expectedHeadings?: string[]; foundHeadings?: string[] } } | null;
      if (parsed?.message) {
        return new TransferFileError(parsed.message, parsed.details?.expectedHeadings ?? [], parsed.details?.foundHeadings ?? []);
      }
      if (err.status === 0) return new TransferFileError('Cannot reach the server. Please check your connection.');
    }
    return new TransferFileError('Something went wrong. Please try again.');
  }

  private saveBlob(response: HttpResponse<Blob>, fallbackName: string): void {
    const blob = response.body as Blob;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = this.fileNameFrom(response.headers.get('Content-Disposition')) ?? fallbackName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  private fileNameFrom(disposition: string | null): string | null {
    const match = /filename="?([^";]+)"?/i.exec(disposition ?? '');
    return match ? match[1] : null;
  }
}
