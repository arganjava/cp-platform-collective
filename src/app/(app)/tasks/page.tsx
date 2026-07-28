"use client";

import React, { useState } from "react";
import { useStore } from "@/lib/store";
import { cn, getInitials, formatDate, generateId } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Plus,
  Search,
  CalendarDays,
  CheckCircle2,
  Clock,
  AlertCircle,
  Eye,
} from "lucide-react";

const priorityVariant: Record<string, "teal" | "mustard" | "coral" | "danger"> = {
  low: "teal",
  medium: "mustard",
  high: "coral",
  urgent: "danger",
};

const statusConfig = {
  todo: { label: "To Do", color: "var(--color-status-todo)", icon: Clock },
  in_progress: { label: "In Progress", color: "var(--color-status-progress)", icon: AlertCircle },
  review: { label: "Review", color: "var(--color-status-review)", icon: Eye },
  done: { label: "Done", color: "var(--color-status-done)", icon: CheckCircle2 },
};

export default function TasksPage() {
  const { tasks, projects, users, getUserById, updateTaskStatus, addTask } = useStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"dueDate" | "priority" | "project">("dueDate");
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskProject, setNewTaskProject] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");

  const filteredTasks = tasks
    .filter((t) => {
      if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
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

  const myTasks = filteredTasks.filter((t) => t.assigneeId === "user-1");

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
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-[family-name:var(--font-heading)] tracking-tight">My Tasks</h1>
            <p className="text-sm text-text-secondary mt-0.5">{myTasks.length} tasks assigned to you across {projects.filter(p => myTasks.some(t => t.projectId === p.id)).length} projects</p>
          </div>
          <Button size="sm" onClick={() => setShowNewTask(true)}>
            <Plus className="w-4 h-4" /> New Task
          </Button>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-4 gap-3">
          {(Object.entries(statusConfig) as [string, typeof statusConfig.todo][]).map(([status, config]) => {
            const count = myTasks.filter((t) => t.status === status).length;
            const Icon = config.icon;
            return (
              <button
                key={status}
                onClick={() => setFilterStatus(filterStatus === status ? "all" : status)}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer text-left",
                  filterStatus === status ? "border-cp-purple-300 bg-cp-purple-50" : "border-border-default bg-white hover:border-border-strong"
                )}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${config.color}20` }}>
                  <Icon className="w-4.5 h-4.5" style={{ color: config.color }} />
                </div>
                <div>
                  <p className="text-lg font-bold">{count}</p>
                  <p className="text-xs text-text-muted">{config.label}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <Input placeholder="Search tasks..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
          </div>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="h-9 rounded-[10px] border border-border-default bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-cp-purple-500 cursor-pointer"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "dueDate" | "priority" | "project")}
            className="h-9 rounded-[10px] border border-border-default bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-cp-purple-500 cursor-pointer"
          >
            <option value="dueDate">Sort by Due Date</option>
            <option value="priority">Sort by Priority</option>
            <option value="project">Sort by Project</option>
          </select>
        </div>

        {/* Task list */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-default">
                  <th className="text-left text-xs font-medium text-text-muted uppercase tracking-wider py-3 px-4">Task</th>
                  <th className="text-left text-xs font-medium text-text-muted uppercase tracking-wider py-3 px-4">Project</th>
                  <th className="text-left text-xs font-medium text-text-muted uppercase tracking-wider py-3 px-4">Status</th>
                  <th className="text-left text-xs font-medium text-text-muted uppercase tracking-wider py-3 px-4">Priority</th>
                  <th className="text-left text-xs font-medium text-text-muted uppercase tracking-wider py-3 px-4">Assignee</th>
                  <th className="text-left text-xs font-medium text-text-muted uppercase tracking-wider py-3 px-4">Due</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((task) => {
                  const project = projects.find((p) => p.id === task.projectId);
                  const assignee = task.assigneeId ? getUserById(task.assigneeId) : null;
                  const daysLeft = Math.ceil((new Date(task.dueDate).getTime() - Date.now()) / 86400000);
                  const isOverdue = daysLeft < 0 && task.status !== "done";
                  return (
                    <tr key={task.id} className={cn("border-b border-border-default/50 hover:bg-surface-sunken/50 transition-colors", isOverdue && "bg-cp-coral-50/30")}>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => updateTaskStatus(task.id, task.status === "done" ? "todo" : "done")}
                            className={cn(
                              "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer flex-shrink-0",
                              task.status === "done"
                                ? "border-cp-teal-500 bg-cp-teal-500 text-white"
                                : "border-border-strong hover:border-cp-purple-500"
                            )}
                          >
                            {task.status === "done" && <CheckCircle2 className="w-3 h-3" />}
                          </button>
                          <span className={cn("text-sm font-medium", task.status === "done" && "line-through text-text-muted")}>{task.title}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: project?.color }} />
                          <span className="text-sm text-text-secondary">{project?.title}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={task.status}
                          onChange={(e) => updateTaskStatus(task.id, e.target.value as "todo" | "in_progress" | "review" | "done")}
                          className="text-xs font-medium px-2 py-1 rounded-md border border-border-default bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-cp-purple-500"
                        >
                          <option value="todo">To Do</option>
                          <option value="in_progress">In Progress</option>
                          <option value="review">Review</option>
                          <option value="done">Done</option>
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={priorityVariant[task.priority]}>{task.priority}</Badge>
                      </td>
                      <td className="py-3 px-4">
                        {assignee ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ backgroundColor: assignee.avatarColor }}>
                              {getInitials(assignee.name)}
                            </div>
                            <span className="text-sm">{assignee.name}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-text-muted">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <CalendarDays className="w-3.5 h-3.5 text-text-muted" />
                          <span className={cn("text-sm", isOverdue && "text-cp-coral-600 font-medium")}>
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
            <div className="py-12 text-center text-text-muted">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-cp-teal-400" />
              <p className="font-medium">All caught up!</p>
              <p className="text-sm mt-1">No tasks match your current filters.</p>
            </div>
          )}
        </Card>
      </div>

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
              <select
                value={newTaskProject}
                onChange={(e) => setNewTaskProject(e.target.value)}
                className="w-full h-9 rounded-[10px] border border-border-default bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-cp-purple-500"
              >
                <option value="">Select project...</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Priority</label>
              <select
                value={newTaskPriority}
                onChange={(e) => setNewTaskPriority(e.target.value as "low" | "medium" | "high" | "urgent")}
                className="w-full h-9 rounded-[10px] border border-border-default bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-cp-purple-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
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
