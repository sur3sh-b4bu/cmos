import { Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ReportService, CollectionsDetailData, CollectionsDateBasis } from './report.service';
import { CurrencyService } from '../../core/services/currency.service';
import { FileDownloadService } from '../../core/services/file-download.service';
import { LanguageService } from '../../core/services/language.service';
import { formatDateDMY } from '../../core/utils/date-format.util';
import { localizedName } from '../../core/utils/localized-name.util';
import { paymentMethodLabel } from '../../shared/utils/payment-method.util';

export interface CollectionsDetailDialogData {
  dateFrom: string;
  dateTo: string;
  /** 'payment' (default) or 'entered' -- see report.service.ts's
   * collectionsDetail(). Dashboard's stat-card popups pass 'entered'. */
  dateBasis?: CollectionsDateBasis;
}

/**
 * Per-payment breakdown for a date range of the Collections/Contributions
 * report -- opened by clicking a date's row in the "by day" table on
 * Reports (dateFrom === dateTo, see reports.ts/html) or by clicking the
 * Dashboard's Today's/Monthly Collections stat cards (dateFrom/dateTo
 * spanning that same range -- see dashboard.ts). Fetches its own data
 * rather than being handed it, same pattern as ReceivePaymentDialogComponent.
 */
@Component({
  selector: 'coms-collections-detail-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule, MatTableModule, MatProgressSpinnerModule, TranslatePipe],
  templateUrl: './collections-detail-dialog.html',
  styleUrl: './collections-detail-dialog.scss',
})
export class CollectionsDetailDialogComponent {
  data = inject<CollectionsDetailDialogData>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<CollectionsDetailDialogComponent>);
  private reportService = inject(ReportService);
  private currencyService = inject(CurrencyService);
  private fileDownload = inject(FileDownloadService);
  private languageService = inject(LanguageService);
  private translate = inject(TranslateService);

  loading = signal(true);
  printing = signal(false);
  detail = signal<CollectionsDetailData | null>(null);

  readonly dateBasis: CollectionsDateBasis = this.data.dateBasis ?? 'payment';
  readonly dateField = this.dateBasis === 'entered' ? 'entered_date' : 'payment_date';
  readonly isSingleDay = this.data.dateFrom === this.data.dateTo;
  readonly displayedColumns = this.isSingleDay
    ? ['receipt_no', 'booked_by', 'mass_name', 'method', 'amount']
    : [this.dateField, 'receipt_no', 'booked_by', 'mass_name', 'method', 'amount'];
  readonly formattedDate = formatDateDMY(this.data.dateFrom);
  readonly formattedRange = { from: formatDateDMY(this.data.dateFrom), to: formatDateDMY(this.data.dateTo) };

  constructor() {
    this.reportService.collectionsDetail(this.data.dateFrom, this.data.dateTo, this.dateBasis).subscribe((detail) => {
      this.detail.set(detail);
      this.loading.set(false);
    });
  }

  currency(v: number): string {
    return `${this.currencyService.current().symbol}${Number(v).toFixed(2)}`;
  }

  formatMethod(method: string | null): string {
    return paymentMethodLabel(method, this.translate);
  }

  massNameText(row: { mass_name: string; mass_name_ta: string | null }): string {
    return localizedName({ name: row.mass_name, name_ta: row.mass_name_ta }, this.languageService.current());
  }

  formatDate(date: string): string {
    return formatDateDMY(date);
  }

  async print(): Promise<void> {
    if (this.printing()) return;
    this.printing.set(true);
    try {
      await this.fileDownload.printPdf(
        this.reportService.getCollectionsDetailPrintUrl(
          this.data.dateFrom,
          this.data.dateTo,
          false,
          this.dateBasis,
          this.languageService.current()
        )
      );
    } finally {
      this.printing.set(false);
    }
  }
}
