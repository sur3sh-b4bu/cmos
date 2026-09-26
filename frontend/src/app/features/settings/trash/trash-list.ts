import { Component, OnInit, TemplateRef, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DataTableComponent } from '../../../shared/components/data-table/data-table';
import { DataTableColumn } from '../../../shared/components/data-table/data-table.model';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { NotificationService } from '../../../core/services/notification.service';
import { formatDateTimeDMY } from '../../../core/utils/date-format.util';
import { TrashItem, TrashService } from '../../../core/services/trash.service';

export interface TrashCategory {
  key: string;
  labelKey: string;
  icon: string;
}

@Component({
  selector: 'coms-trash-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule,
    DataTableComponent,
    TranslatePipe,
  ],
  templateUrl: './trash-list.html',
  styleUrl: './trash-list.scss',
})
export class TrashListComponent implements OnInit {
  private trashService = inject(TrashService);
  private notification = inject(NotificationService);
  private dialog = inject(MatDialog);
  private translate = inject(TranslateService);

  @ViewChild('dateTpl', { static: true }) dateTpl!: TemplateRef<unknown>;
  @ViewChild('actionsTpl', { static: true }) actionsTpl!: TemplateRef<unknown>;

  categories: TrashCategory[] = [
    { key: 'mass_intentions', labelKey: 'nav.massIntentions', icon: 'volunteer_activism' },
    { key: 'contributions', labelKey: 'nav.contributions', icon: 'paid' },
    { key: 'baptism_certificates', labelKey: 'nav.baptismCertificates', icon: 'child_care' },
    { key: 'marriage_certificates', labelKey: 'nav.marriageCertificates', icon: 'favorite' },
    { key: 'death_certificates', labelKey: 'nav.deathCertificates', icon: 'sentiment_neutral' },
    { key: 'priests', labelKey: 'masters.priests.label', icon: 'person' },
    { key: 'masses', labelKey: 'masters.masses.label', icon: 'schedule' },
    { key: 'branches', labelKey: 'masters.branches.label', icon: 'alt_route' },
    { key: 'prayer_intention_master', labelKey: 'masters.prayerIntentionMaster.label', icon: 'category' },
    { key: 'donation_types', labelKey: 'masters.contributionTypes.label', icon: 'savings' },
    { key: 'users', labelKey: 'breadcrumb.users', icon: 'group' },
  ];

  selectedCategory = signal<string>('mass_intentions');

  columns: DataTableColumn[] = [];
  cellTemplates: Record<string, TemplateRef<unknown>> = {};

  rows = signal<TrashItem[]>([]);
  total = signal(0);
  loading = signal(false);
  pageIndex = signal(0);
  pageSize = signal(25);
  search = signal('');

  ngOnInit(): void {
    this.buildColumns();
    this.loadData();
  }

  buildColumns(): void {
    this.cellTemplates = {
      deleted_at: this.dateTpl,
      actions: this.actionsTpl,
    };

    this.columns = [
      { key: 'reference_no', label: this.translate.instant('trash.referenceNo') || 'Reference No', sortable: false },
      { key: 'record_title', label: this.translate.instant('trash.recordTitle') || 'Name / Title', sortable: false },
      { key: 'record_detail', label: this.translate.instant('trash.recordDetail') || 'Details', sortable: false },
      { key: 'deleted_at', label: this.translate.instant('trash.deletedAt') || 'Deleted On', sortable: false },
      { key: 'deleted_by_name', label: this.translate.instant('trash.deletedBy') || 'Deleted By', sortable: false },
      { key: 'actions', label: this.translate.instant('common.actions') || 'Actions', sortable: false },
    ];
  }

  selectCategory(categoryKey: string): void {
    if (this.selectedCategory() === categoryKey) return;
    this.selectedCategory.set(categoryKey);
    this.pageIndex.set(0);
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.trashService
      .list({
        moduleKey: this.selectedCategory(),
        page: this.pageIndex() + 1,
        pageSize: this.pageSize(),
        search: this.search(),
      })
      .subscribe({
        next: (res) => {
          this.rows.set(res.rows || []);
          this.total.set(res.total || 0);
          this.loading.set(false);
        },
        error: (err) => {
          this.notification.error(err.message || 'Failed to load deleted items');
          this.loading.set(false);
        },
      });
  }

  onSearch(query: string): void {
    this.search.set(query);
    this.pageIndex.set(0);
    this.loadData();
  }

  onPageChange(event: { pageIndex: number; pageSize: number }): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadData();
  }

  formatDate(val: string): string {
    return formatDateTimeDMY(val) || '-';
  }

  restoreItem(item: TrashItem): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.translate.instant('trash.restoreConfirmTitle') || 'Restore Record',
        message: this.translate.instant('trash.restoreConfirmMessage', {
          name: item.record_title || item.reference_no,
        }) || `Are you sure you want to restore "${item.record_title || item.reference_no}"? It will become active again.`,
        confirmText: this.translate.instant('trash.restoreAction') || 'Restore',
        isDestructive: false,
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;

      this.loading.set(true);
      this.trashService.restore(this.selectedCategory(), item.id).subscribe({
        next: (res) => {
          this.notification.success(res.message || 'Record successfully restored');
          this.loadData();
        },
        error: (err) => {
          this.notification.error(err.message || 'Failed to restore record');
          this.loading.set(false);
        },
      });
    });
  }
}
