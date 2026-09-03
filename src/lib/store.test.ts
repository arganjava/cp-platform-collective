import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStore } from "./store";
import type { Notification, Project, Sale, Task, User } from "./types";

const mocks = vi.hoisted(() => ({
  insertTask: vi.fn(async () => {}),
  updateTaskRow: vi.fn(async () => {}),
  deleteTaskRow: vi.fn(async () => {}),
  insertProject: vi.fn(async () => {}),
  updateProjectRow: vi.fn(async () => {}),
  deleteProjectRow: vi.fn(async () => {}),
  insertSale: vi.fn(async () => {}),
  updateSaleRow: vi.fn(async () => {}),
  deleteSaleRow: vi.fn(async () => {}),
  insertNotification: vi.fn(async () => {}),
  updateNotificationRow: vi.fn(async () => {}),
  updateAllNotificationsRead: vi.fn(async () => {}),
  updateProfileRow: vi.fn(async () => {}),
  createUserViaFunction: vi.fn(async () => ({ id: "u-created" })),
}));

vi.mock("./supabase/data", () => mocks);

const user: User = {
  id: "u-1",
  name: "Vincent Lim",
  email: "vincent@collectivep.com",
  avatarColor: "var(--primary)",
  role: "admin",
};

const project: Project = {
  id: "p-1",
  title: "DARE Festival 2026",
  description: "",
  status: "active",
  color: "var(--primary)",
  ownerId: "u-1",
  memberIds: ["u-1"],
  startDate: "2026-06-01",
  endDate: "2026-11-15",
  createdAt: "2026-03-10T09:00:00Z",
};

const otherProject: Project = { ...project, id: "p-2", title: "Shades" };

const task: Task = {
  id: "t-1",
  projectId: "p-1",
  title: "Launch ticket sales",
  description: "",
  status: "todo",
  priority: "medium",
  assigneeId: "u-1",
  startDate: "2026-08-01",
  dueDate: "2026-08-31",
  tags: [],
  createdAt: "2026-07-20T09:00:00Z",
  order: 0,
};

const otherTask: Task = { ...task, id: "t-2", projectId: "p-2", title: "Cover design" };

const sale: Sale = {
  id: "s-1",
  projectId: "p-1",
  amount: 15000,
  clientName: "National Arts Council",
  type: "grant",
  date: "2026-04-15",
  notes: "",
  createdAt: "2026-04-15T10:00:00Z",
};

const otherSale: Sale = { ...sale, id: "s-2", projectId: "p-2", amount: 5000 };

const notification: Notification = {
  id: "n-1",
  userId: "u-1",
  message: "New sale logged",
  type: "update",
  isRead: false,
  createdAt: "2026-07-20T10:30:00Z",
};

beforeEach(() => {
  useStore.getState().reset();
  vi.clearAllMocks();
});

describe("initialize", () => {
  it("hydrates state including the current user", () => {
    useStore.getState().initialize({
      users: [user],
      projects: [project],
      tasks: [task],
      sales: [sale],
      notifications: [notification],
      currentUserId: "u-1",
    });
    const s = useStore.getState();
    expect(s.users).toEqual([user]);
    expect(s.projects).toEqual([project]);
    expect(s.tasks).toEqual([task]);
    expect(s.sales).toEqual([sale]);
    expect(s.currentUserId).toBe("u-1");
    expect(s.loading).toBe(false);
    expect(s.initialized).toBe(true);
  });
});

describe("task actions", () => {
  it("addTask appends and persists to Supabase", () => {
    useStore.getState().addTask(task);
    expect(useStore.getState().tasks).toContainEqual(task);
    expect(mocks.insertTask).toHaveBeenCalledWith(task);
  });

  it("updateTask merges partial updates and persists", () => {
    useStore.getState().addTask(task);
    useStore.getState().updateTask("t-1", { status: "in_progress", priority: "high" });
    expect(useStore.getState().tasks[0]).toMatchObject({ status: "in_progress", priority: "high" });
    expect(mocks.updateTaskRow).toHaveBeenCalledWith("t-1", { status: "in_progress", priority: "high" });
  });

  it("updateTaskStatus persists the status change", () => {
    useStore.getState().addTask(task);
    useStore.getState().updateTaskStatus("t-1", "done");
    expect(useStore.getState().tasks[0].status).toBe("done");
    expect(mocks.updateTaskRow).toHaveBeenCalledWith("t-1", { status: "done" });
  });

  it("deleteTask removes the task and persists", () => {
    useStore.getState().addTask(task);
    useStore.getState().deleteTask("t-1");
    expect(useStore.getState().tasks).toEqual([]);
    expect(mocks.deleteTaskRow).toHaveBeenCalledWith("t-1");
  });
});

describe("project actions", () => {
  it("addProject appends and persists", () => {
    useStore.getState().addProject(project);
    expect(useStore.getState().projects).toContainEqual(project);
    expect(mocks.insertProject).toHaveBeenCalledWith(project);
  });

  it("updateProject merges partial updates and persists", () => {
    useStore.getState().addProject(project);
    useStore.getState().updateProject("p-1", { status: "archived", color: "var(--destructive)" });
    expect(useStore.getState().projects[0]).toMatchObject({ status: "archived", color: "var(--destructive)" });
    expect(mocks.updateProjectRow).toHaveBeenCalledWith("p-1", { status: "archived", color: "var(--destructive)" });
  });

  it("deleteProject removes the project and cascades its tasks and sales locally", () => {
    useStore.getState().initialize({
      users: [user],
      projects: [project, otherProject],
      tasks: [task, otherTask],
      sales: [sale, otherSale],
      notifications: [],
      currentUserId: "u-1",
    });
    useStore.getState().deleteProject("p-1");
    const s = useStore.getState();
    expect(s.projects.map((p) => p.id)).toEqual(["p-2"]);
    expect(s.tasks.map((t) => t.id)).toEqual(["t-2"]);
    expect(s.sales.map((sl) => sl.id)).toEqual(["s-2"]);
    expect(mocks.deleteProjectRow).toHaveBeenCalledWith("p-1");
  });
});

