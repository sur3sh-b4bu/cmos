import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { PrayerIntentionService } from '../prayer-intention.service';
import { PrayerIntention } from '../prayer-intention.model';
import { FileDownloadService } from '../../../core/services/file-download.service';
import { NotificationService } from '../../../core/services/notification.service';
import { extractErrorMessage } from '../../../core/utils/http-error.util';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { AuthService } from '../../../core/services/auth.service';

interface MassGroup {
  massId: number;
  massName: string;
  massTime: string;
  entries: PrayerIntention[];
}

@Component({
  selector: 'coms-daily-register',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './daily-register.html',
  styleUrl: './daily-register.scss',
})
export class DailyRegisterComponent implements OnInit {
  private prayerIntentionService = inject(PrayerIntentionService);
  private fileDownload = inject(FileDownloadService);
  private notification = inject(NotificationService);
  private dialog = inject(MatDialog);
  authService = inject(AuthService);

  selectedDate = signal(new Date());
  loading = signal(false);
  printing = signal(false);
  entries = signal<PrayerIntention[]>([]);

  groups = computed<MassGroup[]>(() => {
    const map = new Map<number, MassGroup>();
    for (const e of this.entries()) {
      if (!map.has(e.mass_id)) {
        map.set(e.mass_id, { massId: e.mass_id, massName: e.mass_name, massTime: e.mass_time, entries: [] });
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
    this.prayerIntentionService.getRegisterPreview(this.dateParam).subscribe({
      next: (rows) => {
        this.entries.set(rows);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  intentionText(row: PrayerIntention): string {
    return row.intention_is_custom ? row.custom_intention || '-' : row.intention_master_name || '-';
  }

  async printRegister(): Promise<void> {
    this.printing.set(true);
    try {
      await this.fileDownload.openInNewTab(this.prayerIntentionService.getRegisterPrintUrl(this.dateParam));
    } finally {
      this.printing.set(false);
    }
  }

  async markAllCompleted(): Promise<void> {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Mark all as completed?',
        message: `This marks all ${this.entries().length} prayer intention(s) for ${this.dateParam} as completed, typically done right after Mass.`,
        confirmLabel: 'Mark all completed',
      },
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      const res = await firstValueFrom(this.prayerIntentionService.markAllCompleted(this.dateParam));
      this.notification.success(res.message);
      this.fetch();
    } catch (err) {
      this.notification.error(extractErrorMessage(err));
    }
  }
}
