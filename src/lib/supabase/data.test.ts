import { describe, expect, it } from "vitest";
import {
  fromProfileRow,
  fromProjectRow,
  fromSaleRow,
  fromTaskRow,
  notificationColumns,
  profileColumns,
  projectColumns,
  saleColumns,
  taskColumns,
} from "./data";
import type { ProfileRow, ProjectRow, SaleRow, TaskRow } from "./types";
import type { Project, Sale, Task, User } from "../types";

describe("taskColumns", () => {
  it("maps Task fields to snake_case DB columns", () => {
    const task: Task = {
      id: "30000000-0000-4000-8000-000000000001",
      projectId: "20000000-0000-4000-8000-000000000001",
      title: "Launch ticket sales",
      description: "Set up Eventbrite",
      status: "todo",
      priority: "medium",
      assigneeId: "10000000-0000-4000-8000-000000000005",
      startDate: "2026-08-01",
      dueDate: "2026-08-31",
      tags: ["ticketing", "sales"],
      createdAt: "2026-07-20T09:00:00Z",
      order: 2,
    };
    expect(taskColumns(task)).toEqual({
      id: task.id,
      project_id: task.projectId,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      assignee_id: task.assigneeId,
      start_date: task.startDate,
      due_date: task.dueDate,
      tags: task.tags,
      sort_order: task.order,
    });
  });

  it("coerces null/empty values to DB nulls (schema columns are nullable)", () => {
    const cols = taskColumns({
      id: "task-1",
      assigneeId: null,
      projectId: "",
      dueDate: "",
      startDate: "",
    });
    expect(cols.assignee_id).toBeNull();
    expect(cols.project_id).toBeNull();
    expect(cols.due_date).toBeNull();
    expect(cols.start_date).toBeNull();
  });

  it("omits undefined fields so partial updates only touch given columns", () => {
    const cols = taskColumns({ status: "done" });
    expect(cols).toEqual({ status: "done" });
    expect(cols).not.toHaveProperty("title");
    expect(cols).not.toHaveProperty("assignee_id");
  });
});

describe("projectColumns", () => {
  it("maps camelCase owner/member fields to DB columns", () => {
    const project: Project = {
      id: "20000000-0000-4000-8000-000000000001",
      title: "DARE Festival 2026",
      description: "Flagship arts festival",
      status: "active",
      color: "var(--primary)",
      ownerId: "10000000-0000-4000-8000-000000000001",
      memberIds: ["10000000-0000-4000-8000-000000000001"],
      startDate: "2026-06-01",
      endDate: "2026-11-15",
      createdAt: "2026-03-10T09:00:00Z",
    };
    expect(projectColumns(project)).toMatchObject({
      id: project.id,
      owner_id: project.ownerId,
      member_ids: project.memberIds,
      start_date: project.startDate,
      end_date: project.endDate,
    });
  });

  it("coerces an empty ownerId to null (owner_id is nullable, set null on profile delete)", () => {
    expect(projectColumns({ ownerId: "" }).owner_id).toBeNull();
  });
});

describe("saleColumns", () => {
  it("maps Sale fields and keeps numeric amounts", () => {
    const sale: Sale = {
      id: "40000000-0000-4000-8000-000000000001",
      projectId: "20000000-0000-4000-8000-000000000001",
      amount: 15000,
      clientName: "National Arts Council",
      type: "grant",
      date: "2026-04-15",
      notes: "approved",
      createdAt: "2026-04-15T10:00:00Z",
    };
    expect(saleColumns(sale)).toEqual({
      id: sale.id,
      project_id: sale.projectId,
      amount: 15000,
      client_name: sale.clientName,
      type: sale.type,
      date: sale.date,
      notes: sale.notes,
    });
  });

  it("coerces empty date to null", () => {
    expect(saleColumns({ date: "" }).date).toBeNull();
  });
});

describe("profileColumns / notificationColumns", () => {
  it("maps profile fields and omits an absent avatarUrl so updates never wipe it", () => {
    const user: User = {
      id: "u-1",
      name: "Vincent Lim",
      email: "vincent@collectivep.com",
      avatarColor: "var(--primary)",
      role: "admin",
    };
    expect(profileColumns(user)).toEqual({
      id: user.id,
      name: user.name,
      email: user.email,
      avatar_color: user.avatarColor,
      role: user.role,
    });
    expect(profileColumns(user)).not.toHaveProperty("avatar_url");
  });

  it("nulls a notification relatedId when the field is explicitly null", () => {
    // The app-layer type uses undefined for absent; a runtime null is still
    // normalized to a DB NULL by the mapper (related_id is nullable).
    expect(
      notificationColumns({ relatedId: null as unknown as string }).related_id
    ).toBeNull();
    expect(notificationColumns({}).related_id).toBeUndefined();
  });
});

describe("row → app type mappers", () => {
  it("fromTaskRow applies defaults for nullable/absent columns", () => {
    const row: TaskRow = {
      id: "t-1",
      project_id: "p-1",
      title: "Task",
      description: null as unknown as string,
      status: "",
      priority: "",
      assignee_id: null,
      start_date: null,
      due_date: null,
      tags: null,
      sort_order: 3,
      created_at: null as unknown as string,
    };
    const task = fromTaskRow(row);
    expect(task).toMatchObject({
      id: "t-1",
      projectId: "p-1",
      description: "",
      status: "todo",
      priority: "medium",
      assigneeId: null,
      startDate: "",
      dueDate: "",
      tags: [],
      order: 3,
    });
  });

  it("fromTaskRow passes through valid enum values unchanged", () => {
    const row: TaskRow = {
      id: "t-1",
      project_id: "p-1",
      title: "Task",
      description: "",
      status: "in_progress",
      priority: "urgent",
      assignee_id: "u-1",
      start_date: "2026-08-01",
      due_date: "2026-08-31",
      tags: ["sales"],
      sort_order: 1,
      created_at: "2026-07-20T09:00:00Z",
    };
    expect(fromTaskRow(row)).toMatchObject({
      status: "in_progress",
      priority: "urgent",
      assigneeId: "u-1",
      tags: ["sales"],
      order: 1,
    });
  });

  it("fromProjectRow defaults color, status, and roster fields", () => {
    const row: ProjectRow = {
      id: "p-1",
      title: "Proj",
      description: null as unknown as string,
      status: "",
      color: null,
      owner_id: null,
      member_ids: null,
      start_date: null,
      end_date: null,
      created_at: null as unknown as string,
    };
    expect(fromProjectRow(row)).toMatchObject({
      description: "",
      status: "active",
      color: "var(--primary)",
      ownerId: "",
      memberIds: [],
      startDate: "",
      endDate: "",
    });
  });

  it("fromSaleRow coerces amount to a number and defaults date/type", () => {
    const row: SaleRow = {
      id: "s-1",
      project_id: "p-1",
      amount: 4200,
      client_name: "Ticket Sales",
      type: "",
      date: null,
      notes: "",
      created_at: null as unknown as string,
    };
    const sale = fromSaleRow(row);
    expect(sale.amount).toBe(4200);
    expect(sale.date).toBe("");
    expect(sale.type).toBe("commission");
  });

  it("fromProfileRow defaults avatarColor and role", () => {
    const row: ProfileRow = {
      id: "u-1",
      auth_user_id: null,
      name: "Vincent Lim",
      email: "vincent@collectivep.com",
      avatar_color: null,
      role: null as unknown as string,
      avatar_url: null,
      created_at: "2026-01-05T09:00:00Z",
    };
    expect(fromProfileRow(row)).toMatchObject({
      avatarColor: "var(--primary)",
      role: "guest",
    });
  });
});
