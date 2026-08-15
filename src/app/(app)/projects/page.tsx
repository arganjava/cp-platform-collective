"use client";

import React, { useState } from "react";
import { useStore } from "@/lib/store";
import { cn, getInitials, formatDate, generateId } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { PageFrame, PageHeader, Toolbar } from "@/components/page-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  LayoutGrid,
  List,
} from "lucide-react";

const statusConfig = {
  todo: { label: "To Do", color: "var(--color-status-todo)" },
  in_progress: { label: "In Progress", color: "var(--color-status-progress)" },
  review: { label: "Review", color: "var(--color-status-review)" },
  done: { label: "Done", color: "var(--color-status-done)" },
};

export default function ProjectsPage() {
  const { projects, tasks, users, getUserById, updateTaskStatus, addTask, addProject, searchQuery } = useStore();
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [view, setView] = useState<"board" | "list">("board");
  const [showNewTask, setShowNewTask] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskProject, setNewTaskProject] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [newTaskAssignee, setNewTaskAssignee] = useState("");
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const activeProjects = projects.filter((p) => p.status === "active");
  const displayedTasks = selectedProject
    ? tasks.filter((t) => t.projectId === selectedProject)
    : tasks;

  const query = searchQuery.trim().toLowerCase();
  const filteredTasks = displayedTasks.filter((t) => {
    if (!query) return true;
    const project = projects.find((p) => p.id === t.projectId);
    const assignee = getUserById(t.assigneeId);
    const haystack = [t.title, project?.title ?? "", assignee?.name ?? "", ...t.tags].join(" ").toLowerCase();
    return haystack.includes(query);
  });

  const tasksByStatus = {
    todo: filteredTasks.filter((t) => t.status === "todo").sort((a, b) => a.order - b.order),
    in_progress: filteredTasks.filter((t) => t.status === "in_progress").sort((a, b) => a.order - b.order),
    review: filteredTasks.filter((t) => t.status === "review").sort((a, b) => a.order - b.order),
    done: filteredTasks.filter((t) => t.status === "done").sort((a, b) => a.order - b.order),
  };

  function handleCreateTask() {
    if (!newTaskTitle.trim()) return;
    const task = {
      id: `task-${generateId()}`,
      projectId: newTaskProject || (selectedProject || projects[0]?.id || "proj-1"),
      title: newTaskTitle,
      description: "",
      status: "todo" as const,
      priority: newTaskPriority,
      assigneeId: newTaskAssignee || null,
      startDate: new Date().toISOString().split("T")[0],
      dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
      tags: [],
      createdAt: new Date().toISOString(),
      order: tasksByStatus.todo.length,
    };
    addTask(task);
    setNewTaskTitle("");
    setShowNewTask(false);
  }

  function handleCreateProject() {
    if (!newProjectTitle.trim()) return;
    const project = {
      id: `proj-${generateId()}`,
      title: newProjectTitle,
      description: newProjectDesc,
      status: "active" as const,
      color: ["var(--primary)", "var(--brand)", "var(--muted-foreground)", "var(--destructive)"][Math.floor(Math.random() * 4)],
      ownerId: "user-1",
      memberIds: ["user-1"],
      startDate: new Date().toISOString().split("T")[0],
      endDate: new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0],
      createdAt: new Date().toISOString(),
    };
    addProject(project);
    setNewProjectTitle("");
    setNewProjectDesc("");
    setShowNewProject(false);
  }

  function handleDragStart(taskId: string) {
    setDraggedTask(taskId);
  }

  function handleDragOver(e: React.DragEvent, status: string) {
    e.preventDefault();
    setDragOverColumn(status);
  }

  function handleDrop(status: string) {
    if (draggedTask) {
      updateTaskStatus(draggedTask, status as "todo" | "in_progress" | "review" | "done");
    }
    setDraggedTask(null);
    setDragOverColumn(null);
  }

  const priorityVariant: Record<string, "neutral" | "warning" | "accent" | "danger"> = {
    low: "neutral",
    medium: "warning",
    high: "accent",
    urgent: "danger",
  };

  return (
    <>
      <PageFrame>
        {/* Header */}
        <PageHeader
          title="Projects"
          description="Manage and track all projects across the team"
          actions={<><Button variant="outline" size="sm" onClick={() => setShowNewProject(true)}><Plus className="w-4 h-4" /> New Project</Button><Button size="sm" onClick={() => setShowNewTask(true)}><Plus className="w-4 h-4" /> New Task</Button></>}
        />
        {/* Project chips + search */}
        <Toolbar className="gap-3">
          <button
            onClick={() => setSelectedProject(null)}
            className={cn(
              "min-h-10 px-4 py-2 text-sm font-medium transition-all cursor-pointer",
              !selectedProject ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:border-input"
            )}
          >
            All Projects
          </button>
          {activeProjects.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedProject(p.id)}
              className={cn(
                "px-4 py-2 text-sm font-medium transition-all cursor-pointer flex items-center gap-2",
                selectedProject === p.id ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:border-input"
              )}
            >
              <div className="w-2 h-2" style={{ backgroundColor: p.color }} />
              {p.title}
            </button>
          ))}
          <Tabs className="ml-auto" value={view} onValueChange={(v) => setView(v as "board" | "list")}>
            <TabsList>
              <TabsTrigger value="board"><LayoutGrid className="w-4 h-4 mr-1" />Board</TabsTrigger>
              <TabsTrigger value="list"><List className="w-4 h-4 mr-1" />List</TabsTrigger>
            </TabsList>
          </Tabs>
        </Toolbar>

        {/* Board view */}
        {view === "board" && (
          <div className="overflow-x-auto pb-2" role="region" aria-label="Project task board" tabIndex={0}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:min-w-[1080px] xl:grid-cols-4">
            {(Object.entries(statusConfig) as [string, typeof statusConfig.todo][]).map(([status, config]) => {
              const columnTasks = tasksByStatus[status as keyof typeof tasksByStatus];
              const isDragOver = dragOverColumn === status;
              return (
                <div
                  key={status}
                  className="min-h-[500px]"
                  onDragOver={(e) => handleDragOver(e, status)}
                  onDragLeave={() => setDragOverColumn(null)}
                  onDrop={() => handleDrop(status)}
                >
                  {/* Column header */}
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5" style={{ backgroundColor: config.color }} />
                      <span className="text-sm font-semibold">{config.label}</span>
                      <span className="bg-secondary px-1.5 py-0.5 text-xs tabular-nums text-subtle-foreground">{columnTasks.length}</span>
                    </div>
                    <button type="button" aria-label={`Add task to ${config.label}`} className="flex h-10 w-10 items-center justify-center transition-colors hover:bg-secondary cursor-pointer">
                      <Plus className="w-3.5 h-3.5 text-subtle-foreground" />
                    </button>
                  </div>

                  {/* Cards */}
                  <div className={cn("min-h-[200px] space-y-2 p-1 transition-colors", isDragOver && "border border-dashed border-primary bg-secondary")}>
                    {columnTasks.map((task) => {
                      const project = projects.find((p) => p.id === task.projectId);
                      const assignee = task.assigneeId ? getUserById(task.assigneeId) : null;
                      const daysLeft = Math.ceil((new Date(task.dueDate).getTime() - Date.now()) / 86400000);
                      return (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={() => handleDragStart(task.id)}
                          className={cn(
                            "kanban-card group cursor-grab border border-border bg-card p-3.5 active:cursor-grabbing",
                            draggedTask === task.id && "opacity-50"
                          )}
                        >
                          {/* Project tag */}
                          {project && (
                            <div className="flex items-center gap-1.5 mb-2">
                              <div className="w-1.5 h-1.5" style={{ backgroundColor: project.color }} />
                              <span className="text-xs font-medium text-subtle-foreground uppercase tracking-wider">{project.title}</span>
                            </div>
                          )}
                          {/* Title */}
                          <h4 className="text-sm font-medium mb-2 leading-snug">{task.title}</h4>
                          {/* Tags */}
                          {task.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2">
                              {task.tags.slice(0, 2).map((tag) => (
                                <span key={tag} className="bg-secondary px-1.5 py-0.5 text-xs text-subtle-foreground">{tag}</span>
                              ))}
                            </div>
                          )}
                          {/* Footer */}
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-2">
                              <Badge variant={priorityVariant[task.priority]} className="text-xs px-1.5 py-0">
                                {task.priority}
                              </Badge>
                              {task.status !== "done" && (
                                <span className={cn("text-xs", daysLeft < 0 ? "text-destructive font-medium" : daysLeft <= 3 ? "text-destructive" : "text-subtle-foreground")}>
                                  {daysLeft < 0 ? `${Math.abs(daysLeft)}d late` : `${daysLeft}d left`}
                                </span>
                              )}
                            </div>
                            {assignee && (
                              <div
                                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-primary-foreground"
                                style={{ backgroundColor: assignee.avatarColor }}
                                title={assignee.name}
                              >
                                {getInitials(assignee.name)}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        )}

        {/* List view */}
        {view === "list" && (
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
                    <th className="text-left text-xs font-medium text-subtle-foreground uppercase tracking-wider py-3 px-4">Due Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map((task) => {
                    const project = projects.find((p) => p.id === task.projectId);
                    const assignee = task.assigneeId ? getUserById(task.assigneeId) : null;
                    return (
                      <tr key={task.id} className="border-b border-border/50 hover:bg-secondary/50 transition-colors cursor-pointer">
                        <td className="py-3 px-4">
                          <p className="text-sm font-medium">{task.title}</p>
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
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-primary-foreground" style={{ backgroundColor: assignee.avatarColor }}>
                                {getInitials(assignee.name)}
                              </div>
                              <span className="text-sm">{assignee.name}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-subtle-foreground">Unassigned</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">{formatDate(task.dueDate)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </PageFrame>

      {/* New Task Dialog */}
      <Dialog open={showNewTask} onOpenChange={setShowNewTask}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>Add a new task to your project workflow</DialogDescription>
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
                className="h-9"
              >
                <option value="">Select project...</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Priority</label>
                <Select
                  value={newTaskPriority}
                  onChange={(e) => setNewTaskPriority(e.target.value as "low" | "medium" | "high" | "urgent")}
                  className="h-9"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Assignee</label>
                <Select
                  value={newTaskAssignee}
                  onChange={(e) => setNewTaskAssignee(e.target.value)}
                  className="h-9"
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowNewTask(false)}>Cancel</Button>
              <Button onClick={handleCreateTask}>Create Task</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Project Dialog */}
      <Dialog open={showNewProject} onOpenChange={setShowNewProject}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>Start a new project for the team</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Project Name</label>
              <Input placeholder="e.g., DARE Festival 2027" value={newProjectTitle} onChange={(e) => setNewProjectTitle(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Description</label>
              <Textarea placeholder="Brief description of the project..." value={newProjectDesc} onChange={(e) => setNewProjectDesc(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowNewProject(false)}>Cancel</Button>
              <Button onClick={handleCreateProject}>Create Project</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
