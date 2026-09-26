import { Injectable, inject } from '@angular/core';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { TranslateService } from '@ngx-translate/core';

// MatPaginatorIntl's labels are plain strings read once, not template
// bindings -- ngx-translate's pipe can't reach them, so this mirrors the
// pattern by re-reading translations on every language change and firing
// `changes` (MatPaginator subscribes to that to re-render).
@Injectable({ providedIn: 'root' })
export class TranslatedPaginatorIntl extends MatPaginatorIntl {
  private translate = inject(TranslateService);

  constructor() {
    super();
    this.updateLabels();
    this.translate.onLangChange.subscribe(() => this.updateLabels());
  }

  private updateLabels(): void {
    this.itemsPerPageLabel = this.translate.instant('common.rowsPerPage') + ':';
    this.nextPageLabel = this.translate.instant('common.nextPage');
    this.previousPageLabel = this.translate.instant('common.previousPage');
    this.firstPageLabel = this.translate.instant('common.firstPage');
    this.lastPageLabel = this.translate.instant('common.lastPage');
    this.getRangeLabel = (page: number, pageSize: number, length: number): string => {
      const of = this.translate.instant('common.of');
      if (length === 0 || pageSize === 0) return `0 ${of} ${length}`;
      const safeLength = Math.max(length, 0);
      const startIndex = page * pageSize;
      const endIndex = startIndex < safeLength ? Math.min(startIndex + pageSize, safeLength) : startIndex + pageSize;
      return `${startIndex + 1} – ${endIndex} ${of} ${safeLength}`;
    };
    this.changes.next();
  }
}
