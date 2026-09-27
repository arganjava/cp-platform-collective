import { describe, it, expect } from "vitest";
import { seedProjects, seedTasks, seedUsers, seedProjectProfiles, seedTaskProfiles } from "@/lib/seed-data";
import type { Task, Project } from "@/lib/types";

// Helper logic identical to Gantt page
function isTaskAssignee(
  t: { id: string; assigneeId?: string | null; assigneeIds?: string[] },
  profileId: string,
  taskProfiles = seedTaskProfiles
) {
  if (t.assigneeId === profileId) return true;
  if (t.assigneeIds && t.assigneeIds.includes(profileId)) return true;
  if (taskProfiles.some((tp) => tp.taskId === t.id && tp.profileId === profileId)) return true;
  return false;
}

function isProjectMatchingAssignee(
  p: { id: string; memberIds?: string[]; ownerId?: string },
  assigneeId: string,
  tasks: Task[],
  projectProfiles = seedProjectProfiles,
  taskProfiles = seedTaskProfiles
) {
  if (tasks.some((t) => t.projectId === p.id && isTaskAssignee(t, assigneeId, taskProfiles))) {
    return true;
  }
  if (projectProfiles.some((pp) => pp.projectId === p.id && pp.profileId === assigneeId)) {
    return true;
  }
  if (p.memberIds && p.memberIds.includes(assigneeId)) {
    return true;
  }
  if (p.ownerId === assigneeId) {
    return true;
  }
  return false;
}

function filterGantt(
  projects: Project[],
  tasks: Task[],
  filterAssignee: string,
  currentUserId: string | null,
  isAdmin: boolean,
  selectedProject: string | null = null
) {
  const effectiveAssignee = isAdmin
    ? filterAssignee === "mine"
      ? currentUserId || "all"
      : filterAssignee
    : currentUserId || "all";

  const activeProjects = projects.filter((p) => p.status === "active");

  const visibleProjects = (() => {
    if (effectiveAssignee === "all") {
      if (isAdmin) return activeProjects;
      if (!currentUserId) return [];
      return activeProjects.filter((p) =>
        isProjectMatchingAssignee(p, currentUserId, tasks)
      );
    }
    if (effectiveAssignee === "unassigned") {
      return activeProjects.filter((p) =>
        tasks.some(
          (t) =>
            t.projectId === p.id &&
            !t.assigneeId &&
            (!t.assigneeIds || t.assigneeIds.length === 0) &&
            !seedTaskProfiles.some((tp) => tp.taskId === t.id)
        )
      );
    }
    return activeProjects.filter((p) =>
      isProjectMatchingAssignee(p, effectiveAssignee, tasks)
    );
  })();

  const allTasks = tasks.filter((t) => {
    if (effectiveAssignee === "unassigned") {
      const hasAssignee =
        Boolean(t.assigneeId) ||
        (t.assigneeIds && t.assigneeIds.length > 0) ||
        seedTaskProfiles.some((tp) => tp.taskId === t.id);
      if (hasAssignee) return false;
    } else if (effectiveAssignee !== "all") {
      if (!isTaskAssignee(t, effectiveAssignee)) return false;
    }

    if (!isAdmin && currentUserId) {
      if (!isTaskAssignee(t, currentUserId)) return false;
    }

    if (selectedProject) {
      if (t.projectId !== selectedProject) return false;
    } else {
      if (!visibleProjects.some((p) => p.id === t.projectId)) return false;
    }

    return true;
  });

  return { visibleProjects, allTasks };
}

describe("Gantt Page Assignee Filtering", () => {
  const adminId = "user-1"; // Vincent Lim
  const memberId = "user-3"; // Lim Lee Lee

  it("filters correctly for All Assignees (admin)", () => {
    const { visibleProjects, allTasks } = filterGantt(
      seedProjects,
      seedTasks,
      "all",
      adminId,
      true
    );
    expect(visibleProjects.length).toBe(4); // proj-1, proj-2, proj-3, proj-4 (active)
    expect(allTasks.length).toBeGreaterThan(0);
  });

  it("filters correctly for Assigned to Me (admin)", () => {
    const { visibleProjects, allTasks } = filterGantt(
      seedProjects,
      seedTasks,
      "mine",
      adminId,
      true
    );
    // Vincent Lim has task-1 in proj-1
    expect(visibleProjects.some((p) => p.id === "proj-1")).toBe(true);
    expect(allTasks.some((t) => t.id === "task-1")).toBe(true);
    // Every task must be assigned to adminId
    expect(allTasks.every((t) => isTaskAssignee(t, adminId))).toBe(true);
  });

  it("filters correctly when selecting a specific user (e.g. user-8 Jeffrey Lim)", () => {
    const { visibleProjects, allTasks } = filterGantt(
      seedProjects,
      seedTasks,
      "user-8",
      adminId,
      true
    );
    // Jeffrey Lim has tasks in proj-1, proj-2, proj-3
    expect(visibleProjects.some((p) => p.id === "proj-1")).toBe(true);
    expect(visibleProjects.some((p) => p.id === "proj-2")).toBe(true);
    expect(visibleProjects.some((p) => p.id === "proj-3")).toBe(true);
    // Task-3 is in proj-1 and assigned to user-8
    expect(allTasks.some((t) => t.id === "task-3")).toBe(true);
    expect(allTasks.every((t) => isTaskAssignee(t, "user-8"))).toBe(true);
  });

  it("filters correctly when selecting user-2 Michael Chua", () => {
    const { visibleProjects, allTasks } = filterGantt(
      seedProjects,
      seedTasks,
      "user-2",
      adminId,
      true
    );
    // Michael Chua has task-4 in proj-1 and task-14 in proj-3
    expect(visibleProjects.some((p) => p.id === "proj-1")).toBe(true);
    expect(visibleProjects.some((p) => p.id === "proj-3")).toBe(true);
    expect(allTasks.some((t) => t.id === "task-4")).toBe(true);
    expect(allTasks.some((t) => t.id === "task-14")).toBe(true);
    expect(allTasks.every((t) => isTaskAssignee(t, "user-2"))).toBe(true);
  });

  it("filters correctly for unassigned tasks", () => {
    const unassignedTask: Task = {
      id: "task-unassigned-1",
      projectId: "proj-1",
      title: "Unassigned Test Task",
      description: "",
      status: "todo",
      priority: "medium",
      assigneeId: null,
      assigneeIds: [],
      startDate: "2026-07-01",
      dueDate: "2026-07-31",
      tags: [],
      createdAt: "2026-07-01T00:00:00Z",
      order: 99,
    };
    const { visibleProjects, allTasks } = filterGantt(
      seedProjects,
      [...seedTasks, unassignedTask],
      "unassigned",
      adminId,
      true
    );
    expect(visibleProjects.some((p) => p.id === "proj-1")).toBe(true);
    expect(allTasks.some((t) => t.id === "task-unassigned-1")).toBe(true);
    expect(allTasks.length).toBe(1);
  });

  it("restricts member to their own tasks only", () => {
    const { visibleProjects, allTasks } = filterGantt(
      seedProjects,
      seedTasks,
      "all",
      memberId,
      false
    );
    // Lim Lee Lee (user-3) is member; should only see tasks assigned to herself
    expect(allTasks.every((t) => isTaskAssignee(t, memberId))).toBe(true);
    expect(allTasks.some((t) => t.id === "task-2")).toBe(true);
    expect(allTasks.some((t) => t.id === "task-8")).toBe(true);
  });
});
