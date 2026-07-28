import { create } from "zustand";
import type {
  User,
  Project,
  Task,
  Sale,
  Notification,
  TaskStatus,
  ProjectStatus,
  Priority,
} from "./types";
import { seedUsers, seedProjects, seedTasks, seedSales, seedNotifications } from "./seed-data";

interface AppState {
  // Data
  users: User[];
  projects: Project[];
  tasks: Task[];
  sales: Sale[];
  notifications: Notification[];
  currentUserId: string;

  // UI State
  sidebarCollapsed: boolean;
  searchQuery: string;
  selectedProjectId: string | null;

  // Actions
  toggleSidebar: () => void;
  setSearchQuery: (query: string) => void;
  setSelectedProject: (id: string | null) => void;

  // Task actions
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  updateTaskStatus: (id: string, status: TaskStatus) => void;
  deleteTask: (id: string) => void;
  reorderTasks: (taskId: string, newStatus: TaskStatus, newOrder: number) => void;

  // Project actions
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  updateProjectStatus: (id: string, status: ProjectStatus) => void;
  deleteProject: (id: string) => void;

  // Sale actions
  addSale: (sale: Sale) => void;
  updateSale: (id: string, updates: Partial<Sale>) => void;
  deleteSale: (id: string) => void;

  // Notification actions
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  addNotification: (notification: Notification) => void;

  // Computed helpers
  getUnreadCount: () => number;
  getTasksByProject: (projectId: string) => Task[];
  getTasksByStatus: (status: TaskStatus) => Task[];
  getProjectById: (id: string) => Project | undefined;
  getUserById: (id: string) => User | undefined;
  getSalesByProject: (projectId: string) => Sale[];
  getProjectsByStatus: (status: ProjectStatus) => Project[];
}

export const useStore = create<AppState>((set, get) => ({
  // Initial data
  users: seedUsers,
  projects: seedProjects,
  tasks: seedTasks,
  sales: seedSales,
  notifications: seedNotifications,
  currentUserId: "user-1",

  // UI State
  sidebarCollapsed: false,
  searchQuery: "",
  selectedProjectId: null,

  // UI Actions
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedProject: (id) => set({ selectedProjectId: id }),

  // Task actions
  addTask: (task) => set((s) => ({ tasks: [...s.tasks, task] })),
  updateTask: (id, updates) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),
  updateTaskStatus: (id, status) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, status } : t)),
    })),
  deleteTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
  reorderTasks: (taskId, newStatus, newOrder) =>
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId ? { ...t, status: newStatus, order: newOrder } : t
      ),
    })),

  // Project actions
  addProject: (project) => set((s) => ({ projects: [...s.projects, project] })),
  updateProject: (id, updates) =>
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    })),
  updateProjectStatus: (id, status) =>
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? { ...p, status } : p)),
    })),
  deleteProject: (id) =>
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== id),
      tasks: s.tasks.filter((t) => t.projectId !== id),
    })),

  // Sale actions
  addSale: (sale) => set((s) => ({ sales: [...s.sales, sale] })),
  updateSale: (id, updates) =>
    set((s) => ({
      sales: s.sales.map((sl) => (sl.id === id ? { ...sl, ...updates } : sl)),
    })),
  deleteSale: (id) => set((s) => ({ sales: s.sales.filter((sl) => sl.id !== id) })),

  // Notification actions
  markNotificationRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n
      ),
    })),
  markAllNotificationsRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, isRead: true })),
    })),
  addNotification: (notification) =>
    set((s) => ({ notifications: [notification, ...s.notifications] })),

  // Computed helpers
  getUnreadCount: () => get().notifications.filter((n) => !n.isRead).length,
  getTasksByProject: (projectId) => get().tasks.filter((t) => t.projectId === projectId),
  getTasksByStatus: (status) => get().tasks.filter((t) => t.status === status),
  getProjectById: (id) => get().projects.find((p) => p.id === id),
  getUserById: (id) => get().users.find((u) => u.id === id),
  getSalesByProject: (projectId) => get().sales.filter((s) => s.projectId === projectId),
  getProjectsByStatus: (status) => get().projects.filter((p) => p.status === status),
}));
