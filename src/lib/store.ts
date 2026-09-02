import { create } from "zustand";
import type {
  User,
  Project,
  Task,
  Sale,
  Notification,
  TaskStatus,
  ProjectStatus,
} from "./types";
import {
  insertTask,
  updateTaskRow,
  deleteTaskRow,
  insertProject,
  updateProjectRow,
  deleteProjectRow,
  insertSale,
  updateSaleRow,
  deleteSaleRow,
  insertNotification,
  updateNotificationRow,
  updateAllNotificationsRead,
  updateProfileRow,
  insertProfileRow,
} from "./supabase/data";
import { generateId } from "./utils";

/**
 * Fire-and-forget persistence: keep the UI snappy, but surface failures so
 * the user never sees a phantom row that silently vanishes on refresh.
 * Errors are logged loudly and recorded on the store for the app shell to
 * render as a dismissible banner.
 */
function persist(promise: Promise<unknown>) {
  promise.catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Supabase write failed:", err);
    useStore.getState().setError(message);
  });
}

interface AppState {
  // Data
  users: User[];
  projects: Project[];
  tasks: Task[];
  sales: Sale[];
  notifications: Notification[];
  currentUserId: string | null;
  loading: boolean;
  initialized: boolean;

  // UI State
  sidebarCollapsed: boolean;
  searchQuery: string;
  selectedProjectId: string | null;
  lastError: string | null;

  // Hydration
  initialize: (data: {
    users: User[];
    projects: Project[];
    tasks: Task[];
    sales: Sale[];
    notifications: Notification[];
    currentUserId: string | null;
  }) => void;
  setCurrentUser: (id: string | null) => void;
  reset: () => void;

  // UI Actions
  toggleSidebar: () => void;
  setSearchQuery: (query: string) => void;
  setSelectedProject: (id: string | null) => void;
  setError: (message: string) => void;
  clearError: () => void;

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

  // User actions
  addUser: (user: User) => void;
  updateUser: (id: string, updates: Partial<User>) => void;
  deleteUser: (id: string) => void;

  // Notification actions
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  addNotification: (notification: Notification) => void;

  // Computed helpers
  getUnreadCount: () => number;
  getTasksByProject: (projectId: string) => Task[];
  getTasksByStatus: (status: TaskStatus) => Task[];
  getProjectById: (id: string) => Project | undefined;
  getUserById: (id: string | null) => User | undefined;
  getSalesByProject: (projectId: string) => Sale[];
  getProjectsByStatus: (status: ProjectStatus) => Project[];
}

const initialDataState = {
  users: [] as User[],
  projects: [] as Project[],
  tasks: [] as Task[],
  sales: [] as Sale[],
  notifications: [] as Notification[],
  currentUserId: null as string | null,
  loading: true,
  initialized: false,
  lastError: null as string | null,
};

export const useStore = create<AppState>((set, get) => ({
  ...initialDataState,

  // UI State
  sidebarCollapsed: false,
  searchQuery: "",
  selectedProjectId: null,

  // Hydration
  initialize: ({ users, projects, tasks, sales, notifications, currentUserId }) =>
    set({
      users,
      projects,
      tasks,
      sales,
      notifications,
      currentUserId,
      loading: false,
      initialized: true,
    }),
  setCurrentUser: (id) => set({ currentUserId: id }),
  reset: () => set({ ...initialDataState, loading: false }),

  // UI Actions
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedProject: (id) => set({ selectedProjectId: id }),
  setError: (message) => set({ lastError: message }),
  clearError: () => set({ lastError: null }),

  // Task actions
  addTask: (task) => {
    set((s) => ({ tasks: [...s.tasks, task] }));
    persist(insertTask(task));
  },
  updateTask: (id, updates) => {
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }));
    persist(updateTaskRow(id, updates));
  },
  updateTaskStatus: (id, status) => {
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, status } : t)),
    }));
    persist(updateTaskRow(id, { status }));
  },
  deleteTask: (id) => {
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
    persist(deleteTaskRow(id));
  },
  reorderTasks: (taskId, newStatus, newOrder) => {
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId ? { ...t, status: newStatus, order: newOrder } : t
      ),
    }));
    persist(updateTaskRow(taskId, { status: newStatus, order: newOrder }));
  },

  // Project actions
  addProject: (project) => {
    set((s) => ({ projects: [...s.projects, project] }));
    persist(insertProject(project));
  },
  updateProject: (id, updates) => {
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    }));
    persist(updateProjectRow(id, updates));
  },
  updateProjectStatus: (id, status) => {
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? { ...p, status } : p)),
    }));
    persist(updateProjectRow(id, { status }));
  },
  deleteProject: (id) => {
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== id),
      tasks: s.tasks.filter((t) => t.projectId !== id),
      sales: s.sales.filter((sl) => sl.projectId !== id),
    }));
    persist(deleteProjectRow(id));
  },

  // Sale actions
  addSale: (sale) => {
    set((s) => ({ sales: [...s.sales, sale] }));
    persist(insertSale(sale));
  },
  updateSale: (id, updates) => {
    set((s) => ({
      sales: s.sales.map((sl) => (sl.id === id ? { ...sl, ...updates } : sl)),
    }));
    persist(updateSaleRow(id, updates));
  },
  deleteSale: (id) => {
    set((s) => ({ sales: s.sales.filter((sl) => sl.id !== id) }));
    persist(deleteSaleRow(id));
  },

  // User actions
  addUser: (user) => {
    set((s) => ({ users: [...s.users, user] }));
    persist(insertProfileRow(user));
  },
  updateUser: (id, updates) => {
    set((s) => ({
      users: s.users.map((u) => (u.id === id ? { ...u, ...updates } : u)),
    }));
    persist(updateProfileRow(id, updates));
  },
  deleteUser: (id) => {
    // Soft delete - set deletedAt timestamp
    set((s) => ({
      users: s.users.map((u) =>
        u.id === id ? { ...u, deletedAt: new Date().toISOString() } : u
      ),
    }));
    persist(updateProfileRow(id, { deletedAt: new Date().toISOString() }));
  },

  // Notification actions
  markNotificationRead: (id) => {
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n
      ),
    }));
    persist(updateNotificationRow(id, true));
  },
  markAllNotificationsRead: () => {
    const userId = get().currentUserId;
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, isRead: true })),
    }));
    if (userId) persist(updateAllNotificationsRead(userId));
  },
  addNotification: (notification) => {
    set((s) => ({ notifications: [notification, ...s.notifications] }));
    persist(insertNotification(notification));
  },

  // Computed helpers
  getUnreadCount: () => get().notifications.filter((n) => !n.isRead).length,
  getTasksByProject: (projectId) => get().tasks.filter((t) => t.projectId === projectId),
  getTasksByStatus: (status) => get().tasks.filter((t) => t.status === status),
  getProjectById: (id) => get().projects.find((p) => p.id === id),
  getUserById: (id) => get().users.find((u) => u.id === id),
  getSalesByProject: (projectId) => get().sales.filter((s) => s.projectId === projectId),
  getProjectsByStatus: (status) => get().projects.filter((p) => p.status === status),
}));
