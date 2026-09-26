import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { CurrencyService } from '../../../core/services/currency.service';
import { FileDownloadService } from '../../../core/services/file-download.service';
import { LanguageService } from '../../../core/services/language.service';
import { formatDateDMY } from '../../../core/utils/date-format.util';
import { MassIntentionService } from '../mass-intention.service';
import { BulkBatch } from '../mass-intention.model';
import { BulkBatchDetailDialogComponent } from '../bulk-batch-detail-dialog/bulk-batch-detail-dialog';

/**
 * "Show Bulk Mass Intentions" -- a full page/tab (routed, like 'new' and
 * 'bulk-new'), not a popup: one row per past Bulk Mass Intention save (see
 * bulk-mass-intention-form.ts's own bulkBatchId comment). Clicking a row
 * opens THAT batch's individual intentions in a dialog for inline edit/
 * delete/reprint (see bulk-batch-detail-dialog.ts) -- the popup is for
 * drilling into one batch's detail, not for browsing the whole list.
 * Not paginated -- a "row" here is a whole Bulk save, so even a busy
 * office accumulates these slowly; the most recent 50 covers a long
 * stretch.
 */
@Component({
  selector: 'coms-bulk-batches-list',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule, TranslatePipe],
  templateUrl: './bulk-batches-list.html',
  styleUrl: './bulk-batches-list.scss',
})
export class BulkBatchesListComponent implements OnInit {
  private massIntentionService = inject(MassIntentionService);
  private fileDownload = inject(FileDownloadService);
  private dialog = inject(MatDialog);
  currencyService = inject(CurrencyService);
  languageService = inject(LanguageService);

  loading = signal(true);
  batches = signal<BulkBatch[]>([]);
  printingBatchId = signal<string | null>(null);

  formatDate = formatDateDMY;

  ngOnInit(): void {
    this.currencyService.load();
    this.fetch();
  }

  private fetch(): void {
    this.loading.set(true);
    this.massIntentionService.listBulkBatches({ page: 1, pageSize: 50 }).subscribe({
      next: (res) => {
        this.batches.set(res.data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  currency(v: number | string): string {
    return `${this.currencyService.current().symbol}${Number(v).toFixed(2)}`;
  }

  async print(batch: BulkBatch, event: Event): Promise<void> {
    event.stopPropagation();
    if (this.printingBatchId()) return;
    this.printingBatchId.set(batch.batchId);
    try {
      await this.fileDownload.printPdf(this.massIntentionService.getBulkReceiptUrlByBatch(batch.batchId, this.languageService.current()));
    } finally {
      this.printingBatchId.set(null);
    }
  }

  /** Opens that batch's individual intentions for edit/delete/reprint --
   * see bulk-batch-detail-dialog.ts. Refetches afterward unconditionally
   * (cheap, and simpler than threading back exactly what changed) so any
   * edit/delete made inside is reflected here too -- including a batch
   * disappearing outright if its last row was deleted. */
  async openBatch(batch: BulkBatch): Promise<void> {
    const ref = this.dialog.open(BulkBatchDetailDialogComponent, {
      data: { batch },
      width: '1100px',
      maxWidth: '95vw',
    });
    await firstValueFrom(ref.afterClosed());
    this.fetch();
  }
}
