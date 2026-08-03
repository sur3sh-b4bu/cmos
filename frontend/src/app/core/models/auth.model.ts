export interface CurrentUser {
  id: number;
  username: string;
  fullName?: string;
  email?: string | null;
  phone?: string | null;
  roleId: number;
  roleCode: string;
  roleName?: string;
  churchId: number;
  branchId?: number | null;
  mustChangePassword?: boolean;
  permissions: string[];
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponseData {
  accessToken: string;
  user: CurrentUser;
}
