import { Component, Input, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'coms-error-page',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatIconModule, TranslatePipe],
  template: `
    <div class="error-page">
      <mat-icon class="error-page__icon">{{ icon }}</mat-icon>
      <h1>{{ title | translate }}</h1>
      <p class="text-muted">{{ message | translate }}</p>
      <!-- A signed-out visitor sent to /dashboard just bounces to /login, so
           point them there directly. -->
      @if (authService.isAuthenticated()) {
        <a mat-flat-button color="primary" routerLink="/dashboard">
          <mat-icon>home</mat-icon>
          {{ 'staticPages.backToDashboard' | translate }}
        </a>
      } @else {
        <a mat-flat-button color="primary" routerLink="/login">
          <mat-icon>login</mat-icon>
          {{ 'staticPages.backToLogin' | translate }}
        </a>
      }
    </div>
  `,
  styles: [
    `
      .error-page {
        min-height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 60px 20px;
        text-align: center;
      }
      .error-page__icon {
        font-size: 56px;
        width: 56px;
        height: 56px;
        color: var(--coms-color-gold);
        margin-bottom: 8px;
      }
      h1 {
        margin: 0;
        font-size: 22px;
      }
      p {
        margin: 0 0 16px;
      }
    `,
  ],
})
export class ErrorPageComponent {
  authService = inject(AuthService);

  @Input() icon = 'error_outline';
  /** Translation keys (route data binds these directly -- see app.routes.ts), resolved via the `translate` pipe above. */
  @Input() title = 'staticPages.somethingWentWrong';
  @Input() message = '';
}
