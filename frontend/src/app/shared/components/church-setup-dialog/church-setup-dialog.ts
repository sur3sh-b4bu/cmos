import { Component, OnInit, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  CertificateSeriesType,
  ChurchSetupPayload,
  ChurchSetupService,
  ChurchSetupStatus,
  SeriesValues,
  SuggestedMass,
} from '../../../core/services/church-setup.service';
import { NotificationService } from '../../../core/services/notification.service';
import { extractErrorMessage } from '../../../core/utils/http-error.util';

export interface ChurchSetupDialogData {
  churchId: number;
  /** Shown in the title until the status has loaded. */
  churchName?: string;
}

/** Opens the "Set up this church" popup; resolves (afterClosed) with true if the setup was saved. */
export function openChurchSetupDialog(dialog: MatDialog, data: ChurchSetupDialogData) {
  return dialog.open<ChurchSetupDialogComponent, ChurchSetupDialogData, boolean>(ChurchSetupDialogComponent, {
    data,
    width: '960px',
    maxWidth: '96vw',
    maxHeight: '92vh',
    autoFocus: 'dialog',
    disableClose: true,
  });
}

const PREFIX_PATTERN = /^[A-Za-z0-9._/-]+$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,60}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9]{10}$/;
const CERTIFICATE_TYPES: CertificateSeriesType[] = ['Baptism', 'Marriage', 'Death'];

/**
 * What a church needs before its office can save a record: a receipt-number series, a numbering
 * series for each certificate type, and at least one Mass -- plus a branch and a priest, which
 * are only recommended. Opens with the values the church would get by default already filled in
 * and shows only what this church is still missing.
 */
@Component({
  selector: 'coms-church-setup-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    TranslatePipe,
  ],
  templateUrl: './church-setup-dialog.html',
  styleUrl: './church-setup-dialog.scss',
})
export class ChurchSetupDialogComponent implements OnInit {
  data = inject<ChurchSetupDialogData>(MAT_DIALOG_DATA);
  private dialogRef = inject<MatDialogRef<ChurchSetupDialogComponent, boolean>>(MatDialogRef);
  private setup = inject(ChurchSetupService);
  private fb = inject(FormBuilder);
  private notification = inject(NotificationService);
  private translate = inject(TranslateService);

  readonly certificateTypes = CERTIFICATE_TYPES;
  readonly dayTypes = ['Daily', 'Sunday', 'Special'] as const;

  loading = signal(true);
  saving = signal(false);
  loadError = signal<string | null>(null);
  saveError = signal<string | null>(null);
  submitted = signal(false);
  status = signal<ChurchSetupStatus | null>(null);

  receipt!: FormGroup;
  certificates: Partial<Record<CertificateSeriesType, FormGroup>> = {};
  masses = this.fb.array<FormGroup>([]);
  /** The church's own Administrator login -- optional; left empty, none is created. */
  adminForm = this.fb.nonNullable.group({
    fullName: ['', Validators.maxLength(150)],
    username: ['', Validators.maxLength(60)],
    email: ['', Validators.maxLength(150)],
    phone: ['', Validators.maxLength(20)],
  });
  /** Shown once, after the login was created. */
  credentials = signal<{ username: string; tempPassword: string } | null>(null);
  copied = signal(false);

  extras = this.fb.nonNullable.group({
    branchName: ['', Validators.maxLength(150)],
    priestName: ['', Validators.maxLength(150)],
    priestTitle: ['Rev. Fr.', Validators.maxLength(50)],
  });

