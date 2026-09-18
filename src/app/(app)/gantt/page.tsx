"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useStore } from "@/lib/store";
import { cn, getInitials, formatDate } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { PageFrame, PageHeader, Toolbar } from "@/components/page-layout";
import { Select } from "@/components/ui/select";
import { Flag, ExternalLink, Lock } from "lucide-react";

type ZoomLevel = "day" | "week" | "month";

const priorityColors: Record<string, string> = {
  low: "var(--color-priority-low)",
  medium: "var(--color-priority-medium)",
  high: "var(--color-priority-high)",
  urgent: "var(--color-priority-urgent)",
};

export default function GanttPage() {
  const { projects, tasks, getUserById, getActiveUsers, currentUserId, searchQuery } = useStore();
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [zoom, setZoom] = useState<ZoomLevel>("week");
  const [hoveredTask, setHoveredTask] = useState<string | null>(null);

  const currentUser = getUserById(currentUserId);
  const isAdmin = currentUser?.role === "admin";
  const activeUsers = getActiveUsers();

  // Assignee filter: for admin, defaults to "all"; for member/guest, defaults to self and is disabled
  const [filterAssignee, setFilterAssignee] = useState<string>("all");

  useEffect(() => {
    if (!isAdmin && currentUserId) {
      setFilterAssignee(currentUserId);
    }
  }, [isAdmin, currentUserId]);

  const effectiveAssignee = isAdmin ? filterAssignee : (currentUserId || "all");

  // For member and guest roles: filter projects related to tasks where tasks.assignee_id = current user
  const userProjectIds = useMemo(() => {
    if (isAdmin) return null;
    return new Set(tasks.filter((t) => t.assigneeId === currentUserId).map((t) => t.projectId));
  }, [tasks, isAdmin, currentUserId]);

  const visibleProjects = useMemo(() => {
    const active = projects.filter((p) => p.status === "active");
    if (isAdmin) return active;
    return active.filter((p) => userProjectIds?.has(p.id));
  }, [projects, isAdmin, userProjectIds]);

  useEffect(() => {
    if (selectedProject && !visibleProjects.some((p) => p.id === selectedProject)) {
      setSelectedProject(null);
    }
  }, [selectedProject, visibleProjects]);

  const query = searchQuery.trim().toLowerCase();

  // Calculate filtered tasks based on project, assignee, and search
  const allTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Assignee filter
      if (effectiveAssignee === "unassigned") {
        if (t.assigneeId) return false;
      } else if (effectiveAssignee !== "all") {
        if (t.assigneeId !== effectiveAssignee) return false;
      }

      // Member/Guest restriction: must be assigned to self and in related projects
      if (!isAdmin && currentUserId) {
        if (t.assigneeId !== currentUserId) return false;
        if (!userProjectIds?.has(t.projectId)) return false;
      }

      // Project filter
      if (selectedProject) {
        if (t.projectId !== selectedProject) return false;
      } else if (!isAdmin) {
        if (!userProjectIds?.has(t.projectId)) return false;
      }

      // Search query filter
      if (query) {
        const project = projects.find((p) => p.id === t.projectId);
        const assignee = t.assigneeId ? getUserById(t.assigneeId) : null;
        const haystack = `${t.title} ${project?.title ?? ""} ${assignee?.name ?? ""}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      return true;
    });
  }, [tasks, effectiveAssignee, isAdmin, currentUserId, userProjectIds, selectedProject, query, projects, getUserById]);

  const timelineStart = useMemo(() => {
    const dates = allTasks.flatMap((t) =>
      [t.startDate, t.checkDate].filter(Boolean).map((d) => new Date(d!).getTime())
    );
    const projects2 = visibleProjects.map((p) => new Date(p.startDate).getTime());
    const valid = [...dates, ...projects2].filter((n) => !isNaN(n));
    return valid.length > 0 ? new Date(Math.min(...valid)) : new Date();
  }, [allTasks, visibleProjects]);

  const timelineEnd = useMemo(() => {
    const dates = allTasks.flatMap((t) =>
      [t.dueDate, t.checkDate].filter(Boolean).map((d) => new Date(d!).getTime())
    );
    const projects2 = visibleProjects.map((p) => new Date(p.endDate).getTime());
    const valid = [...dates, ...projects2].filter((n) => !isNaN(n));
    return valid.length > 0 ? new Date(Math.max(...valid)) : new Date();
  }, [allTasks, visibleProjects]);

  // Generate columns based on zoom level
  const columns = useMemo(() => {
    const cols: Date[] = [];
    const current = new Date(timelineStart);
    current.setDate(1); // Start from first of month
    const end = new Date(timelineEnd);
    end.setMonth(end.getMonth() + 1);

    while (current <= end) {
      cols.push(new Date(current));
      if (zoom === "day") current.setDate(current.getDate() + 1);
      else if (zoom === "week") current.setDate(current.getDate() + 7);
      else current.setMonth(current.getMonth() + 1);
    }
    return cols;
  }, [timelineStart, timelineEnd, zoom]);

  const totalDays = Math.max(1, Math.ceil((timelineEnd.getTime() - timelineStart.getTime()) / 86400000));

  function getBarPosition(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const startOffset = Math.max(0, (start.getTime() - timelineStart.getTime()) / 86400000);
    const duration = Math.max(1, (end.getTime() - start.getTime()) / 86400000);
    const left = (startOffset / totalDays) * 100;
    const width = (duration / totalDays) * 100;
    return { left: `${left}%`, width: `${Math.min(width, 100 - left)}%` };
  }

  function getPointPosition(dateStr: string): number | null {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    const offset = (d.getTime() - timelineStart.getTime()) / 86400000;
    const left = (offset / totalDays) * 100;
    return Math.max(0, Math.min(100, left));
  }

  function formatColumnHeader(date: Date): string {
    if (zoom === "day") return date.toLocaleDateString("en-SG", { day: "numeric", month: "short" });
    if (zoom === "week") return `W${getWeekNumber(date)} ${date.toLocaleDateString("en-SG", { month: "short" })}`;
    return date.toLocaleDateString("en-SG", { month: "short", year: "numeric" });
  }

  function getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  // Today marker
  const today = new Date();
  const todayOffset = ((today.getTime() - timelineStart.getTime()) / 86400000 / totalDays) * 100;
  const columnWidth = zoom === "day" ? 40 : zoom === "week" ? 80 : 120;
  const chartWidth = Math.max(1000, 280 + columns.length * columnWidth);

  return (
      <PageFrame className="max-w-[1600px]">
        {/* Header */}
        <PageHeader
          title="Timeline"
          description="Gantt chart view of project schedules and task timelines"
          actions={<div className="flex items-center bg-secondary p-1">
            {(["day", "week", "month"] as ZoomLevel[]).map((z) => (
              <button
                key={z}
                onClick={() => setZoom(z)}
                className={cn(
                  "min-h-10 px-3 text-xs font-semibold transition-colors capitalize",
                  zoom === z ? "bg-card text-foreground" : "text-subtle-foreground hover:text-muted-foreground"
                )}
              >
                {z}
              </button>
            ))}
          </div>}
        />
        <Toolbar className="border-0 bg-transparent p-0 flex flex-wrap items-center justify-between gap-3">
          {/* Assignee filter: role admin can view all timeline and has Assignee filter, for role member and guest filter defaults to self and is disabled */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-subtle-foreground whitespace-nowrap">
              Assignee:
            </span>
            {isAdmin ? (
              <Select
                id="gantt-filter-assignee"
                aria-label="Filter timeline by assignee"
                value={filterAssignee}
                onChange={(e) => setFilterAssignee(e.target.value)}
                className="w-48 text-xs h-8"
              >
                <option value="all">All Assignees</option>
                {currentUserId && <option value={currentUserId}>Assigned to Me</option>}
                <option value="unassigned">Unassigned</option>
                {activeUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}{u.id === currentUserId ? " (You)" : ""}
                  </option>
                ))}
              </Select>
            ) : (
              <div
                className="flex items-center gap-1.5"
                title="Role member and guest can only view timeline assigned to themselves"
              >
                <Select
                  id="gantt-filter-assignee-disabled"
                  aria-label="Filter timeline by assignee (disabled for member/guest)"
                  disabled
                  value={currentUserId || ""}
                  className="w-48 text-xs h-8 opacity-75 cursor-not-allowed bg-muted"
                >
                  <option value={currentUserId || ""}>
                    {currentUser ? `${currentUser.name} (You)` : "Assigned to You"}
                  </option>
                </Select>
                <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-secondary px-1.5 py-1 border border-border">
                  <Lock className="w-2.5 h-2.5" />
                  <span>Self Only</span>
                </span>
              </div>
            )}
          </div>

          {/* Project filter */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setSelectedProject(null)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-all cursor-pointer",
                !selectedProject ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:border-input"
              )}
            >
              All Projects
            </button>
            {visibleProjects.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedProject(p.id === selectedProject ? null : p.id)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5",
                  selectedProject === p.id ? "text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:border-input"
                )}
                style={selectedProject === p.id ? { backgroundColor: p.color } : undefined}
              >
                <div className="w-2 h-2" style={{ backgroundColor: p.color }} />
                {p.title}
              </button>
            ))}
          </div>
        </Toolbar>

        {/* Gantt Chart */}
        <Card className="overflow-hidden">
          <div className="w-full overflow-x-auto">
            <div className="min-w-[1000px]" style={{ width: chartWidth }}>
              {/* Header row with dates */}
              <div className="flex border-b border-border bg-secondary">
                <div className="sticky left-0 z-20 w-[280px] flex-shrink-0 border-r border-border bg-secondary px-4 py-2.5">
                  <span className="text-xs font-medium text-subtle-foreground uppercase tracking-wider">Task</span>
                </div>
                <div className="flex-1 relative">
                  <div className="flex">
                    {columns.map((col, i) => (
                      <div
                        key={i}
                        className="flex-shrink-0 px-2 py-2.5 text-center border-r border-border/50 text-xs font-medium text-subtle-foreground"
                        style={{ width: columnWidth }}
                      >
                        {formatColumnHeader(col)}
                      </div>
                    ))}
                  </div>
                  {/* Today marker */}
                  {todayOffset >= 0 && todayOffset <= 100 && (
                    <div
                      className="absolute top-0 bottom-0 w-px bg-brand z-10"
                      style={{ left: `${todayOffset}%` }}
                    >
                      <div className="absolute -top-0 left-1/2 -translate-x-1/2 bg-brand text-white text-xs px-1 py-0.5 font-medium whitespace-nowrap">
                        Today
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Project rows */}
              {allTasks.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">
                  <p className="text-sm font-medium text-foreground">No tasks to display on timeline</p>
                  <p className="mt-1 text-xs text-subtle-foreground">
                    {isAdmin
                      ? "No tasks match the selected project or assignee filter."
                      : "No active tasks are assigned to you for this timeline."}
                  </p>
                </div>
              ) : (
                (selectedProject ? visibleProjects.filter((p) => p.id === selectedProject) : visibleProjects).map((project) => {
                  const projectTasks = allTasks.filter((t) => t.projectId === project.id);
                  if (projectTasks.length === 0) return null;
                  const members = project.memberIds.map((id) => getUserById(id)).filter(Boolean);

                  return (
                    <div key={project.id}>
                      {/* Project header row */}
                      <div className="flex border-b border-border bg-secondary/50">
                        <div className="sticky left-0 z-20 w-[280px] flex-shrink-0 border-r border-border bg-secondary/50 px-4 py-2">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5" style={{ backgroundColor: project.color }} />
                            <span className="text-sm font-semibold">{project.title}</span>
                          </div>
                        </div>
                        <div className="flex-1 relative py-2">
                          {/* Project duration bar */}
                          <div
                            className="absolute h-2 opacity-20 top-1/2 -translate-y-1/2"
                            style={{
                              ...getBarPosition(project.startDate, project.endDate),
                              backgroundColor: project.color,
                            }}
                          />
                        </div>
                      </div>

                      {/* Task rows */}
                      {projectTasks.map((task) => {
                        const assignee = task.assigneeId ? getUserById(task.assigneeId) : null;
                        const barPos = getBarPosition(task.startDate, task.dueDate);
                        const checkDatePos = task.checkDate ? getPointPosition(task.checkDate) : null;
                        const isHovered = hoveredTask === task.id;

                        return (
                          <div
                            key={task.id}
                            className={cn(
                              "flex border-b border-border/50 transition-colors",
                              isHovered && "bg-secondary/50"
                            )}
                            onMouseEnter={() => setHoveredTask(task.id)}
                            onMouseLeave={() => setHoveredTask(null)}
                          >
                            {/* Task info */}
                            <div className="sticky left-0 z-20 w-[280px] flex-shrink-0 border-r border-border bg-card px-4 py-2.5">
                              <div className="flex items-center gap-2 pl-4">
                                <div
                                  className="w-1.5 h-1.5 flex-shrink-0"
                                  style={{ backgroundColor: priorityColors[task.priority] }}
                                />
                                <span className="text-sm truncate">{task.title}</span>
                                {task.link && (
                                  <a
                                    href={task.link.startsWith("http://") || task.link.startsWith("https://") ? task.link : `https://${task.link}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center text-primary shrink-0 hover:text-primary/80"
                                    title={`Open link: ${task.link}`}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                )}
                                {task.checkDate && (
                                  <span
                                    className="inline-flex items-center text-blue-600 dark:text-blue-400 shrink-0"
                                    title={`Check Date: ${formatDate(task.checkDate)}`}
                                  >
                                    <Flag className="w-3 h-3 fill-blue-600 text-blue-600 dark:fill-blue-400 dark:text-blue-400" />
                                  </span>
                                )}
                                {assignee && (
                                  <div
                                    className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-primary-foreground flex-shrink-0 ml-auto"
                                    style={{ backgroundColor: assignee.avatarColor }}
                                    title={assignee.name}
                                  >
                                    {getInitials(assignee.name)}
                                  </div>
                                )}
                              </div>
                            </div>

                          {/* Gantt bar */}
                          <div className="flex-1 relative py-2.5">
                            {/* Task schedule line (start_date to due_date kept as current) */}
                            <div
                              className="gantt-bar absolute h-6 top-1/2 -translate-y-1/2 flex items-center px-2 z-10"
                              style={{
                                ...barPos,
                                backgroundColor: task.status === "done" ? "var(--muted-foreground)" : project.color,
                                opacity: task.status === "done" ? 0.7 : 1,
                              }}
                            >
                              {isHovered && (
                                <span className="text-xs text-primary-foreground font-medium whitespace-nowrap overflow-hidden">
                                  {task.title}
                                </span>
                              )}
                            </div>

                            {/* Specific point check_date flagging with blue color */}
                            {checkDatePos !== null && (
                              <div
                                className="absolute top-0 bottom-0 z-20 pointer-events-auto group/flag"
                                style={{ left: `${checkDatePos}%` }}
                                id={`gantt-check-flag-${task.id}`}
                              >
                                {/* Blue vertical pin line */}
                                <div className="absolute top-0 bottom-0 w-0.5 -translate-x-1/2 bg-blue-600 dark:bg-blue-400 shadow-sm" />

                                {/* Blue flag marker button */}
                                <div
                                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 dark:bg-blue-500 text-white shadow-md ring-2 ring-card hover:scale-125 transition-transform cursor-pointer"
                                  title={`Check Date: ${formatDate(task.checkDate!)}`}
                                >
                                  <Flag className="w-2.5 h-2.5 fill-white text-white" />
                                </div>

                                {/* Hover tooltip */}
                                <div className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover/flag:opacity-100 transition-opacity bg-blue-700 dark:bg-blue-800 text-white text-[10px] font-semibold px-2 py-0.5 rounded shadow-lg whitespace-nowrap z-30">
                                  Check Date: {formatDate(task.checkDate!)}
                                </div>
                              </div>
                            )}

                            {/* Grid lines */}
                            {columns.map((_, i) => (
                              <div
                                key={i}
                                className="absolute top-0 bottom-0 border-r border-border/30"
                                style={{ left: `${((i + 1) / columns.length) * 100}%` }}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}
            </div>
          </div>
        </Card>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-2">
          <div className="flex items-center gap-4">
            <span className="text-xs text-subtle-foreground font-medium">Priority:</span>
            {Object.entries(priorityColors).map(([key, color]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5" style={{ backgroundColor: color }} />
                <span className="text-xs text-muted-foreground capitalize">{key}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-2 bg-muted-foreground opacity-70" />
            <span className="text-xs text-muted-foreground">Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-px h-4 bg-brand" />
            <span className="text-xs text-muted-foreground">Today</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-4 h-4 rounded-full bg-blue-600 text-white">
              <Flag className="w-2.5 h-2.5 fill-white text-white" />
            </div>
            <span className="text-xs text-muted-foreground">Check Date (Flag)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ExternalLink className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs text-muted-foreground">Task Link</span>
          </div>
        </div>
      </PageFrame>
  );
}
