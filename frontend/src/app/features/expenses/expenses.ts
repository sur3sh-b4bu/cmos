import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ExpenseService } from './services/expense.service';
import { AccountHead, ChurchExpenseTransaction, LedgerItem, MonthlyAbstract, MonthlyAccountsResponse } from './models/expense.model';
import { NotificationService } from '../../core/services/notification.service';
import { CurrencyService } from '../../core/services/currency.service';
import { AuthService } from '../../core/services/auth.service';
import { LanguageService } from '../../core/services/language.service';

@Component({
  selector: 'coms-expenses',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatTabsModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    RouterLink,
    TranslatePipe,
  ],
  templateUrl: './expenses.html',
  styleUrl: './expenses.scss',
})
export class ExpensesComponent implements OnInit {
  private expenseService = inject(ExpenseService);
  private notification = inject(NotificationService);
  currencyService = inject(CurrencyService);
  authService = inject(AuthService);
  languageService = inject(LanguageService);
  private translate = inject(TranslateService);

  // Active Month & Year
  currentYear = signal<number>(new Date().getFullYear());
  currentMonth = signal<number>(new Date().getMonth() + 1);

  monthYear = computed(() => {
    const y = this.currentYear();
    const m = String(this.currentMonth()).padStart(2, '0');
    return `${y}-${m}`;
  });

  months = [
    { value: 1, name: 'January', tamilName: 'ஜனவரி' },
    { value: 2, name: 'February', tamilName: 'பிப்ரவரி' },
    { value: 3, name: 'March', tamilName: 'மார்ச்' },
    { value: 4, name: 'April', tamilName: 'ஏப்ரல்' },
    { value: 5, name: 'May', tamilName: 'மே' },
    { value: 6, name: 'June', tamilName: 'ஜூன்' },
    { value: 7, name: 'July', tamilName: 'ஜூலை' },
    { value: 8, name: 'August', tamilName: 'ஆகஸ்ட்' },
    { value: 9, name: 'September', tamilName: 'செப்டம்பர்' },
    { value: 10, name: 'October', tamilName: 'அக்டோபர்' },
    { value: 11, name: 'November', tamilName: 'நவம்பர்' },
    { value: 12, name: 'December', tamilName: 'டிசம்பர்' },
  ];

  currentChurchName = computed(() => {
    return (
      this.authService.activeChurchBranch()?.churchName ||
      this.authService.currentUser()?.churchName ||
      "St. Mary's Church"
    );
  });

  years: number[] = [];

  // State
  loading = signal<boolean>(false);
  saving = signal<boolean>(false);
  printing = signal<boolean>(false);
  activeTab = signal<number>(0);

  // Ledger Data
  receipts = signal<LedgerItem[]>([]);
  payments = signal<LedgerItem[]>([]);
  abstract = signal<MonthlyAbstract>({
    month_year: '',
    opening_cash_hand: 0,
    opening_cash_bank: 0,
    opening_fixed_deposits: 0,
    closing_cash_hand: 0,
    closing_cash_bank: 0,
    closing_fixed_deposits: 0,
    receipts_specific_project: 0,
    payments_specific_project: 0,
    remit_stole_fees: 0,
    remit_mass_intentions: 0,
    remit_parish_contribution: 0,
    remit_diocesan_collection: 0,
    recv_monthly_allowance: 0,
    recv_medical_allowance: 0,
    recv_mission_conveyance: 0,
    recv_any_other: 0,
    priest_name: '',
    designation: '',
    unit_no: '',
    notes: '',
  });

  autoAggregates = signal<{
    massIntentionsOffering: number;
    massIntentionsCount: number;
    contributionsByType: Record<string, number>;
  }>({
    massIntentionsOffering: 0,
    massIntentionsCount: 0,
    contributionsByType: {},
  });

  prevMonthClosing = signal<{ cashHand: number; cashBank: number; fixedDeposits: number }>({
    cashHand: 0,
    cashBank: 0,
    fixedDeposits: 0,
  });

  // Account Heads list for Quick Transaction Modal
  accountHeads = signal<AccountHead[]>([]);

