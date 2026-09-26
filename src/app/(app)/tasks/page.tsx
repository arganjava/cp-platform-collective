"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useStore } from "@/lib/store";
import { cn, getInitials, formatDate, generateId } from "@/lib/utils";
import type { Task, Priority, TaskStatus, TaskLink, User } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { PageFrame, PageHeader, Toolbar } from "@/components/page-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Avatar } from "@/components/ui/avatar";
import {
  Plus,
  CalendarDays,
  CheckCircle2,
  Clock,
  AlertCircle,
  Eye,
  Pencil,
  Trash2,
  Search,
  Filter,
  X,
  User as UserIcon,
  FolderKanban,
  RotateCcw,
  AlertTriangle,
  Flag,
  ExternalLink,
  Users,
} from "lucide-react";

const priorityVariant: Record<string, "neutral" | "warning" | "accent" | "danger"> = {
  low: "neutral",
  medium: "warning",
  high: "accent",
  urgent: "danger",
};

const statusConfig = {
  todo: { label: "To Do", color: "var(--color-status-todo)", icon: Clock },
  in_progress: { label: "In Progress", color: "var(--color-status-progress)", icon: AlertCircle },
  review: { label: "Review", color: "var(--color-status-review)", icon: Eye },
  done: { label: "Done", color: "var(--color-status-done)", icon: CheckCircle2 },
};

type DeadlineFilter = "all" | "overdue" | "today" | "this_week" | "this_month" | "later" | "no_due_date";

