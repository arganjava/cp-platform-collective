/**
 * Supabase database schema types.
 *
 * These mirror the tables created by `supabase/setup.sql`. Regenerate from the
 * Supabase CLI (`supabase gen types typescript`) if the schema changes.
 */

export interface ProfileRow {
  id: string;
  auth_user_id: string | null;
  name: string;
  email: string;
  avatar_color: string | null;
  role: string;
  avatar_url: string | null;
  created_at: string;
  deleted_at: string | null;
}

export interface ProjectRow {
  id: string;
  title: string;
  description: string;
  status: string;
  color: string | null;
  owner_id: string | null;
  member_ids: string[] | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

export interface TaskRow {
  id: string;
  project_id: string | null;
  title: string;
  description: string;
  status: string;
  priority: string;
  assignee_id: string | null;
  start_date: string | null;
  due_date: string | null;
  tags: string[] | null;
  sort_order: number;
  created_at: string;
}

export interface SaleRow {
  id: string;
  project_id: string | null;
  amount: number;
  client_name: string;
  type: string;
  date: string | null;
  notes: string;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  user_id: string | null;
  message: string;
  type: string;
  is_read: boolean;
  related_id: string | null;
  created_at: string;
}

export type Database = {
  public: {
    Tables: {
      profiles: { Row: ProfileRow; Insert: Partial<ProfileRow>; Update: Partial<ProfileRow>; Relationships: [] };
      projects: { Row: ProjectRow; Insert: Partial<ProjectRow>; Update: Partial<ProjectRow>; Relationships: [] };
      tasks: { Row: TaskRow; Insert: Partial<TaskRow>; Update: Partial<TaskRow>; Relationships: [] };
      sales: { Row: SaleRow; Insert: Partial<SaleRow>; Update: Partial<SaleRow>; Relationships: [] };
      notifications: { Row: NotificationRow; Insert: Partial<NotificationRow>; Update: Partial<NotificationRow>; Relationships: [] };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
