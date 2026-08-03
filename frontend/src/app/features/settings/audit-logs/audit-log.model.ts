export interface AuditLog {
  id: number;
  user_id: number | null;
  username_snapshot: string | null;
  action: string;
  module: string;
  entity_type: string | null;
  entity_id: number | null;
  old_values: string | null;
  new_values: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}
