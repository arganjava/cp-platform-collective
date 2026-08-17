import { getSupabase } from "./client";
import type {
  ProfileRow,
  ProjectRow,
  TaskRow,
  SaleRow,
  NotificationRow,
} from "./types";
import type {
  User,
  Project,
  Task,
  Sale,
  Notification,
  TaskStatus,
  Priority,
  ProjectStatus,
  SaleType,
} from "../types";

type RowResult<T> = { data: T | null; error: { message: string } | null };

function unwrap<T>(result: RowResult<T>, label: string): T {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data as T;
}

/* ─────────────────────────── Row → app type ─────────────────────────── */

export function fromProfileRow(r: ProfileRow): User {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    avatarColor: r.avatar_color ?? "var(--primary)",
    role: (r.role as User["role"]) ?? "member",
    avatarUrl: r.avatar_url ?? undefined,
  };
}

export function fromProjectRow(r: ProjectRow): Project {
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? "",
    status: (r.status as ProjectStatus) || "active",
    color: r.color ?? "var(--primary)",
    ownerId: r.owner_id ?? "",
    memberIds: r.member_ids ?? [],
    startDate: r.start_date ?? "",
    endDate: r.end_date ?? "",
    createdAt: r.created_at ?? new Date().toISOString(),
  };
}

export function fromTaskRow(r: TaskRow): Task {
  return {
    id: r.id,
    projectId: r.project_id ?? "",
    title: r.title,
    description: r.description ?? "",
    status: (r.status as TaskStatus) || "todo",
    priority: (r.priority as Priority) || "medium",
    assigneeId: r.assignee_id ?? null,
    startDate: r.start_date ?? "",
    dueDate: r.due_date ?? "",
    tags: r.tags ?? [],
    createdAt: r.created_at ?? new Date().toISOString(),
    order: r.sort_order ?? 0,
  };
}

export function fromSaleRow(r: SaleRow): Sale {
  return {
    id: r.id,
    projectId: r.project_id ?? "",
    amount: Number(r.amount) || 0,
    clientName: r.client_name ?? "",
    type: (r.type as SaleType) || "commission",
    date: r.date ?? "",
    notes: r.notes ?? "",
    createdAt: r.created_at ?? new Date().toISOString(),
  };
}

export function fromNotificationRow(r: NotificationRow): Notification {
  return {
    id: r.id,
    userId: r.user_id ?? "",
    message: r.message,
    type: (r.type as Notification["type"]) || "update",
    isRead: r.is_read ?? false,
    relatedId: r.related_id ?? undefined,
    createdAt: r.created_at ?? new Date().toISOString(),
  };
}

/* ─────────────────────── app type → DB columns ─────────────────────── */

export function projectColumns(p: Partial<Project>): Record<string, unknown> {
  const cols: Record<string, unknown> = {};
  if (p.id !== undefined) cols.id = p.id;
  if (p.title !== undefined) cols.title = p.title;
  if (p.description !== undefined) cols.description = p.description;
  if (p.status !== undefined) cols.status = p.status;
  if (p.color !== undefined) cols.color = p.color;
  if (p.ownerId !== undefined) cols.owner_id = p.ownerId || null;
  if (p.memberIds !== undefined) cols.member_ids = p.memberIds;
  if (p.startDate !== undefined) cols.start_date = p.startDate || null;
  if (p.endDate !== undefined) cols.end_date = p.endDate || null;
  return cols;
}

export function taskColumns(t: Partial<Task>): Record<string, unknown> {
  const cols: Record<string, unknown> = {};
  if (t.id !== undefined) cols.id = t.id;
  if (t.projectId !== undefined) cols.project_id = t.projectId || null;
  if (t.title !== undefined) cols.title = t.title;
  if (t.description !== undefined) cols.description = t.description;
  if (t.status !== undefined) cols.status = t.status;
  if (t.priority !== undefined) cols.priority = t.priority;
  if (t.assigneeId !== undefined) cols.assignee_id = t.assigneeId || null;
  if (t.startDate !== undefined) cols.start_date = t.startDate || null;
  if (t.dueDate !== undefined) cols.due_date = t.dueDate || null;
  if (t.tags !== undefined) cols.tags = t.tags;
  if (t.order !== undefined) cols.sort_order = t.order;
  return cols;
}

export function saleColumns(s: Partial<Sale>): Record<string, unknown> {
  const cols: Record<string, unknown> = {};
  if (s.id !== undefined) cols.id = s.id;
  if (s.projectId !== undefined) cols.project_id = s.projectId || null;
  if (s.amount !== undefined) cols.amount = s.amount;
  if (s.clientName !== undefined) cols.client_name = s.clientName;
  if (s.type !== undefined) cols.type = s.type;
  if (s.date !== undefined) cols.date = s.date || null;
  if (s.notes !== undefined) cols.notes = s.notes;
  return cols;
}

export function notificationColumns(n: Partial<Notification>): Record<string, unknown> {
  const cols: Record<string, unknown> = {};
  if (n.id !== undefined) cols.id = n.id;
  if (n.userId !== undefined) cols.user_id = n.userId || null;
  if (n.message !== undefined) cols.message = n.message;
  if (n.type !== undefined) cols.type = n.type;
  if (n.isRead !== undefined) cols.is_read = n.isRead;
  if (n.relatedId !== undefined) cols.related_id = n.relatedId ?? null;
  return cols;
}

