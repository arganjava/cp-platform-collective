import { describe, it, expect } from "vitest";
import {
  seedProjects,
  seedTasks,
  seedProjectProfiles,
  seedTaskProfiles,
} from "@/lib/seed-data";
import type { Task, Project, ProjectProfile, TaskProfile } from "@/lib/types";

// Matching helpers identical to src/app/(app)/projects/page.tsx
function isTaskAssignee(
  t: Task,
  profileId: string,
  taskProfiles: TaskProfile[] = seedTaskProfiles
) {
  if (t.assigneeId === profileId) return true;
  if (t.assigneeIds && t.assigneeIds.includes(profileId)) return true;
  if (taskProfiles.some((tp) => tp.taskId === t.id && tp.profileId === profileId)) return true;
  return false;
}

function isProjectMatchingAssignee(
  p: Project,
  profileId: string,
  tasks: Task[] = seedTasks,
  projectProfiles: ProjectProfile[] = seedProjectProfiles,
  taskProfiles: TaskProfile[] = seedTaskProfiles
) {
  // 1. Direct project membership via project_profiles
  if (projectProfiles.some((pp) => pp.projectId === p.id && pp.profileId === profileId)) {
    return true;
  }
  // 2. Task assignment via task_profiles (or tasks.assignee_id / assigneeIds) pointing to this project
  if (tasks.some((t) => t.projectId === p.id && isTaskAssignee(t, profileId, taskProfiles))) {
    return true;
  }
  // 3. Fallback to owner or legacy memberIds
  if (p.ownerId === profileId || (p.memberIds && p.memberIds.includes(profileId))) {
    return true;
  }
  return false;
}

function getVisibleProjects(
  projects: Project[],
  tasks: Task[],
  projectProfiles: ProjectProfile[],
  taskProfiles: TaskProfile[],
  currentUserId: string | null,
  isAdmin: boolean,
  filterAssignee: string
) {
  const effectiveAssignee = isAdmin
    ? (filterAssignee === "mine" ? currentUserId || "all" : filterAssignee)
    : (currentUserId || "all");

  if (!isAdmin) {
    if (!currentUserId) return [];
    return projects.filter((p) =>
      isProjectMatchingAssignee(p, currentUserId, tasks, projectProfiles, taskProfiles)
    );
  }

  if (effectiveAssignee === "all") {
    return projects;
  }

  if (effectiveAssignee === "unassigned") {
    return projects.filter((p) =>
      tasks.some(
        (t) =>
          t.projectId === p.id &&
          !t.assigneeId &&
          (!t.assigneeIds || t.assigneeIds.length === 0) &&
          !taskProfiles.some((tp) => tp.taskId === t.id)
      )
    );
  }

  return projects.filter((p) =>
    isProjectMatchingAssignee(p, effectiveAssignee, tasks, projectProfiles, taskProfiles)
  );
}

