import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private snackBar = inject(MatSnackBar);

  success(message: string): void {
    this.show(message, 'coms-snackbar--success');
  }

  warning(message: string): void {
    this.show(message, 'coms-snackbar--warning');
  }

  error(message: string): void {
    this.show(message, 'coms-snackbar--error', 6000);
  }

  info(message: string): void {
    this.show(message, 'coms-snackbar--info');
  }

  private show(message: string, panelClass: string, duration = 3500): void {
    this.snackBar.open(message, 'Dismiss', {
      duration,
      panelClass: ['coms-snackbar', panelClass],
      horizontalPosition: 'end',
      verticalPosition: 'top',
    });
  }
}