  async ngOnInit(): Promise<void> {
    try {
      const status = await this.setup.getStatus(this.data.churchId);
      this.build(status);
      this.status.set(status);
    } catch (err) {
      this.loadError.set(extractErrorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }

  private seriesGroup(values: SeriesValues): FormGroup {
    return this.fb.nonNullable.group({
      prefix: [values.prefix, [Validators.required, Validators.maxLength(20), Validators.pattern(PREFIX_PATTERN)]],
      startNumber: [values.startNumber, [Validators.required, Validators.min(1), Validators.max(999999999)]],
      padding: [values.padding, [Validators.required, Validators.min(1), Validators.max(10)]],
    });
  }

  private massGroup(mass: SuggestedMass): FormGroup {
    return this.fb.nonNullable.group({
      name: [mass.name, [Validators.required, Validators.maxLength(100)]],
      nameTa: [mass.nameTa ?? '', Validators.maxLength(150)],
      massTime: [mass.massTime, [Validators.required, Validators.pattern(TIME_PATTERN)]],
      dayType: [mass.dayType, Validators.required],
      defaultOfferingAmount: [mass.defaultOfferingAmount ?? 0, [Validators.min(0)]],
    });
  }

  /** Builds a form section only for what this church is missing. */
  private build(status: ChurchSetupStatus): void {
    if (status.missing.receiptSeries) this.receipt = this.seriesGroup(status.defaults.receiptSeries);
    for (const type of status.missing.certificateSeries) {
      this.certificates[type] = this.seriesGroup(status.defaults.certificateSeries[type]);
    }
    if (status.missing.masses) status.defaults.masses.forEach((m) => this.masses.push(this.massGroup(m)));
  }

  /** The first number the series would hand out, e.g. RCT0001. */
  preview(group: FormGroup | undefined): string {
    const v = group?.getRawValue() as SeriesValues | undefined;
    if (!v || !v.prefix || !(v.startNumber >= 1) || !(v.padding >= 1)) return '';
    return `${v.prefix}${String(Math.floor(v.startNumber)).padStart(Math.min(10, Math.floor(v.padding)), '0')}`;
  }

  /** True when the person started filling in an Administrator (a name or a username). */
  wantsAdmin(): boolean {
    const v = this.adminForm.getRawValue();
    return !!(v.fullName.trim() || v.username.trim());
  }

  /** Is this Administrator field currently unacceptable? Only checked once the person has tried to save or touched it. */
  adminInvalid(field: 'fullName' | 'username' | 'email' | 'phone'): boolean {
    if (!this.status()?.missing.admin) return false;
    if (!(this.submitted() || this.adminForm.get(field)!.touched)) return false;
    const v = this.adminForm.getRawValue();
    if (field === 'fullName') return this.wantsAdmin() && !v.fullName.trim();
    if (field === 'username') return this.wantsAdmin() && !USERNAME_PATTERN.test(v.username.trim());
    if (field === 'email') return !!v.email.trim() && !EMAIL_PATTERN.test(v.email.trim());
    return !!v.phone.trim() && !PHONE_PATTERN.test(v.phone.trim());
  }

  async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      // Clipboard blocked (e.g. plain HTTP): the text is on screen to select by hand.
    }
  }

  done(): void {
    this.dialogRef.close(true);
  }

  addMass(): void {
    this.masses.push(this.massGroup({ name: '', nameTa: '', massTime: '06:00', dayType: 'Daily', defaultOfferingAmount: 0 }));
  }

  removeMass(index: number): void {
    this.masses.removeAt(index);
  }

  invalid(group: FormGroup | undefined, control: string): boolean {
    const c = group?.get(control);
    return !!c && c.invalid && (c.touched || this.submitted());
  }

  private allGroups(): FormGroup[] {
    const groups: FormGroup[] = [this.extras];
    if (this.receipt) groups.push(this.receipt);
    for (const g of Object.values(this.certificates)) if (g) groups.push(g);
    groups.push(...(this.masses as FormArray<FormGroup>).controls);
    return groups;
  }

  async save(): Promise<void> {
    this.submitted.set(true);
    this.saveError.set(null);
    const groups = this.allGroups();
    groups.forEach((g) => g.markAllAsTouched());
    this.adminForm.markAllAsTouched();
    if (groups.some((g) => g.invalid)) return;
    if (this.adminInvalid('fullName') || this.adminInvalid('username') || this.adminInvalid('email') || this.adminInvalid('phone')) return;

    const payload: ChurchSetupPayload = {};
    if (this.receipt) payload.receiptSeries = this.receipt.getRawValue();
    const certs = Object.entries(this.certificates) as [CertificateSeriesType, FormGroup][];
    if (certs.length) payload.certificateSeries = Object.fromEntries(certs.map(([type, g]) => [type, g.getRawValue()]));
    if (this.masses.length) payload.masses = this.masses.getRawValue() as SuggestedMass[];
    const extras = this.extras.getRawValue();
    if (this.status()?.missing.branch && extras.branchName.trim()) payload.branch = { name: extras.branchName.trim() };
    if (this.status()?.missing.priest && extras.priestName.trim()) {
      payload.priest = { name: extras.priestName.trim(), title: extras.priestTitle.trim() || undefined };
    }

    if (this.status()?.missing.admin && this.wantsAdmin()) {
      const a = this.adminForm.getRawValue();
      payload.admin = { fullName: a.fullName.trim(), username: a.username.trim(), email: a.email.trim() || undefined, phone: a.phone.trim() || undefined };
    }

    this.saving.set(true);
    try {
      const result = await this.setup.apply(this.data.churchId, payload);
      this.notification.success(this.translate.instant('churchSetup.saved', { church: result.status.churchName }));
      if (result.admin) {
        // The temporary password exists only in this response: show it now, and stay open until the person is done.
        this.credentials.set({ username: result.admin.username, tempPassword: result.admin.tempPassword });
        return;
      }
      this.dialogRef.close(true);
    } catch (err) {
      this.saveError.set(extractErrorMessage(err));
    } finally {
      this.saving.set(false);
    }
  }

  later(): void {
    this.dialogRef.close(false);
  }
}
