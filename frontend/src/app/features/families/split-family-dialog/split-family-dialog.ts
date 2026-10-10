import { Component, Inject, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Family, FamilyMember, Ward } from '../family.model';
import { FamilyService } from '../family.service';

@Component({
  selector: 'coms-split-family-dialog',
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
    MatCheckboxModule,
    MatSnackBarModule,
  ],
  templateUrl: './split-family-dialog.html',
  styleUrl: './split-family-dialog.scss',
})
export class SplitFamilyDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private familyService = inject(FamilyService);
  private dialogRef = inject(MatDialogRef<SplitFamilyDialogComponent>);
  private snackBar = inject(MatSnackBar);

  parentFamily: Family;
  wards = signal<Ward[]>([]);
  selectedMemberIds = signal<number[]>([]);
  saving = signal(false);

  form: FormGroup = this.fb.group({
    family_code: ['', [Validators.required]],
    family_name: ['', [Validators.required, Validators.maxLength(200)]],
    family_name_ta: [''],
    ward_id: [null],
    head_member_id: [null, [Validators.required]],
    address_line1: [''],
    address_line2: [''],
    city: [''],
    pincode: [''],
    phone: [''],
    remarks: [''],
  });

  constructor(@Inject(MAT_DIALOG_DATA) public data: { family: Family; wards: Ward[] }) {
    this.parentFamily = data.family;
    if (data.wards) {
      this.wards.set(data.wards);
    }
  }

  ngOnInit(): void {
    this.familyService.getNextCode().subscribe({
      next: (code) => this.form.patchValue({ family_code: code }),
      error: () => {},
    });

    // Default pre-fills from parent family
    this.form.patchValue({
      ward_id: this.parentFamily.ward_id,
      address_line1: this.parentFamily.address_line1,
      address_line2: this.parentFamily.address_line2,
      city: this.parentFamily.city,
      pincode: this.parentFamily.pincode,
    });
  }

  toggleMember(memberId: number, checked: boolean): void {
    const current = [...this.selectedMemberIds()];
    if (checked) {
      if (!current.includes(memberId)) {
        current.push(memberId);
      }
    } else {
      const idx = current.indexOf(memberId);
      if (idx >= 0) {
        current.splice(idx, 1);
      }
    }
    this.selectedMemberIds.set(current);

    // If head_member_id is not in selected list, update it
    if (!current.includes(this.form.value.head_member_id)) {
      this.form.patchValue({ head_member_id: current.length > 0 ? current[0] : null });
    }

    // Suggest default family name based on head member
    if (current.length > 0 && !this.form.value.family_name) {
      const headMem = this.parentFamily.members?.find((m) => m.id === current[0]);
      if (headMem) {
        this.form.patchValue({ family_name: `${headMem.first_name} ${headMem.last_name || ''} Family`.trim() });
      }
    }
  }

  isMemberSelected(memberId: number): boolean {
    return this.selectedMemberIds().includes(memberId);
  }

  getSelectedMembers(): FamilyMember[] {
    return (this.parentFamily.members || []).filter((m) => m.id && this.selectedMemberIds().includes(m.id));
  }

  onSubmit(): void {
    if (this.selectedMemberIds().length === 0) {
      this.snackBar.open('Please select at least one member to divide into the new family', 'Close', { duration: 3500 });
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const val = this.form.value;

    const payload = {
      ...val,
      member_ids: this.selectedMemberIds(),
    };

    this.familyService.splitFamily(this.parentFamily.id, payload).subscribe({
      next: (newFamily) => {
        this.saving.set(false);
        this.snackBar.open(`Family divided successfully! New Family Code: ${newFamily.family_code}`, 'Close', { duration: 4000 });
        this.dialogRef.close({ success: true, newFamily });
      },
      error: (err) => {
        this.saving.set(false);
        this.snackBar.open('Error splitting family: ' + (err.error?.message || err.message), 'Close', { duration: 4500 });
      },
    });
  }
}