  // Transactions list
  transactions = signal<ChurchExpenseTransaction[]>([]);
  transactionsTotal = signal<number>(0);
  txLoading = signal<boolean>(false);
  txPage = signal<number>(1);
  txLimit = signal<number>(25);

  // New Transaction Form Model
  showNewTxModal = signal<boolean>(false);
  newTx = signal<{
    entryDate: string;
    type: 'receipt' | 'payment';
    headId: number | null;
    headName: string;
    amount: number | null;
    voucherNo: string;
    paidTo: string;
    notes: string;
  }>({
    entryDate: new Date().toISOString().slice(0, 10),
    type: 'payment',
    headId: null,
    headName: '',
    amount: null,
    voucherNo: '',
    paidTo: '',
    notes: '',
  });

  // Calculated totals
  totalReceipts = computed(() => {
    return this.receipts().reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  });

  totalPayments = computed(() => {
    return this.payments().reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  });

  // Abstract calculations
  abstractTotalReceiptsParish = computed(() => {
    // Receipts from the parish journal excluding opening balances and specific project
    return this.receipts()
      .filter((r) => !['REC_OPEN_CASH', 'REC_OPEN_BANK', 'REC_OPEN_FD', 'REC_PROJ_INC'].includes(r.code || ''))
      .reduce((s, r) => s + (Number(r.amount) || 0), 0);
  });

