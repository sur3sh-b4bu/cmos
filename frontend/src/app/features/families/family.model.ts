export type FamilyStatus = 'ACTIVE' | 'MIGRATED_OUT' | 'MIGRATED_IN' | 'DIVIDED' | 'INACTIVE';

export type RelationshipToHead =
  | 'HEAD'
  | 'SPOUSE'
  | 'SON'
  | 'DAUGHTER'
  | 'FATHER'
  | 'MOTHER'
  | 'BROTHER'
  | 'SISTER'
  | 'GRANDFATHER'
  | 'GRANDMOTHER'
  | 'SON_IN_LAW'
  | 'DAUGHTER_IN_LAW'
  | 'GRANDSON'
  | 'GRANDDAUGHTER'
  | 'OTHER';

export type MaritalStatus = 'SINGLE' | 'MARRIED' | 'WIDOWED' | 'DIVORCED' | 'CLERGY';

export interface Ward {
  id: number;
  church_id: number;
  branch_id?: number | null;
  name: string;
  name_ta?: string | null;
  code?: string | null;
  leader_name?: string | null;
  leader_phone?: string | null;
  sort_order?: number;
}

export interface FamilyMember {
  id?: number;
  church_id?: number;
  family_id?: number;
  first_name: string;
  last_name?: string | null;
  name_ta?: string | null;
  relationship_to_head: RelationshipToHead;
  gender: 'M' | 'F' | 'OTHER';
  dob?: string | null;
  age?: number | null;
  phone?: string | null;
  email?: string | null;
  blood_group?: string | null;
  occupation?: string | null;
  education?: string | null;
  marital_status?: MaritalStatus;
  is_baptised?: boolean | number;
  baptism_date?: string | null;
  baptism_certificate_no?: string | null;
  is_communion_received?: boolean | number;
  communion_date?: string | null;
  is_confirmed?: boolean | number;
  confirmation_date?: string | null;
  marriage_date?: string | null;
  marriage_certificate_no?: string | null;
  is_alive?: boolean | number;
  deceased_date?: string | null;
  is_head?: boolean | number;
  notes?: string | null;
}

export interface FamilyEvent {
  id: number;
  family_id: number;
  member_id?: number | null;
  event_type: 'CREATED' | 'MEMBER_ADDED' | 'MEMBER_UPDATED' | 'MEMBER_REMOVED' | 'FAMILY_SPLIT' | 'MIGRATED_OUT' | 'MIGRATED_IN' | 'HEAD_CHANGED' | 'STATUS_CHANGED' | 'DECEASED';
  description: string;
  details_json?: any;
  created_at: string;
  created_by_name?: string;
}

export interface Family {
  id: number;
  church_id: number;
  branch_id?: number | null;
  family_code: string;
  family_name: string;
  family_name_ta?: string | null;
  ward_id?: number | null;
  ward_name?: string | null;
  ward_name_ta?: string | null;
  head_member_id?: number | null;
  head_first_name?: string | null;
  head_last_name?: string | null;
  head_phone?: string | null;
  head_gender?: string | null;
  parent_family_id?: number | null;
  parent_family_code?: string | null;
  parent_family_name?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  address_ta?: string | null;
  city?: string | null;
  pincode?: string | null;
  phone?: string | null;
  email?: string | null;
  marriage_date?: string | null;
  status: FamilyStatus;
  migration_date?: string | null;
  migration_reason?: string | null;
  migrated_to_parish?: string | null;
  migrated_from_parish?: string | null;
  remarks?: string | null;
  created_at: string;
  total_members?: number;
  male_members?: number;
  female_members?: number;
  members?: FamilyMember[];
  events?: FamilyEvent[];
}

export interface CensusStats {
  families: {
    total_families: number;
    active_families: number;
    migrated_families: number;
    divided_families: number;
  };
  members: {
    total_souls: number;
    male_count: number;
    female_count: number;
    children_count: number;
    married_count: number;
    single_count: number;
    baptised_count: number;
    confirmed_count: number;
  };
  wards: {
    ward_id: number;
    ward_name: string;
    ward_name_ta?: string;
    family_count: number;
    member_count: number;
  }[];
}
