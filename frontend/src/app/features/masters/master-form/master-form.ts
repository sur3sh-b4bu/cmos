import { Component, Input, OnChanges, OnDestroy, WritableSignal, effect, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { MasterLookupService } from '../../../core/services/master-lookup.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { extractErrorMessage } from '../../../core/utils/http-error.util';
import { resolveUploadUrl } from '../../../core/utils/asset-url.util';
import { baminiToUnicode } from '../../../core/utils/bamini-to-unicode.util';
import { LanguageService } from '../../../core/services/language.service';
import { phoneValidator } from '../../../shared/utils/phone.validator';
import { MasterService } from '../master.service';
import { MASTER_CONFIGS, MasterFormField } from '../master-config';
import { openChurchSetupDialog } from '../../../shared/components/church-setup-dialog/church-setup-dialog';
import { DatepickerTodayHeaderComponent } from '../../../shared/components/datepicker-today-header/datepicker-today-header';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB -- mirrors the backend's own limit (middlewares/upload.js)
// SVG deliberately excluded -- mirrors the backend's own reasoning
// (middlewares/upload.js) for dropping it as an accepted logo type.
const ALLOWED_LOGO_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

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
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    TranslatePipe,
  ],
  templateUrl: './master-form.html',
  styleUrl: './master-form.scss',
})
export class MasterFormComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) masterKey!: string;

  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private translate = inject(TranslateService);
  private masterLookup = inject(MasterLookupService);
  private masterService = inject(MasterService);
  private notification = inject(NotificationService);
  private authService = inject(AuthService);
  private languageService = inject(LanguageService);
  private dialog = inject(MatDialog);

  /** calendarHeaderComponent needs a class reference, not a template var. */
  readonly todayHeader = DatepickerTodayHeaderComponent;

  config = MASTER_CONFIGS['churches'];
  form: FormGroup = this.fb.group({});
  editId = signal<number | null>(null);
  loading = signal(false);
  saving = signal(false);
  optionsByMasterKey = signal<Record<string, { id: number; name: string }[]>>({});

  /** Logo upload state (churches only, see config.logoUpload) -- kept
   * separate from `form` since it's a multipart upload against its own
   * endpoint, not part of the plain JSON create/update payload.
   *
   * Uploading needs an existing church id, but a brand-new church doesn't
   * have one yet -- so in create mode a picked file is held here and shown
   * via a local object-preview URL, then actually uploaded right after
   * submit() creates the record (see there). In edit mode it uploads
   * immediately on pick instead, same as before. */
  logoUrl = signal<string | null>(null);
  private pendingLogoFile: File | null = null;
  private pendingLogoPreviewUrl: string | null = null; // object URL, needs revoking
  uploadingLogo = signal(false);

  /** Master Administrator, creating a church-scoped record, can check
   * several churches at once instead of picking just one -- submit() then
   * creates one row per checked church (same field values otherwise),
   * rather than the client just picking a single church_id. Tracked here
   * rather than in `form` since Validators.required doesn't catch an
   * empty *array* (see isChurchMultiField()'s own doc comment); `submitted`
   * gates the "select at least one" error the same way `.touched` gates a
   * plain field's own required error. */
  selectedChurchIds = signal<Set<number>>(new Set());
  submitted = signal(false);

  /** Per-field "Type in Bamini" toggle state -- see MasterFormField.bamini
   * and mass-intention-form.ts's identical per-field toggles, generalized
   * here since this form's fields are config-driven rather than fixed
   * named controls. Lazily created per field key in baminiSignal() below,
   * so every master's form shares one Map instead of needing a named
   * signal per field; cleared in ngOnChanges when switching masters so a
   * stale toggle from e.g. Churches' "name" field can't leak into
   * Branches' own "name" field. */
  private baminiSignals = new Map<string, WritableSignal<boolean>>();

  /** Keeps every already-created Bamini toggle in sync if the site
   * language changes while this form is open, not just on initial load --
   * see LanguageService.isTamil's own doc comment. */
  constructor() {
    effect(() => {
      const isTamil = this.languageService.isTamilTextInput();
      for (const sig of this.baminiSignals.values()) sig.set(isTamil);
    });
  }

  ngOnChanges(): void {
    this.config = MASTER_CONFIGS[this.masterKey];
    // Set synchronously, BEFORE buildForm(), since isChurchMultiField() (and
    // therefore which controls buildForm() gives a required validator to)
    // depends on whether this is a create or an edit.
    const idParam = this.route.snapshot.paramMap.get('id');

    // Creating a brand-new church (the tenant itself) is Master
    // Administrator-only -- see mastersController.create()'s matching
    // backend check and master-list.ts's canCreate(), which already keeps
    // the "New Church" button hidden from anyone else. This catches
    // someone landing here directly by URL instead of letting them fill
    // out a form that's only going to be rejected on submit.
    if (this.masterKey === 'churches' && !idParam && !this.authService.isMasterAdmin()) {
      this.router.navigate(['/masters', this.masterKey]);
      return;
    }

    this.editId.set(idParam ? Number(idParam) : null);
    this.selectedChurchIds.set(new Set());
    this.submitted.set(false);
    this.buildForm();
    this.loadMasterOptions();
    this.clearPendingLogoPreview();
    this.logoUrl.set(null);
    this.baminiSignals.clear();

    if (idParam) {
      this.loading.set(true);
      this.masterService.getById(this.masterKey, Number(idParam)).subscribe({
        next: (record) => {
          const patch: Record<string, unknown> = {};
          for (const field of this.config.formFields) {
            const raw = record[field.key];
            patch[field.key] =
              field.type === 'date' && raw
                ? new Date(raw)
                : field.type === 'checkbox'
                  ? !!raw
                  : // DB TIME columns round-trip as "HH:MM:SS"; a native time
                    // input with no `step` attribute only accepts "HH:MM".
                    field.type === 'time' && typeof raw === 'string'
                    ? raw.slice(0, 5)
                    : raw;
          }
          this.form.patchValue(patch);
          if (this.config.logoUpload) {
            this.logoUrl.set(resolveUploadUrl(record['logo_url'] as string | null | undefined));
          }
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    }
  }

  ngOnDestroy(): void {
    this.clearPendingLogoPreview();
  }

  private clearPendingLogoPreview(): void {
    if (this.pendingLogoPreviewUrl) URL.revokeObjectURL(this.pendingLogoPreviewUrl);
    this.pendingLogoPreviewUrl = null;
    this.pendingLogoFile = null;
  }

  /** Validates a picked logo file. In edit mode, uploads it immediately,
   * updating the preview and (if this is the current user's own church) the
   * sidebar crest right away. In create mode, there's no church id to
   * upload against yet -- the file is held and only actually sent once
   * submit() creates the record. */
  async onLogoSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // allows re-picking the same file later (e.g. after fixing it)
    if (!file) return;

    if (!ALLOWED_LOGO_MIME_TYPES.has(file.type)) {
      this.notification.error('Logo must be a PNG, JPEG or WEBP image');
      return;
    }
    if (file.size > MAX_LOGO_SIZE_BYTES) {
      this.notification.error('Logo must be 2MB or smaller');
      return;
    }

    const churchId = this.editId();
    if (!churchId) {
      this.clearPendingLogoPreview();
      this.pendingLogoFile = file;
      this.pendingLogoPreviewUrl = URL.createObjectURL(file);
      this.logoUrl.set(this.pendingLogoPreviewUrl);
      return;
    }

    await this.uploadLogo(churchId, file);
  }

  private async uploadLogo(churchId: number, file: File): Promise<void> {
    this.uploadingLogo.set(true);
    try {
      const updated = await firstValueFrom(this.masterService.uploadChurchLogo(churchId, file));
      this.logoUrl.set(resolveUploadUrl(updated.logo_url));
      this.authService.updateCurrentUserChurchLogo(churchId, updated.logo_url);
    } catch (err) {
      this.notification.error(extractErrorMessage(err, 'Could not upload the logo.'));
      throw err;
    } finally {
      this.uploadingLogo.set(false);
    }
  }

  private buildForm(): void {
    const controls: Record<string, unknown> = {};
    for (const field of this.config.formFields) {
      if (this.isChurchMultiField(field)) {
        // Selection tracked separately (selectedChurchIds), not through
        // this control -- see that signal's own doc comment.
        controls[field.key] = [null];
        continue;
      }
      const defaultValue = field.type === 'checkbox' ? false : (field.default ?? null);
      const isPhone = field.key === 'phone' || (field as any).type === 'phone';
      const validators = [];
      if (field.required) validators.push(Validators.required);
      if (isPhone) validators.push(phoneValidator);
      controls[field.key] = [defaultValue, validators];
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

  /** True only for the Church field, only while creating (not editing --
   * one existing row can't retroactively become several), and only for
   * Master Administrator -- everyone else's Church field stays the single
   * mat-select it's always been (their own is forced server-side to their
   * own church regardless, same as before this feature existed). */
  isChurchMultiField(field: MasterFormField): boolean {
    return field.key === 'church_id' && field.masterKey === 'churches' && !this.editId() && this.authService.isMasterAdmin();
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

  isAllChurchesSelected(field: MasterFormField): boolean {
    const options = this.optionsFor(field);
    return options.length > 0 && options.every((o) => this.selectedChurchIds().has(o.id));
  }

  isSomeChurchesSelected(field: MasterFormField): boolean {
    const options = this.optionsFor(field);
    const count = options.filter((o) => this.selectedChurchIds().has(o.id)).length;
    return count > 0 && count < options.length;
  }

  toggleAllChurches(field: MasterFormField, checked: boolean): void {
    this.selectedChurchIds.set(checked ? new Set(this.optionsFor(field).map((o) => o.id)) : new Set());
  }

  baminiSignal(key: string): WritableSignal<boolean> {
    let sig = this.baminiSignals.get(key);
    if (!sig) {
      sig = signal(this.languageService.isTamilTextInput());
      this.baminiSignals.set(key, sig);
    }
    return sig;
  }

  toggleBamini(key: string): void {
    this.baminiSignal(key).update((v) => !v);
  }

  /** Converts whatever was typed in Bamini to real Tamil Unicode once the
   * field loses focus -- see bamini-to-unicode.util.ts. No-op if the
   * toggle was never on for this field, same guard as
   * mass-intention-form.ts's identical convertBaminiOnBlur(). */
  convertBaminiOnBlur(key: string): void {
    const mode = this.baminiSignal(key);
    if (!mode()) return;
    const control = this.form.get(key);
    if (control) control.setValue(baminiToUnicode(control.value));
    mode.set(false);
  }

  private toDateOnly(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  async submit(): Promise<void> {
    this.submitted.set(true);
    const multiField = this.config.formFields.find((f) => this.isChurchMultiField(f));
    if (multiField && this.selectedChurchIds().size === 0) {
      return; // "select at least one church" error shown inline, see template
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const raw = this.form.getRawValue();
    const payload: Record<string, unknown> = {};
    for (const field of this.config.formFields) {
      if (multiField && field.key === multiField.key) continue; // filled in per-church below
      const value = raw[field.key];
      payload[field.key] =
        field.type === 'date' && value instanceof Date
          ? this.toDateOnly(value)
          : field.type === 'checkbox'
            ? (value ? 1 : 0)
            : value;
    }

    try {
      if (multiField) {
        await this.submitForMultipleChurches(multiField, payload);
        return;
      }

      const editId = this.editId();
      let createdChurch: { id: number; name: string } | null = null;
      if (editId) {
        await firstValueFrom(this.masterService.update(this.masterKey, editId, payload));
        // Same reasoning as the logo live-patch above: if the admin just
        // changed their own church's brand color, reflect it immediately
        // instead of waiting for the next login/refresh.
        if (this.masterKey === 'churches' && typeof payload['theme_color'] === 'string') {
          this.authService.updateCurrentUserChurchThemeColor(editId, payload['theme_color']);
        }
        this.notification.success(
          this.translate.instant('masters.updated', { name: this.translate.instant(this.config.singularLabel) })
        );
      } else {
        const created = await firstValueFrom(this.masterService.create(this.masterKey, payload));
        createdChurch = { id: created.id, name: String(payload['name'] ?? '') };
        this.notification.success(
          this.translate.instant('masters.created', { name: this.translate.instant(this.config.singularLabel) })
        );

        // The logo picked before the church existed (see onLogoSelected)
        // gets uploaded now that it finally has an id. A failure here
        // shouldn't block navigating away -- the church itself is already
        // saved either way, and the logo can always be added from Edit.
        if (this.pendingLogoFile) {
          try {
            await this.uploadLogo(created.id, this.pendingLogoFile);
          } catch {
            // uploadLogo() already showed its own error notification
          } finally {
            this.clearPendingLogoPreview();
          }
        }
      }
      // A brand-new church has no receipt/certificate numbering and no Masses yet, so staff couldn't
      // save anything in it. Ask for those details now, while the person creating it is here.
      if (this.masterKey === 'churches' && createdChurch) {
        await firstValueFrom(openChurchSetupDialog(this.dialog, { churchId: createdChurch.id, churchName: createdChurch.name }).afterClosed());
      }
      this.router.navigate(['/masters', this.masterKey]);
    } catch (err) {
      this.notification.error(extractErrorMessage(err));
    } finally {
      this.saving.set(false);
    }
  }

  /** Master Administrator checked more than one church -- create one row
   * per selected church (same field values otherwise), sequentially so a
   * failure on one church is attributable and doesn't block the rest, same
   * pattern as onImportRows()'s per-row creates in master-list.ts. Always
   * used in create mode only -- see isChurchMultiField(). */
  private async submitForMultipleChurches(field: MasterFormField, basePayload: Record<string, unknown>): Promise<void> {
    const churchIds = Array.from(this.selectedChurchIds());
    const churchNameById = new Map(this.optionsFor(field).map((o) => [o.id, o.name]));
    let succeeded = 0;
    const failures: string[] = [];

    for (const churchId of churchIds) {
      try {
        await firstValueFrom(this.masterService.create(this.masterKey, { ...basePayload, [field.key]: churchId }));
        succeeded++;
      } catch (err) {
        failures.push(`${churchNameById.get(churchId) ?? `#${churchId}`}: ${extractErrorMessage(err)}`);
      }
    }

    if (succeeded) {
      this.notification.success(
        this.translate.instant('masters.createdForChurches', {
          count: succeeded,
          name: this.translate.instant(this.config.singularLabel),
        })
      );
    }
    if (failures.length) {
      const shown = failures.slice(0, 3).join(' | ') + (failures.length > 3 ? '…' : '');
      this.notification.error(`${this.translate.instant('masters.createFailedForSomeChurches', { count: failures.length })} ${shown}`);
    }
    if (succeeded) this.router.navigate(['/masters', this.masterKey]);
  }
}
