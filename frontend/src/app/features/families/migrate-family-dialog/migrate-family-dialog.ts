import { Component, Inject, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Family } from '../family.model';
import { FamilyService } from '../family.service';

@Component({
  selector: 'coms-migrate-family-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
  ],
  template: `
    <div class="migrate-dialog" style="max-width: 540px; padding: 0.5rem;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
        <div style="display: flex; gap: 0.75rem; align-items: center;">
          <mat-icon style="color: #2563eb; font-size: 28px; width: 28px; height: 28px;">transfer_within_a_station</mat-icon>
          <div>
            <h2 mat-dialog-title style="margin: 0; font-size: 1.25rem; font-weight: 700;">Transfer / Migrate Family</h2>
            <span style="font-size: 0.8125rem; color: #64748b;">Update parish migration status for <strong>{{ family.family_name }}</strong></span>
          </div>
        </div>
        <button mat-icon-button mat-dialog-close><mat-icon>close</mat-icon></button>
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <mat-dialog-content style="display: flex; flex-direction: column; gap: 0.75rem; padding: 0;">
          <mat-form-field appearance="outline">
            <mat-label>Migration Type / Status</mat-label>
            <mat-select formControlName="status" required>
              <mat-option value="MIGRATED_OUT">Migrated Out (Moved away to another parish / place)</mat-option>
              <mat-option value="MIGRATED_IN">Migrated In (Transferred in from another parish)</mat-option>
              <mat-option value="ACTIVE">Active (Reset to current parishioner)</mat-option>
              <mat-option value="INACTIVE">Inactive</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Migration / Transfer Date</mat-label>
            <input matInput type="date" formControlName="migration_date" />
          </mat-form-field>

          @if (form.get('status')?.value === 'MIGRATED_OUT') {
            <mat-form-field appearance="outline">
              <mat-label>Destination Parish / Church</mat-label>
              <input matInput formControlName="migrated_to_parish" placeholder="e.g. St. Anthony's Church, Bangalore" />
            </mat-form-field>
          }

          @if (form.get('status')?.value === 'MIGRATED_IN') {
            <mat-form-field appearance="outline">
              <mat-label>Previous Parish / Church</mat-label>
              <input matInput formControlName="migrated_from_parish" placeholder="e.g. Holy Cross Church, Goa" />
            </mat-form-field>
          }

          <mat-form-field appearance="outline">
            <mat-label>Reason / Notes</mat-label>
            <textarea matInput formControlName="migration_reason" rows="3" placeholder="e.g. Relocated for employment / transferred..."></textarea>
          </mat-form-field>
        </mat-dialog-content>

        <mat-dialog-actions align="end" style="margin-top: 1rem; padding: 0.75rem 0 0; border-top: 1px solid #e2e8f0;">
          <button mat-button type="button" mat-dialog-close>Cancel</button>
          <button mat-flat-button color="primary" type="submit" [disabled]="saving()">
            <mat-icon>{{ saving() ? 'hourglass_top' : 'save' }}</mat-icon>
            Save Migration Status
          </button>
        </mat-dialog-actions>
      </form>
    </div>
  `,
})
export class MigrateFamilyDialogComponent {
  private fb = inject(FormBuilder);
  private familyService = inject(FamilyService);
  private dialogRef = inject(MatDialogRef<MigrateFamilyDialogComponent>);
  private snackBar = inject(MatSnackBar);

  family: Family;
  saving = signal(false);

  form: FormGroup = this.fb.group({
    status: ['MIGRATED_OUT', [Validators.required]],
    migration_date: [new Date().toISOString().split('T')[0]],
    migrated_to_parish: [''],
    migrated_from_parish: [''],
    migration_reason: [''],
  });

  constructor(@Inject(MAT_DIALOG_DATA) public data: { family: Family }) {
    this.family = data.family;
    if (this.family.status) {
      this.form.patchValue({
        status: this.family.status === 'ACTIVE' ? 'MIGRATED_OUT' : this.family.status,
        migration_date: this.family.migration_date ? this.family.migration_date.split('T')[0] : new Date().toISOString().split('T')[0],
        migrated_to_parish: this.family.migrated_to_parish,
        migrated_from_parish: this.family.migrated_from_parish,
        migration_reason: this.family.migration_reason,
      });
    }
  }

  onSubmit(): void {
    if (this.form.invalid) return;

    this.saving.set(true);
    this.familyService.migrateFamily(this.family.id, this.form.value).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.snackBar.open('Migration status updated', 'Close', { duration: 3000 });
        this.dialogRef.close({ success: true, family: updated });
      },
      error: (err) => {
        this.saving.set(false);
        this.snackBar.open('Error: ' + (err.error?.message || err.message), 'Close', { duration: 4000 });
      },
    });
  }
}
