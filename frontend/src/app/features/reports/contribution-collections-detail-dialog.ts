import { Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ReportService, ContributionCollectionsDetailData } from './report.service';
import { CurrencyService } from '../../core/services/currency.service';
import { FileDownloadService } from '../../core/services/file-download.service';
import { LanguageService } from '../../core/services/language.service';
import { formatDateDMY } from '../../core/utils/date-format.util';
import { localizedName } from '../../core/utils/localized-name.util';
import { paymentMethodLabel } from '../../shared/utils/payment-method.util';

export interface ContributionCollectionsDetailDialogData {
  dateFrom: string;
  dateTo: string;
}

/**
 * Contributions' equivalent of CollectionsDetailDialogComponent -- per-payment
 * breakdown for a date range of the Reports > Contributions tab's "by day"
 * table (dateFrom === dateTo when opened from clicking a single date).
 * Kept as its own component rather than generalizing the Mass Collections
 * dialog: the two entities' rows don't share a shape (contribution_type_name
 * vs mass_name), and this way the well-tested Mass Collections dialog
 * (also used by Dashboard's Today's/Monthly Collections cards) stays
 * untouched.
 */
@Component({
  selector: 'coms-contribution-collections-detail-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule, MatTableModule, MatProgressSpinnerModule, TranslatePipe],
  templateUrl: './contribution-collections-detail-dialog.html',
  styleUrl: './contribution-collections-detail-dialog.scss',
})
export class ContributionCollectionsDetailDialogComponent {
  data = inject<ContributionCollectionsDetailDialogData>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<ContributionCollectionsDetailDialogComponent>);
  private reportService = inject(ReportService);
  private currencyService = inject(CurrencyService);
  private fileDownload = inject(FileDownloadService);
  private languageService = inject(LanguageService);
  private translate = inject(TranslateService);

  loading = signal(true);
  printing = signal(false);
  detail = signal<ContributionCollectionsDetailData | null>(null);

  readonly isSingleDay = this.data.dateFrom === this.data.dateTo;
  readonly displayedColumns = this.isSingleDay
    ? ['receipt_no', 'name', 'contribution_type', 'method', 'amount']
    : ['payment_date', 'receipt_no', 'name', 'contribution_type', 'method', 'amount'];
  readonly formattedDate = formatDateDMY(this.data.dateFrom);
  readonly formattedRange = { from: formatDateDMY(this.data.dateFrom), to: formatDateDMY(this.data.dateTo) };

  constructor() {
    this.reportService.contributionCollectionsDetail(this.data.dateFrom, this.data.dateTo).subscribe((detail) => {
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

  formatDate(date: string): string {
    return formatDateDMY(date);
  }

  contributionTypeText(row: {
    contribution_type_is_custom: 0 | 1;
    contribution_type_name: string | null;
    contribution_type_name_ta: string | null;
    custom_contribution_type: string | null;
  }): string {
    if (row.contribution_type_is_custom) return row.custom_contribution_type || '-';
    return localizedName({ name: row.contribution_type_name || '', name_ta: row.contribution_type_name_ta }, this.languageService.current()) || '-';
  }

  async print(): Promise<void> {
    if (this.printing()) return;
    this.printing.set(true);
    try {
      await this.fileDownload.printPdf(
        this.reportService.getContributionCollectionsDetailPrintUrl(this.data.dateFrom, this.data.dateTo, false, this.languageService.current())
      );
    } finally {
      this.printing.set(false);
    }
  }
}
