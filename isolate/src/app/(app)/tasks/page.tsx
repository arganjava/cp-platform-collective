"use client";

import React, { useState } from "react";
import { useStore } from "@/lib/store";
import { cn, getInitials, formatDate, generateId } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { PageFrame, PageHeader, Toolbar } from "@/components/page-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Plus,
  CalendarDays,
  CheckCircle2,
  Clock,
  AlertCircle,
  Eye,
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

export default function TasksPage() {
  const { tasks, projects, users, getUserById, updateTaskStatus, addTask, searchQuery } = useStore();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"dueDate" | "priority" | "project">("dueDate");
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskProject, setNewTaskProject] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");

  const query = searchQuery.trim().toLowerCase();
  const filteredTasks = tasks
    .filter((t) => {
      if (query) {
        const project = projects.find((p) => p.id === t.projectId);
        const assignee = getUserById(t.assigneeId);
        const haystack = [t.title, project?.title ?? "", assignee?.name ?? "", ...t.tags].join(" ").toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      if (filterPriority !== "all" && t.priority !== filterPriority) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "dueDate") return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      if (sortBy === "priority") {
        const order = { urgent: 0, high: 1, medium: 2, low: 3 };
        return (order[a.priority] ?? 4) - (order[b.priority] ?? 4);
      }
      return a.projectId.localeCompare(b.projectId);
    });

  function handleCreateTask() {
    if (!newTaskTitle.trim()) return;
    addTask({
      id: `task-${generateId()}`,
      projectId: newTaskProject || projects[0]?.id || "proj-1",
      title: newTaskTitle,
      description: "",
      status: "todo",
      priority: newTaskPriority,
      assigneeId: "user-1",
      startDate: new Date().toISOString().split("T")[0],
      dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
      tags: [],
      createdAt: new Date().toISOString(),
      order: 0,
    });
    setNewTaskTitle("");
    setShowNewTask(false);
  }

  return (
    <>
      <PageFrame>
        {/* Header */}
        <PageHeader
          title="My Tasks"
          description={`${filteredTasks.length} ${filteredTasks.length === 1 ? "task" : "tasks"} across ${projects.filter(p => filteredTasks.some(t => t.projectId === p.id)).length} ${projects.filter(p => filteredTasks.some(t => t.projectId === p.id)).length === 1 ? "project" : "projects"}`}
          actions={<Button size="sm" onClick={() => setShowNewTask(true)}><Plus className="w-4 h-4" /> New Task</Button>}
        />
        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-0 border-y border-border sm:grid-cols-4">
          {(Object.entries(statusConfig) as [string, typeof statusConfig.todo][]).map(([status, config]) => {
            const count = filteredTasks.filter((t) => t.status === status).length;
            const Icon = config.icon;
            return (
              <button
                key={status}
                onClick={() => setFilterStatus(filterStatus === status ? "all" : status)}
                className={cn(
                  "flex min-h-11 items-center gap-3 px-5 py-4 text-left transition-colors border-r border-border last:border-r-0",
                  filterStatus === status ? "bg-secondary" : "hover:bg-secondary"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" style={{ color: config.color }} aria-hidden="true" />
                <div>
                  <p className="text-lg font-bold tabular">{count}</p>
                  <p className="text-xs font-medium uppercase tracking-wider text-subtle-foreground">{config.label}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <Toolbar>
          <Select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Select>
          <Select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "dueDate" | "priority" | "project")}
          >
            <option value="dueDate">Sort by Due Date</option>
            <option value="priority">Sort by Priority</option>
            <option value="project">Sort by Project</option>
          </Select>
        </Toolbar>

        {/* Task list */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs font-medium text-subtle-foreground uppercase tracking-wider py-3 px-4">Task</th>
                  <th className="text-left text-xs font-medium text-subtle-foreground uppercase tracking-wider py-3 px-4">Project</th>
                  <th className="text-left text-xs font-medium text-subtle-foreground uppercase tracking-wider py-3 px-4">Status</th>
                  <th className="text-left text-xs font-medium text-subtle-foreground uppercase tracking-wider py-3 px-4">Priority</th>
                  <th className="text-left text-xs font-medium text-subtle-foreground uppercase tracking-wider py-3 px-4">Assignee</th>
                  <th className="text-left text-xs font-medium text-subtle-foreground uppercase tracking-wider py-3 px-4">Due</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((task) => {
                  const project = projects.find((p) => p.id === task.projectId);
                  const assignee = task.assigneeId ? getUserById(task.assigneeId) : null;
                  const daysLeft = Math.ceil((new Date(task.dueDate).getTime() - Date.now()) / 86400000);
                  const isOverdue = daysLeft < 0 && task.status !== "done";
                  return (
                    <tr key={task.id} className={cn("border-b border-border/50 hover:bg-secondary/50 transition-colors", isOverdue && "bg-accent/30")}>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => updateTaskStatus(task.id, task.status === "done" ? "todo" : "done")}
                            aria-label={task.status === "done" ? `Mark ${task.title} incomplete` : `Mark ${task.title} complete`}
                            className={cn(
                              "w-5 h-5 border-2 flex items-center justify-center transition-all cursor-pointer flex-shrink-0",
                              task.status === "done"
                                ? "border-primary bg-primary text-white"
                                : "border-input hover:border-primary"
                            )}
                          >
                            {task.status === "done" && <CheckCircle2 className="w-3 h-3" />}
                          </button>
                          <span className={cn("text-sm font-medium", task.status === "done" && "line-through text-subtle-foreground")}>{task.title}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2" style={{ backgroundColor: project?.color }} />
                          <span className="text-sm text-muted-foreground">{project?.title}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Select
                          value={task.status}
                          onChange={(e) => updateTaskStatus(task.id, e.target.value as "todo" | "in_progress" | "review" | "done")}
                          className="h-auto text-xs font-medium px-2 py-1"
                        >
                          <option value="todo">To Do</option>
                          <option value="in_progress">In Progress</option>
                          <option value="review">Review</option>
                          <option value="done">Done</option>
                        </Select>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={priorityVariant[task.priority]}>{task.priority}</Badge>
                      </td>
                      <td className="py-3 px-4">
                        {assignee ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: assignee.avatarColor }}>
                              {getInitials(assignee.name)}
                            </div>
                            <span className="text-sm">{assignee.name}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-subtle-foreground">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <CalendarDays className="w-3.5 h-3.5 text-subtle-foreground" />
                          <span className={cn("text-sm", isOverdue && "text-destructive font-medium")}>
                            {formatDate(task.dueDate)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredTasks.length === 0 && (
            <div className="py-12 text-center text-subtle-foreground">
              <p className="font-heading text-base font-semibold">All caught up</p>
              <p className="text-sm mt-1">No tasks match your current filters.</p>
            </div>
          )}
        </Card>
      </PageFrame>

      {/* New Task Dialog */}
      <Dialog open={showNewTask} onOpenChange={setShowNewTask}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>Add a new task to your workflow</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Title</label>
              <Input placeholder="What needs to be done?" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Project</label>
              <Select
                value={newTaskProject}
                onChange={(e) => setNewTaskProject(e.target.value)}
              >
                <option value="">Select project...</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Priority</label>
              <Select
                value={newTaskPriority}
                onChange={(e) => setNewTaskPriority(e.target.value as "low" | "medium" | "high" | "urgent")}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowNewTask(false)}>Cancel</Button>
              <Button onClick={handleCreateTask}>Create Task</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
