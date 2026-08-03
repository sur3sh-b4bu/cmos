import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'coms-error-page',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatIconModule],
  template: `
    <div class="error-page">
      <mat-icon class="error-page__icon">{{ icon }}</mat-icon>
      <h1>{{ title }}</h1>
      <p class="text-muted">{{ message }}</p>
      <a mat-flat-button color="primary" routerLink="/dashboard">
        <mat-icon>home</mat-icon>
        Back to Dashboard
      </a>
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
  @Input() icon = 'error_outline';
  @Input() title = 'Something went wrong';
  @Input() message = '';
}
