export interface AppUser {
  id: number;
  church_id: number;
  branch_id: number | null;
  role_id: number;
  employee_code: string | null;
  full_name: string;
  username: string;
  email: string | null;
  phone: string | null;
  must_change_password: number;
  last_login_at: string | null;
  is_active: number;
  role_name: string;
  role_code: string;
  church_name: string | null;
}

export interface CreateUserRequest {
  full_name: string;
  username: string;
  email?: string;
  phone?: string;
  role_id: number;
  church_id: number;
  branch_id?: number | null;
  employee_code?: string;
}

export type UpdateUserRequest = Partial<Omit<CreateUserRequest, 'username'>>;
