import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import { MasterLookupService } from '../../../core/services/master-lookup.service';

export interface AddRoleDialogResult {
  name: string;
  description: string;
  /** Only set for Master Administrator -- one role gets created per church
   * checked here (see roles-permissions.ts's addRole()). Undefined for a
   * plain admin, whose role is pinned to its own church automatically (see
   * roleController.create()), so it never shows this picker at all. */
  churchIds?: number[];
}

/** Settings > Roles & Permissions > "Add Role" -- collects a name and
 * optional description; the server generates `code`. Master Administrator
 * additionally gets a Church checklist (same reasoning/shape as
 * master-form.ts's own multi-church picker) -- checking more than one
 * creates the same role under each. */
@Component({
  selector: 'coms-add-role-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatCheckboxModule, MatButtonModule, TranslatePipe],
  templateUrl: './add-role-dialog.html',
  styleUrl: './add-role-dialog.scss',
})
export class AddRoleDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<AddRoleDialogComponent, AddRoleDialogResult | undefined>);
  private masterLookup = inject(MasterLookupService);
  authService = inject(AuthService);

  churches = signal<{ id: number; name: string }[]>([]);
  selectedChurchIds = signal<Set<number>>(new Set());
  submitted = signal(false);

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', Validators.maxLength(255)],
  });

  ngOnInit(): void {
    if (this.authService.isMasterAdmin()) {
      const active = this.authService.activeChurchBranch();
      if (active) this.selectedChurchIds.set(new Set([active.churchId]));
      this.masterLookup.list<{ id: number; name: string }>('churches').subscribe((rows) => this.churches.set(rows));
    }
  }

  isChurchSelected(id: number): boolean {
    return this.selectedChurchIds().has(id);
  }

  toggleChurchSelection(id: number): void {
    const next = new Set(this.selectedChurchIds());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.selectedChurchIds.set(next);
  }

  isAllChurchesSelected(): boolean {
    return this.churches().length > 0 && this.churches().every((c) => this.selectedChurchIds().has(c.id));
  }

  isSomeChurchesSelected(): boolean {
    const count = this.churches().filter((c) => this.selectedChurchIds().has(c.id)).length;
    return count > 0 && count < this.churches().length;
  }

  toggleAllChurches(checked: boolean): void {
    this.selectedChurchIds.set(checked ? new Set(this.churches().map((c) => c.id)) : new Set());
  }

  cancel(): void {
    this.dialogRef.close(undefined);
  }

  submit(): void {
    this.submitted.set(true);
    const isMasterAdmin = this.authService.isMasterAdmin();
    if (isMasterAdmin && this.selectedChurchIds().size === 0) {
      return; // "select at least one church" error shown inline
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { name, description } = this.form.getRawValue();
    this.dialogRef.close({ name, description, churchIds: isMasterAdmin ? Array.from(this.selectedChurchIds()) : undefined });
  }
}
