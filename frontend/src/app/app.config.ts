import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE } from '@angular/material/core';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { provideTranslateService } from '@ngx-translate/core';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { DD_MM_YYYY_FORMATS, DdMmYyyyDateAdapter } from './core/date/dd-mm-yyyy-date-adapter';
import { StaticTranslateLoader } from './core/i18n/static-translate-loader';
import { TranslatedPaginatorIntl } from './core/i18n/translated-paginator-intl';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding()),
    provideAnimationsAsync(),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideTranslateService({ lang: 'en', fallbackLang: 'en', loader: StaticTranslateLoader }),
    { provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: { appearance: 'outline' } },
    // App-wide DD-MM-YYYY date format. Registered once at root so every
    // mat-datepicker is consistent; feature components must NOT also import
    // MatNativeDateModule, which would re-provide the stock DateAdapter at
    // their own injector level and silently shadow this.
    { provide: MAT_DATE_LOCALE, useValue: 'en-GB' },
    { provide: DateAdapter, useClass: DdMmYyyyDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: DD_MM_YYYY_FORMATS },
    { provide: MatPaginatorIntl, useClass: TranslatedPaginatorIntl },
  ],
};
