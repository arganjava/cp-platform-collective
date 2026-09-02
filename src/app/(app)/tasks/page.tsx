"use client";

import React, { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { cn, getInitials, formatDate, generateId } from "@/lib/utils";
import type { Task, Priority, TaskStatus } from "@/lib/types";
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
    currentUserId,
    getUserById,
    getActiveUsers,
    updateTaskStatus,
    updateTask,
    deleteTask,
    addTask,
    searchQuery: globalSearchQuery,
  } = useStore();

  const activeUsers = getActiveUsers();

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
  const [newTaskAssignee, setNewTaskAssignee] = useState(currentUserId || "");
  const [newTaskPriority, setNewTaskPriority] = useState<Priority>("medium");
  const [newTaskDueDate, setNewTaskDueDate] = useState(
    new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0]
  );

  // Edit Task State
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    title: string;
    description: string;
    projectId: string;
    status: TaskStatus;
    priority: Priority;
    assigneeId: string;
    dueDate: string;
  }>({
    title: "",
    description: "",
    projectId: "",
    status: "todo",
    priority: "medium",
    assigneeId: "",
    dueDate: "",
  });

  // Delete Task State
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);

  const query = (localSearch || globalSearchQuery).trim().toLowerCase();

  // Today reference date normalized to midnight
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const nextWeekMs = Date.now() + 7 * 86400000;
  const nextMonthMs = Date.now() + 30 * 86400000;

  // Filter combined logic
  const filteredTasks = useMemo(() => {
    return tasks
      .filter((t) => {
        // 1. Search Query
        if (query) {
          const project = projects.find((p) => p.id === t.projectId);
          const assignee = t.assigneeId ? getUserById(t.assigneeId) : null;
          const haystack = [
            t.title,
            t.description || "",
            project?.title ?? "",
            assignee?.name ?? "",
            assignee?.email ?? "",
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

        // 5. Assignee Filter
        if (filterAssignee === "unassigned") {
          if (t.assigneeId) return false;
        } else if (filterAssignee === "mine") {
          if (t.assigneeId !== currentUserId) return false;
        } else if (filterAssignee !== "all") {
          if (t.assigneeId !== filterAssignee) return false;
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
    tasks,
    query,
    filterStatus,
    filterPriority,
    filterProject,
    filterAssignee,
    filterDeadline,
    sortBy,
    projects,
    getUserById,
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
    const projectId = newTaskProject || projects[0]?.id;
    if (!newTaskTitle.trim() || !projectId) return;

    addTask({
      id: generateId(),
      projectId,
      title: newTaskTitle.trim(),
      description: newTaskDescription.trim(),
      status: "todo",
      priority: newTaskPriority,
      assigneeId: newTaskAssignee || null,
      startDate: new Date().toISOString().split("T")[0],
      dueDate: newTaskDueDate || new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
      tags: [],
      createdAt: new Date().toISOString(),
      order: tasks.length,
    });

    setNewTaskTitle("");
    setNewTaskDescription("");
    setShowNewTask(false);
  }

  function openEditTask(task: Task) {
    setEditingTaskId(task.id);
    setEditForm({
      title: task.title,
      description: task.description || "",
      projectId: task.projectId,
      status: task.status,
      priority: task.priority,
      assigneeId: task.assigneeId ?? "",
      dueDate: task.dueDate ? task.dueDate.split("T")[0] : "",
    });
  }

  function handleSaveTask() {
    if (!editingTaskId || !editForm.title.trim() || !editForm.projectId) return;
    updateTask(editingTaskId, {
      title: editForm.title.trim(),
      description: editForm.description,
      projectId: editForm.projectId,
      status: editForm.status,
      priority: editForm.priority,
      assigneeId: editForm.assigneeId || null,
      dueDate: editForm.dueDate,
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
          description={`Showing ${filteredTasks.length} of ${tasks.length} tasks across ${projects.length} active projects.`}
          actions={
            <Button
              id="btn-create-task-top"
              size="sm"
              onClick={() => {
                if (!newTaskProject && projects.length > 0) {
                  setNewTaskProject(projects[0].id);
                }
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
            const count = tasks.filter((t) => t.status === status).length;
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
                {projects.map((p) => (
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
                    const daysLeft = Math.ceil(
                      (new Date(task.dueDate).getTime() - new Date(todayStr).getTime()) / 86400000
                    );
                    const isOverdue = daysLeft < 0 && task.status !== "done";
                    const isDueToday = daysLeft === 0 && task.status !== "done";

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
                              <span
                                className={cn(
                                  "font-medium text-foreground",
                                  task.status === "done" && "line-through text-subtle-foreground"
                                )}
                              >
                                {task.title}
                              </span>
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
                          {assignee ? (
                            <div className="flex items-center gap-2">
                              <Avatar
                                color={assignee.avatarColor || "var(--primary)"}
                                size="sm"
                                className="h-6 w-6 text-[10px]"
                              >
                                {getInitials(assignee.name)}
                              </Avatar>
                              <span className="truncate text-xs font-medium text-foreground">
                                {assignee.name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-subtle-foreground italic">Unassigned</span>
                          )}
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
                          {isOverdue && (
                            <span className="text-[10px] font-semibold text-destructive uppercase tracking-wider">
                              Overdue by {Math.abs(daysLeft)}d
                            </span>
                          )}
                          {isDueToday && (
                            <span className="text-[10px] font-semibold text-accent uppercase tracking-wider">
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
        <DialogContent className="max-w-md">
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
                  {projects.map((p) => (
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="select-new-task-assignee" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-subtle-foreground">
                  Assignee
                </label>
                <Select
                  id="select-new-task-assignee"
                  value={newTaskAssignee}
                  onChange={(e) => setNewTaskAssignee(e.target.value)}
                  className="w-full"
                >
                  <option value="">Unassigned</option>
                  {activeUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label htmlFor="input-new-task-deadline" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-subtle-foreground">
                  Due Date
                </label>
                <Input
                  id="input-new-task-deadline"
                  type="date"
                  value={newTaskDueDate}
                  onChange={(e) => setNewTaskDueDate(e.target.value)}
                  className="w-full"
                />
              </div>
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
        <DialogContent className="max-w-md">
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
                  {projects.map((p) => (
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

            <div className="grid grid-cols-2 gap-3">
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
                <label htmlFor="edit-task-assignee" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-subtle-foreground">
                  Assignee
                </label>
                <Select
                  id="edit-task-assignee"
                  value={editForm.assigneeId}
                  onChange={(e) => setEditForm({ ...editForm, assigneeId: e.target.value })}
                  className="w-full"
                >
                  <option value="">Unassigned</option>
                  {activeUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div>
              <label htmlFor="edit-task-due" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-subtle-foreground">
                Due Date
              </label>
              <Input
                id="edit-task-due"
                type="date"
                value={editForm.dueDate}
                onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
              />
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
