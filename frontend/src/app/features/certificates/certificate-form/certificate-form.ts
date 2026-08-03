import { Component, Input, OnChanges, ViewChild, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, FormGroupDirective, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { firstValueFrom } from 'rxjs';
import { MasterLookupService } from '../../../core/services/master-lookup.service';
import { NotificationService } from '../../../core/services/notification.service';
import { FileDownloadService } from '../../../core/services/file-download.service';
import { extractErrorMessage } from '../../../core/utils/http-error.util';
import { CertificateService, CertificateType } from '../certificate.service';
import { CERTIFICATE_CONFIGS, CertificateFormField } from '../certificate-config';

@Component({
  selector: 'coms-certificate-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './certificate-form.html',
  styleUrl: './certificate-form.scss',
})
export class CertificateFormComponent implements OnChanges {
  @Input({ required: true }) certType!: CertificateType;

  // Material's default ErrorStateMatcher shows an error once EITHER the
  // control is touched OR the enclosing FormGroupDirective has ever been
  // submitted -- FormGroup.reset() only clears the former, so a plain
  // reset() leaves every required-and-empty field showing red forever
  // after the first successful save. FormGroupDirective.resetForm()
  // clears both; see submit() below.
  @ViewChild(FormGroupDirective) private formGroupDirective?: FormGroupDirective;

  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private masterLookup = inject(MasterLookupService);
  private certificateService = inject(CertificateService);
  private notification = inject(NotificationService);
  private fileDownload = inject(FileDownloadService);

  config = CERTIFICATE_CONFIGS.baptism;
  form: FormGroup = this.fb.group({});
  editId = signal<number | null>(null);
  loading = signal(false);
  saving = signal(false);
  justSavedId = signal<number | null>(null);
  justSavedCertNo = signal<string | null>(null);
  optionsByMasterKey = signal<Record<string, { id: number; name: string }[]>>({});

  ngOnChanges(): void {
    this.config = CERTIFICATE_CONFIGS[this.certType];
    this.buildForm();
    this.loadMasterOptions();

    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      const id = Number(idParam);
      this.editId.set(id);
      this.loading.set(true);
      this.certificateService.getById(this.certType, id).subscribe({
        next: (record) => {
          const patch: Record<string, unknown> = {};
          for (const field of this.config.formFields) {
            patch[field.key] = field.type === 'date' && record[field.key] ? new Date(record[field.key]) : record[field.key];
          }
          this.form.patchValue(patch);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    } else {
      this.editId.set(null);
      this.justSavedId.set(null);
      this.justSavedCertNo.set(null);
    }
  }

  private buildForm(): void {
    const controls: Record<string, unknown> = {};
    for (const field of this.config.formFields) {
      controls[field.key] = [null, field.required ? Validators.required : []];
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

  optionsFor(field: CertificateFormField): { id: number; name: string }[] {
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
      payload[field.key] = field.type === 'date' && value instanceof Date ? this.toDateOnly(value) : value;
    }

    try {
      const editId = this.editId();
      if (editId) {
        await firstValueFrom(this.certificateService.update(this.certType, editId, payload));
        this.notification.success('Certificate updated successfully.');
        this.router.navigate(['/certificates', this.certType]);
      } else {
        const created = await firstValueFrom(this.certificateService.create(this.certType, payload));
        this.notification.success(`Saved. Certificate ${created.certificate_no} generated.`);
        this.justSavedId.set(created.id);
        this.justSavedCertNo.set(created.certificate_no);
        this.formGroupDirective?.resetForm();
      }
    } catch (err) {
      this.notification.error(extractErrorMessage(err));
    } finally {
      this.saving.set(false);
    }
  }

  async printCertificate(): Promise<void> {
    const id = this.justSavedId();
    if (!id) return;
    await this.fileDownload.openInNewTab(this.certificateService.getPrintUrl(this.certType, id));
  }
}
