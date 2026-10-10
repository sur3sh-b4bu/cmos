import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Family, FamilyMember } from '../family.model';
import { FamilyService } from '../family.service';
import { FamilyMemberDialogComponent } from '../family-member-dialog/family-member-dialog';
import { SplitFamilyDialogComponent } from '../split-family-dialog/split-family-dialog';
import { MigrateFamilyDialogComponent } from '../migrate-family-dialog/migrate-family-dialog';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'coms-family-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule,
    MatDialogModule,
    MatSnackBarModule,
  ],
  templateUrl: './family-detail.html',
  styleUrl: './family-detail.scss',
})
export class FamilyDetailComponent implements OnInit {
  private familyService = inject(FamilyService);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  familyId = signal<number>(0);
  family = signal<Family | null>(null);
  loading = signal(true);

  canEdit = this.authService.hasPermission('families.update');
  canDelete = this.authService.hasPermission('families.delete');

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.familyId.set(Number(idParam));
      this.loadDetail();
    }
  }

  loadDetail(): void {
    this.loading.set(true);
    this.familyService.getById(this.familyId()).subscribe({
      next: (fam) => {
        this.family.set(fam);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.snackBar.open('Error loading family: ' + (err.error?.message || err.message), 'Close', { duration: 4000 });
      },
    });
  }

  openAddMember(): void {
    const ref = this.dialog.open(FamilyMemberDialogComponent, {
      width: '680px',
      data: { familyId: this.familyId() },
    });
    ref.afterClosed().subscribe((res) => {
      if (res?.success) {
        this.loadDetail();
      }
    });
  }

  openEditMember(member: FamilyMember): void {
    const ref = this.dialog.open(FamilyMemberDialogComponent, {
      width: '680px',
      data: { familyId: this.familyId(), member },
    });
    ref.afterClosed().subscribe((res) => {
      if (res?.success) {
        this.loadDetail();
      }
    });
  }

  deleteMember(member: FamilyMember): void {
    if (confirm(`Remove ${member.first_name} ${member.last_name || ''} from this household?`)) {
      this.familyService.removeMember(member.id!).subscribe({
        next: () => {
          this.snackBar.open('Member removed from family', 'Close', { duration: 3000 });
          this.loadDetail();
        },
        error: (err) => {
          this.snackBar.open('Error: ' + (err.error?.message || err.message), 'Close', { duration: 4000 });
        },
      });
    }
  }

  openSplitFamily(): void {
    this.familyService.getWards().subscribe((wards) => {
      const ref = this.dialog.open(SplitFamilyDialogComponent, {
        width: '680px',
        data: { family: this.family()!, wards },
      });
      ref.afterClosed().subscribe((res) => {
        if (res?.success && res.newFamily) {
          this.router.navigate(['/families', res.newFamily.id]);
        }
      });
    });
  }

  openMigrateFamily(): void {
    const ref = this.dialog.open(MigrateFamilyDialogComponent, {
      width: '540px',
      data: { family: this.family()! },
    });
    ref.afterClosed().subscribe((res) => {
      if (res?.success) {
        this.loadDetail();
      }
    });
  }

  printFamilyCard(): void {
    window.print();
  }

  getRelationshipClass(rel: string): string {
    switch (rel) {
      case 'HEAD':
        return 'rel-badge head';
      case 'SPOUSE':
        return 'rel-badge spouse';
      case 'SON':
      case 'DAUGHTER':
        return 'rel-badge child';
      case 'FATHER':
      case 'MOTHER':
      case 'GRANDFATHER':
      case 'GRANDMOTHER':
        return 'rel-badge elder';
      default:
        return 'rel-badge';
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'ACTIVE':
        return 'status-pill active';
      case 'MIGRATED_OUT':
        return 'status-pill migrated-out';
      case 'MIGRATED_IN':
        return 'status-pill migrated-in';
      case 'DIVIDED':
        return 'status-pill divided';
      default:
        return 'status-pill';
    }
  }
}
