"use client";

import React, { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { cn, getInitials, formatDate } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { PageFrame, PageHeader, Toolbar } from "@/components/page-layout";

type ZoomLevel = "day" | "week" | "month";

const priorityColors: Record<string, string> = {
  low: "var(--color-priority-low)",
  medium: "var(--color-priority-medium)",
  high: "var(--color-priority-high)",
  urgent: "var(--color-priority-urgent)",
};

export default function GanttPage() {
  const { projects, tasks, getUserById, searchQuery } = useStore();
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [zoom, setZoom] = useState<ZoomLevel>("week");
  const [hoveredTask, setHoveredTask] = useState<string | null>(null);

  const activeProjects = projects.filter((p) => p.status === "active");
  const query = searchQuery.trim().toLowerCase();

  // Calculate timeline bounds
  const allTasks = (selectedProject
    ? tasks.filter((t) => t.projectId === selectedProject)
    : tasks
  ).filter((t) => {
    if (!query) return true;
    const project = projects.find((p) => p.id === t.projectId);
    return `${t.title} ${project?.title ?? ""}`.toLowerCase().includes(query);
  });

  const timelineStart = useMemo(() => {
    const dates = allTasks.map((t) => new Date(t.startDate).getTime());
    const projects2 = activeProjects.map((p) => new Date(p.startDate).getTime());
    return new Date(Math.min(...dates, ...projects2));
  }, [allTasks, activeProjects]);

  const timelineEnd = useMemo(() => {
    const dates = allTasks.map((t) => new Date(t.dueDate).getTime());
    const projects2 = activeProjects.map((p) => new Date(p.endDate).getTime());
    return new Date(Math.max(...dates, ...projects2));
  }, [allTasks, activeProjects]);

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

  const totalDays = Math.ceil((timelineEnd.getTime() - timelineStart.getTime()) / 86400000);

  function getBarPosition(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const startOffset = Math.max(0, (start.getTime() - timelineStart.getTime()) / 86400000);
    const duration = Math.max(1, (end.getTime() - start.getTime()) / 86400000);
    const left = (startOffset / totalDays) * 100;
    const width = (duration / totalDays) * 100;
    return { left: `${left}%`, width: `${Math.min(width, 100 - left)}%` };
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
        <Toolbar className="border-0 bg-transparent p-0">
        {/* Project filter */}
          <button
            onClick={() => setSelectedProject(null)}
            className={cn(
              "px-3 py-1.5 text-sm font-medium transition-all cursor-pointer",
              !selectedProject ? "bg-primary text-white" : "bg-card border border-border text-muted-foreground hover:border-input"
            )}
          >
            All Projects
          </button>
          {activeProjects.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedProject(p.id === selectedProject ? null : p.id)}
              className={cn(
                "px-3 py-1.5 text-sm font-medium transition-all cursor-pointer flex items-center gap-1.5",
                selectedProject === p.id ? "text-white" : "bg-card border border-border text-muted-foreground hover:border-input"
              )}
              style={selectedProject === p.id ? { backgroundColor: p.color } : undefined}
            >
              <div className="w-2 h-2" style={{ backgroundColor: p.color }} />
              {p.title}
            </button>
          ))}
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
                      className="absolute top-0 bottom-0 w-px bg-accent0 z-10"
                      style={{ left: `${todayOffset}%` }}
                    >
                      <div className="absolute -top-0 left-1/2 -translate-x-1/2 bg-accent0 text-white text-xs px-1 py-0.5 font-medium whitespace-nowrap">
                        Today
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Project rows */}
              {(selectedProject ? activeProjects.filter((p) => p.id === selectedProject) : activeProjects).map((project) => {
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
                              {assignee && (
                                <div
                                  className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ml-auto"
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
                            <div
                              className="gantt-bar absolute h-6 top-1/2 -translate-y-1/2 flex items-center px-2"
                              style={{
                                ...barPos,
                                backgroundColor: task.status === "done" ? "var(--muted-foreground)" : project.color,
                                opacity: task.status === "done" ? 0.7 : 1,
                              }}
                            >
                              {isHovered && (
                                <span className="text-xs text-white font-medium whitespace-nowrap overflow-hidden">
                                  {task.title}
                                </span>
                              )}
                            </div>
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
              })}
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
            <div className="w-px h-4 bg-accent0" />
            <span className="text-xs text-muted-foreground">Today</span>
          </div>
        </div>
      </PageFrame>
  );
}
