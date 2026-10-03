import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatRadioModule } from '@angular/material/radio';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { LanguageService } from '../../../core/services/language.service';
import { MasterLookupService } from '../../../core/services/master-lookup.service';
import { MasterService } from '../../masters/master.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AppLang } from '../../../core/i18n/translations';

export interface LanguageRow {
  id: number;
  name: string;
  name_ta?: string | null;
  code: string;
  is_default: number;
  is_active: number;
  is_deleted: number;
}

@Component({
  selector: 'coms-language-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatIconModule,
    MatButtonModule,
    MatRadioModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    TranslatePipe,
  ],
  templateUrl: './language-settings.html',
  styleUrl: './language-settings.scss',
})
export class LanguageSettingsComponent implements OnInit {
  languageService = inject(LanguageService);
  private masterLookup = inject(MasterLookupService);
  private masterService = inject(MasterService);
  private notification = inject(NotificationService);
  private translate = inject(TranslateService);

  loading = signal(true);
  saving = signal(false);
  languages = signal<LanguageRow[]>([]);
  selectedDefaultId = signal<number | null>(null);

  async ngOnInit(): Promise<void> {
    await this.loadLanguages();
  }

  async loadLanguages(): Promise<void> {
    this.loading.set(true);
    try {
      const rows = await firstValueFrom(
        this.masterLookup.list<LanguageRow>('languages')
      );
      this.languages.set(rows || []);
      const defaultRow = rows.find((r) => r.is_default === 1);
      if (defaultRow) {
        this.selectedDefaultId.set(defaultRow.id);
      } else if (rows.length > 0) {
        this.selectedDefaultId.set(rows[0].id);
      }
    } catch (err) {
      this.notification.error('common.loadFailed');
    } finally {
      this.loading.set(false);
    }
  }

  async saveDefaultLanguage(row?: LanguageRow): Promise<void> {
    const target = row || this.languages().find((r) => r.id === this.selectedDefaultId());
    if (!target) return;

    this.saving.set(true);
    try {
      // 1. Update database default via master endpoint
      await firstValueFrom(this.masterService.setDefault('languages', target.id));

      // 2. Map and apply language immediately to the running app
      const mapped = this.languageService.mapCode(target.code);
      if (mapped) {
        this.languageService.setLanguage(mapped);
      }

      // 3. Reload DB records to verify state
      await this.loadLanguages();

      this.notification.success(
        this.translate.instant('settings.defaultLanguageUpdated', {
          name: target.name_ta && this.languageService.isTamil() ? target.name_ta : target.name,
        })
      );
    } catch (err) {
      this.notification.error('common.saveFailed');
    } finally {
      this.saving.set(false);
    }
  }

  setTypingMode(mode: 'ta' | 'en'): void {
    this.languageService.setTextInputMode(mode);
    this.notification.success('settings.typingModeUpdated');
  }

  setQuickLanguage(lang: AppLang): void {
    this.languageService.setLanguage(lang);
  }
}
