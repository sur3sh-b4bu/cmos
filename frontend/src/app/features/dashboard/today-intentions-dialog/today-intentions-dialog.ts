import { Component, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { MassIntentionService } from '../../mass-intentions/mass-intention.service';
import { MassIntention } from '../../mass-intentions/mass-intention.model';
import { FileDownloadService } from '../../../core/services/file-download.service';
import { LanguageService } from '../../../core/services/language.service';
import { CurrencyInrPipe } from '../../../shared/pipes/currency-inr.pipe';
import { formatDateDMY } from '../../../core/utils/date-format.util';
import { localizedName } from '../../../core/utils/localized-name.util';

import { MatTooltipModule } from '@angular/material/tooltip';

export interface TodayIntentionsDialogData {
  date: string;
}

interface MassGroup {
  massId: number;
  massName: string;
  massNameTa: string | null;
  massTime: string;
  entries: MassIntention[];
}

/**
 * Register-style popup behind the Dashboard's Today's Mass Intentions stat
 * card -- same "grouped by Mass" view/data source as the Daily Prayer
 * Register page (daily-register.ts), just wrapped as a dialog for one date
 * instead of a full routed page with its own date picker. Reuses that same
 * preview/print endpoints rather than duplicating the register query.
 */
@Component({
  selector: 'coms-today-intentions-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule, MatTooltipModule, MatProgressSpinnerModule, CurrencyInrPipe, TranslatePipe],
  templateUrl: './today-intentions-dialog.html',
  styleUrl: './today-intentions-dialog.scss',
})
export class TodayIntentionsDialogComponent {
  data = inject<TodayIntentionsDialogData>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<TodayIntentionsDialogComponent>);
  private massIntentionService = inject(MassIntentionService);
  private fileDownload = inject(FileDownloadService);
  languageService = inject(LanguageService);

  loading = signal(true);
  printing = signal(false);
  printingReasonsOnly = signal(false);
  printingGroupMassId = signal<number | null>(null);
  printingGroupReasonsMassId = signal<number | null>(null);
  entries = signal<MassIntention[]>([]);

  readonly formattedDate = formatDateDMY(this.data.date);

  groups = computed<MassGroup[]>(() => {
    const map = new Map<number, MassGroup>();
    for (const e of this.entries()) {
      if (!map.has(e.mass_id)) {
        map.set(e.mass_id, { massId: e.mass_id, massName: e.mass_name, massNameTa: e.mass_name_ta, massTime: e.mass_time, entries: [] });
      }
      map.get(e.mass_id)!.entries.push(e);
    }
    return Array.from(map.values()).sort((a, b) => (a.massTime > b.massTime ? 1 : -1));
  });

  totalOffering = computed(() => this.entries().reduce((sum, e) => sum + Number(e.offering_amount), 0));

  constructor() {
    this.massIntentionService.getRegisterPreview(this.data.date).subscribe({
      next: (rows) => {
        this.entries.set(rows);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  intentionText(row: MassIntention): string {
    if (row.intention_is_custom) return row.custom_intention || '-';
    const base = row.intention_master_name
      ? localizedName({ name: row.intention_master_name, name_ta: row.intention_master_name_ta }, this.languageService.current())
      : '';
    if (base && row.custom_intention) return `${base} - ${row.custom_intention}`;
    return base || row.custom_intention || '-';
  }

  massLabel(group: MassGroup): string {
    return localizedName({ name: group.massName, name_ta: group.massNameTa }, this.languageService.current());
  }

  groupOffering(group: MassGroup): number {
    return group.entries.reduce((sum, e) => sum + Number(e.offering_amount || 0), 0);
  }

  async print(): Promise<void> {
    if (this.printing()) return;
    this.printing.set(true);
    try {
      await this.fileDownload.printPdf(this.massIntentionService.getRegisterPrintUrl(this.data.date, false, this.languageService.current()));
    } finally {
      this.printing.set(false);
    }
  }

  async printReasonsOnly(): Promise<void> {
    if (this.printingReasonsOnly()) return;
    this.printingReasonsOnly.set(true);
    try {
      await this.fileDownload.printPdf(
        this.massIntentionService.getRegisterReasonsOnlyPrintUrl(this.data.date, this.languageService.current())
      );
    } finally {
      this.printingReasonsOnly.set(false);
    }
  }

  /** Print a single Mass's intention reasons only (e.g. for the priest to read at altar/pulpit for this Mass) */
  async printGroupReasonsOnly(group: MassGroup): Promise<void> {
    if (this.printingGroupReasonsMassId()) return;
    this.printingGroupReasonsMassId.set(group.massId);
    try {
      await this.fileDownload.printPdf(
        this.massIntentionService.getRegisterReasonsOnlyPrintUrl(this.data.date, this.languageService.current(), group.massId)
      );
    } finally {
      this.printingGroupReasonsMassId.set(null);
    }
  }

  /** Print a single Mass's full register table */
  async printGroup(group: MassGroup): Promise<void> {
    if (this.printingGroupMassId()) return;
    this.printingGroupMassId.set(group.massId);
    try {
      await this.fileDownload.printPdf(
        this.massIntentionService.getRegisterPrintUrl(this.data.date, false, this.languageService.current(), false, group.massId)
      );
    } finally {
      this.printingGroupMassId.set(null);
    }
  }
}
