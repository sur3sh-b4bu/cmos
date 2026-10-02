import { Injectable, computed, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { MasterLookupService } from './master-lookup.service';
import { AppLang } from '../i18n/translations';

const STORAGE_KEY = 'coms_lang';
const TEXT_INPUT_KEY = 'coms_text_input_mode';
const DEFAULT_LANG: AppLang = 'ta';

/** Masters -> Languages row codes this app actually has translations for. */
const CODE_TO_LANG: Record<string, AppLang> = { en: 'en', eng: 'en', english: 'en', ta: 'ta', tam: 'ta', tamil: 'ta' };

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private translate = inject(TranslateService);
  private masterLookup = inject(MasterLookupService);

  readonly current = signal<AppLang>(this.readStored());
  private orgDefaultRequested = false;

  /** Global text input typing mode: 'ta' (Bamini Tamil) or 'en' (English). Defaults to Tamil. */
  readonly textInputMode = signal<'ta' | 'en'>(this.readStoredTextInput());

  /** Whether the global text input mode is currently Tamil. */
  readonly isTamilTextInput = computed(() => this.textInputMode() === 'ta');

  /** Whether the UI interface language is currently Tamil. */
  readonly isTamil = computed(() => this.current() === 'ta');

  /** Toggle text input typing mode between Tamil and English. */
  toggleTextInputMode(): void {
    const next = this.textInputMode() === 'ta' ? 'en' : 'ta';
    this.setTextInputMode(next);
  }

  setTextInputMode(mode: 'ta' | 'en'): void {
    this.textInputMode.set(mode);
    try {
      localStorage.setItem(TEXT_INPUT_KEY, mode);
    } catch {
      // ignore storage errors
    }
  }

  /** Call once at app bootstrap, before anything reads translations. */
  init(): void {
    this.apply(this.current());
  }

  /**
   * A personal choice made via the language switcher always wins. Call once
   * the user is authenticated (see header.ts) to pick up Masters -> Languages
   * -> Set Default for anyone who hasn't personally chosen yet -- same
   * "loaded once, reflects on next login/refresh" contract as CurrencyService.
   */
  loadOrgDefault(): void {
    if (this.orgDefaultRequested) return;
    this.orgDefaultRequested = true;
    this.masterLookup.list<{ code: string; is_default: 0 | 1 }>('languages').subscribe({
      next: (rows) => {
        if (localStorage.getItem(STORAGE_KEY)) return; // explicit personal choice takes precedence
        const def = rows.find((r) => r.is_default);
        const mapped = def && this.mapCode(def.code);
        if (mapped) this.apply(mapped); // not persisted -- an org default, not a personal choice
      },
      error: () => {
        this.orgDefaultRequested = false; // allow a retry on next call
      },
    });
  }

  /** Maps a Masters -> Languages row's `code` to a language this app can render, if any. */
  mapCode(code: string | undefined | null): AppLang | null {
    return (code && CODE_TO_LANG[code.trim().toLowerCase()]) || null;
  }

  setLanguage(lang: AppLang): void {
    localStorage.setItem(STORAGE_KEY, lang);
    this.apply(lang);
    // Also align typing mode with chosen UI language
    this.setTextInputMode(lang === 'ta' ? 'ta' : 'en');
  }

  private apply(lang: AppLang): void {
    this.current.set(lang);
    this.translate.setFallbackLang(DEFAULT_LANG);
    this.translate.use(lang);
    document.documentElement.lang = lang;
  }

  private readStored(): AppLang {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'en' ? 'en' : 'ta';
  }

  private readStoredTextInput(): 'ta' | 'en' {
    const stored = localStorage.getItem(TEXT_INPUT_KEY);
    if (stored === 'en' || stored === 'ta') return stored;
    return this.readStored() === 'en' ? 'en' : 'ta';
  }
}
