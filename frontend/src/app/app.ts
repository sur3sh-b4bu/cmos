import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from './core/services/auth.service';
import { LanguageService } from './core/services/language.service';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'coms-root',
  imports: [RouterOutlet, MatProgressSpinnerModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  authService = inject(AuthService);
  private languageService = inject(LanguageService);
  // Field injection (not just a constructor call) is what instantiates this
  // singleton at app boot -- its constructor effect() is the whole point,
  // reacting to authService.currentUser() for the rest of the app's life.
  private themeService = inject(ThemeService);

  ngOnInit(): void {
    // Applies the persisted language (or the English default) before any
    // route renders, so there's no flash of the other language on load.
    this.languageService.init();

    // The receipt-QR page is public. Attempting a silent refresh there would
    // hold it behind the boot splash for a round-trip that can only ever fail
    // (a parishioner has no session), so skip straight to rendering.
    if (window.location.pathname.startsWith('/r/')) {
      this.authService.skipSessionRestore();
      return;
    }
    this.authService.restoreSession();
    // CurrencyService.load() is triggered by CurrencyInrPipe/login instead of
    // here -- this runs before the session (and its auth token) exists, so
    // an API call fired from this method would just race the token and fail.
  }
}
