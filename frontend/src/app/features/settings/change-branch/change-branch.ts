import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MasterLookupService } from '../../../core/services/master-lookup.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/services/auth.service';
import { extractErrorMessage } from '../../../core/utils/http-error.util';

interface BranchOption {
  id: number;
  name: string;
}

/**
 * The per-church ADMIN's own branch switcher -- narrower than Master
 * Administrator's Change Church & Branch (change-church-branch.ts): an
 * ADMIN's church is fixed (their own), so this only ever picks a BRANCH of
 * it, listed via the ordinary /api/masters/branches lookup (already scoped
 * to their own church server-side -- see genericMasterRepository's
 * addChurchScope). Selecting "All Branches" (null) restores this role's
 * traditional unrestricted view.
 */
@Component({
  selector: 'coms-change-branch',
  standalone: true,
  imports: [ReactiveFormsModule, MatFormFieldModule, MatSelectModule, MatButtonModule, MatIconModule, TranslatePipe],
  templateUrl: './change-branch.html',
  styleUrl: './change-branch.scss',
})
export class ChangeBranchComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private masterLookup = inject(MasterLookupService);
  private notification = inject(NotificationService);
  private translate = inject(TranslateService);
  authService = inject(AuthService);

  branches = signal<BranchOption[]>([]);
  saving = signal(false);

  form = this.fb.nonNullable.group({
    // null means "All Branches" -- a real, selectable option (see the
    // template's first mat-option), not an absent/invalid value.
    branch_id: [null as number | null],
  });

  ngOnInit(): void {
    this.masterLookup.list<BranchOption>('branches').subscribe((rows) => this.branches.set(rows));
    this.form.patchValue({ branch_id: this.authService.adminActiveBranch()?.id ?? null });
  }

  async submit(): Promise<void> {
    this.saving.set(true);
    try {
      const { branch_id } = this.form.getRawValue();
      if (branch_id === null) {
        this.authService.setAdminActiveBranch(null);
        this.notification.success(this.translate.instant('settings.branchSwitched', { branch: this.translate.instant('settings.allBranches') }));
      } else {
        // Re-fetch the chosen row (rather than trusting the cached dropdown
        // list) so the name shown afterward is always accurate.
        const branch = await firstValueFrom(this.masterLookup.getById<BranchOption>('branches', branch_id));
        this.authService.setAdminActiveBranch(branch);
        this.notification.success(this.translate.instant('settings.branchSwitched', { branch: branch.name }));
      }
      this.router.navigate(['/dashboard']);
    } catch (err) {
      this.notification.error(extractErrorMessage(err));
    } finally {
      this.saving.set(false);
    }
  }
}
