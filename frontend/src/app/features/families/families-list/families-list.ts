import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslatePipe } from '@ngx-translate/core';
import { FamilyService } from '../family.service';
import { CensusStats, Family, Ward } from '../family.model';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'coms-families-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatTooltipModule,
    MatDialogModule,
    MatSnackBarModule,
  ],
  templateUrl: './families-list.html',
  styleUrl: './families-list.scss',
})
export class FamiliesListComponent implements OnInit {
  private familyService = inject(FamilyService);
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);

  families = signal<Family[]>([]);
  total = signal(0);
  page = signal(1);
  pageSize = signal(25);
  loading = signal(false);

  search = signal('');
  wardFilter = signal<number | null>(null);
  statusFilter = signal<string>('ACTIVE');
  sortBy = signal('family_code');
  sortDir = signal<'ASC' | 'DESC'>('ASC');

  census = signal<CensusStats | null>(null);
  wards = signal<Ward[]>([]);

  displayedColumns = [
    'family_code',
    'family_name',
    'head_member',
    'ward_name',
    'total_members',
    'phone',
    'status',
    'actions',
  ];

  canCreate = this.authService.hasPermission('families.create');
  canEdit = this.authService.hasPermission('families.update');
  canDelete = this.authService.hasPermission('families.delete');

  ngOnInit(): void {
    this.loadWards();
    this.loadCensus();
    this.loadFamilies();
  }

  loadWards(): void {
    this.familyService.getWards().subscribe({
      next: (w) => this.wards.set(w),
      error: () => {},
    });
  }

  loadCensus(): void {
    this.familyService.getCensus().subscribe({
      next: (stats) => this.census.set(stats),
      error: () => {},
    });
  }

  loadFamilies(): void {
    this.loading.set(true);
    this.familyService
      .list({
        page: this.page(),
        pageSize: this.pageSize(),
        search: this.search() || undefined,
        wardId: this.wardFilter() || undefined,
        status: this.statusFilter() || undefined,
        sortBy: this.sortBy(),
        sortDir: this.sortDir(),
      })
      .subscribe({
        next: (res) => {
          this.families.set(res.rows);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.snackBar.open('Error loading families: ' + (err.error?.message || err.message), 'Close', { duration: 4000 });
        },
      });
  }

  onSearchChange(): void {
    this.page.set(1);
    this.loadFamilies();
  }

  onFilterChange(): void {
    this.page.set(1);
    this.loadFamilies();
  }

  onSortChange(sort: Sort): void {
    this.sortBy.set(sort.active || 'family_code');
    this.sortDir.set(sort.direction === 'desc' ? 'DESC' : 'ASC');
    this.loadFamilies();
  }

  onPageChange(event: PageEvent): void {
    this.page.set(event.pageIndex + 1);
    this.pageSize.set(event.pageSize);
    this.loadFamilies();
  }

  viewDetail(family: Family): void {
    this.router.navigate(['/families', family.id]);
  }

  deleteFamily(family: Family, event: Event): void {
    event.stopPropagation();
    if (confirm(`Are you sure you want to delete family "${family.family_name}" (${family.family_code})?`)) {
      this.familyService.delete(family.id).subscribe({
        next: () => {
          this.snackBar.open('Family record deleted', 'Close', { duration: 3000 });
          this.loadFamilies();
          this.loadCensus();
        },
        error: (err) => {
          this.snackBar.open('Error: ' + (err.error?.message || err.message), 'Close', { duration: 4000 });
        },
      });
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'ACTIVE':
        return 'status-badge active';
      case 'MIGRATED_OUT':
        return 'status-badge migrated-out';
      case 'MIGRATED_IN':
        return 'status-badge migrated-in';
      case 'DIVIDED':
        return 'status-badge divided';
      default:
        return 'status-badge';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'ACTIVE':
        return 'Active';
      case 'MIGRATED_OUT':
        return 'Migrated Out';
      case 'MIGRATED_IN':
        return 'Migrated In';
      case 'DIVIDED':
        return 'Divided';
      default:
        return status;
    }
  }

  printDirectory(): void {
    window.print();
  }
}
