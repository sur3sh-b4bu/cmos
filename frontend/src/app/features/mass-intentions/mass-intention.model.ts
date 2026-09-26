export interface MassIntention {
  id: number;
  church_id: number;
  branch_id: number | null;
  receipt_no: string;
  name: string;
  /** Who came to the office and made the booking -- can differ from `name`
   * (who the Mass is offered for/by). Shown in the list and printed on the
   * receipt only -- see mass-intention-form.ts / receiptPdf.js. */
  booked_by: string | null;
  phone: string | null;
  prayer_date: string;
  mass_id: number;
  mass_name: string;
  /** Tamil name of the Mass, if set via Masters > Masses -- see
   * localized-name.util.ts. Null falls back to `mass_name`. */
  mass_name_ta: string | null;
  mass_time: string;
  day_type: string;
  prayer_intention_master_id: number | null;
  intention_master_name: string | null;
  /** Tamil name of the intention preset, if set via Masters > Mass Intention
   * Presets -- see localized-name.util.ts. Null falls back to
   * `intention_master_name`. Meaningless when intention_is_custom (there's
   * no preset row at all in that case). */
  intention_master_name_ta: string | null;
  intention_is_custom: number;
  custom_intention: string | null;
  offering_amount: string;
  payment_method_id: number | null;
  payment_method_name: string | null;
  remarks: string | null;
  is_paid: 0 | 1;
  paid_via: 'cash' | 'upi' | 'cheque' | 'bank_transfer' | 'other' | null;
  payment_reference_number: string | null;
  payment_date: string | null;
  payment_remarks: string | null;
  created_by_name: string | null;
  created_at: string;
}

export interface CreateMassIntentionRequest {
  name: string;
  bookedBy?: string;
  phone?: string;
  prayerDate: string;
  massId: number;
  prayerIntentionMasterId?: number | null;
  customIntention?: string;
  offeringAmount: number;
  paymentMethodId?: number | null;
  remarks?: string;
  allowDuplicate?: boolean;
  /** Set only by the Bulk Mass Intention form -- see its own bulkBatchId comment. */
  bulkBatchId?: string;
}

export type UpdateMassIntentionRequest = Partial<CreateMassIntentionRequest>;

/** One row per Bulk Mass Intention save -- backs "Show Bulk Mass
 * Intentions" (see mass-intentions-list.ts). */
export interface BulkBatch {
  batchId: string;
  createdAt: string;
  bookedBy: string | null;
  phone: string | null;
  count: number;
  total: number;
  paidCount: number;
}

export interface DashboardAnnouncement {
  id: number;
  title: string;
  body: string | null;
  start_date: string | null;
  end_date: string | null;
  /** 'permanent' never auto-expires (end_date is ignored) -- see
   * lookupRepository.getActiveAnnouncements. Only permanent ones get a
   * remove button on the Dashboard itself; temporary ones self-expire. */
  status: 'permanent' | 'temporary';
}

export interface DashboardRestrictedDate {
  id: number;
  name: string;
  date: string;
  isRecurringYearly: boolean;
}

export interface DashboardStats {
  todayCount: number;
  todayCollections: number;
  pendingCount: number;
  monthlyCollections: number;
  todayContributions: number;
  monthlyContributions: number;
  upcoming: MassIntention[];
  collectionsTrend: { date: string; total: number }[];
  intentionsByMass: { massName: string; count: number }[];
  announcements: DashboardAnnouncement[];
  upcomingRestrictedDates: DashboardRestrictedDate[];
}

export interface ReceivePaymentRequest {
  method: 'cash' | 'upi' | 'cheque' | 'bank_transfer' | 'other';
  referenceNumber?: string;
  remarks?: string;
  paymentDate?: string;
}
