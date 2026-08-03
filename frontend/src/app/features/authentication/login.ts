import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { AuthService } from '../../core/services/auth.service';
import { extractErrorMessage } from '../../core/utils/http-error.util';

@Component({
  selector: 'coms-login',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatCheckboxModule,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  username = '';
  password = '';
  hidePassword = signal(true);
  loading = signal(false);
  errorMessage = signal<string | null>(null);

  async submit(): Promise<void> {
    if (!this.username || !this.password || this.loading()) return;
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      const user = await this.authService.login({ username: this.username, password: this.password });
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
      if (user.mustChangePassword) {
        this.router.navigate(['/change-password'], { queryParams: { forced: true } });
      } else {
        this.router.navigateByUrl(returnUrl || '/dashboard');
      }
    } catch (err) {
      this.errorMessage.set(extractErrorMessage(err, 'Unable to sign in. Please check your credentials.'));
    } finally {
      this.loading.set(false);
    }
  }

  togglePasswordVisibility(): void {
    this.hidePassword.update((v) => !v);
  }
}
