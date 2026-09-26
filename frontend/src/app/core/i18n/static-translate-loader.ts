import { Injectable } from '@angular/core';
import { TranslateLoader, TranslationObject } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { TRANSLATIONS, AppLang } from './translations';

// Translations are bundled directly (see translations.ts) rather than fetched
// over HTTP -- there are only two languages and they're small, so a static,
// synchronous "load" avoids an extra network round trip and a possible flash
// of untranslated content on first paint.
@Injectable()
export class StaticTranslateLoader extends TranslateLoader {
  override getTranslation(lang: string): Observable<TranslationObject> {
    return of((TRANSLATIONS[lang as AppLang] ?? TRANSLATIONS['en']) as TranslationObject);
  }
}
