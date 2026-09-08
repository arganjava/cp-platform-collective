export type Priority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "todo" | "in_progress" | "review" | "done";
export type ProjectStatus = "draft" | "active" | "completed" | "archived";
export type UserRole = "admin" | "member" | "guest";
export type NotificationType = "assignment" | "mention" | "deadline" | "update" | "comment";
export type SaleType = "commission" | "artwork" | "workshop" | "sponsorship" | "grant";
export type SaleStageStatus = "Opportunity" | "Discussion" | "Closed" | "Lost";

export interface User {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  role: UserRole;
  avatarUrl?: string;
  isDeleted?: boolean;
  deletedAt?: string | null;
  createdAt?: string;
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

export interface Client {
  id: string;
  name: string;
  createdAt: string;
  createdBy?: string | null;
  updatedAt: string;
  updatedBy?: string | null;
}

export interface Sale {
  id: string;
  projectId: string;
  amount: number;
  clientId: string;
  clientName?: string;
  type: SaleType;
  date: string;
  notes: string;
  createdAt: string;
}

export interface SaleStage {
  id: string;
  saleId: string;
  status: SaleStageStatus;
  date: string;
  picProfileId: string | null;
  value: number;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  updatedBy?: string | null;
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
