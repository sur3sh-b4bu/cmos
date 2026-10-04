import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ExpenseService } from '../../expenses/services/expense.service';
import { AccountHead } from '../../expenses/models/expense.model';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'coms-expense-heads',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatTabsModule,
    MatProgressSpinnerModule,
    RouterLink,
    TranslatePipe,
  ],
  templateUrl: './expense-heads.html',
  styleUrl: './expense-heads.scss',
})
export class ExpenseHeadsComponent implements OnInit {
  private expenseService = inject(ExpenseService);
  private notification = inject(NotificationService);
  authService = inject(AuthService);

  loading = signal<boolean>(false);
  activeTab = signal<number>(0); // 0: Receipts, 1: Payments
  heads = signal<AccountHead[]>([]);

  // Filtered lists
  receiptHeads = computed(() => {
    return this.heads().filter((h) => h.type === 'receipt');
  });

  paymentHeads = computed(() => {
    return this.heads().filter((h) => h.type === 'payment');
  });

  // Modal State for Add / Edit
  showModal = signal<boolean>(false);
  isEditing = signal<boolean>(false);
  editingHeadId = signal<number | null>(null);

  formHead = signal<{
    type: 'receipt' | 'payment';
    section: string;
    name: string;
    tamilName: string;
    code: string;
    autoSource: string;
    orderIndex: number;
  }>({
    type: 'receipt',
    section: 'Other Income',
    name: '',
    tamilName: '',
    code: '',
    autoSource: '',
    orderIndex: 0,
  });

  receiptSections = ['Opening Balance', 'Other Income', 'Payables', 'Collections Made', 'Loans Received', 'Advances Received', 'Project Income'];
  paymentSections = [
    'Administrative Expenses',
    'Salary/Honorarium',
    'Masses',
    'Repairs & Maintenance',
    'Collections remitted to Diocese',
    'Loans Paid',
    'Advances Paid',
    'Project Money spent',
    'Closing Balance',
    'Other Expenses',
  ];

  autoSources = [
    { value: '', label: 'Manual Entry (Empty / Type into form)' },
    { value: 'mass_intentions_people', label: 'Mass Intentions Offering (Auto from App)' },
    { value: 'contributions_village', label: 'Village Contributions (Auto from App)' },
    { value: 'contributions_substation', label: 'Substation Collections (Auto from App)' },
    { value: 'contributions_family', label: 'Family Subscriptions (Auto from App)' },
    { value: 'contributions_dumbbox', label: 'Dumb Box Collections (Auto from App)' },
    { value: 'contributions_feast', label: 'Feast Collections (Auto from App)' },
    { value: 'contributions_sunday', label: 'Sunday Collections (Auto from App)' },
  ];

  ngOnInit(): void {
    this.loadHeads();
  }

  loadHeads(): void {
    this.loading.set(true);
    this.expenseService.getAccountHeads().subscribe({
      next: (data) => {
        this.heads.set(data || []);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.notification.error(err.message || 'Failed to load account heads');
      },
    });
  }

  openCreateModal(type: 'receipt' | 'payment'): void {
    this.isEditing.set(false);
    this.editingHeadId.set(null);
    this.formHead.set({
      type,
      section: type === 'receipt' ? 'Other Income' : 'Administrative Expenses',
      name: '',
      tamilName: '',
      code: '',
      autoSource: '',
      orderIndex: this.heads().length + 1,
    });
    this.showModal.set(true);
  }

  openEditModal(head: AccountHead): void {
    this.isEditing.set(true);
    this.editingHeadId.set(head.id);
    this.formHead.set({
      type: head.type,
      section: head.section,
      name: head.name,
      tamilName: head.tamil_name || '',
      code: head.code || '',
      autoSource: head.auto_source || '',
      orderIndex: head.order_index || 0,
    });
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
  }

  saveHead(): void {
    const data = this.formHead();
    if (!data.name.trim()) {
      this.notification.warning('Please enter a head name');
      return;
    }

    if (this.isEditing() && this.editingHeadId()) {
      this.expenseService
        .updateAccountHead(this.editingHeadId()!, {
          name: data.name.trim(),
          tamilName: data.tamilName.trim() || null,
          section: data.section,
          code: data.code.trim() || null,
          autoSource: data.autoSource || null,
          orderIndex: Number(data.orderIndex) || 0,
        } as any)
        .subscribe({
          next: () => {
            this.notification.success('Account head updated successfully');
            this.closeModal();
            this.loadHeads();
          },
          error: (err) => this.notification.error(err.message || 'Failed to update account head'),
        });
    } else {
      this.expenseService
        .createAccountHead({
          type: data.type,
          section: data.section,
          name: data.name.trim(),
          tamilName: data.tamilName.trim() || null,
          code: data.code.trim() || null,
          autoSource: data.autoSource || null,
          orderIndex: Number(data.orderIndex) || 0,
        } as any)
        .subscribe({
          next: () => {
            this.notification.success('Account head created successfully');
            this.closeModal();
            this.loadHeads();
          },
          error: (err) => this.notification.error(err.message || 'Failed to create account head'),
        });
    }
  }

  deleteHead(head: AccountHead): void {
    if (!confirm(`Are you sure you want to deactivate "${head.name}"?`)) return;
    this.expenseService.deleteAccountHead(head.id).subscribe({
      next: () => {
        this.notification.success(`Account head "${head.name}" removed`);
        this.loadHeads();
      },
      error: (err) => this.notification.error(err.message || 'Failed to delete account head'),
    });
  }
}
