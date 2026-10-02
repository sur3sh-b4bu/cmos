import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MassIntentionService } from '../mass-intention.service';
import { MassIntention } from '../mass-intention.model';
import { FileDownloadService } from '../../../core/services/file-download.service';
import { LanguageService } from '../../../core/services/language.service';
import { CurrencyInrPipe } from '../../../shared/pipes/currency-inr.pipe';
import { DatepickerTodayHeaderComponent } from '../../../shared/components/datepicker-today-header/datepicker-today-header';
import { localizedName } from '../../../core/utils/localized-name.util';
import { TranslatePipe } from '@ngx-translate/core';

interface MassGroup {
  massId: number;
  massName: string;
  massNameTa: string | null;
  massTime: string;
  entries: MassIntention[];
}

@Component({
  selector: 'coms-daily-register',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    RouterLinkActive,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    CurrencyInrPipe,
    TranslatePipe,
  ],
  templateUrl: './daily-register.html',
  styleUrl: './daily-register.scss',
})
export class DailyRegisterComponent implements OnInit {
  private massIntentionService = inject(MassIntentionService);
  private fileDownload = inject(FileDownloadService);
  languageService = inject(LanguageService);

  /** calendarHeaderComponent needs a class reference, not a template var. */
  readonly todayHeader = DatepickerTodayHeaderComponent;

  selectedDate = signal(new Date());
  loading = signal(false);
  printing = signal(false);
  printingReasonsOnly = signal(false);
  entries = signal<MassIntention[]>([]);

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

  ngOnInit(): void {
    this.fetch();
  }

  private toDateOnly(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  get dateParam(): string {
    return this.toDateOnly(this.selectedDate());
  }

  onDateChange(date: Date | null): void {
    if (!date) return;
    this.selectedDate.set(date);
    this.fetch();
  }

  fetch(): void {
    this.loading.set(true);
    this.massIntentionService.getRegisterPreview(this.dateParam).subscribe({
      next: (rows) => {
        this.entries.set(rows);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  intentionText(row: MassIntention): string {
    if (row.intention_is_custom) return row.custom_intention || '-';
    if (!row.intention_master_name) return '-';
    return localizedName({ name: row.intention_master_name, name_ta: row.intention_master_name_ta }, this.languageService.current());
  }

  massLabel(group: MassGroup): string {
    return localizedName({ name: group.massName, name_ta: group.massNameTa }, this.languageService.current());
  }

  groupOffering(group: MassGroup): number {
    return group.entries.reduce((sum, e) => sum + Number(e.offering_amount || 0), 0);
  }

  async printRegister(): Promise<void> {
    this.printing.set(true);
    try {
      await this.fileDownload.printPdf(this.massIntentionService.getRegisterPrintUrl(this.dateParam, false, this.languageService.current()));
    } finally {
      this.printing.set(false);
    }
  }

  /** Print register with mass reasons/intentions only -- without donor names or amounts */
  async printRegisterReasonsOnly(): Promise<void> {
    this.printingReasonsOnly.set(true);
    try {
      await this.fileDownload.printPdf(
        this.massIntentionService.getRegisterReasonsOnlyPrintUrl(this.dateParam, this.languageService.current())
      );
    } finally {
      this.printingReasonsOnly.set(false);
    }
  }
}
