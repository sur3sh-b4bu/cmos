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

interface ChurchOption {
  id: number;
  name: string;
  theme_color?: string | null;
  logo_url?: string | null;
}

interface BranchOption {
  id: number;
  name: string;
}

@Component({
  selector: 'coms-change-church-branch',
  standalone: true,
  imports: [ReactiveFormsModule, MatFormFieldModule, MatSelectModule, MatButtonModule, MatIconModule, TranslatePipe],
  templateUrl: './change-church-branch.html',
  styleUrl: './change-church-branch.scss',
})
export class ChangeChurchBranchComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private masterLookup = inject(MasterLookupService);
  private notification = inject(NotificationService);
  private translate = inject(TranslateService);
  authService = inject(AuthService);

  churches = signal<ChurchOption[]>([]);
  branches = signal<BranchOption[]>([]);
  saving = signal(false);

  form = this.fb.nonNullable.group({
    // null means "Central Management" -- a real, selectable option (see
    // the template's first mat-option), not an absent/invalid value, so
    // there's deliberately no Validators.required here. Defaults to null,
    // i.e. Central Management, exactly like a fresh session that hasn't
    // picked a church yet.
    church_id: [null as number | null],
    // null means "all branches" -- likewise a real option, not just an
    // absent value.
    branch_id: [null as number | null],
  });

  ngOnInit(): void {
    this.masterLookup.list<ChurchOption>('churches').subscribe((rows) => this.churches.set(rows));

    const active = this.authService.activeChurchBranch();
    if (active) {
      this.form.patchValue({ church_id: active.churchId, branch_id: active.branchId });
      this.loadBranches(active.churchId);
    }

    this.form.controls.church_id.valueChanges.subscribe((churchId) => {
      this.form.controls.branch_id.setValue(null);
      this.branches.set([]);
      if (churchId) this.loadBranches(churchId);
    });
  }

  private loadBranches(churchId: number): void {
    this.masterLookup.list<BranchOption>('branches', { church_id: churchId }).subscribe((rows) => this.branches.set(rows));
  }

  async submit(): Promise<void> {
    this.saving.set(true);
    try {
      const { church_id, branch_id } = this.form.getRawValue();
      if (church_id === null) {
        this.authService.useCentralManagement();
        this.notification.success(this.translate.instant('settings.centralManagementActive'));
      } else {
        // Re-fetch the chosen rows (rather than trusting the cached
        // dropdown lists) so the name shown afterward is always accurate.
        const church = await firstValueFrom(this.masterLookup.getById<ChurchOption>('churches', church_id));
        const branch = branch_id ? await firstValueFrom(this.masterLookup.getById<BranchOption>('branches', branch_id)) : null;

        this.authService.setActiveChurchBranch(church, branch);
        this.notification.success(
          this.translate.instant('settings.churchBranchSwitched', {
            church: church.name,
            branch: branch ? ` / ${branch.name}` : '',
          })
        );
      }
      // Central Management lands on its organization-wide overview; a church lands on that church's dashboard.
      this.router.navigate([church_id === null ? '/central/overview' : '/dashboard']);
    } catch (err) {
      this.notification.error(extractErrorMessage(err));
    } finally {
      this.saving.set(false);
    }
  }
}