describe("sale actions", () => {
  it("addSale appends and persists", () => {
    useStore.getState().addSale(sale);
    expect(useStore.getState().sales).toContainEqual(sale);
    expect(mocks.insertSale).toHaveBeenCalledWith(sale);
  });

  it("updateSale merges partial updates and persists", () => {
    useStore.getState().addSale(sale);
    useStore.getState().updateSale("s-1", { amount: 18000, type: "sponsorship" });
    expect(useStore.getState().sales[0]).toMatchObject({ amount: 18000, type: "sponsorship" });
    expect(mocks.updateSaleRow).toHaveBeenCalledWith("s-1", { amount: 18000, type: "sponsorship" });
  });

  it("deleteSale removes the sale and persists", () => {
    useStore.getState().addSale(sale);
    useStore.getState().deleteSale("s-1");
    expect(useStore.getState().sales).toEqual([]);
    expect(mocks.deleteSaleRow).toHaveBeenCalledWith("s-1");
  });
});

describe("user actions", () => {
  it("updateUser merges partial updates and persists via updateProfileRow", () => {
    useStore.getState().initialize({
      users: [user],
      projects: [],
      tasks: [],
      sales: [],
      notifications: [],
      currentUserId: "u-1",
    });
    useStore.getState().updateUser("u-1", { name: "Vincent L." });
    expect(useStore.getState().users[0].name).toBe("Vincent L.");
    expect(mocks.updateProfileRow).toHaveBeenCalledWith("u-1", { name: "Vincent L." });
  });

  it("addUser persists and appends user if email is unique", async () => {
    useStore.getState().initialize({
      users: [user],
      projects: [],
      tasks: [],
      sales: [],
      notifications: [],
      currentUserId: "u-1",
    });
    const newUser: User = {
      id: "u-new",
      name: "Alice Wang",
      email: "alice@collectivep.com",
      avatarColor: "var(--accent)",
      role: "member",
    };
    await useStore.getState().addUser(newUser, "SecurePass123!");
    expect(useStore.getState().users.some((u) => u.email === "alice@collectivep.com")).toBe(true);
    expect(mocks.createUserViaFunction).toHaveBeenCalledWith({
      name: "Alice Wang",
      email: "alice@collectivep.com",
      role: "member",
      password: "SecurePass123!",
      avatarColor: "var(--accent)",
    });
  });

  it("addUser throws an error and refuses to add if email already exists", async () => {
    useStore.getState().initialize({
      users: [user],
      projects: [],
      tasks: [],
      sales: [],
      notifications: [],
      currentUserId: "u-1",
    });
    const duplicateUser: User = {
      id: "u-dup",
      name: "Vincent Imposter",
      email: "vincent@COLLECTIVEP.com", // case-insensitive check
      avatarColor: "var(--primary)",
      role: "guest",
    };

    await expect(useStore.getState().addUser(duplicateUser, "password123")).rejects.toThrow(
      "A user profile with this email address already exists."
    );
    expect(useStore.getState().users.length).toBe(1);
    expect(useStore.getState().lastError).toBe("A user profile with this email address already exists.");
  });
});

describe("notification actions", () => {
  it("markNotificationRead flips isRead and persists", () => {
    useStore.getState().addNotification(notification);
    useStore.getState().markNotificationRead("n-1");
    expect(useStore.getState().notifications[0].isRead).toBe(true);
    expect(mocks.updateNotificationRow).toHaveBeenCalledWith("n-1", true);
  });

  it("markAllNotificationsRead flips every notification for the current user", () => {
    useStore.getState().initialize({
      users: [user],
      projects: [],
      tasks: [],
      sales: [],
      notifications: [notification, { ...notification, id: "n-2", isRead: true }],
      currentUserId: "u-1",
    });
    useStore.getState().markAllNotificationsRead();
    expect(useStore.getState().notifications.every((n) => n.isRead)).toBe(true);
    expect(mocks.updateAllNotificationsRead).toHaveBeenCalledWith("u-1");
  });

  it("addNotification prepends and persists", () => {
    useStore.getState().addNotification(notification);
    expect(useStore.getState().notifications[0]).toEqual(notification);
    expect(mocks.insertNotification).toHaveBeenCalledWith(notification);
  });
});

describe("persistence error surfacing", () => {
  it("records a failed write as lastError so the UI can surface it", async () => {
    mocks.insertTask.mockRejectedValueOnce(new Error("permission denied for table tasks"));
    useStore.getState().addTask(task);

    await vi.waitFor(() => {
      expect(useStore.getState().lastError).toMatch(/permission denied/);
    });

    useStore.getState().clearError();
    expect(useStore.getState().lastError).toBeNull();
  });

  it("reset() clears a previously recorded error", async () => {
    mocks.updateTaskRow.mockRejectedValueOnce(new Error("boom"));
    useStore.getState().addTask(task);
    useStore.getState().updateTask("t-1", { status: "done" });

    await vi.waitFor(() => {
      expect(useStore.getState().lastError).toBe("boom");
    });

    useStore.getState().reset();
    expect(useStore.getState().lastError).toBeNull();
  });
});