export function profileColumns(u: Partial<User>): Record<string, unknown> {
  const cols: Record<string, unknown> = {};
  if (u.id !== undefined) cols.id = u.id;
  if (u.name !== undefined) cols.name = u.name;
  if (u.email !== undefined) cols.email = u.email;
  if (u.avatarColor !== undefined) cols.avatar_color = u.avatarColor;
  if (u.role !== undefined) cols.role = u.role;
  if (u.avatarUrl !== undefined) cols.avatar_url = u.avatarUrl || null;
  return cols;
}

/* ─────────────────────────── Loaders ─────────────────────────── */

export interface TeamData {
  users: User[];
  projects: Project[];
  tasks: Task[];
  sales: Sale[];
  notifications: Notification[];
}

export async function fetchTeamData(): Promise<TeamData> {
  const supabase = getSupabase();
  const [profiles, projects, tasks, sales, notifications] = await Promise.all([
    supabase.from("profiles").select("*").order("name"),
    supabase.from("projects").select("*").order("created_at"),
    supabase.from("tasks").select("*").order("sort_order", { ascending: true }).order("created_at"),
    supabase.from("sales").select("*").order("date", { ascending: false }),
    supabase.from("notifications").select("*").order("created_at", { ascending: false }),
  ]);

  return {
    users: (unwrap(profiles, "load profiles") as ProfileRow[]).map(fromProfileRow),
    projects: (unwrap(projects, "load projects") as ProjectRow[]).map(fromProjectRow),
    tasks: (unwrap(tasks, "load tasks") as TaskRow[]).map(fromTaskRow),
    sales: (unwrap(sales, "load sales") as SaleRow[]).map(fromSaleRow),
    notifications: (unwrap(notifications, "load notifications") as NotificationRow[]).map(
      fromNotificationRow
    ),
  };
}

/**
 * Resolves (or creates) the team profile for the signed-in auth user, linking
 * an existing roster entry by email when possible.
 */
export async function ensureProfile(authUser: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}): Promise<User> {
  const supabase = getSupabase();

  const byAuth = await supabase
    .from("profiles")
    .select("*")
    .eq("auth_user_id", authUser.id)
    .maybeSingle();
  if (byAuth.data) return fromProfileRow(byAuth.data as ProfileRow);

  if (authUser.email) {
    const byEmail = await supabase
      .from("profiles")
      .select("*")
      .eq("email", authUser.email)
      .maybeSingle();
    if (byEmail.data) {
      const existing = byEmail.data as ProfileRow;
      await supabase
        .from("profiles")
        .update({ auth_user_id: authUser.id })
        .eq("id", existing.id);
      return fromProfileRow({ ...existing, auth_user_id: authUser.id });
    }
  }

  const name =
    (authUser.user_metadata?.full_name as string | undefined) ??
    (authUser.user_metadata?.name as string | undefined) ??
    authUser.email?.split("@")[0] ??
    "Team member";

  const created = await supabase
    .from("profiles")
    .insert({
      auth_user_id: authUser.id,
      name,
      email: authUser.email ?? "",
      role: "member",
      avatar_color: "var(--primary)",
    })
    .select()
    .single();
  if (created.error) throw new Error(`create profile: ${created.error.message}`);
  return fromProfileRow(created.data as ProfileRow);
}

/* ─────────────────────────── Mutations ─────────────────────────── */

export async function insertProject(project: Project) {
  const { error } = await getSupabase()
    .from("projects")
    .insert(projectColumns(project));
  if (error) throw error;
}

export async function updateProjectRow(id: string, updates: Partial<Project>) {
  const { error } = await getSupabase()
    .from("projects")
    .update(projectColumns(updates))
    .eq("id", id);
  if (error) throw error;
}

export async function deleteProjectRow(id: string) {
  const { error } = await getSupabase().from("projects").delete().eq("id", id);
  if (error) throw error;
}

export async function insertTask(task: Task) {
  const { error } = await getSupabase()
    .from("tasks")
    .insert(taskColumns(task));
  if (error) throw error;
}

export async function updateTaskRow(id: string, updates: Partial<Task>) {
  const { error } = await getSupabase()
    .from("tasks")
    .update(taskColumns(updates))
    .eq("id", id);
  if (error) throw error;
}

export async function deleteTaskRow(id: string) {
  const { error } = await getSupabase().from("tasks").delete().eq("id", id);
  if (error) throw error;
}

export async function insertSale(sale: Sale) {
  const { error } = await getSupabase()
    .from("sales")
    .insert(saleColumns(sale));
  if (error) throw error;
}

export async function updateSaleRow(id: string, updates: Partial<Sale>) {
  const { error } = await getSupabase()
    .from("sales")
    .update(saleColumns(updates))
    .eq("id", id);
  if (error) throw error;
}

export async function deleteSaleRow(id: string) {
  const { error } = await getSupabase().from("sales").delete().eq("id", id);
  if (error) throw error;
}

export async function insertNotification(notification: Notification) {
  const { error } = await getSupabase()
    .from("notifications")
    .insert(notificationColumns(notification));
  if (error) throw error;
}

export async function updateNotificationRow(id: string, isRead: boolean) {
  const { error } = await getSupabase()
    .from("notifications")
    .update({ is_read: isRead })
    .eq("id", id);
  if (error) throw error;
}

export async function updateAllNotificationsRead(userId: string) {
  const { error } = await getSupabase()
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);
  if (error) throw error;
}

export async function updateProfileRow(id: string, updates: Partial<User>) {
  const { error } = await getSupabase()
    .from("profiles")
    .update(profileColumns(updates))
    .eq("id", id);
  if (error) throw error;
}

/* ─────────────────────────── Storage ─────────────────────────── */

export const AVATAR_BUCKET = "avatars";

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const supabase = getSupabase();
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `${userId}.${ext}`;
  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