  abstractTotalPaymentsParish = computed(() => {
    // Payments from the parish journal excluding closing balances and specific project
    return this.payments()
      .filter((p) => !['PAY_CLOSE_CASH', 'PAY_CLOSE_BANK', 'PAY_CLOSE_FD', 'PAY_PROJ_SPENT'].includes(p.code || ''))
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);
  });

  abstractTotalReceipts = computed(() => {
    const abs = this.abstract();
    return (
      (Number(abs.opening_cash_hand) || 0) +
      (Number(abs.opening_cash_bank) || 0) +
      (Number(abs.opening_fixed_deposits) || 0) +
      this.abstractTotalReceiptsParish() +
      (Number(abs.receipts_specific_project) || 0)
    );
  });

  abstractTotalPayments = computed(() => {
    const abs = this.abstract();
    return (
      this.abstractTotalPaymentsParish() +
      (Number(abs.payments_specific_project) || 0) +
      (Number(abs.closing_cash_hand) || 0) +
      (Number(abs.closing_cash_bank) || 0) +
      (Number(abs.closing_fixed_deposits) || 0)
    );
  });

  totalRemittance = computed(() => {
    const abs = this.abstract();
    return (
      (Number(abs.remit_stole_fees) || 0) +
      (Number(abs.remit_mass_intentions) || 0) +
      (Number(abs.remit_parish_contribution) || 0) +
      (Number(abs.remit_diocesan_collection) || 0)
    );
  });

  totalReceivables = computed(() => {
    const abs = this.abstract();
    return (
      (Number(abs.recv_monthly_allowance) || 0) +
      (Number(abs.recv_medical_allowance) || 0) +
      (Number(abs.recv_mission_conveyance) || 0) +
      (Number(abs.recv_any_other) || 0)
    );
  });

  netDiocesePayable = computed(() => {
    return this.totalRemittance() - this.totalReceivables();
  });

  ngOnInit(): void {
    const currentY = new Date().getFullYear();
    for (let y = currentY + 1; y >= currentY - 5; y--) {
      this.years.push(y);
    }
    this.loadMonthlyAccounts();
    this.loadAccountHeads();
  }

  loadAccountHeads(): void {
    this.expenseService.getAccountHeads().subscribe({
      next: (heads) => this.accountHeads.set(heads),
      error: (err) => console.error('Error fetching heads', err),
    });
  }

  loadMonthlyAccounts(): void {
    this.loading.set(true);
    this.expenseService.getMonthlyAccounts(this.monthYear()).subscribe({
      next: (data) => {
        this.receipts.set(data.receipts || []);
        this.payments.set(data.payments || []);
        this.abstract.set(data.abstract || ({} as any));
        this.autoAggregates.set(data.autoAggregates || { massIntentionsOffering: 0, massIntentionsCount: 0, contributionsByType: {} });
        this.prevMonthClosing.set(data.prevMonthClosing || { cashHand: 0, cashBank: 0, fixedDeposits: 0 });
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.notification.error(err.message || 'Failed to load monthly accounts');
      },
    });
  }

  onMonthChange(month: number): void {
    this.currentMonth.set(month);
    this.loadMonthlyAccounts();
    if (this.activeTab() === 2) {
      this.loadTransactions();
    }
  }

  onYearChange(year: number): void {
    this.currentYear.set(year);
    this.loadMonthlyAccounts();
    if (this.activeTab() === 2) {
      this.loadTransactions();
    }
  }

  prevMonth(): void {
    let m = this.currentMonth() - 1;
    let y = this.currentYear();
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    this.currentMonth.set(m);
    this.currentYear.set(y);
    this.loadMonthlyAccounts();
  }

  nextMonth(): void {
    let m = this.currentMonth() + 1;
    let y = this.currentYear();
    if (m > 12) {
      m = 1;
      y += 1;
    }
    this.currentMonth.set(m);
    this.currentYear.set(y);
    this.loadMonthlyAccounts();
  }

  saveLedger(): void {
    this.saving.set(true);
    const allEntries: any[] = [];

    this.receipts().forEach((r) => {
      allEntries.push({
        headId: r.id,
        headName: r.name,
        type: 'receipt',
        amount: Number(r.amount) || 0,
        notes: r.notes || null,
        voucherNo: r.voucher_no || null,
        paidTo: r.paid_to || null,
      });
    });

    this.payments().forEach((p) => {
      allEntries.push({
        headId: p.id,
        headName: p.name,
        type: 'payment',
        amount: Number(p.amount) || 0,
        notes: p.notes || null,
        voucherNo: p.voucher_no || null,
        paidTo: p.paid_to || null,
      });
    });

    // Sync closing balances in abstract to payment items if updated
    const abs = { ...this.abstract() };
    const closeCash = this.payments().find((p) => p.code === 'PAY_CLOSE_CASH');
    if (closeCash) abs.closing_cash_hand = Number(closeCash.amount) || 0;

    const closeBank = this.payments().find((p) => p.code === 'PAY_CLOSE_BANK');
    if (closeBank) abs.closing_cash_bank = Number(closeBank.amount) || 0;

    const closeFd = this.payments().find((p) => p.code === 'PAY_CLOSE_FD');
    if (closeFd) abs.closing_fixed_deposits = Number(closeFd.amount) || 0;

    const openCash = this.receipts().find((r) => r.code === 'REC_OPEN_CASH');
    if (openCash) abs.opening_cash_hand = Number(openCash.amount) || 0;

    const openBank = this.receipts().find((r) => r.code === 'REC_OPEN_BANK');
    if (openBank) abs.opening_cash_bank = Number(openBank.amount) || 0;

    const openFd = this.receipts().find((r) => r.code === 'REC_OPEN_FD');
    if (openFd) abs.opening_fixed_deposits = Number(openFd.amount) || 0;

    this.expenseService.saveMonthlyLedger(this.monthYear(), { entries: allEntries, abstract: abs }).subscribe({
      next: () => {
        this.saving.set(false);
        this.notification.success('Financial ledger & diocese abstract saved successfully.');
      },
      error: (err) => {
        this.saving.set(false);
        this.notification.error(err.message || 'Failed to save accounts.');
      },
    });
  }

  printLedgerPdf(): void {
    this.printing.set(true);
    this.expenseService.getMonthlyPrintPdfBlob(this.monthYear()).subscribe({
      next: (blob) => {
        this.printing.set(false);
        const fileUrl = URL.createObjectURL(blob);
        const win = window.open(fileUrl, '_blank');
        if (!win) {
          const a = document.createElement('a');
          a.href = fileUrl;
          a.download = `Church_Accounts_${this.monthYear()}.pdf`;
          a.click();
        }
      },
      error: (err) => {
        this.printing.set(false);
        this.notification.error(err.message || 'Failed to generate printable PDF.');
      },
    });
  }

  onTabChange(index: number): void {
    this.activeTab.set(index);
    if (index === 2) {
      this.loadTransactions();
    }
  }

  loadTransactions(): void {
    this.txLoading.set(true);
    const my = this.monthYear();
    const [yStr, mStr] = my.split('-');
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10);
    const lastDay = new Date(y, m, 0).getDate();
    const dateFrom = `${my}-01`;
    const dateTo = `${my}-${String(lastDay).padStart(2, '0')}`;

    this.expenseService
      .listTransactions({
        dateFrom,
        dateTo,
        page: this.txPage(),
        limit: this.txLimit(),
      })
      .subscribe({
        next: (res) => {
          this.transactions.set(res.rows || []);
          this.transactionsTotal.set(res.total || 0);
          this.txLoading.set(false);
        },
        error: (err) => {
          this.txLoading.set(false);
          this.notification.error(err.message || 'Failed to load transactions');
        },
      });
  }

  openNewTxModal(): void {
    this.newTx.set({
      entryDate: `${this.monthYear()}-01`,
      type: 'payment',
      headId: null,
      headName: '',
      amount: null,
      voucherNo: '',
      paidTo: '',
      notes: '',
    });
    this.showNewTxModal.set(true);
  }

  closeNewTxModal(): void {
    this.showNewTxModal.set(false);
  }

  onTxHeadChange(headId: number): void {
    const head = this.accountHeads().find((h) => h.id === Number(headId));
    if (head) {
      this.newTx.update((prev) => ({
        ...prev,
        headId: head.id,
        headName: head.name,
        type: head.type,
      }));
    }
  }

  submitNewTransaction(): void {
    const tx = this.newTx();
    if (!tx.amount || tx.amount <= 0) {
      this.notification.warning('Please enter a valid amount');
      return;
    }
    if (!tx.headName && !tx.headId) {
      this.notification.warning('Please select an account head');
      return;
    }

    this.expenseService
      .createTransaction({
        entryDate: tx.entryDate,
        type: tx.type,
        headId: tx.headId ? Number(tx.headId) : null,
        headName: tx.headName || 'General Expense',
        amount: Number(tx.amount),
        voucherNo: tx.voucherNo || null,
        paidTo: tx.paidTo || null,
        notes: tx.notes || null,
      })
      .subscribe({
        next: () => {
          this.notification.success('Transaction added successfully');
          this.closeNewTxModal();
          this.loadMonthlyAccounts();
          this.loadTransactions();
        },
        error: (err) => {
          this.notification.error(err.message || 'Failed to save transaction');
        },
      });
  }

  deleteTransaction(id: number): void {
    if (!confirm('Are you sure you want to delete this transaction entry?')) return;
    this.expenseService.deleteTransaction(id).subscribe({
      next: () => {
        this.notification.success('Transaction deleted');
        this.loadMonthlyAccounts();
        this.loadTransactions();
      },
      error: (err) => this.notification.error(err.message || 'Failed to delete transaction'),
    });
  }

  // Update item amount on manual entry
  updateItemAmount(item: LedgerItem, newAmount: any): void {
    const parsed = parseFloat(newAmount) || 0;
    item.amount = parsed;
    item.manual_amount = item.is_auto ? parsed - item.auto_amount : parsed;

    // Trigger reactivity
    this.receipts.set([...this.receipts()]);
    this.payments.set([...this.payments()]);
  }

  // Update abstract field
  updateAbstractField(field: keyof MonthlyAbstract, val: any): void {
    this.abstract.update((prev) => ({
      ...prev,
      [field]: val,
    }));
  }

  formatCurrency(val: number | string | null | undefined): string {
    const num = Number(val) || 0;
    return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  getSelectedMonthName(): string {
    const m = this.months.find((item) => item.value === this.currentMonth());
    if (!m) return '';
    return this.languageService.isTamil() ? m.tamilName : m.name;
  }
}
