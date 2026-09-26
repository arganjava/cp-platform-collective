import { create } from "zustand";
import type {
  User,
  Project,
  Task,
  Sale,
  SaleStage,
  Notification,
  TaskStatus,
  ProjectStatus,
  Client,
  ProjectProfile,
  TaskProfile,
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
  insertSaleStage,
  updateSaleStageRow,
  deleteSaleStageRow,
  insertClient,
  updateClientRow,
  deleteClientRow,
  insertNotification,
  updateNotificationRow,
  updateAllNotificationsRead,
  updateProfileRow,
  softDeleteProfileRow,
  restoreProfileRow,
  createUserViaFunction,
  fetchTeamData,
} from "./supabase/data";
import { isSupabaseConfigured } from "./supabase/client";

/**
 * Fire-and-forget persistence: keep the UI snappy, but surface failures so
 * the user never sees a phantom row that silently vanishes on refresh.
 * Errors are logged loudly and recorded on the store for the app shell to
 * render as a dismissible banner.
 */
function persist(promise: Promise<unknown>): Promise<unknown> {
  if (!isSupabaseConfigured) return Promise.resolve();
  return promise.catch((err) => {
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
  saleStages: SaleStage[];
  notifications: Notification[];
  clients: Client[];
  projectProfiles: ProjectProfile[];
  taskProfiles: TaskProfile[];
  currentUserId: string | null;
  loading: boolean;
  initialized: boolean;

  // UI State
  sidebarCollapsed: boolean;
  searchQuery: string;
  selectedProjectId: string | null;
  lastError: string | null;
  isSyncing: boolean;

  // Hydration
  initialize: (data: {
    users: User[];
    projects: Project[];
    tasks: Task[];
    sales: Sale[];
    saleStages?: SaleStage[];
    notifications: Notification[];
    clients?: Client[];
    projectProfiles?: ProjectProfile[];
    taskProfiles?: TaskProfile[];
    currentUserId: string | null;
  }) => void;
  loadDataFromDatabase: () => Promise<void>;
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

  // SaleStage actions
  addSaleStage: (stage: SaleStage) => Promise<void>;
  updateSaleStage: (id: string, updates: Partial<SaleStage>) => Promise<void>;
  deleteSaleStage: (id: string) => Promise<void>;

  // Client actions
  addClient: (client: Client) => Promise<void>;
  updateClient: (id: string, updates: Partial<Client>) => void;
  deleteClient: (id: string) => void;

  // User actions
  addUser: (user: User, password?: string) => Promise<void>;
  updateUser: (id: string, updates: Partial<User>, skipPersist?: boolean) => void;
  deleteUser: (id: string, skipPersist?: boolean) => void;
  softDeleteUser: (id: string, skipPersist?: boolean) => void;
  restoreUser: (id: string, skipPersist?: boolean) => void;

  // Notification actions
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  addNotification: (notification: Notification) => void;

  // Computed helpers
  getUnreadCount: () => number;
  getActiveUsers: () => User[];
  getTasksByProject: (projectId: string) => Task[];
  getTasksByStatus: (status: TaskStatus) => Task[];
  getProjectById: (id: string) => Project | undefined;
  getUserById: (id: string | null) => User | undefined;
  getClientById: (id: string | null | undefined) => Client | undefined;
  getSalesByProject: (projectId: string) => Sale[];
  getSaleStagesBySaleId: (saleId: string) => SaleStage[];
  getProjectsByStatus: (status: ProjectStatus) => Project[];
  getProjectMemberIds: (projectId: string) => string[];
  getProjectProfilesByProjectId: (projectId: string) => ProjectProfile[];
  getTaskAssigneeIds: (taskId: string) => string[];
  getTaskProfilesByTaskId: (taskId: string) => TaskProfile[];
}

const initialDataState = {
  users: [] as User[],
  projects: [] as Project[],
  tasks: [] as Task[],
  sales: [] as Sale[],
  saleStages: [] as SaleStage[],
  notifications: [] as Notification[],
  clients: [] as Client[],
  projectProfiles: [] as ProjectProfile[],
  taskProfiles: [] as TaskProfile[],
  currentUserId: null as string | null,
  loading: true,
  initialized: false,
  lastError: null as string | null,
  isSyncing: false,
};

export const useStore = create<AppState>((set, get) => ({
  ...initialDataState,

  // UI State
  sidebarCollapsed: false,
  searchQuery: "",
  selectedProjectId: null,

  // Hydration
  initialize: ({
    users,
    projects,
    tasks,
    sales,
    saleStages,
    notifications,
    clients,
    projectProfiles,
    taskProfiles,
    currentUserId,
  }) =>
    set({
      users,
      projects,
      tasks,
      sales,
      saleStages: saleStages ?? [],
      notifications,
      clients: clients ?? [],
      projectProfiles: projectProfiles ?? [],
      taskProfiles: taskProfiles ?? [],
      currentUserId,
      loading: false,
      initialized: true,
    }),
  loadDataFromDatabase: async () => {
    if (!isSupabaseConfigured) return;
    try {
      set({ isSyncing: true });
      const data = await fetchTeamData();
      const currentUserId = get().currentUserId;
      get().initialize({
        ...data,
        currentUserId,
      });
    } catch (err) {
      console.warn("Could not reload data from database:", err);
    } finally {
      set({ isSyncing: false });
    }
  },
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
    const assigneeIds =
      task.assigneeIds && task.assigneeIds.length > 0
        ? task.assigneeIds
        : task.assigneeId
        ? [task.assigneeId]
        : [];
    const newProfiles: TaskProfile[] = assigneeIds.map((profileId) => ({
      id: `tp-${task.id}-${profileId}`,
      taskId: task.id,
      profileId,
    }));
    const finalTask: Task = {
      ...task,
      ...(task.assigneeIds !== undefined ? { assigneeIds } : {}),
      assigneeId: task.assigneeId ?? (assigneeIds[0] || null),
    };
    set((s) => ({
      tasks: [...s.tasks, finalTask],
      taskProfiles: [...s.taskProfiles, ...newProfiles],
    }));
    persist(insertTask(finalTask));
  },
  updateTask: (id, updates) => {
    set((s) => {
      let updatedProfiles = s.taskProfiles;
      let nextAssigneeIds = updates.assigneeIds;
      if (updates.assigneeIds !== undefined) {
        const remaining = s.taskProfiles.filter((tp) => tp.taskId !== id);
        const added = updates.assigneeIds.map((profileId) => ({
          id: `tp-${id}-${profileId}`,
          taskId: id,
          profileId,
        }));
        updatedProfiles = [...remaining, ...added];
      } else if (updates.assigneeId !== undefined && updates.assigneeIds === undefined) {
        const remaining = s.taskProfiles.filter((tp) => tp.taskId !== id);
        const added = updates.assigneeId
          ? [
              {
                id: `tp-${id}-${updates.assigneeId}`,
                taskId: id,
                profileId: updates.assigneeId,
              },
            ]
          : [];
        updatedProfiles = [...remaining, ...added];
        nextAssigneeIds = updates.assigneeId ? [updates.assigneeId] : [];
      }
      return {
        tasks: s.tasks.map((t) =>
          t.id === id
            ? {
                ...t,
                ...updates,
                assigneeIds: nextAssigneeIds !== undefined ? nextAssigneeIds : t.assigneeIds,
              }
            : t
        ),
        taskProfiles: updatedProfiles,
      };
    });
    persist(updateTaskRow(id, updates));
  },
  updateTaskStatus: (id, status) => {
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, status } : t)),
    }));
    persist(updateTaskRow(id, { status }));
  },
  deleteTask: (id) => {
    set((s) => ({
      tasks: s.tasks.filter((t) => t.id !== id),
      taskProfiles: s.taskProfiles.filter((tp) => tp.taskId !== id),
    }));
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
    const newProfiles: ProjectProfile[] = (project.memberIds || []).map((profileId) => ({
      id: `pp-${project.id}-${profileId}`,
      projectId: project.id,
      profileId,
    }));
    set((s) => ({
      projects: [...s.projects, project],
      projectProfiles: [...s.projectProfiles, ...newProfiles],
    }));
    persist(insertProject(project));
  },
  updateProject: (id, updates) => {
    set((s) => {
      let updatedProfiles = s.projectProfiles;
      if (updates.memberIds !== undefined) {
        const remaining = s.projectProfiles.filter((pp) => pp.projectId !== id);
        const added = updates.memberIds.map((profileId) => ({
          id: `pp-${id}-${profileId}`,
          projectId: id,
          profileId,
        }));
        updatedProfiles = [...remaining, ...added];
      }
      return {
        projects: s.projects.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        projectProfiles: updatedProfiles,
      };
    });
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
      projectProfiles: s.projectProfiles.filter((pp) => pp.projectId !== id),
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
    set((s) => ({
      sales: s.sales.filter((sl) => sl.id !== id),
      saleStages: s.saleStages.filter((st) => st.saleId !== id),
    }));
    persist(deleteSaleRow(id));
  },

  // SaleStage actions
  addSaleStage: async (stage) => {
    set((s) => ({ saleStages: [...s.saleStages, stage] }));
    await persist(insertSaleStage(stage));
  },
  updateSaleStage: async (id, updates) => {
    set((s) => ({
      saleStages: s.saleStages.map((st) => (st.id === id ? { ...st, ...updates } : st)),
    }));
    await persist(updateSaleStageRow(id, updates));
  },
  deleteSaleStage: async (id) => {
    set((s) => ({ saleStages: s.saleStages.filter((st) => st.id !== id) }));
    await persist(deleteSaleStageRow(id));
  },

  // Client actions
  addClient: async (client) => {
    set((s) => ({ clients: [...s.clients, client] }));
    await persist(insertClient(client));
  },
  updateClient: (id, updates) => {
    set((s) => ({
      clients: s.clients.map((c) => (c.id === id ? { ...c, ...updates } : c)),
      // If client name updated, also update resolved clientName in sales
      sales: updates.name
        ? s.sales.map((sl) => (sl.clientId === id ? { ...sl, clientName: updates.name } : sl))
        : s.sales,
    }));
    persist(updateClientRow(id, updates));
  },
  deleteClient: (id) => {
    set((s) => ({
      clients: s.clients.filter((c) => c.id !== id),
      sales: s.sales.map((sl) => (sl.clientId === id ? { ...sl, clientId: "" } : sl)),
    }));
    persist(deleteClientRow(id));
  },

  // User actions
  addUser: async (user, password) => {
    const normalizedEmail = user.email.trim().toLowerCase();
    const existing = get().users.find((u) => u.email.trim().toLowerCase() === normalizedEmail);
    if (existing) {
      const errorMsg = existing.isDeleted
        ? "A user profile with this email address already exists in the archive."
        : "A user profile with this email address already exists.";
      get().setError(errorMsg);
      throw new Error(errorMsg);
    }

    // Persist via API / edge function or profile insert
    try {
      const res = await createUserViaFunction({
        name: user.name,
        email: user.email,
        role: user.role,
        password,
        avatarColor: user.avatarColor,
      });

      const finalUser: User = {
        ...user,
        id: res?.id || user.id,
      };

      set((s) => ({
        users: [...s.users.filter((u) => u.id !== finalUser.id), finalUser],
      }));
    } catch (err) {
      console.error("Failed to persist new user:", err);
      const msg = err instanceof Error ? err.message : String(err);
      get().setError(`User creation error: ${msg}`);
      throw err;
    }
  },
  updateUser: (id, updates, skipPersist = false) => {
    set((s) => ({
      users: s.users.map((u) => (u.id === id ? { ...u, ...updates } : u)),
    }));
    if (!skipPersist) {
      persist(updateProfileRow(id, updates));
    }
  },
  softDeleteUser: (id, skipPersist = false) => {
    set((s) => ({
      users: s.users.map((u) =>
        u.id === id
          ? { ...u, isDeleted: true, deletedAt: new Date().toISOString() }
          : u
      ),
    }));
    if (!skipPersist) {
      persist(softDeleteProfileRow(id));
    }
  },
  deleteUser: (id, skipPersist = false) => {
    get().softDeleteUser(id, skipPersist);
  },
  restoreUser: (id, skipPersist = false) => {
    set((s) => ({
      users: s.users.map((u) =>
        u.id === id
          ? { ...u, isDeleted: false, deletedAt: null }
          : u
      ),
    }));
    if (!skipPersist) {
      persist(restoreProfileRow(id));
    }
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
  getActiveUsers: () => get().users.filter((u) => !u.isDeleted),
  getTasksByProject: (projectId) => get().tasks.filter((t) => t.projectId === projectId),
  getTasksByStatus: (status) => get().tasks.filter((t) => t.status === status),
  getProjectById: (id) => get().projects.find((p) => p.id === id),
  getUserById: (id) => get().users.find((u) => u.id === id),
  getClientById: (id) => {
    if (!id) return undefined;
    return get().clients.find((c) => c.id === id);
  },
  getSalesByProject: (projectId) => get().sales.filter((s) => s.projectId === projectId),
  getSaleStagesBySaleId: (saleId) =>
    get()
      .saleStages.filter((st) => st.saleId === saleId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
  getProjectsByStatus: (status) => get().projects.filter((p) => p.status === status),
  getProjectMemberIds: (projectId) =>
    get().projectProfiles.filter((pp) => pp.projectId === projectId).map((pp) => pp.profileId),
  getProjectProfilesByProjectId: (projectId) =>
    get().projectProfiles.filter((pp) => pp.projectId === projectId),
  getTaskAssigneeIds: (taskId) => {
    const fromProfiles = get()
      .taskProfiles.filter((tp) => tp.taskId === taskId)
      .map((tp) => tp.profileId);
    if (fromProfiles.length > 0) return fromProfiles;
    const task = get().tasks.find((t) => t.id === taskId);
    if (task?.assigneeIds && task.assigneeIds.length > 0) return task.assigneeIds;
    return task?.assigneeId ? [task.assigneeId] : [];
  },
  getTaskProfilesByTaskId: (taskId) =>
    get().taskProfiles.filter((tp) => tp.taskId === taskId),
}));
