import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { MasterLookupService } from '../../../core/services/master-lookup.service';
import { NotificationService } from '../../../core/services/notification.service';
import { extractErrorMessage } from '../../../core/utils/http-error.util';
import { phoneValidator } from '../../../shared/utils/phone.validator';
import { UserService } from './user.service';
import { RoleService, Role } from '../roles-permissions/role.service';
import { TempPasswordDialogComponent } from './temp-password-dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'coms-user-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslatePipe,
  ],
  templateUrl: './user-form.html',
  styleUrl: './user-form.scss',
})
export class UserFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private masterLookup = inject(MasterLookupService);
  private userService = inject(UserService);
  private roleService = inject(RoleService);
  private notification = inject(NotificationService);
  private dialog = inject(MatDialog);
  private translate = inject(TranslateService);

  editId = signal<number | null>(null);
  loading = signal(false);
  saving = signal(false);
  roles = signal<Role[]>([]);
  churches = signal<{ id: number; name: string }[]>([]);
  branches = signal<{ id: number; name: string }[]>([]);

  form = this.fb.nonNullable.group({
    full_name: ['', Validators.required],
    username: ['', [Validators.required, Validators.minLength(3)]],
    email: [''],
    phone: ['', phoneValidator],
    employee_code: [''],
    role_id: [null as number | null, Validators.required],
    church_id: [null as number | null, Validators.required],
    branch_id: [null as number | null],
  });

  ngOnInit(): void {
    this.roleService.listRoles().subscribe((roles) => this.roles.set(roles));
    this.masterLookup.list<{ id: number; name: string }>('churches').subscribe((rows) => this.churches.set(rows));

    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      const id = Number(idParam);
      this.editId.set(id);
      this.loading.set(true);
      this.userService.getById(id).subscribe({
        next: (user) => {
          // Loaded (for whichever church this user already belongs to)
          // BEFORE wiring up watchChurchChanges() below, so patchValue's
          // own church_id doesn't trigger a branch_id reset -- that reset
          // is only meant for a church the admin picks manually afterward.
          if (user.church_id) this.loadBranches(user.church_id);
          this.form.patchValue({
            full_name: user.full_name,
            username: user.username,
            email: user.email ?? '',
            phone: user.phone ?? '',
            employee_code: user.employee_code ?? '',
            role_id: user.role_id,
            church_id: user.church_id,
            branch_id: user.branch_id,
          });
          this.form.controls.username.disable();
          this.loading.set(false);
          this.watchChurchChanges();
        },
        error: () => this.loading.set(false),
      });
    } else {
      this.watchChurchChanges();
    }
  }

  /** Keeps the Branch dropdown limited to branches of whichever church is
   * currently selected -- without this, nothing stopped picking a branch
   * that belongs to a completely different church (that's exactly how the
   * mismatched church/branch pairs seen in production got created; the
   * server now also rejects such a mismatch on save, but the dropdown
   * should never have offered it in the first place). */
  private watchChurchChanges(): void {
    this.form.controls.church_id.valueChanges.subscribe((churchId) => {
      this.form.controls.branch_id.setValue(null);
      this.branches.set([]);
      if (churchId) this.loadBranches(churchId);
    });
  }

  private loadBranches(churchId: number): void {
    this.masterLookup.list<{ id: number; name: string }>('branches', { church_id: churchId }).subscribe((rows) => this.branches.set(rows));
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const raw = this.form.getRawValue();
    // role_id/church_id are Validators.required, so form.invalid above
    // already guarantees these aren't null by the time we get here.
    const payload = { ...raw, role_id: raw.role_id!, church_id: raw.church_id! };

    try {
      const editId = this.editId();
      if (editId) {
        await firstValueFrom(this.userService.update(editId, payload));
        this.notification.success(this.translate.instant('settings.userUpdated'));
        this.router.navigate(['/settings/users']);
      } else {
        const { user, tempPassword } = await firstValueFrom(this.userService.create(payload));
        this.dialog
          .open(TempPasswordDialogComponent, {
            data: { title: this.translate.instant('settings.userCreated', { name: user.full_name }), password: tempPassword },
          })
          .afterClosed()
          .subscribe(() => this.router.navigate(['/settings/users']));
      }
    } catch (err) {
      this.notification.error(extractErrorMessage(err));
    } finally {
      this.saving.set(false);
    }
  }
}
