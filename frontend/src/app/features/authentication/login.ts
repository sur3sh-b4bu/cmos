import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';
import { BiometricAuthService } from '../../core/services/biometric-auth.service';
import { CurrencyService } from '../../core/services/currency.service';
import { LanguageService } from '../../core/services/language.service';
import { AppLang } from '../../core/i18n/translations';
import { extractErrorMessage } from '../../core/utils/http-error.util';
import { CurrentUser } from '../../core/models/auth.model';

@Component({
  selector: 'coms-login',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatCheckboxModule,
    TranslatePipe,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class LoginComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private currencyService = inject(CurrencyService);
  private translate = inject(TranslateService);
  languageService = inject(LanguageService);
  biometric = inject(BiometricAuthService);

  private static readonly LAST_USER_KEY = 'coms-last-username';

  username = '';
  password = '';
  hidePassword = signal(true);
  loading = signal(false);
  biometricLoading = signal(false);
  errorMessage = signal<string | null>(null);

  /** Whether this device can do biometric sign-in at all. */
  biometricAvailable = signal(false);

  async ngOnInit(): Promise<void> {
    // Remembering just the username (never the password) lets us offer the
    // biometric button straight away on a machine someone signs in at daily.
    this.username = localStorage.getItem(LoginComponent.LAST_USER_KEY) ?? '';
    this.biometricAvailable.set(await this.biometric.detectAvailability());
  }

  get canUseBiometrics(): boolean {
    return this.biometricAvailable() && this.username.trim().length > 0;
  }

  /** `usernameValue`/`passwordValue` come straight off the input elements:
   * a browser autofilling saved credentials doesn't always fire the input
   * event ngModel listens to until the user interacts, so the bound
   * `username`/`password` can still be empty even though the fields visibly
   * hold values. Reading the DOM at submit time -- and NOT disabling Sign In
   * on form validity -- keeps password-manager logins from looking broken. */
  async submit(usernameValue = this.username, passwordValue = this.password): Promise<void> {
    if (this.loading()) return;
    this.username = usernameValue;
    this.password = passwordValue;
    if (!this.username || !this.password) {
      this.errorMessage.set(this.translate.instant('auth.enterCredentials'));
      return;
    }
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      const user = await this.authService.login({
        username: this.username,
        password: this.password,
      });
      this.afterSignIn(user);
    } catch (err) {
      this.errorMessage.set(
        extractErrorMessage(err, this.translate.instant('auth.unableToSignIn'))
      );
    } finally {
      this.loading.set(false);
    }
  }

  async signInWithBiometrics(): Promise<void> {
    const username = this.username.trim();
    if (!username || this.biometricLoading()) return;

    this.biometricLoading.set(true);
    this.errorMessage.set(null);
    try {
      const user = await this.authService.loginWithBiometrics(username);
      this.afterSignIn(user);
    } catch (err) {
      // Browser WebAuthn errors are opaque ("NotAllowedError"), so run them
      // through the service's translator before showing anything.
      this.errorMessage.set(this.biometric.describeError(err));
    } finally {
      this.biometricLoading.set(false);
    }
  }

  private afterSignIn(user: CurrentUser): void {
    localStorage.setItem(LoginComponent.LAST_USER_KEY, this.username.trim());
    // Re-attempt now that we're authenticated -- App.ngOnInit's earlier call
    // (before any session existed) had nothing to fetch with.
    this.currencyService.load();
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    if (user.mustChangePassword) {
      this.router.navigate(['/change-password'], { queryParams: { forced: true } });
    } else {
      this.router.navigateByUrl(returnUrl || '/dashboard');
    }
  }

  togglePasswordVisibility(): void {
    this.hidePassword.update((v) => !v);
  }

  setLanguage(lang: AppLang): void {
    this.languageService.setLanguage(lang);
  }
}
