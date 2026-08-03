import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'coms-temp-password-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="temp-password">
      <mat-icon class="temp-password__icon">vpn_key</mat-icon>
      <h2 mat-dialog-title>{{ data.title }}</h2>
      <mat-dialog-content>
        <p>Share this temporary password with the user securely (in person or a private message). They'll be required to change it on first login.</p>
        <div class="temp-password__value">{{ data.password }}</div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-flat-button color="primary" mat-dialog-close>Done</button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [
    `
      .temp-password {
        text-align: center;
        padding: 8px 4px;
        max-width: 380px;
      }
      .temp-password__icon {
        color: var(--coms-color-gold);
        font-size: 32px;
        width: 32px;
        height: 32px;
        margin-bottom: 4px;
      }
      p {
        font-size: 13px;
        color: var(--coms-text-muted);
        margin: 0 0 12px;
      }
      .temp-password__value {
        font-family: monospace;
        font-size: 20px;
        font-weight: 700;
        letter-spacing: 0.03em;
        background: var(--coms-surface-alt);
        border-radius: var(--coms-radius-sm);
        padding: 12px;
        color: var(--coms-color-primary);
      }
    `,
  ],
})
export class TempPasswordDialogComponent {
  data = inject<{ title: string; password: string }>(MAT_DIALOG_DATA);
}
