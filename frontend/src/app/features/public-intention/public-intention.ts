import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { environment } from '../../../environments/environment';
import { LanguageService } from '../../core/services/language.service';
import { AppLang } from '../../core/i18n/translations';

interface PublicIntention {
  receiptNo: string;
  name: string;
  prayerDate: string;
  massName: string;
  massTime: string;
  intention: string;
  startsAt: string;
  isPast: boolean;
  church: { name: string; address: string };
}

type Stage = 'loading' | 'ask' | 'added' | 'declined' | 'error';

interface ReminderOption {
  labelKey: string;
  minutes: number;
}

/**
 * The page a parishioner lands on after scanning the QR code on their prayer
 * offering receipt. Entirely public -- no COMS account, no login.
 *
 * A browser page can't write into someone's calendar directly (that needs a
 * per-provider OAuth grant), so "accept" hands back a standard .ics file,
 * which iOS, Android, Outlook, Apple Calendar AND Google Calendar's own
 * import flow all open with their own "Add event?" confirmation -- kept to
 * that one self-hosted download rather than also offering a Google Calendar
 * prefill link, which would hand this person's name and receipt number to
 * Google as a URL query string the moment they tapped it.
 */
@Component({
  selector: 'coms-public-intention',
  standalone: true,
  imports: [DatePipe, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatMenuModule, TranslatePipe],
  templateUrl: './public-intention.html',
  styleUrl: './public-intention.scss',
})
export class PublicIntentionComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private translate = inject(TranslateService);
  languageService = inject(LanguageService);

  private token = '';

  stage = signal<Stage>('loading');
  errorMessage = signal('');
  intention = signal<PublicIntention | null>(null);
  reminderMinutes = signal(60);

  readonly reminderOptions: ReminderOption[] = [
    { labelKey: 'publicIntention.atTimeOfMass', minutes: 0 },
    { labelKey: 'publicIntention.oneHourBefore', minutes: 60 },
    { labelKey: 'publicIntention.oneDayBefore', minutes: 1440 },
  ];

  ngOnInit(): void {
    // Public link, no session -- defaults to English but honors a
    // previously-chosen language (e.g. the same device's office login) if
    // one happens to be stored.
    this.languageService.init();

    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    if (!this.token) {
      this.fail(this.translate.instant('publicIntention.missingReceiptCode'));
      return;
    }

    this.http
      .get<{ data: PublicIntention }>(`${environment.apiBaseUrl}/public/intentions/${this.token}`)
      .subscribe({
        next: (res) => {
          this.intention.set(res.data);
          this.stage.set('ask');
        },
        error: (err) =>
          this.fail(err?.error?.message ?? this.translate.instant('publicIntention.receiptNotFound')),
      });
  }

  setLanguage(lang: AppLang): void {
    this.languageService.setLanguage(lang);
  }

  private fail(message: string): void {
    this.errorMessage.set(message);
    this.stage.set('error');
  }

  selectReminder(minutes: number): void {
    this.reminderMinutes.set(minutes);
  }

  /** Downloads the .ics; the phone's calendar app takes it from there. */
  addToCalendar(): void {
    const url = `${environment.apiBaseUrl}/public/intentions/${this.token}/calendar.ics?reminder=${this.reminderMinutes()}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = `mass-intention-${this.intention()?.receiptNo ?? 'event'}.ics`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    this.stage.set('added');
  }

  decline(): void {
    this.stage.set('declined');
  }

  backToChoice(): void {
    this.stage.set('ask');
  }
}
