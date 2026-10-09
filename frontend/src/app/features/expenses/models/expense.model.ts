export interface AccountHead {
  id: number;
  church_id?: number | null;
  type: 'receipt' | 'payment';
  section: string;
  name: string;
  tamil_name?: string | null;
  code?: string | null;
  is_system?: boolean | number;
  auto_source?: string | null;
  order_index?: number;
  is_active?: boolean | number;
}

export interface LedgerItem {
  id?: number;
  code?: string;
  section: string;
  name: string;
  tamil_name?: string;
  type: 'receipt' | 'payment';
  auto_source?: string | null;
  is_auto: boolean;
  auto_amount: number;
  manual_amount: number;
  amount: number;
  order_index?: number;
  notes?: string;
  voucher_no?: string;
  paid_to?: string;
}

export interface MonthlyAbstract {
  id?: number;
  church_id?: number;
  branch_id?: number | null;
  month_year: string;
  opening_cash_hand: number;
  opening_cash_bank: number;
  opening_fixed_deposits: number;
  closing_cash_hand: number;
  closing_cash_bank: number;
  closing_fixed_deposits: number;
  receipts_specific_project: number;
  payments_specific_project: number;
  remit_stole_fees: number;
  remit_mass_intentions: number;
  remit_parish_contribution: number;
  remit_diocesan_collection: number;
  recv_monthly_allowance: number;
  recv_medical_allowance: number;
  recv_mission_conveyance: number;
  recv_any_other: number;
  priest_name?: string;
  designation?: string;
  unit_no?: string;
  notes?: string;
}

export interface MonthlyAccountsResponse {
  monthYear: string;
  churchId: number;
  branchId?: number | null;
  startDate: string;
  endDate: string;
  receipts: LedgerItem[];
  payments: LedgerItem[];
  totalReceipts: number;
  totalPayments: number;
  abstract: MonthlyAbstract;
  autoAggregates: {
    massIntentionsOffering: number;
    massIntentionsCount: number;
    contributionsByType: Record<string, number>;
  };
  prevMonthClosing: {
    cashHand: number;
    cashBank: number;
    fixedDeposits: number;
  };
}

export interface ChurchExpenseTransaction {
  id: number;
  church_id: number;
  branch_id?: number | null;
  entry_date: string;
  month_year: string;
  type: 'receipt' | 'payment';
  head_id?: number | null;
  head_name: string;
  account_head_name?: string;
  account_head_tamil_name?: string;
  section?: string;
  amount: number;
  payment_method_id?: number | null;
  payment_method_name?: string;
  payment_method_code?: string;
  voucher_no?: string | null;
  paid_to?: string | null;
  notes?: string | null;
  created_by?: number | null;
  created_by_name?: string | null;
  created_at: string;
}
