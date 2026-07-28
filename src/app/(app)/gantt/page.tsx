"use client";

import React, { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { cn, getInitials, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ZoomLevel = "day" | "week" | "month";

const priorityColors: Record<string, string> = {
  low: "#14b8a0",
  medium: "#ffd633",
  high: "#ff6b4a",
  urgent: "#dc2626",
};

export default function GanttPage() {
  const { projects, tasks, getUserById } = useStore();
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [zoom, setZoom] = useState<ZoomLevel>("week");
  const [hoveredTask, setHoveredTask] = useState<string | null>(null);

  const activeProjects = projects.filter((p) => p.status === "active");

  // Calculate timeline bounds
  const allTasks = selectedProject
    ? tasks.filter((t) => t.projectId === selectedProject)
    : tasks;

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

  return (
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-[family-name:var(--font-heading)] tracking-tight">Timeline</h1>
            <p className="text-sm text-text-secondary mt-0.5">Gantt chart view of project schedules and task timelines</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-surface-sunken rounded-lg p-0.5">
              {(["day", "week", "month"] as ZoomLevel[]).map((z) => (
                <button
                  key={z}
                  onClick={() => setZoom(z)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer capitalize",
                    zoom === z ? "bg-white text-text-primary shadow-sm" : "text-text-muted hover:text-text-secondary"
                  )}
                >
                  {z}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Project filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setSelectedProject(null)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer",
              !selectedProject ? "bg-cp-purple-600 text-white" : "bg-white border border-border-default text-text-secondary hover:border-border-strong"
            )}
          >
            All Projects
          </button>
          {activeProjects.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedProject(p.id === selectedProject ? null : p.id)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer flex items-center gap-1.5",
                selectedProject === p.id ? "text-white" : "bg-white border border-border-default text-text-secondary hover:border-border-strong"
              )}
              style={selectedProject === p.id ? { backgroundColor: p.color } : undefined}
            >
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
              {p.title}
            </button>
          ))}
        </div>

        {/* Gantt Chart */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[1000px]">
              {/* Header row with dates */}
              <div className="flex border-b border-border-default bg-surface-sunken">
                <div className="w-[280px] flex-shrink-0 px-4 py-2.5 border-r border-border-default">
                  <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Task</span>
                </div>
                <div className="flex-1 relative">
                  <div className="flex">
                    {columns.map((col, i) => (
                      <div
                        key={i}
                        className="flex-shrink-0 px-2 py-2.5 text-center border-r border-border-default/50 text-[10px] font-medium text-text-muted"
                        style={{ width: zoom === "day" ? 40 : zoom === "week" ? 80 : 120 }}
                      >
                        {formatColumnHeader(col)}
                      </div>
                    ))}
                  </div>
                  {/* Today marker */}
                  {todayOffset >= 0 && todayOffset <= 100 && (
                    <div
                      className="absolute top-0 bottom-0 w-px bg-cp-coral-500 z-10"
                      style={{ left: `${todayOffset}%` }}
                    >
                      <div className="absolute -top-0 left-1/2 -translate-x-1/2 bg-cp-coral-500 text-white text-[9px] px-1 py-0.5 rounded-b-sm font-medium whitespace-nowrap">
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
                    <div className="flex border-b border-border-default bg-surface-sunken/50">
                      <div className="w-[280px] flex-shrink-0 px-4 py-2 border-r border-border-default">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: project.color }} />
                          <span className="text-sm font-semibold">{project.title}</span>
                        </div>
                      </div>
                      <div className="flex-1 relative py-2">
                        {/* Project duration bar */}
                        <div
                          className="absolute h-2 rounded-full opacity-20 top-1/2 -translate-y-1/2"
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
                            "flex border-b border-border-default/50 transition-colors",
                            isHovered && "bg-cp-purple-50/30"
                          )}
                          onMouseEnter={() => setHoveredTask(task.id)}
                          onMouseLeave={() => setHoveredTask(null)}
                        >
                          {/* Task info */}
                          <div className="w-[280px] flex-shrink-0 px-4 py-2.5 border-r border-border-default">
                            <div className="flex items-center gap-2 pl-4">
                              <div
                                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: priorityColors[task.priority] }}
                              />
                              <span className="text-sm truncate">{task.title}</span>
                              {assignee && (
                                <div
                                  className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0 ml-auto"
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
                              className="gantt-bar absolute h-6 rounded-md top-1/2 -translate-y-1/2 flex items-center px-2"
                              style={{
                                ...barPos,
                                backgroundColor: task.status === "done" ? "var(--color-cp-teal-400)" : project.color,
                                opacity: task.status === "done" ? 0.7 : 1,
                              }}
                            >
                              {isHovered && (
                                <span className="text-[10px] text-white font-medium whitespace-nowrap overflow-hidden">
                                  {task.title}
                                </span>
                              )}
                            </div>
                            {/* Grid lines */}
                            {columns.map((_, i) => (
                              <div
                                key={i}
                                className="absolute top-0 bottom-0 border-r border-border-default/30"
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
        <div className="flex items-center gap-6 px-2">
          <div className="flex items-center gap-4">
            <span className="text-xs text-text-muted font-medium">Priority:</span>
            {Object.entries(priorityColors).map(([key, color]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-xs text-text-secondary capitalize">{key}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-2 rounded-sm bg-cp-teal-400 opacity-70" />
            <span className="text-xs text-text-secondary">Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-px h-4 bg-cp-coral-500" />
            <span className="text-xs text-text-secondary">Today</span>
          </div>
        </div>
      </div>
  );
}