export default function TasksPage() {
  const {
    tasks,
    projects,
    users,
    projectProfiles,
    taskProfiles,
    currentUserId,
    getUserById,
    getActiveUsers,
    updateTaskStatus,
    updateTask,
    deleteTask,
    addTask,
    searchQuery: globalSearchQuery,
  } = useStore();

  const currentUser = getUserById(currentUserId);
  const isAdmin = currentUser?.role === "admin";
  const activeUsers = getActiveUsers();

  function formatTimeOnly(str?: string | null): string {
    if (!str) return "";
    if (str.includes("T")) {
      const time = str.split("T")[1];
      return time.substring(0, 5);
    }
    return str.substring(0, 5);
  }

  const isTaskAssignee = useCallback(
    (t: Task, profileId: string) => {
      if (t.assigneeId === profileId) return true;
      if (t.assigneeIds && t.assigneeIds.includes(profileId)) return true;
      if (taskProfiles.some((tp) => tp.taskId === t.id && tp.profileId === profileId)) return true;
      return false;
    },
    [taskProfiles]
  );

  const getTaskAssigneeList = useCallback(
    (t: Task): User[] => {
      const fromStore = taskProfiles
        .filter((tp) => tp.taskId === t.id)
        .map((tp) => getUserById(tp.profileId))
        .filter(Boolean) as User[];
      if (fromStore.length > 0) return fromStore;
      if (t.assigneeIds && t.assigneeIds.length > 0) {
        return t.assigneeIds.map((id) => getUserById(id)).filter(Boolean) as User[];
      }
      return [t.assigneeId ? getUserById(t.assigneeId) : null].filter(Boolean) as User[];
    },
    [taskProfiles, getUserById]
  );

  // Multi-filter states
  const [localSearch, setLocalSearch] = useState("");
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterDeadline, setFilterDeadline] = useState<DeadlineFilter>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"dueDate" | "priority" | "project" | "title">("dueDate");

  // Create Task State
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskProject, setNewTaskProject] = useState("");
  const [newTaskAssignees, setNewTaskAssignees] = useState<string[]>(
    currentUserId ? [currentUserId] : []
  );
  const [newTaskPriority, setNewTaskPriority] = useState<Priority>("medium");
  const [newTaskDueDate, setNewTaskDueDate] = useState<string>("");
  const [newTaskCheckDate, setNewTaskCheckDate] = useState<string>("");
  const [newTaskCheckStartTime, setNewTaskCheckStartTime] = useState<string>("09:00");
  const [newTaskCheckEndTime, setNewTaskCheckEndTime] = useState<string>("10:00");
  const [newTaskLinks, setNewTaskLinks] = useState<{ id: string; label: string; url: string }[]>([]);

  // Edit Task State
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    title: string;
    description: string;
    projectId: string;
    status: TaskStatus;
    priority: Priority;
    assigneeIds: string[];
    dueDate: string;
    checkDate: string;
    checkStartTime: string;
    checkEndTime: string;
    googleCalendarId?: string | null;
    links: { id: string; label: string; url: string }[];
  }>({
    title: "",
    description: "",
    projectId: "",
    status: "todo",
    priority: "medium",
    assigneeIds: [],
    dueDate: "",
    checkDate: "",
    checkStartTime: "",
    checkEndTime: "",
    googleCalendarId: null,
    links: [],
  });

  // Delete Task State
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);

  const query = (localSearch || globalSearchQuery).trim().toLowerCase();

  // Role-based visibility: admin can view all data; member/guest base on tasks.assignee_id and project_profiles
  const userMemberProjectIds = useMemo(() => {
    if (isAdmin) return null;
    if (!currentUserId) return new Set<string>();
    return new Set(
      projectProfiles
        .filter((pp) => pp.profileId === currentUserId)
        .map((pp) => pp.projectId)
    );
  }, [projectProfiles, isAdmin, currentUserId]);

  const userAssignedProjectIds = useMemo(() => {
    if (isAdmin) return null;
    if (!currentUserId) return new Set<string>();
    return new Set(
      tasks.filter((t) => isTaskAssignee(t, currentUserId)).map((t) => t.projectId)
    );
  }, [tasks, isAdmin, currentUserId, isTaskAssignee]);

  const visibleProjects = useMemo(() => {
    if (isAdmin) return projects;
    if (!currentUserId) return [];
    return projects.filter(
      (p) =>
        (userMemberProjectIds && userMemberProjectIds.has(p.id)) ||
        (userAssignedProjectIds && userAssignedProjectIds.has(p.id)) ||
        p.ownerId === currentUserId
    );
  }, [projects, isAdmin, currentUserId, userMemberProjectIds, userAssignedProjectIds]);

  const visibleTasks = useMemo(() => {
    if (isAdmin) return tasks;
    if (!currentUserId) return [];
    return tasks.filter((t) => isTaskAssignee(t, currentUserId));
  }, [tasks, isAdmin, currentUserId, isTaskAssignee]);

  useEffect(() => {
    if (filterProject !== "all" && !visibleProjects.some((p) => p.id === filterProject)) {
      setFilterProject("all");
    }
  }, [filterProject, visibleProjects]);

  // Today reference date normalized to midnight
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const nextWeekMs = Date.now() + 7 * 86400000;
  const nextMonthMs = Date.now() + 30 * 86400000;

  // Filter combined logic
  const filteredTasks = useMemo(() => {
    return visibleTasks
      .filter((t) => {
        // 1. Search Query
        if (query) {
          const project = projects.find((p) => p.id === t.projectId);
          const assignees = getTaskAssigneeList(t);
          const assigneeNames = assignees.map((u) => u.name).join(" ");
          const assigneeEmails = assignees.map((u) => u.email).join(" ");
          const haystack = [
            t.title,
            t.description || "",
            project?.title ?? "",
            assigneeNames,
            assigneeEmails,
            ...t.tags,
          ]
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(query)) return false;
        }

        // 2. Status Filter
        if (filterStatus !== "all" && t.status !== filterStatus) return false;

        // 3. Priority Filter
        if (filterPriority !== "all" && t.priority !== filterPriority) return false;

        // 4. Project Filter
        if (filterProject !== "all" && t.projectId !== filterProject) return false;

        // 5. Assignee Filter (for admin)
        if (isAdmin) {
          if (filterAssignee === "unassigned") {
            const assignees = getTaskAssigneeList(t);
            if (assignees.length > 0 || t.assigneeId) return false;
          } else if (filterAssignee === "mine") {
            if (!currentUserId || !isTaskAssignee(t, currentUserId)) return false;
          } else if (filterAssignee !== "all") {
            if (!isTaskAssignee(t, filterAssignee)) return false;
          }
        }

        // 6. Deadline Filter
        if (filterDeadline !== "all") {
          if (!t.dueDate) {
            if (filterDeadline !== "no_due_date") return false;
          } else {
            const taskDueMs = new Date(t.dueDate).getTime();
            const isDone = t.status === "done";
            const taskDueStr = t.dueDate.split("T")[0];

            if (filterDeadline === "overdue") {
              if (isDone || taskDueStr >= todayStr) return false;
            } else if (filterDeadline === "today") {
              if (taskDueStr !== todayStr) return false;
            } else if (filterDeadline === "this_week") {
              if (taskDueStr < todayStr || taskDueMs > nextWeekMs) return false;
            } else if (filterDeadline === "this_month") {
              if (taskDueStr < todayStr || taskDueMs > nextMonthMs) return false;
            } else if (filterDeadline === "later") {
              if (taskDueMs <= nextMonthMs) return false;
            } else if (filterDeadline === "no_due_date") {
              return false;
            }
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "dueDate") {
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }
        if (sortBy === "priority") {
          const order = { urgent: 0, high: 1, medium: 2, low: 3 };
          return (order[a.priority] ?? 4) - (order[b.priority] ?? 4);
        }
        if (sortBy === "project") {
          const projA = projects.find((p) => p.id === a.projectId)?.title || "";
          const projB = projects.find((p) => p.id === b.projectId)?.title || "";
          return projA.localeCompare(projB);
        }
        return a.title.localeCompare(b.title);
      });
  }, [
    visibleTasks,
    isAdmin,
    query,
    filterStatus,
    filterPriority,
    filterProject,
    filterAssignee,
    filterDeadline,
    sortBy,
    projects,
    getTaskAssigneeList,
    isTaskAssignee,
    currentUserId,
    todayStr,
    nextWeekMs,
    nextMonthMs,
  ]);

  const hasActiveFilters =
    localSearch !== "" ||
    filterStatus !== "all" ||
    filterPriority !== "all" ||
    filterProject !== "all" ||
    filterAssignee !== "all" ||
    filterDeadline !== "all";

  function handleResetFilters() {
    setLocalSearch("");
    setFilterStatus("all");
    setFilterPriority("all");
    setFilterProject("all");
    setFilterAssignee("all");
    setFilterDeadline("all");
  }

  function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    const availableProjects = visibleProjects.length > 0 ? visibleProjects : projects;
    const projectId = newTaskProject || availableProjects[0]?.id;
    if (!newTaskTitle.trim() || !projectId) return;

    const finalAssignees =
      newTaskAssignees.length > 0
        ? newTaskAssignees
        : currentUserId && !isAdmin
        ? [currentUserId]
        : [];

    const checkDate = newTaskCheckDate.trim() ? newTaskCheckDate.trim() : null;
    const checkStartTime =
      checkDate && newTaskCheckStartTime.trim()
        ? `${checkDate}T${newTaskCheckStartTime.trim()}:00`
        : checkDate
        ? `${checkDate}T09:00:00`
        : null;
    const checkEndTime =
      checkDate && newTaskCheckEndTime.trim()
        ? `${checkDate}T${newTaskCheckEndTime.trim()}:00`
        : checkDate
        ? `${checkDate}T10:00:00`
        : null;

    const sanitizedLinks = newTaskLinks
      .map((l, idx) => ({
        id: l.id || `link-${idx + 1}`,
        label: l.label.trim() || "Link",
        url: l.url.trim(),
      }))
      .filter((l) => l.url.length > 0);

    const primaryLink = sanitizedLinks.length > 0 ? sanitizedLinks[0].url : null;

    addTask({
      id: generateId(),
      projectId,
      title: newTaskTitle.trim(),
      description: newTaskDescription.trim(),
      status: "todo",
      priority: newTaskPriority,
      assigneeId: finalAssignees[0] || null,
      assigneeIds: finalAssignees,
      startDate: new Date().toISOString().split("T")[0],
      dueDate: newTaskDueDate.trim() ? newTaskDueDate.trim() : null,
      checkDate,
      checkStartTime,
      checkEndTime,
      link: primaryLink,
      links: sanitizedLinks,
      tags: [],
      createdAt: new Date().toISOString(),
      order: tasks.length,
    });

    setNewTaskTitle("");
    setNewTaskDescription("");
    setNewTaskDueDate("");
    setNewTaskCheckDate("");
    setNewTaskCheckStartTime("09:00");
    setNewTaskCheckEndTime("10:00");
    setNewTaskLinks([]);
    setNewTaskAssignees(currentUserId ? [currentUserId] : []);
    setShowNewTask(false);
  }

  function openEditTask(task: Task) {
    setEditingTaskId(task.id);
    const resolvedLinks: { id: string; label: string; url: string }[] =
      task.links && task.links.length > 0
        ? task.links.map((l, i) => ({
            id: l.id || `link-${i + 1}`,
            label: l.label || "Link",
            url: l.url || "",
          }))
        : task.link
        ? [{ id: "link-1", label: "Link", url: task.link }]
        : [];

    const rawCheckDate = task.checkDate ? task.checkDate.split("T")[0] : "";
    let startTimeStr = "09:00";
    let endTimeStr = "10:00";
    if (task.checkStartTime) {
      startTimeStr = formatTimeOnly(task.checkStartTime);
    }
    if (task.checkEndTime) {
      endTimeStr = formatTimeOnly(task.checkEndTime);
    }

    const initialAssignees =
      task.assigneeIds && task.assigneeIds.length > 0
        ? task.assigneeIds
        : task.assigneeId
        ? [task.assigneeId]
        : taskProfiles
            .filter((tp) => tp.taskId === task.id)
            .map((tp) => tp.profileId);

    setEditForm({
      title: task.title,
      description: task.description || "",
      projectId: task.projectId,
      status: task.status,
      priority: task.priority,
      assigneeIds: initialAssignees,
      dueDate: task.dueDate ? task.dueDate.split("T")[0] : "",
      checkDate: rawCheckDate,
      checkStartTime: startTimeStr,
      checkEndTime: endTimeStr,
      googleCalendarId: task.googleCalendarId || null,
      links: resolvedLinks,
    });
  }

  function handleSaveTask() {
    if (!editingTaskId || !editForm.title.trim() || !editForm.projectId) return;
    const sanitizedLinks = editForm.links
      .map((l, idx) => ({
        id: l.id || `link-${idx + 1}`,
        label: l.label.trim() || "Link",
        url: l.url.trim(),
      }))
      .filter((l) => l.url.length > 0);

    const primaryLink = sanitizedLinks.length > 0 ? sanitizedLinks[0].url : null;

    const checkDate = editForm.checkDate.trim() ? editForm.checkDate.trim() : null;
    const checkStartTime =
      checkDate && editForm.checkStartTime.trim()
        ? `${checkDate}T${editForm.checkStartTime.trim()}:00`
        : checkDate
        ? `${checkDate}T09:00:00`
        : null;
    const checkEndTime =
      checkDate && editForm.checkEndTime.trim()
        ? `${checkDate}T${editForm.checkEndTime.trim()}:00`
        : checkDate
        ? `${checkDate}T10:00:00`
        : null;

    updateTask(editingTaskId, {
      title: editForm.title.trim(),
      description: editForm.description,
      projectId: editForm.projectId,
      status: editForm.status,
      priority: editForm.priority,
      assigneeId: editForm.assigneeIds[0] || null,
      assigneeIds: editForm.assigneeIds,
      dueDate: editForm.dueDate.trim() ? editForm.dueDate.trim() : null,
      checkDate,
      checkStartTime,
      checkEndTime,
      link: primaryLink,
      links: sanitizedLinks,
    });
    setEditingTaskId(null);
  }

  function handleConfirmDeleteTask() {
    if (!deletingTask) return;
    deleteTask(deletingTask.id);
    setDeletingTask(null);
  }

  return (
    <>
      <PageFrame id="tasks-page-frame">
        {/* Header */}
        <PageHeader
          title="Tasks"
          description={`Showing ${filteredTasks.length} of ${visibleTasks.length} tasks across ${visibleProjects.length} active projects.`}
          actions={
            <Button
              id="btn-create-task-top"
              size="sm"
              onClick={() => {
                if ((!newTaskProject || !visibleProjects.some((p) => p.id === newTaskProject)) && visibleProjects.length > 0) {
                  setNewTaskProject(visibleProjects[0].id);
                }
                setNewTaskAssignees(currentUserId ? [currentUserId] : []);
                setShowNewTask(true);
              }}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>New Task</span>
            </Button>
          }
        />

        {/* Quick Status Stats */}
        <div className="grid grid-cols-2 gap-0 border-y border-border sm:grid-cols-4" id="tasks-status-tabs">
          {(Object.entries(statusConfig) as [TaskStatus, typeof statusConfig.todo][]).map(([status, config]) => {
            const count = visibleTasks.filter((t) => t.status === status).length;
            const isSelected = filterStatus === status;
            const Icon = config.icon;
            return (
              <button
                key={status}
                type="button"
                id={`status-tab-${status}`}
                onClick={() => setFilterStatus(isSelected ? "all" : status)}
                className={cn(
                  "flex min-h-11 items-center gap-3 px-5 py-4 text-left transition-colors border-r border-border last:border-r-0 cursor-pointer",
                  isSelected ? "bg-secondary text-foreground" : "hover:bg-secondary/40 text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" style={{ color: config.color }} aria-hidden="true" />
                <div>
                  <p className="text-lg font-bold tabular text-foreground">{count}</p>
                  <p className="text-xs font-medium uppercase tracking-wider text-subtle-foreground">{config.label}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Comprehensive Multi-Filter Toolbar */}
        <Toolbar id="tasks-filter-toolbar" className="flex-col items-stretch sm:flex-row sm:items-center gap-3">
          {/* Search Input */}
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle-foreground" aria-hidden="true" />
            <Input
              id="tasks-search-input"
              type="search"
              aria-label="Search tasks"
              placeholder="Search by title, project, assignee, or tag..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>

          {/* Filter Dropdowns Grid */}
          <div className="flex flex-wrap items-center gap-2">
            {/* 1. Assignee Filter */}
            {isAdmin ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-subtle-foreground">Assignee:</span>
                <Select
                  id="filter-task-assignee"
                  aria-label="Filter tasks by assignee"
                  value={filterAssignee}
                  onChange={(e) => setFilterAssignee(e.target.value)}
                  className="w-36 text-xs"
                >
                  <option value="all">All Assignees</option>
                  <option value="mine">Assigned to Me</option>
                  <option value="unassigned">Unassigned</option>
                  {activeUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </Select>
              </div>
            ) : (
              <div className="flex items-center gap-1.5" title="As a member or guest, you view tasks assigned to you">
                <span className="text-xs font-semibold uppercase tracking-wider text-subtle-foreground">Assignee:</span>
                <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-secondary text-foreground border border-border">
                  Assigned to You
                </span>
              </div>
            )}

            {/* 2. Project Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-subtle-foreground">Project:</span>
              <Select
                id="filter-task-project"
                aria-label="Filter tasks by project"
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
                className="w-36 text-xs"
              >
                <option value="all">All Projects</option>
                {visibleProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </Select>
            </div>

            {/* 3. Deadline Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-subtle-foreground">Deadline:</span>
              <Select
                id="filter-task-deadline"
                aria-label="Filter tasks by deadline"
                value={filterDeadline}
                onChange={(e) => setFilterDeadline(e.target.value as DeadlineFilter)}
                className="w-36 text-xs"
              >
                <option value="all">All Deadlines</option>
                <option value="overdue">⚠️ Overdue</option>
                <option value="today">Due Today</option>
                <option value="this_week">Due This Week</option>
                <option value="this_month">Due This Month</option>
                <option value="later">Upcoming / Later</option>
                <option value="no_due_date">No Due Date</option>
              </Select>
            </div>

            {/* 4. Priority Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-subtle-foreground">Priority:</span>
              <Select
                id="filter-task-priority"
                aria-label="Filter tasks by priority"
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="w-32 text-xs"
              >
                <option value="all">All Priorities</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </Select>
            </div>

            {/* 5. Sort By */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-subtle-foreground">Sort:</span>
              <Select
                id="filter-task-sort"
                aria-label="Sort tasks by"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "dueDate" | "priority" | "project" | "title")}
                className="w-32 text-xs"
              >
                <option value="dueDate">Due Date</option>
                <option value="priority">Priority</option>
                <option value="project">Project</option>
                <option value="title">Title</option>
              </Select>
            </div>
          </div>
        </Toolbar>

        {/* Active Filter Badges Bar */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 px-1 text-xs" id="active-filter-chips">
            <span className="font-semibold uppercase tracking-wider text-subtle-foreground">Active Filters:</span>

            {localSearch && (
              <Badge variant="neutral" className="gap-1 font-normal">
                <span>Search: &ldquo;{localSearch}&rdquo;</span>
                <button
                  type="button"
                  aria-label="Clear search filter"
                  onClick={() => setLocalSearch("")}
                  className="hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}

            {filterAssignee !== "all" && (
              <Badge variant="neutral" className="gap-1 font-normal">
                <span>
                  Assignee:{" "}
                  {filterAssignee === "mine"
                    ? "Assigned to Me"
                    : filterAssignee === "unassigned"
                    ? "Unassigned"
                    : getUserById(filterAssignee)?.name || "User"}
                </span>
                <button
                  type="button"
                  aria-label="Clear assignee filter"
                  onClick={() => setFilterAssignee("all")}
                  className="hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}

            {filterProject !== "all" && (
              <Badge variant="neutral" className="gap-1 font-normal">
                <span>Project: {projects.find((p) => p.id === filterProject)?.title || "Project"}</span>
                <button
                  type="button"
                  aria-label="Clear project filter"
                  onClick={() => setFilterProject("all")}
                  className="hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}

            {filterDeadline !== "all" && (
              <Badge variant="neutral" className="gap-1 font-normal">
                <span>
                  Deadline:{" "}
                  {filterDeadline === "overdue"
                    ? "Overdue"
                    : filterDeadline === "today"
                    ? "Today"
                    : filterDeadline === "this_week"
                    ? "This Week"
                    : filterDeadline === "this_month"
                    ? "This Month"
                    : filterDeadline === "later"
                    ? "Later"
                    : "No Due Date"}
                </span>
                <button
                  type="button"
                  aria-label="Clear deadline filter"
                  onClick={() => setFilterDeadline("all")}
                  className="hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}

            {filterPriority !== "all" && (
              <Badge variant="neutral" className="gap-1 font-normal capitalize">
                <span>Priority: {filterPriority}</span>
                <button
                  type="button"
                  aria-label="Clear priority filter"
                  onClick={() => setFilterPriority("all")}
                  className="hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}

            {filterStatus !== "all" && (
              <Badge variant="neutral" className="gap-1 font-normal">
                <span>Status: {statusConfig[filterStatus as TaskStatus]?.label || filterStatus}</span>
                <button
                  type="button"
                  aria-label="Clear status filter"
                  onClick={() => setFilterStatus("all")}
                  className="hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="h-6 px-2 text-[11px] text-destructive hover:bg-destructive/10"
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              Reset All
            </Button>
          </div>
        )}

        {/* Task Table */}
        <Card id="tasks-table-card" className="border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" id="tasks-table">
              <thead className="border-b border-border bg-secondary/60 text-xs font-semibold uppercase tracking-wider text-subtle-foreground">
                <tr>
                  <th className="px-4 py-3.5 sm:px-6">Task</th>
                  <th className="px-4 py-3.5">Project</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Priority</th>
                  <th className="px-4 py-3.5">Assignee</th>
                  <th className="px-4 py-3.5">Deadline</th>
                  <th className="px-4 py-3.5 text-right sm:px-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-14 text-center text-muted-foreground">
                      <AlertCircle className="mx-auto mb-2 h-8 w-8 text-subtle-foreground" />
                      <p className="font-medium text-foreground">No tasks match the selected filters.</p>
                      <p className="mt-1 text-xs text-subtle-foreground">
                        Try resetting or combining different filter parameters.
                      </p>
                      {hasActiveFilters && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleResetFilters}
                          className="mt-4"
                        >
                          Clear All Filters
                        </Button>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((task) => {
                    const project = projects.find((p) => p.id === task.projectId);
                    const assignee = task.assigneeId ? getUserById(task.assigneeId) : null;
                    const daysLeft = task.dueDate
                      ? Math.ceil(
                          (new Date(task.dueDate).getTime() - new Date(todayStr).getTime()) / 86400000
                        )
                      : null;
                    const isOverdue = daysLeft !== null && daysLeft < 0 && task.status !== "done";
                    const isDueToday = daysLeft !== null && daysLeft === 0 && task.status !== "done";

                    return (
                      <tr
                        key={task.id}
                        id={`task-row-${task.id}`}
                        className={cn(
                          "transition-colors hover:bg-secondary/30",
                          isOverdue && "bg-destructive/5"
                        )}
                      >
                        <td className="px-4 py-3.5 sm:px-6">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() =>
                                updateTaskStatus(task.id, task.status === "done" ? "todo" : "done")
                              }
                              aria-label={
                                task.status === "done"
                                  ? `Mark "${task.title}" as incomplete`
                                  : `Mark "${task.title}" as complete`
                              }
                              className={cn(
                                "flex h-5 w-5 shrink-0 items-center justify-center border transition-all cursor-pointer",
                                task.status === "done"
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-input hover:border-primary"
                              )}
                            >
                              {task.status === "done" && <CheckCircle2 className="h-3.5 w-3.5" />}
                            </button>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={cn(
                                    "font-medium text-foreground",
                                    task.status === "done" && "line-through text-subtle-foreground"
                                  )}
                                >
                                  {task.title}
                                </span>
                                {(() => {
                                  const displayLinks: TaskLink[] =
                                    task.links && task.links.length > 0
                                      ? task.links
                                      : task.link
                                      ? [{ id: "link-1", label: "Link", url: task.link }]
                                      : [];

                                  if (displayLinks.length === 0) return null;

                                  return (
                                    <div className="inline-flex items-center gap-1.5 flex-wrap">
                                      {displayLinks.map((lnk, idx) => {
                                        const href =
                                          lnk.url.startsWith("http://") || lnk.url.startsWith("https://")
                                            ? lnk.url
                                            : `https://${lnk.url}`;
                                        return (
                                          <a
                                            key={lnk.id || idx}
                                            href={href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-primary/10 text-primary hover:bg-primary/20 hover:underline transition-colors"
                                            title={`${lnk.label}: ${lnk.url}`}
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <ExternalLink className="h-3 w-3 shrink-0" />
                                            <span className="truncate max-w-[120px]">{lnk.label || "Link"}</span>
                                          </a>
                                        );
                                      })}
                                    </div>
                                  );
                                })()}
                              </div>
                              {task.description && (
                                <p className="truncate text-xs text-muted-foreground max-w-xs sm:max-w-sm">
                                  {task.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: project?.color || "var(--primary)" }}
                            />
                            <span className="truncate text-xs text-muted-foreground">
                              {project?.title || "No Project"}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <Select
                            id={`select-status-${task.id}`}
                            aria-label={`Change status for ${task.title}`}
                            value={task.status}
                            onChange={(e) =>
                              updateTaskStatus(task.id, e.target.value as TaskStatus)
                            }
                            className="h-8 text-xs font-medium px-2 py-1 w-28"
                          >
                            <option value="todo">To Do</option>
                            <option value="in_progress">In Progress</option>
                            <option value="review">Review</option>
                            <option value="done">Done</option>
                          </Select>
                        </td>

                        <td className="px-4 py-3.5">
                          <Badge variant={priorityVariant[task.priority]} className="capitalize text-[11px]">
                            {task.priority}
                          </Badge>
                        </td>

                        <td className="px-4 py-3.5">
                          {(() => {
                            const taskAssignees = getTaskAssigneeList(task);
                            if (taskAssignees.length === 0) {
                              return <span className="text-xs text-subtle-foreground italic">Unassigned</span>;
                            }
                            return (
                              <div className="flex items-center gap-2" title={taskAssignees.map((u) => u.name).join(", ")}>
                                <div className="flex -space-x-1.5 overflow-hidden shrink-0">
                                  {taskAssignees.map((u) => (
                                    <Avatar
                                      key={u.id}
                                      color={u.avatarColor || "var(--primary)"}
                                      size="sm"
                                      className="h-6 w-6 text-[10px] ring-1 ring-background"
                                      aria-label={u.name}
                                    >
                                      {getInitials(u.name)}
                                    </Avatar>
                                  ))}
                                </div>
                                <span className="truncate text-xs font-medium text-foreground max-w-[130px]">
                                  {taskAssignees.map((u) => u.name).join(", ")}
                                </span>
                              </div>
                            );
                          })()}
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5 text-xs">
                            <CalendarDays className="h-3.5 w-3.5 text-subtle-foreground shrink-0" />
                            <span
                              className={cn(
                                "tabular",
                                isOverdue && "font-semibold text-destructive",
                                isDueToday && "font-semibold text-accent"
                              )}
                            >
                              {task.dueDate ? formatDate(task.dueDate) : "No due date"}
                            </span>
                          </div>
                          {task.checkDate && (
                            <div className="mt-0.5 space-y-0.5">
                              <div
                                className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-medium"
                                title={`Check Date: ${formatDate(task.checkDate)}${task.checkStartTime ? ` (${formatTimeOnly(task.checkStartTime)}${task.checkEndTime ? ` - ${formatTimeOnly(task.checkEndTime)}` : ""})` : ""}`}
                              >
                                <Flag className="h-3 w-3 fill-blue-600 text-blue-600 dark:fill-blue-400 dark:text-blue-400 shrink-0" />
                                <span className="tabular">Check: {formatDate(task.checkDate)}</span>
                              </div>
                              {(task.checkStartTime || task.checkEndTime) && (
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground pl-4">
                                  <Clock className="h-2.5 w-2.5 shrink-0" />
                                  <span className="tabular font-mono">
                                    {formatTimeOnly(task.checkStartTime) || "09:00"}
                                    {" - "}
                                    {formatTimeOnly(task.checkEndTime) || "10:00"}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                          {task.googleCalendarId && (
                            <div
                              className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5"
                              title={`Google Calendar ID: ${task.googleCalendarId}`}
                            >
                              <CalendarDays className="h-2.5 w-2.5 shrink-0" />
                              <span>Calendar Synced</span>
                            </div>
                          )}
                          {isOverdue && (
                            <span className="text-[10px] font-semibold text-destructive uppercase tracking-wider block mt-0.5">
                              Overdue by {Math.abs(daysLeft)}d
                            </span>
                          )}
                          {isDueToday && (
                            <span className="text-[10px] font-semibold text-accent uppercase tracking-wider block mt-0.5">
                              Due Today
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-right sm:px-6">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              aria-label={`Edit ${task.title}`}
                              onClick={() => openEditTask(task)}
                              className="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Delete ${task.title}`}
                              onClick={() => setDeletingTask(task)}
                              className="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </PageFrame>

      {/* New Task Dialog */}
      <Dialog open={showNewTask} onOpenChange={setShowNewTask}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>Add a new actionable item to your workflow with priority and assignee.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateTask} className="space-y-4 pt-2">
            <div>
              <label htmlFor="input-new-task-title" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-subtle-foreground">
                Task Title *
              </label>
              <Input
                id="input-new-task-title"
                required
                placeholder="What needs to be done?"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="input-new-task-desc" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-subtle-foreground">
                Description (Optional)
              </label>
              <Textarea
                id="input-new-task-desc"
                rows={2}
                placeholder="Add context or acceptance criteria..."
                value={newTaskDescription}
                onChange={(e) => setNewTaskDescription(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="select-new-task-project" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-subtle-foreground">
                  Project *
                </label>
                <Select
                  id="select-new-task-project"
                  required
                  value={newTaskProject}
                  onChange={(e) => setNewTaskProject(e.target.value)}
                  className="w-full"
                >
                  {visibleProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label htmlFor="select-new-task-priority" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-subtle-foreground">
                  Priority *
                </label>
                <Select
                  id="select-new-task-priority"
                  value={newTaskPriority}
                  onChange={(e) => setNewTaskPriority(e.target.value as Priority)}
                  className="w-full"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </Select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-subtle-foreground">
                  <Users className="h-3.5 w-3.5 text-primary" />
                  <span>Assignees</span>
                  <span className="text-[11px] font-normal text-muted-foreground">({newTaskAssignees.length} selected)</span>
                </label>
                {currentUserId && !newTaskAssignees.includes(currentUserId) && (
                  <button
                    type="button"
                    onClick={() => setNewTaskAssignees((prev) => [...prev, currentUserId])}
                    className="text-[11px] text-primary hover:underline font-medium"
                  >
                    + Assign to Me
                  </button>
                )}
              </div>

              {/* Selected Assignees Pills */}
              <div className="flex flex-wrap items-center gap-1.5 p-2 min-h-10 border border-border rounded-lg bg-card/50 mb-2">
                {newTaskAssignees.length === 0 ? (
                  <span className="text-xs text-muted-foreground italic">No assignees selected (Unassigned)</span>
                ) : (
                  newTaskAssignees.map((userId) => {
                    const u = getUserById(userId);
                    if (!u) return null;
                    return (
                      <span
                        key={u.id}
                        className="inline-flex items-center gap-1.5 pl-1.5 pr-2 py-0.5 text-xs bg-secondary border border-border text-foreground rounded-md font-medium"
                      >
                        <Avatar
                          color={u.avatarColor || "var(--primary)"}
                          size="sm"
                          className="h-4 w-4 text-[9px]"
                        >
                          {getInitials(u.name)}
                        </Avatar>
                        <span>{u.name}</span>
                        <button
                          type="button"
                          onClick={() => setNewTaskAssignees((prev) => prev.filter((id) => id !== u.id))}
                          className="hover:text-destructive text-muted-foreground ml-0.5"
                          aria-label={`Remove ${u.name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    );
                  })
                )}
              </div>

              {/* User Selection List */}
              <div className="max-h-36 overflow-y-auto border border-border rounded-lg p-1.5 divide-y divide-border/40 bg-card/30">
                {activeUsers.map((u) => {
                  const isSelected = newTaskAssignees.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() =>
                        setNewTaskAssignees((prev) =>
                          isSelected ? prev.filter((id) => id !== u.id) : [...prev, u.id]
                        )
                      }
                      className={cn(
                        "w-full flex items-center justify-between p-1.5 text-xs rounded hover:bg-secondary/70 transition-colors text-left",
                        isSelected && "bg-secondary font-medium"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Avatar
                          color={u.avatarColor || "var(--primary)"}
                          size="sm"
                          className="h-5 w-5 text-[10px]"
                        >
                          {getInitials(u.name)}
                        </Avatar>
                        <span>
                          {u.name}
                          {u.id === currentUserId ? " (You)" : ""}
                        </span>
                      </div>
                      <span
                        className={cn(
                          "h-4 w-4 rounded border flex items-center justify-center text-[10px]",
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border"
                        )}
                      >
                        {isSelected ? "✓" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label htmlFor="input-new-task-deadline" className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-subtle-foreground">
                <span>Due Date</span>
                <span className="text-[11px] font-normal lowercase text-muted-foreground">(optional)</span>
              </label>
              <Input
                id="input-new-task-deadline"
                type="date"
                value={newTaskDueDate}
                onChange={(e) => setNewTaskDueDate(e.target.value)}
                className="w-full"
              />
            </div>

            {/* Check Date & Milestone Start/End Times */}
            <div className="border border-border/80 rounded-lg p-3 bg-secondary/20 space-y-2.5">
              <div className="flex items-center justify-between">
                <label htmlFor="input-new-task-check-date" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-subtle-foreground">
                  <Flag className="h-3.5 w-3.5 text-blue-600 fill-blue-600 dark:text-blue-400 dark:fill-blue-400" />
                  <span>Check Date & Milestone Times</span>
                </label>
                <span className="text-[11px] font-normal text-muted-foreground">(optional calendar milestone)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <span className="block text-[11px] text-muted-foreground font-medium mb-1">Date</span>
                  <Input
                    id="input-new-task-check-date"
                    type="date"
                    value={newTaskCheckDate}
                    onChange={(e) => setNewTaskCheckDate(e.target.value)}
                    className="w-full text-xs"
                  />
                </div>
                <div>
                  <span className="block text-[11px] text-muted-foreground font-medium mb-1">Start Time</span>
                  <Input
                    id="input-new-task-check-start-time"
                    type="time"
                    disabled={!newTaskCheckDate}
                    value={newTaskCheckStartTime}
                    onChange={(e) => setNewTaskCheckStartTime(e.target.value)}
                    className="w-full text-xs disabled:opacity-50"
                  />
                </div>
                <div>
                  <span className="block text-[11px] text-muted-foreground font-medium mb-1">End Time</span>
                  <Input
                    id="input-new-task-check-end-time"
                    type="time"
                    disabled={!newTaskCheckDate}
                    value={newTaskCheckEndTime}
                    onChange={(e) => setNewTaskCheckEndTime(e.target.value)}
                    className="w-full text-xs disabled:opacity-50"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-subtle-foreground">
                  <ExternalLink className="h-3.5 w-3.5 text-primary" />
                  <span>Links & Resources</span>
                  {newTaskLinks.length > 0 && (
                    <span className="text-[11px] font-normal text-muted-foreground">({newTaskLinks.length})</span>
                  )}
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => setNewTaskLinks((prev) => [...prev, { id: generateId(), label: "", url: "" }])}
                >
                  <Plus className="h-3 w-3" />
                  <span>Add Link</span>
                </Button>
              </div>

              {newTaskLinks.length === 0 ? (
                <div className="flex items-center justify-between p-2.5 border border-dashed border-border rounded-lg bg-card/40">
                  <span className="text-xs text-muted-foreground">No links added yet.</span>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                    onClick={() => setNewTaskLinks([{ id: generateId(), label: "", url: "" }])}
                  >
                    <Plus className="h-3 w-3" />
                    <span>Attach a link</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {newTaskLinks.map((lnk, idx) => (
                    <div key={lnk.id || idx} className="flex items-center gap-2">
                      <Input
                        type="text"
                        placeholder="Label (e.g. Figma, PR)"
                        value={lnk.label}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewTaskLinks((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, label: val } : item))
                          );
                        }}
                        className="w-1/3 shrink-0 text-xs h-9"
                      />
                      <Input
                        type="url"
                        placeholder="https://..."
                        value={lnk.url}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewTaskLinks((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, url: val } : item))
                          );
                        }}
                        className="flex-1 text-xs h-9"
                      />
                      <button
                        type="button"
                        onClick={() => setNewTaskLinks((prev) => prev.filter((_, i) => i !== idx))}
                        className="h-9 w-9 shrink-0 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                        title="Remove link"
                        aria-label="Remove link"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setShowNewTask(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!newTaskTitle.trim()}>
                Create Task
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Task Dialog */}
      <Dialog open={editingTaskId !== null} onOpenChange={(open) => !open && setEditingTaskId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
            <DialogDescription>Update task details, assignment, status, and deadlines.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div>
              <label htmlFor="edit-task-title" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-subtle-foreground">
                Title
              </label>
              <Input
                id="edit-task-title"
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              />
            </div>

            <div>
              <label htmlFor="edit-task-desc" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-subtle-foreground">
                Description
              </label>
              <Textarea
                id="edit-task-desc"
                rows={2}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="edit-task-project" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-subtle-foreground">
                  Project
                </label>
                <Select
                  id="edit-task-project"
                  value={editForm.projectId}
                  onChange={(e) => setEditForm({ ...editForm, projectId: e.target.value })}
                  className="w-full"
                >
                  {visibleProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label htmlFor="edit-task-status" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-subtle-foreground">
                  Status
                </label>
                <Select
                  id="edit-task-status"
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value as TaskStatus })}
                  className="w-full"
                >
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="review">Review</option>
                  <option value="done">Done</option>
                </Select>
              </div>
            </div>

            <div>
              <label htmlFor="edit-task-priority" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-subtle-foreground">
                Priority
              </label>
              <Select
                id="edit-task-priority"
                value={editForm.priority}
                onChange={(e) => setEditForm({ ...editForm, priority: e.target.value as Priority })}
                className="w-full"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-subtle-foreground">
                  <Users className="h-3.5 w-3.5 text-primary" />
                  <span>Assignees</span>
                  <span className="text-[11px] font-normal text-muted-foreground">({editForm.assigneeIds.length} selected)</span>
                </label>
                {currentUserId && !editForm.assigneeIds.includes(currentUserId) && (
                  <button
                    type="button"
                    onClick={() =>
                      setEditForm((prev) => ({
                        ...prev,
                        assigneeIds: [...prev.assigneeIds, currentUserId],
                      }))
                    }
                    className="text-[11px] text-primary hover:underline font-medium"
                  >
                    + Assign to Me
                  </button>
                )}
              </div>

              {/* Selected Assignees Pills */}
              <div className="flex flex-wrap items-center gap-1.5 p-2 min-h-10 border border-border rounded-lg bg-card/50 mb-2">
                {editForm.assigneeIds.length === 0 ? (
                  <span className="text-xs text-muted-foreground italic">No assignees selected (Unassigned)</span>
                ) : (
                  editForm.assigneeIds.map((userId) => {
                    const u = getUserById(userId);
                    if (!u) return null;
                    return (
                      <span
                        key={u.id}
                        className="inline-flex items-center gap-1.5 pl-1.5 pr-2 py-0.5 text-xs bg-secondary border border-border text-foreground rounded-md font-medium"
                      >
                        <Avatar
                          color={u.avatarColor || "var(--primary)"}
                          size="sm"
                          className="h-4 w-4 text-[9px]"
                        >
                          {getInitials(u.name)}
                        </Avatar>
                        <span>{u.name}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setEditForm((prev) => ({
                              ...prev,
                              assigneeIds: prev.assigneeIds.filter((id) => id !== u.id),
                            }))
                          }
                          className="hover:text-destructive text-muted-foreground ml-0.5"
                          aria-label={`Remove ${u.name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    );
                  })
                )}
              </div>

              {/* User Selection List */}
              <div className="max-h-36 overflow-y-auto border border-border rounded-lg p-1.5 divide-y divide-border/40 bg-card/30">
                {activeUsers.map((u) => {
                  const isSelected = editForm.assigneeIds.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() =>
                        setEditForm((prev) => ({
                          ...prev,
                          assigneeIds: isSelected
                            ? prev.assigneeIds.filter((id) => id !== u.id)
                            : [...prev.assigneeIds, u.id],
                        }))
                      }
                      className={cn(
                        "w-full flex items-center justify-between p-1.5 text-xs rounded hover:bg-secondary/70 transition-colors text-left",
                        isSelected && "bg-secondary font-medium"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Avatar
                          color={u.avatarColor || "var(--primary)"}
                          size="sm"
                          className="h-5 w-5 text-[10px]"
                        >
                          {getInitials(u.name)}
                        </Avatar>
                        <span>
                          {u.name}
                          {u.id === currentUserId ? " (You)" : ""}
                        </span>
                      </div>
                      <span
                        className={cn(
                          "h-4 w-4 rounded border flex items-center justify-center text-[10px]",
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border"
                        )}
                      >
                        {isSelected ? "✓" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label htmlFor="edit-task-due" className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-subtle-foreground">
                <span>Due Date</span>
                <span className="text-[11px] font-normal lowercase text-muted-foreground">(optional)</span>
              </label>
              <Input
                id="edit-task-due"
                type="date"
                value={editForm.dueDate}
                onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
              />
            </div>

            {/* Check Date & Milestone Start/End Times */}
            <div className="border border-border/80 rounded-lg p-3 bg-secondary/20 space-y-2.5">
              <div className="flex items-center justify-between">
                <label htmlFor="edit-task-check-date" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-subtle-foreground">
                  <Flag className="h-3.5 w-3.5 text-blue-600 fill-blue-600 dark:text-blue-400 dark:fill-blue-400" />
                  <span>Check Date & Milestone Times</span>
                </label>
                <span className="text-[11px] font-normal text-muted-foreground">(optional calendar milestone)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <span className="block text-[11px] text-muted-foreground font-medium mb-1">Date</span>
                  <Input
                    id="edit-task-check-date"
                    type="date"
                    value={editForm.checkDate}
                    onChange={(e) => setEditForm({ ...editForm, checkDate: e.target.value })}
                    className="w-full text-xs"
                  />
                </div>
                <div>
                  <span className="block text-[11px] text-muted-foreground font-medium mb-1">Start Time</span>
                  <Input
                    id="edit-task-check-start-time"
                    type="time"
                    disabled={!editForm.checkDate}
                    value={editForm.checkStartTime}
                    onChange={(e) => setEditForm({ ...editForm, checkStartTime: e.target.value })}
                    className="w-full text-xs disabled:opacity-50"
                  />
                </div>
                <div>
                  <span className="block text-[11px] text-muted-foreground font-medium mb-1">End Time</span>
                  <Input
                    id="edit-task-check-end-time"
                    type="time"
                    disabled={!editForm.checkDate}
                    value={editForm.checkEndTime}
                    onChange={(e) => setEditForm({ ...editForm, checkEndTime: e.target.value })}
                    className="w-full text-xs disabled:opacity-50"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-subtle-foreground">
                  <ExternalLink className="h-3.5 w-3.5 text-primary" />
                  <span>Links & Resources</span>
                  {editForm.links.length > 0 && (
                    <span className="text-[11px] font-normal text-muted-foreground">({editForm.links.length})</span>
                  )}
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() =>
                    setEditForm((prev) => ({
                      ...prev,
                      links: [...prev.links, { id: generateId(), label: "", url: "" }],
                    }))
                  }
                >
                  <Plus className="h-3 w-3" />
                  <span>Add Link</span>
                </Button>
              </div>

              {editForm.links.length === 0 ? (
                <div className="flex items-center justify-between p-2.5 border border-dashed border-border rounded-lg bg-card/40">
                  <span className="text-xs text-muted-foreground">No links added yet.</span>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                    onClick={() =>
                      setEditForm((prev) => ({
                        ...prev,
                        links: [{ id: generateId(), label: "", url: "" }],
                      }))
                    }
                  >
                    <Plus className="h-3 w-3" />
                    <span>Attach a link</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {editForm.links.map((lnk, idx) => (
                    <div key={lnk.id || idx} className="flex items-center gap-2">
                      <Input
                        type="text"
                        placeholder="Label (e.g. Figma, PR)"
                        value={lnk.label}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditForm((prev) => ({
                            ...prev,
                            links: prev.links.map((item, i) =>
                              i === idx ? { ...item, label: val } : item
                            ),
                          }));
                        }}
                        className="w-1/3 shrink-0 text-xs h-9"
                      />
                      <Input
                        type="url"
                        placeholder="https://..."
                        value={lnk.url}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditForm((prev) => ({
                            ...prev,
                            links: prev.links.map((item, i) =>
                              i === idx ? { ...item, url: val } : item
                            ),
                          }));
                        }}
                        className="flex-1 text-xs h-9"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setEditForm((prev) => ({
                            ...prev,
                            links: prev.links.filter((_, i) => i !== idx),
                          }))
                        }
                        className="h-9 w-9 shrink-0 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                        title="Remove link"
                        aria-label="Remove link"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setEditingTaskId(null)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSaveTask} disabled={!editForm.title.trim()}>
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deletingTask !== null} onOpenChange={(open) => !open && setDeletingTask(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Task</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong className="text-foreground">{deletingTask?.title}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2 text-sm text-muted-foreground">
            <p>This action cannot be undone and will permanently remove the task from all views.</p>
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setDeletingTask(null)}>
                Cancel
              </Button>
              <Button type="button" variant="destructive" onClick={handleConfirmDeleteTask}>
                Delete Task
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
