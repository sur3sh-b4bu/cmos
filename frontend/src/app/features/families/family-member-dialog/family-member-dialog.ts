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
import { FamilyMember, MaritalStatus, RelationshipToHead } from '../family.model';
import { FamilyService } from '../family.service';

@Component({
  selector: 'coms-family-member-dialog',
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
  templateUrl: './family-member-dialog.html',
  styleUrl: './family-member-dialog.scss',
})
export class FamilyMemberDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private familyService = inject(FamilyService);
  private dialogRef = inject(MatDialogRef<FamilyMemberDialogComponent>);
  private snackBar = inject(MatSnackBar);

  isEditMode = signal(false);
  saving = signal(false);
  familyId: number;
  memberToEdit?: FamilyMember;

  relationships: { value: RelationshipToHead; label: string }[] = [
    { value: 'HEAD', label: 'Head of Family' },
    { value: 'SPOUSE', label: 'Spouse (Wife / Husband)' },
    { value: 'SON', label: 'Son' },
    { value: 'DAUGHTER', label: 'Daughter' },
    { value: 'FATHER', label: 'Father' },
    { value: 'MOTHER', label: 'Mother' },
    { value: 'BROTHER', label: 'Brother' },
    { value: 'SISTER', label: 'Sister' },
    { value: 'GRANDFATHER', label: 'Grandfather' },
    { value: 'GRANDMOTHER', label: 'Grandmother' },
    { value: 'SON_IN_LAW', label: 'Son-in-law' },
    { value: 'DAUGHTER_IN_LAW', label: 'Daughter-in-law' },
    { value: 'GRANDSON', label: 'Grandson' },
    { value: 'GRANDDAUGHTER', label: 'Granddaughter' },
    { value: 'OTHER', label: 'Other Relative / Dependent' },
  ];

  maritalStatuses: { value: MaritalStatus; label: string }[] = [
    { value: 'SINGLE', label: 'Single' },
    { value: 'MARRIED', label: 'Married' },
    { value: 'WIDOWED', label: 'Widowed' },
    { value: 'DIVORCED', label: 'Divorced' },
    { value: 'CLERGY', label: 'Clergy / Religious' },
  ];

  form: FormGroup = this.fb.group({
    first_name: ['', [Validators.required, Validators.maxLength(150)]],
    last_name: [''],
    name_ta: [''],
    relationship_to_head: ['SON', [Validators.required]],
    gender: ['M', [Validators.required]],
    dob: [''],
    phone: [''],
    email: ['', [Validators.email]],
    blood_group: [''],
    occupation: [''],
    education: [''],
    marital_status: ['SINGLE', [Validators.required]],
    is_baptised: [false],
    baptism_date: [''],
    baptism_certificate_no: [''],
    is_communion_received: [false],
    communion_date: [''],
    is_confirmed: [false],
    confirmation_date: [''],
    marriage_date: [''],
    is_head: [false],
    notes: [''],
  });

  constructor(@Inject(MAT_DIALOG_DATA) public data: { familyId: number; member?: FamilyMember }) {
    this.familyId = data.familyId;
    this.memberToEdit = data.member;
    if (data.member) {
      this.isEditMode.set(true);
    }
  }

  ngOnInit(): void {
    if (this.memberToEdit) {
      this.form.patchValue({
        first_name: this.memberToEdit.first_name,
        last_name: this.memberToEdit.last_name,
        name_ta: this.memberToEdit.name_ta,
        relationship_to_head: this.memberToEdit.relationship_to_head,
        gender: this.memberToEdit.gender,
        dob: this.memberToEdit.dob ? this.memberToEdit.dob.split('T')[0] : '',
        phone: this.memberToEdit.phone,
        email: this.memberToEdit.email,
        blood_group: this.memberToEdit.blood_group,
        occupation: this.memberToEdit.occupation,
        education: this.memberToEdit.education,
        marital_status: this.memberToEdit.marital_status || 'SINGLE',
        is_baptised: !!this.memberToEdit.is_baptised,
        baptism_date: this.memberToEdit.baptism_date ? this.memberToEdit.baptism_date.split('T')[0] : '',
        baptism_certificate_no: this.memberToEdit.baptism_certificate_no,
        is_communion_received: !!this.memberToEdit.is_communion_received,
        communion_date: this.memberToEdit.communion_date ? this.memberToEdit.communion_date.split('T')[0] : '',
        is_confirmed: !!this.memberToEdit.is_confirmed,
        confirmation_date: this.memberToEdit.confirmation_date ? this.memberToEdit.confirmation_date.split('T')[0] : '',
        marriage_date: this.memberToEdit.marriage_date ? this.memberToEdit.marriage_date.split('T')[0] : '',
        is_head: !!this.memberToEdit.is_head,
        notes: this.memberToEdit.notes,
      });
    }
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const val = this.form.value;

    if (this.isEditMode() && this.memberToEdit?.id) {
      this.familyService.updateMember(this.memberToEdit.id, val).subscribe({
        next: (updated) => {
          this.saving.set(false);
          this.snackBar.open('Member updated', 'Close', { duration: 3000 });
          this.dialogRef.close({ success: true, member: updated });
        },
        error: (err) => {
          this.saving.set(false);
          this.snackBar.open('Error: ' + (err.error?.message || err.message), 'Close', { duration: 4000 });
        },
      });
    } else {
      this.familyService.addMember(this.familyId, val).subscribe({
        next: (created) => {
          this.saving.set(false);
          this.snackBar.open('Member added to household', 'Close', { duration: 3000 });
          this.dialogRef.close({ success: true, member: created });
        },
        error: (err) => {
          this.saving.set(false);
          this.snackBar.open('Error: ' + (err.error?.message || err.message), 'Close', { duration: 4000 });
        },
      });
    }
  }
}
