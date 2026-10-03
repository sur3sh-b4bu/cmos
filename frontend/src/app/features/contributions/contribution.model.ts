export interface Contribution {
  id: number;
  church_id: number;
  branch_id: number | null;
  receipt_no: string;
  name: string;
  phone: string | null;
  contribution_type_id: number | null;
  contribution_type_name: string | null;
  contribution_type_name_ta: string | null;
  contribution_type_is_custom: 0 | 1;
  custom_contribution_type: string | null;
  contribution_amount: string;
  payment_method_id: number | null;
  payment_method_name: string | null;
  remarks: string | null;
  is_paid: 0 | 1;
  paid_via: 'cash' | 'upi' | 'cheque' | 'bank_transfer' | 'other' | null;
  payment_reference_number: string | null;
  payment_date: string | null;
  payment_remarks: string | null;
  is_refunded: 0 | 1;
  refunded_at: string | null;
  refund_reason: string | null;
  refund_amount: string | number | null;
  created_by_name: string | null;
  created_at: string;
}

export interface CreateContributionRequest {
  name: string;
  phone?: string;
  contributionTypeId?: number | null;
  customContributionType?: string;
  contributionAmount: number;
  paymentMethodId?: number | null;
  remarks?: string;
}

export type UpdateContributionRequest = Partial<CreateContributionRequest>;

export interface ReceiveContributionPaymentRequest {
  method: 'cash' | 'upi' | 'cheque' | 'bank_transfer' | 'other';
  referenceNumber?: string;
  remarks?: string;
  paymentDate?: string;
}
