import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FamilyService } from '../family.service';
import { Ward } from '../family.model';

@Component({
  selector: 'coms-family-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
  ],
  templateUrl: './family-form.html',
  styleUrl: './family-form.scss',
})
export class FamilyFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private familyService = inject(FamilyService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  isEditMode = signal(false);
  familyId = signal<number | null>(null);
  loading = signal(false);
  saving = signal(false);
  wards = signal<Ward[]>([]);

  form: FormGroup = this.fb.group({
    family_code: ['', [Validators.required]],
    family_name: ['', [Validators.required, Validators.maxLength(200)]],
    family_name_ta: [''],
    ward_id: [null],
    address_line1: [''],
    address_line2: [''],
    address_ta: [''],
    city: [''],
    pincode: [''],
    phone: [''],
    email: ['', [Validators.email]],
    marriage_date: [''],
    status: ['ACTIVE', [Validators.required]],
    remarks: [''],
  });

  ngOnInit(): void {
    this.loadWards();

    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.isEditMode.set(true);
      this.familyId.set(Number(idParam));
      this.loadFamily(Number(idParam));
    } else {
      this.loadNextCode();
    }
  }

  loadWards(): void {
    this.familyService.getWards().subscribe({
      next: (w) => this.wards.set(w),
      error: () => {},
    });
  }

  loadNextCode(): void {
    this.familyService.getNextCode().subscribe({
      next: (code) => this.form.patchValue({ family_code: code }),
      error: () => {},
    });
  }

  loadFamily(id: number): void {
    this.loading.set(true);
    this.familyService.getById(id).subscribe({
      next: (fam) => {
        this.form.patchValue({
          family_code: fam.family_code,
          family_name: fam.family_name,
          family_name_ta: fam.family_name_ta,
          ward_id: fam.ward_id,
          address_line1: fam.address_line1,
          address_line2: fam.address_line2,
          address_ta: fam.address_ta,
          city: fam.city,
          pincode: fam.pincode,
          phone: fam.phone,
          email: fam.email,
          marriage_date: fam.marriage_date ? fam.marriage_date.split('T')[0] : '',
          status: fam.status,
          remarks: fam.remarks,
        });
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.snackBar.open('Error loading family: ' + (err.error?.message || err.message), 'Close', { duration: 4000 });
      },
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const val = this.form.value;

    if (this.isEditMode() && this.familyId()) {
      this.familyService.update(this.familyId()!, val).subscribe({
        next: () => {
          this.saving.set(false);
          this.snackBar.open('Family updated successfully', 'Close', { duration: 3000 });
          this.router.navigate(['/families', this.familyId()]);
        },
        error: (err) => {
          this.saving.set(false);
          this.snackBar.open('Error: ' + (err.error?.message || err.message), 'Close', { duration: 4000 });
        },
      });
    } else {
      this.familyService.create(val).subscribe({
        next: (created) => {
          this.saving.set(false);
          this.snackBar.open('Family registered successfully', 'Close', { duration: 3000 });
          this.router.navigate(['/families', created.id]);
        },
        error: (err) => {
          this.saving.set(false);
          this.snackBar.open('Error: ' + (err.error?.message || err.message), 'Close', { duration: 4000 });
        },
      });
    }
  }
}
