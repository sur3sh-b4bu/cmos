import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideTranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { App } from './app';
import { AuthService } from './core/services/auth.service';
import { StaticTranslateLoader } from './core/i18n/static-translate-loader';

/**
 * Stands in for the real AuthService -- App.ngOnInit only ever calls
 * restoreSession()/skipSessionRestore() on it and reads `initializing()` in
 * the template (see app.html), so that's all this needs to provide. The
 * real service also gets constructed indirectly here anyway (ThemeService,
 * injected by App for its constructor side effect, injects AuthService
 * itself too) -- stubbing it keeps this test from depending on a live
 * backend or a real HTTP round trip.
 */
class StubAuthService {
  currentUser = signal(null);
  initializing = signal(false);
  // Deliberately no-ops -- this test double exists purely so App.ngOnInit
  // has something to call without reaching a real backend.
  /* eslint-disable @typescript-eslint/no-empty-function */
  restoreSession(): void {}
  skipSessionRestore(): void {}
  /* eslint-enable @typescript-eslint/no-empty-function */
}

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        // LanguageService (which App.ngOnInit calls into) injects
        // MasterLookupService, which needs HttpClient to even construct --
        // provideHttpClientTesting() means nothing this test doesn't
        // explicitly flush actually reaches a network.
        provideHttpClient(),
        provideHttpClientTesting(),
        // The real, synchronous, in-memory loader (see static-translate-
        // loader.ts) -- same setup as app.config.ts's production provider,
        // just without a network-backed one to worry about in tests.
        provideTranslateService({ lang: 'en', fallbackLang: 'en', loader: provideTranslateLoader(StaticTranslateLoader) }),
        { provide: AuthService, useClass: StubAuthService },
      ],
    }).compileComponents();
  });

  it('creates the root component', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('shows the boot splash while the session is still being restored', () => {
    TestBed.overrideProvider(AuthService, {
      useValue: Object.assign(new StubAuthService(), { initializing: signal(true) }),
    });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.app-splash')).toBeTruthy();
  });

  it('renders the router outlet once session restore has finished', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.app-splash')).toBeNull();
  });
});
