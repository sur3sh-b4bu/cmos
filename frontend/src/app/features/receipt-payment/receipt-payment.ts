import { Component, OnInit, TemplateRef, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ExpenseService } from '../expenses/services/expense.service';
import { AccountHead, ChurchExpenseTransaction } from '../expenses/models/expense.model';
import { MasterLookupService } from '../../core/services/master-lookup.service';
import { NotificationService } from '../../core/services/notification.service';
import { CurrencyService } from '../../core/services/currency.service';
import { AuthService } from '../../core/services/auth.service';
import { LanguageService } from '../../core/services/language.service';
import { formatDateDMY } from '../../core/utils/date-format.util';
import { DatepickerTodayHeaderComponent } from '../../shared/components/datepicker-today-header/datepicker-today-header';
import { DataTableComponent } from '../../shared/components/data-table/data-table';
import { DataTableColumn, DataTableSort } from '../../shared/components/data-table/data-table.model';
import { FilterBarComponent } from '../../shared/components/filter-bar/filter-bar';
import { FilterFieldDef } from '../../shared/components/filter-bar/filter-bar.model';

export interface PaymentMethodMaster {
  id: number;
  name: string;
  code: string;
}

@Component({
  selector: 'coms-receipt-payment',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    RouterLinkActive,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    DataTableComponent,
    FilterBarComponent,
    TranslatePipe,
  ],
  templateUrl: './receipt-payment.html',
  styleUrl: './receipt-payment.scss',
})
export class ReceiptPaymentComponent implements OnInit {
  private expenseService = inject(ExpenseService);
  private masterLookup = inject(MasterLookupService);
  private notification = inject(NotificationService);
  currencyService = inject(CurrencyService);
  authService = inject(AuthService);
  languageService = inject(LanguageService);
  translate = inject(TranslateService);

  readonly todayHeader = DatepickerTodayHeaderComponent;

  @ViewChild('typeTpl', { static: true }) typeTpl!: TemplateRef<unknown>;
  @ViewChild('headTpl', { static: true }) headTpl!: TemplateRef<unknown>;
  @ViewChild('modeTpl', { static: true }) modeTpl!: TemplateRef<unknown>;
  @ViewChild('amountTpl', { static: true }) amountTpl!: TemplateRef<unknown>;
  @ViewChild('actionsTpl', { static: true }) actionsTpl!: TemplateRef<unknown>;

  cellTemplates: Record<string, TemplateRef<unknown>> = {};

  // Selected Working Date (Defaults to Today)
  selectedDate = signal<Date>(new Date());

  selectedDateStr = computed(() => {
    const d = this.selectedDate();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });

  selectedMonthYear = computed(() => {
    const d = this.selectedDate();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });

  // Master Data Signals
  accountHeads = signal<AccountHead[]>([]);
  paymentMethods = signal<PaymentMethodMaster[]>([]);

  // Transactions State
  transactions = signal<ChurchExpenseTransaction[]>([]);
  total = signal(0);
  loading = signal<boolean>(false);
  submitting = signal<boolean>(false);
  selectedPreviewId = signal<number | null>(null);
  editingTxId = signal<number | null>(null);

  // DataTable & Filtering Signals
  pageIndex = signal(0);
  pageSize = signal(25);
  search = signal('');
  sort = signal<DataTableSort>({ active: 'entry_date', direction: 'desc' });
  filters = signal<Record<string, string>>({});