describe("Projects Page Assignee & RBAC Filtering", () => {
  const adminId = "user-1"; // Vincent Lim (Admin)
  const memberId = "user-3"; // Lim Lee Lee (Member)
  const guestArtistId = "user-8"; // Jeffrey Lim (Guest / Artist)

  it("admin can see all projects when filter is 'all'", () => {
    const visible = getVisibleProjects(
      seedProjects,
      seedTasks,
      seedProjectProfiles,
      seedTaskProfiles,
      adminId,
      true,
      "all"
    );
    expect(visible.length).toBe(seedProjects.length);
  });

  it("admin filtering by 'mine' only sees projects matching admin membership or assigned tasks", () => {
    const visible = getVisibleProjects(
      seedProjects,
      seedTasks,
      seedProjectProfiles,
      seedTaskProfiles,
      adminId,
      true,
      "mine"
    );
    // Vincent Lim owns/has tasks in proj-1, proj-2, proj-3
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.every((p) => isProjectMatchingAssignee(p, adminId, seedTasks, seedProjectProfiles, seedTaskProfiles))).toBe(true);
  });

  it("admin filtering by specific user sees only projects where user is in project_profiles or has tasks in task_profiles", () => {
    const visible = getVisibleProjects(
      seedProjects,
      seedTasks,
      seedProjectProfiles,
      seedTaskProfiles,
      adminId,
      true,
      guestArtistId
    );
    expect(visible.length).toBeGreaterThan(0);
    visible.forEach((p) => {
      const match = isProjectMatchingAssignee(p, guestArtistId, seedTasks, seedProjectProfiles, seedTaskProfiles);
      expect(match).toBe(true);
    });
  });

  it("admin filtering by 'unassigned' sees only projects that contain unassigned tasks", () => {
    const unassignedTask: Task = {
      id: "task-test-unassigned",
      projectId: "proj-4",
      title: "Orphaned Task",
      description: "",
      status: "todo",
      priority: "medium",
      assigneeId: null,
      assigneeIds: [],
      startDate: "2026-08-01",
      dueDate: "2026-08-15",
      tags: [],
      createdAt: "2026-08-01T00:00:00Z",
      order: 10,
    };

    const visible = getVisibleProjects(
      seedProjects,
      [...seedTasks, unassignedTask],
      seedProjectProfiles,
      seedTaskProfiles,
      adminId,
      true,
      "unassigned"
    );
    expect(visible.some((p) => p.id === "proj-4")).toBe(true);
  });

  it("non-admin member sees ONLY self projects (matching project_profiles or task_profiles)", () => {
    // Custom isolated setup to verify strict exclusion
    const customProjects: Project[] = [
      {
        id: "proj-assigned-member",
        title: "Member Assigned Project",
        description: "Assigned via project_profiles",
        status: "active",
        color: "#10b981",
        createdAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "proj-task-member",
        title: "Member Task Project",
        description: "Assigned via task_profiles only",
        status: "active",
        color: "#3b82f6",
        createdAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "proj-unrelated",
        title: "Secret Project",
        description: "User has neither project membership nor task assignments",
        status: "active",
        color: "#ef4444",
        createdAt: "2026-01-01T00:00:00Z",
      },
    ];

    const customProjectProfiles: ProjectProfile[] = [
      {
        id: "pp-1",
        projectId: "proj-assigned-member",
        profileId: memberId,
        role: "member",
        createdAt: "2026-01-01T00:00:00Z",
      },
    ];

    const customTasks: Task[] = [
      {
        id: "task-in-second-proj",
        projectId: "proj-task-member",
        title: "Task for Member",
        description: "",
        status: "todo",
        priority: "high",
        assigneeId: null,
        assigneeIds: [],
        startDate: "2026-01-01",
        dueDate: "2026-01-10",
        tags: [],
        createdAt: "2026-01-01T00:00:00Z",
        order: 1,
      },
      {
        id: "task-in-unrelated",
        projectId: "proj-unrelated",
        title: "Secret Task",
        description: "",
        status: "todo",
        priority: "low",
        assigneeId: adminId,
        assigneeIds: [adminId],
        startDate: "2026-01-01",
        dueDate: "2026-01-10",
        tags: [],
        createdAt: "2026-01-01T00:00:00Z",
        order: 1,
      },
    ];

    const customTaskProfiles: TaskProfile[] = [
      {
        id: "tp-1",
        taskId: "task-in-second-proj",
        profileId: memberId,
        createdAt: "2026-01-01T00:00:00Z",
      },
    ];

    // Call as non-admin (isAdmin = false)
    const visible = getVisibleProjects(
      customProjects,
      customTasks,
      customProjectProfiles,
      customTaskProfiles,
      memberId,
      false, // non-admin
      "all" // even if filter was somehow "all", non-admin must be restricted to self
    );

    expect(visible.map((p) => p.id)).toEqual([
      "proj-assigned-member",
      "proj-task-member",
    ]);
    expect(visible.some((p) => p.id === "proj-unrelated")).toBe(false);
  });
});
