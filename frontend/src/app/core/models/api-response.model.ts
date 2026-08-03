export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiListMeta {
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiListResponse<T> {
  success: boolean;
  data: T[];
  meta: ApiListMeta;
}
