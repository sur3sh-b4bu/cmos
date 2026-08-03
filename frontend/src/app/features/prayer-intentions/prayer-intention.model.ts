export interface PrayerIntention {
  id: number;
  church_id: number;
  branch_id: number | null;
  receipt_no: string;
  name: string;
  phone: string | null;
  prayer_date: string;
  mass_id: number;
  mass_name: string;
  mass_time: string;
  day_type: string;
  prayer_intention_master_id: number | null;
  intention_master_name: string | null;
  intention_is_custom: number;
  custom_intention: string | null;
  offering_amount: string;
  payment_method_id: number | null;
  payment_method_name: string | null;
  remarks: string | null;
  status_id: number;
  status_code: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  status_label: string;
  status_color: string;
  completed_at: string | null;
  created_by_name: string | null;
  created_at: string;
}

export interface CreatePrayerIntentionRequest {
  name: string;
  phone?: string;
  prayerDate: string;
  massId: number;
  prayerIntentionMasterId?: number | null;
  customIntention?: string;
  offeringAmount: number;
  paymentMethodId?: number | null;
  remarks?: string;
  allowDuplicate?: boolean;
}

export type UpdatePrayerIntentionRequest = Partial<CreatePrayerIntentionRequest>;

export interface DashboardStats {
  todayCount: number;
  todayCollections: number;
  pendingCount: number;
  monthlyCollections: number;
  upcoming: PrayerIntention[];
}
