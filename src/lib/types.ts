export type Priority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "todo" | "in_progress" | "review" | "done";
export type ProjectStatus = "draft" | "active" | "completed" | "archived";
export type UserRole = "admin" | "manager" | "member";
export type NotificationType = "assignment" | "mention" | "deadline" | "update" | "comment";
export type SaleType = "commission" | "artwork" | "workshop" | "sponsorship" | "grant";

export interface User {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  role: UserRole;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  status: ProjectStatus;
  color: string;
  ownerId: string;
  memberIds: string[];
  startDate: string;
  endDate: string;
  createdAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  assigneeId: string | null;
  startDate: string;
  dueDate: string;
  tags: string[];
  createdAt: string;
  order: number;
}

export interface Sale {
  id: string;
  projectId: string;
  amount: number;
  clientName: string;
  type: SaleType;
  date: string;
  notes: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  relatedId?: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  createdAt: string;
}

export type ViewMode = "board" | "list" | "gantt";
export type ReportType = "sales" | "tasks" | "projects" | "team";