  filterFields = computed<FilterFieldDef[]>(() => {
    const heads = this.accountHeads().filter((h) => h.is_active);
    const methods = this.paymentMethods();
    const isTa = this.languageService.isTamil();

    return [
      {
        key: 'dateRange',
        label: 'receiptPayment.entryDate',
        type: 'dateRange',
      },
      {
        key: 'type',
        label: 'receiptPayment.type',
        type: 'select',
        options: [
          { value: 'receipt', label: isTa ? 'வரவு (Receipt)' : 'Receipt' },
          { value: 'payment', label: isTa ? 'பற்று (Payment)' : 'Payment' },
        ],
      },
      {
        key: 'headId',
        label: 'receiptPayment.basedOn',
        type: 'select',
        options: heads.map((h) => ({
          value: h.id,
          label: isTa && h.tamil_name ? h.tamil_name : `${h.name}${h.tamil_name ? ' (' + h.tamil_name + ')' : ''}`,
        })),
      },
      {
        key: 'paymentMethodCode',
        label: 'receiptPayment.paymentMode',
        type: 'select',
        options: methods.length > 0
          ? methods.map((m) => ({ value: m.code, label: m.name }))
          : [
              { value: 'CASH', label: 'Cash' },
              { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
              { value: 'UPI', label: 'UPI' },
              { value: 'CHEQUE', label: 'Cheque' },
            ],
      },
    ];
  });

  columns: DataTableColumn<ChurchExpenseTransaction>[] = [
    {
      key: 'entry_date',
      label: 'receiptPayment.entryDate',
      sortable: true,
      accessor: (r) => formatDateDMY(r.entry_date),
    },
    {
      key: 'type',
      label: 'receiptPayment.type',
      sortable: true,
    },
    {
      key: 'head_name',
      label: 'receiptPayment.basedOn',
      sortable: true,
    },
    {
      key: 'payment_method_name',
      label: 'receiptPayment.paymentMode',
      sortable: true,
    },
    {
      key: 'voucher_no',
      label: 'receiptPayment.voucherNo',
      sortable: true,
      accessor: (r) => r.voucher_no || '—',
    },
    {
      key: 'paid_to',
      label: 'receiptPayment.payerOrPayee',
      sortable: true,
      accessor: (r) => r.paid_to || '—',
    },
    {
      key: 'notes',
      label: 'receiptPayment.remarks',
      accessor: (r) => r.notes || '—',
    },
    {
      key: 'amount',
      label: 'receiptPayment.amount',
      align: 'right',
      sortable: true,
    },
    {
      key: 'actions',
      label: 'common.actions',
      align: 'center',
    },
  ];

  // Form State
  form = signal<{
    entryDate: string;
    type: 'receipt' | 'payment';
    headId: number | null;
    headName: string;
    amount: number | null;
    paymentModeCode: string;
    paymentMethodId: number | null;
    voucherNo: string;
    paidTo: string;
    notes: string;
  }>({
    entryDate: this.toDateOnlyString(new Date()),
    type: 'receipt',
    headId: null,
    headName: '',
    amount: null,
    paymentModeCode: 'CASH',
    paymentMethodId: null,
    voucherNo: '',
    paidTo: '',
    notes: '',
  });

  // Grouped Heads based on currently selected form type
  groupedHeadsForType = computed(() => {
    const t = this.form().type;
    const heads = this.accountHeads().filter((h) => h.type === t && h.is_active);
    const groups: { [key: string]: AccountHead[] } = {};

    for (const h of heads) {
      const sec = h.section || (t === 'receipt' ? 'General Receipts' : 'General Payments');
      if (!groups[sec]) {
        groups[sec] = [];
      }
      groups[sec].push(h);
    }

    return Object.keys(groups).map((sec) => ({
      section: sec,
      items: groups[sec].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)),
    }));
  });

  // Active church info
  currentChurchName = computed(() => {
    return (
      this.authService.activeChurchBranch()?.churchName ||
      this.authService.currentUser()?.churchName ||
      "St. Mary's Church"
    );
  });

  // Computed Selected Preview Transaction
  selectedPreviewTx = computed(() => {
    const id = this.selectedPreviewId();
    if (!id) return null;
    return this.transactions().find((t) => t.id === id) || null;
  });

  // Computed summary statistics for the selected date
  summaryStats = computed(() => {
    const txs = this.transactions();
    let totalReceipts = 0;
    let totalPayments = 0;
    let cashCount = 0;
    let bankCount = 0;
    let upiCount = 0;

    for (const t of txs) {
      const amt = Number(t.amount) || 0;
      if (t.type === 'receipt') {
        totalReceipts += amt;
      } else {
        totalPayments += amt;
      }

      const mode = (t.payment_method_code || '').toUpperCase();
      if (mode === 'CASH') cashCount++;
      else if (mode === 'BANK_TRANSFER' || mode === 'CHEQUE') bankCount++;
      else if (mode === 'UPI') upiCount++;
    }

    return {
      totalReceipts,
      totalPayments,
      netCashflow: totalReceipts - totalPayments,
      count: txs.length,
      cashCount,
      bankCount,
      upiCount,
    };
  });

  ngOnInit(): void {
    this.cellTemplates = {
      type: this.typeTpl,
      head_name: this.headTpl,
      payment_method_name: this.modeTpl,
      amount: this.amountTpl,
      actions: this.actionsTpl,
    };
    this.loadPaymentMethods();
    this.loadAccountHeads();
    this.fetchTransactions();
  }

  onFiltersChange(newFilters: Record<string, string>): void {
    this.filters.set(newFilters || {});
    this.pageIndex.set(0);
    this.fetchTransactions();
  }

  onSearchChange(term: string): void {
    this.search.set(term);
    this.pageIndex.set(0);
    this.fetchTransactions();
  }

  onSortChange(s: DataTableSort): void {
    this.sort.set(s);
    this.fetchTransactions();
  }

  onPageChange(e: { pageIndex: number; pageSize: number }): void {
    this.pageIndex.set(e.pageIndex);
    this.pageSize.set(e.pageSize);
    this.fetchTransactions();
  }

  private toDateOnlyString(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  onDateChange(date: Date | null): void {
    if (!date) return;
    this.selectedDate.set(date);
    const dateStr = this.toDateOnlyString(date);
    this.form.update((f) => ({ ...f, entryDate: dateStr }));
    // Clear dateRange filter so single-day focus takes over
    if (this.filters()['dateFrom'] || this.filters()['dateTo']) {
      this.filters.update((curr) => {
        const { dateFrom, dateTo, ...rest } = curr;
        return rest;
      });
    }
    this.pageIndex.set(0);
    this.fetchTransactions();
  }

  prevDay(): void {
    const d = new Date(this.selectedDate());
    d.setDate(d.getDate() - 1);
    this.onDateChange(d);
  }

  nextDay(): void {
    const d = new Date(this.selectedDate());
    d.setDate(d.getDate() + 1);
    this.onDateChange(d);
  }

  today(): void {
    this.onDateChange(new Date());
  }

  loadPaymentMethods(): void {
    this.masterLookup.list<PaymentMethodMaster>('payment_methods').subscribe({
      next: (methods) => {
        this.paymentMethods.set(methods || []);
        const cashMethod = methods.find((m) => m.code === 'CASH');
        if (cashMethod && !this.form().paymentMethodId) {
          this.form.update((f) => ({
            ...f,
            paymentModeCode: 'CASH',
            paymentMethodId: cashMethod.id,
          }));
        }
      },
      error: (err) => console.error('Error fetching payment methods', err),
    });
  }

  loadAccountHeads(): void {
    this.expenseService.getAccountHeads().subscribe({
      next: (heads) => this.accountHeads.set(heads || []),
      error: (err) => console.error('Error fetching heads', err),
    });
  }

  fetchTransactions(): void {
    this.loading.set(true);
    const f = this.filters();
    const dateFrom = f['dateFrom'] || this.selectedDateStr();
    const dateTo = f['dateTo'] || this.selectedDateStr();
    const type = f['type'] || undefined;
    const headId = f['headId'] ? Number(f['headId']) : undefined;
    const paymentMethodCode = f['paymentMethodCode'] || undefined;
    const search = this.search().trim() || undefined;

    this.expenseService
      .listTransactions({
        dateFrom,
        dateTo,
        type,
        headId,
        paymentMethodCode,
        search,
        page: this.pageIndex() + 1,
        limit: this.pageSize(),
        branchId: this.authService.activeChurchBranch()?.branchId,
      })
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          let list = res.rows || [];

          // Client-side safeguard filtering (ensures instantaneous response)
          if (search) {
            const s = search.toLowerCase();
            list = list.filter((t) =>
              (t.voucher_no && t.voucher_no.toLowerCase().includes(s)) ||
              (t.paid_to && t.paid_to.toLowerCase().includes(s)) ||
              (t.notes && t.notes.toLowerCase().includes(s)) ||
              (t.head_name && t.head_name.toLowerCase().includes(s)) ||
              (t.account_head_name && t.account_head_name.toLowerCase().includes(s)) ||
              (t.account_head_tamil_name && t.account_head_tamil_name.toLowerCase().includes(s)) ||
              String(t.amount).includes(s)
            );
          }
          if (paymentMethodCode) {
            const pm = paymentMethodCode.toUpperCase();
            list = list.filter((t) => (t.payment_method_code || '').toUpperCase() === pm);
          }
          if (type) {
            list = list.filter((t) => t.type === type);
          }
          if (headId) {
            list = list.filter((t) => t.head_id === headId);
          }

          this.transactions.set(list);
          this.total.set(search || paymentMethodCode || type || headId ? list.length : (res.total ?? list.length));

          // If previously selected item is still in list, keep it; otherwise select the first item or null
          if (this.selectedPreviewId()) {
            const exists = list.some((t) => t.id === this.selectedPreviewId());
            if (!exists) {
              this.selectedPreviewId.set(list.length > 0 ? list[0].id : null);
            }
          } else if (list.length > 0) {
            this.selectedPreviewId.set(list[0].id);
          }
        },
        error: (err) => {
          this.loading.set(false);
          console.error('Error fetching transactions', err);
        },
      });
  }

  setType(type: 'receipt' | 'payment'): void {
    this.form.update((f) => ({
      ...f,
      type,
      headId: null,
      headName: '',
    }));
  }

  onHeadChange(headId: number | null): void {
    const head = this.accountHeads().find((h) => h.id === headId);
    this.form.update((f) => ({
      ...f,
      headId: headId,
      headName: head ? head.name : '',
    }));
  }

  setPaymentMode(code: string): void {
    const matched = this.paymentMethods().find((m) => m.code === code);
    this.form.update((f) => ({
      ...f,
      paymentModeCode: code,
      paymentMethodId: matched ? matched.id : null,
    }));
  }

  onPreviewSelect(txId: number | null): void {
    this.selectedPreviewId.set(txId);
  }

  selectTxToPreview(tx: ChurchExpenseTransaction): void {
    this.selectedPreviewId.set(tx.id);
    const el = document.getElementById('preview-voucher-card');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  resetForm(): void {
    this.editingTxId.set(null);
    const dateStr = this.selectedDateStr();
    const cashMethod = this.paymentMethods().find((m) => m.code === 'CASH');
    this.form.set({
      entryDate: dateStr,
      type: 'receipt',
      headId: null,
      headName: '',
      amount: null,
      paymentModeCode: 'CASH',
      paymentMethodId: cashMethod ? cashMethod.id : null,
      voucherNo: '',
      paidTo: '',
      notes: '',
    });
  }

  editTransaction(tx: ChurchExpenseTransaction): void {
    this.editingTxId.set(tx.id);
    const mode = tx.payment_method_code ? tx.payment_method_code.toUpperCase() : 'CASH';
    const pm = this.paymentMethods().find((m) => m.code === mode);
    this.form.set({
      entryDate: tx.entry_date,
      type: tx.type,
      headId: tx.head_id ?? null,
      headName: tx.account_head_name || tx.head_name || '',
      amount: Number(tx.amount) || null,
      paymentModeCode: mode,
      paymentMethodId: tx.payment_method_id ?? (pm ? pm.id : null),
      voucherNo: tx.voucher_no || '',
      paidTo: tx.paid_to || '',
      notes: tx.notes || '',
    });
    this.selectedPreviewId.set(tx.id);
    const el = document.getElementById('entry-form-card');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  cancelEdit(): void {
    this.resetForm();
  }

  submitSave(): void {
    const f = this.form();
    if (!f.amount || f.amount <= 0) {
      this.notification.warning('Please enter a valid amount greater than 0.');
      return;
    }

    let headName = f.headName;
    if (f.headId) {
      const h = this.accountHeads().find((item) => item.id === f.headId);
      if (h) headName = h.name;
    } else if (!headName) {
      headName = f.type === 'receipt' ? 'General Receipt' : 'General Payment';
    }

    let pmId = f.paymentMethodId;
    if (!pmId && f.paymentModeCode) {
      const pm = this.paymentMethods().find((m) => m.code === f.paymentModeCode);
      if (pm) pmId = pm.id;
    }

    this.submitting.set(true);

    if (this.editingTxId()) {
      const txId = this.editingTxId()!;
      this.expenseService
        .updateTransaction(txId, {
          entryDate: f.entryDate,
          type: f.type,
          headId: f.headId,
          headName: headName,
          amount: Number(f.amount),
          paymentMethodId: pmId || null,
          voucherNo: f.voucherNo.trim() || null,
          paidTo: f.paidTo.trim() || null,
          notes: f.notes.trim() || null,
        })
        .subscribe({
          next: () => {
            this.submitting.set(false);
            this.notification.success('Transaction updated successfully.');
            this.editingTxId.set(null);
            this.fetchTransactions();
            this.resetForm();
          },
          error: (err) => {
            this.submitting.set(false);
            console.error('Error updating transaction', err);
            this.notification.error(err?.error?.message || 'Failed to update transaction.');
          },
        });
      return;
    }

    this.expenseService
      .createTransaction({
        entryDate: f.entryDate,
        type: f.type,
        headId: f.headId,
        headName: headName,
        amount: Number(f.amount),
        paymentMethodId: pmId || null,
        voucherNo: f.voucherNo.trim() || null,
        paidTo: f.paidTo.trim() || null,
        notes: f.notes.trim() || null,
        branchId: this.authService.activeChurchBranch()?.branchId || null,
      })
      .subscribe({
        next: (created) => {
          this.submitting.set(false);
          this.notification.success(
            `${f.type === 'receipt' ? 'Receipt' : 'Payment'} of ₹${Number(f.amount).toLocaleString('en-IN')} saved successfully.`
          );

          // Update transactions and select new record in dropdown
          this.fetchTransactions();
          if (created && created.id) {
            this.selectedPreviewId.set(created.id);
          }

          // Clear amount & notes but retain date & head for quick successive entry
          this.form.update((prev) => ({
            ...prev,
            amount: null,
            voucherNo: '',
            paidTo: '',
            notes: '',
          }));
        },
        error: (err) => {
          this.submitting.set(false);
          console.error('Error saving transaction', err);
          this.notification.error(err?.error?.message || 'Failed to save transaction entry.');
        },
      });
  }

  printTransactionVoucher(tx: ChurchExpenseTransaction): void {
    this.selectedPreviewId.set(tx.id);
    setTimeout(() => {
      window.print();
    }, 150);
  }

  deleteTransaction(id: number): void {
    const confirmMsg = this.translate.instant('expenses.deleteConfirm') || 'Are you sure you want to delete this transaction entry?';
    if (!confirm(confirmMsg)) return;

    this.expenseService.deleteTransaction(id).subscribe({
      next: () => {
        this.notification.success('Transaction entry deleted.');
        if (this.selectedPreviewId() === id) {
          this.selectedPreviewId.set(null);
        }
        this.fetchTransactions();
      },
      error: (err) => {
        console.error('Error deleting transaction', err);
        this.notification.error('Failed to delete transaction.');
      },
    });
  }

  printVoucher(): void {
    window.print();
  }

  printSelectedDayReport(): void {
    const dateStr = this.selectedDateStr();
    const url = this.expenseService.getDailyPrintUrl(dateStr, this.languageService.current());
    window.open(url, '_blank');
  }

  printOverallMonthlyReport(): void {
    const my = this.selectedMonthYear();
    const url = this.expenseService.getMonthlyPrintUrl(my, this.languageService.current());
    window.open(url, '_blank');
  }

  printDaywiseMonthReport(): void {
    const my = this.selectedMonthYear();
    const url = this.expenseService.getDaywiseMonthPrintUrl(my, this.languageService.current());
    window.open(url, '_blank');
  }

  formatCurrency(val: number | string | null | undefined): string {
    const num = Number(val) || 0;
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  getPaymentMethodIcon(code?: string | null): string {
    const c = (code || '').toUpperCase();
    if (c === 'CASH') return 'payments';
    if (c === 'UPI') return 'qr_code_2';
    if (c === 'BANK_TRANSFER' || c === 'CHEQUE') return 'account_balance';
    return 'credit_card';
  }

  getPaymentMethodLabel(code?: string | null): string {
    const c = (code || '').toUpperCase();
    if (c === 'CASH') return 'Cash in Hand';
    if (c === 'UPI') return 'Online / UPI';
    if (c === 'BANK_TRANSFER') return 'Bank Transfer';
    if (c === 'CHEQUE') return 'Cheque';
    return code || 'Cash';
  }
}
