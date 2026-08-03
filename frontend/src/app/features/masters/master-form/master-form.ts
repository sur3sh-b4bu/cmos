import { Component, Input, OnChanges, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { firstValueFrom } from 'rxjs';
import { MasterLookupService } from '../../../core/services/master-lookup.service';
import { NotificationService } from '../../../core/services/notification.service';
import { extractErrorMessage } from '../../../core/utils/http-error.util';
import { MasterService } from '../master.service';
import { MASTER_CONFIGS, MasterFormField } from '../master-config';

@Component({
  selector: 'coms-master-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './master-form.html',
  styleUrl: './master-form.scss',
})
export class MasterFormComponent implements OnChanges {
  @Input({ required: true }) masterKey!: string;

  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private masterLookup = inject(MasterLookupService);
  private masterService = inject(MasterService);
  private notification = inject(NotificationService);

  config = MASTER_CONFIGS['churches'];
  form: FormGroup = this.fb.group({});
  editId = signal<number | null>(null);
  loading = signal(false);
  saving = signal(false);
  optionsByMasterKey = signal<Record<string, { id: number; name: string }[]>>({});

  ngOnChanges(): void {
    this.config = MASTER_CONFIGS[this.masterKey];
    this.buildForm();
    this.loadMasterOptions();

    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      const id = Number(idParam);
      this.editId.set(id);
      this.loading.set(true);
      this.masterService.getById(this.masterKey, id).subscribe({
        next: (record) => {
          const patch: Record<string, unknown> = {};
          for (const field of this.config.formFields) {
            const raw = record[field.key];
            patch[field.key] = field.type === 'date' && raw ? new Date(raw) : field.type === 'checkbox' ? !!raw : raw;
          }
          this.form.patchValue(patch);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    } else {
      this.editId.set(null);
    }
  }

  private buildForm(): void {
    const controls: Record<string, unknown> = {};
    for (const field of this.config.formFields) {
      const defaultValue = field.type === 'checkbox' ? false : null;
      controls[field.key] = [defaultValue, field.required ? Validators.required : []];
    }
    this.form = this.fb.group(controls);
  }

  private loadMasterOptions(): void {
    const masterKeys = [...new Set(this.config.formFields.filter((f) => f.masterKey).map((f) => f.masterKey!))];
    for (const key of masterKeys) {
      this.masterLookup.list<{ id: number; name: string }>(key).subscribe((rows) => {
        this.optionsByMasterKey.update((current) => ({ ...current, [key]: rows }));
      });
    }
  }

  optionsFor(field: MasterFormField): { id: number; name: string }[] {
    return field.masterKey ? this.optionsByMasterKey()[field.masterKey] ?? [] : [];
  }

  private toDateOnly(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const raw = this.form.getRawValue();
    const payload: Record<string, unknown> = {};
    for (const field of this.config.formFields) {
      const value = raw[field.key];
      payload[field.key] =
        field.type === 'date' && value instanceof Date
          ? this.toDateOnly(value)
          : field.type === 'checkbox'
            ? (value ? 1 : 0)
            : value;
    }

    try {
      const editId = this.editId();
      if (editId) {
        await firstValueFrom(this.masterService.update(this.masterKey, editId, payload));
        this.notification.success(`${this.config.singularLabel} updated successfully.`);
      } else {
        await firstValueFrom(this.masterService.create(this.masterKey, payload));
        this.notification.success(`${this.config.singularLabel} created successfully.`);
      }
      this.router.navigate(['/masters', this.masterKey]);
    } catch (err) {
      this.notification.error(extractErrorMessage(err));
    } finally {
      this.saving.set(false);
    }
  }
}
