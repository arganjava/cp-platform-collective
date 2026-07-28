"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useStore } from "@/lib/store";
import { cn, formatDate, getInitials } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  FolderKanban,
  CheckSquare,
  DollarSign,
  Clock,
  ArrowUpRight,
  Users,
  CalendarDays,
  Sparkles,
} from "lucide-react";

const RechartsArea = dynamic(() => import("@/components/dashboard-chart").then(m => m.DashboardChart), { ssr: false });

const statusColors: Record<string, string> = {
  todo: "var(--color-status-todo)",
  in_progress: "var(--color-status-progress)",
  review: "var(--color-status-review)",
  done: "var(--color-status-done)",
};

const statusLabels: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  review: "Review",
  done: "Done",
};

const priorityColors: Record<string, string> = {
  low: "var(--color-priority-low)",
  medium: "var(--color-priority-medium)",
  high: "var(--color-priority-high)",
  urgent: "var(--color-priority-urgent)",
};

export default function DashboardPage() {
  const { projects, tasks, sales, users, getUserById } = useStore();

  const activeProjects = projects.filter((p) => p.status === "active");
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === "done").length;
  const completionPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const overdueTasks = tasks.filter((t) => {
    if (t.status === "done") return false;
    return new Date(t.dueDate) < new Date();
  }).length;
  const totalRevenue = sales.reduce((sum, s) => sum + s.amount, 0);
  const thisMonthSales = sales.filter((s) => {
    const d = new Date(s.date);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const thisMonthRevenue = thisMonthSales.reduce((sum, s) => sum + s.amount, 0);

  const upcomingDeadlines = [...tasks]
    .filter((t) => t.status !== "done")
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 5);

  return (
      <div className="space-y-6 animate-fade-in">
        {/* Welcome banner */}
        <div className="relative overflow-hidden rounded-[18px] gradient-brand p-6 text-white">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5" />
              <span className="text-white/80 text-sm font-medium">Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, Vincent</span>
            </div>
            <h1 className="text-2xl font-bold font-[family-name:var(--font-heading)] tracking-tight mb-1">
              Redefining Ability. Reimagining Possibility.
            </h1>
            <p className="text-white/70 text-sm max-w-xl">
              Here&apos;s what&apos;s happening across your projects today. {overdueTasks > 0 ? `${overdueTasks} task${overdueTasks > 1 ? "s" : ""} need attention.` : "Everything is on track."}
            </p>
          </div>
          <div className="absolute -right-10 -top-10 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -right-5 -bottom-10 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="card-hover">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-cp-purple-100 flex items-center justify-center">
                  <FolderKanban className="w-5 h-5 text-cp-purple-600" />
                </div>
                <Badge variant="purple">{activeProjects.length} active</Badge>
              </div>
              <p className="text-2xl font-bold tracking-tight">{projects.length}</p>
              <p className="text-sm text-text-secondary">Total Projects</p>
            </CardContent>
          </Card>

          <Card className="card-hover">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-cp-teal-100 flex items-center justify-center">
                  <CheckSquare className="w-5 h-5 text-cp-teal-600" />
                </div>
                <Badge variant="success">{completionPct}% done</Badge>
              </div>
              <p className="text-2xl font-bold tracking-tight">{totalTasks}</p>
              <p className="text-sm text-text-secondary">Total Tasks</p>
            </CardContent>
          </Card>

          <Card className="card-hover">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-cp-coral-100 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-cp-coral-600" />
                </div>
                {overdueTasks > 0 ? (
                  <Badge variant="danger">{overdueTasks} overdue</Badge>
                ) : (
                  <Badge variant="success">On track</Badge>
                )}
              </div>
              <p className="text-2xl font-bold tracking-tight">{overdueTasks}</p>
              <p className="text-sm text-text-secondary">Overdue Tasks</p>
            </CardContent>
          </Card>

          <Card className="card-hover">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-cp-mustard-100 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-cp-mustard-700" />
                </div>
                <Badge variant="teal">
                  <ArrowUpRight className="w-3 h-3 mr-0.5" />
                  +${(thisMonthRevenue / 1000).toFixed(0)}k
                </Badge>
              </div>
              <p className="text-2xl font-bold tracking-tight">${(totalRevenue / 1000).toFixed(0)}k</p>
              <p className="text-sm text-text-secondary">Total Revenue</p>
            </CardContent>
          </Card>
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Task breakdown + Chart */}
          <div className="lg:col-span-2 space-y-6">
            {/* Task status breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Task Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-3 mb-6">
                  {(["todo", "in_progress", "review", "done"] as const).map((status) => {
                    const count = tasks.filter((t) => t.status === status).length;
                    return (
                      <div key={status} className="text-center p-3 rounded-xl bg-surface-sunken">
                        <div className="w-2.5 h-2.5 rounded-full mx-auto mb-2" style={{ backgroundColor: statusColors[status] }} />
                        <p className="text-xl font-bold">{count}</p>
                        <p className="text-xs text-text-muted">{statusLabels[status]}</p>
                      </div>
                    );
                  })}
                </div>
                <RechartsArea />
              </CardContent>
            </Card>

            {/* Upcoming deadlines */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Upcoming Deadlines</CardTitle>
                  <CalendarDays className="w-4 h-4 text-text-muted" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {upcomingDeadlines.map((task) => {
                    const project = projects.find((p) => p.id === task.projectId);
                    const daysLeft = Math.ceil((new Date(task.dueDate).getTime() - new Date().getTime()) / 86400000);
                    const isOverdue = daysLeft < 0;
                    return (
                      <div key={task.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-sunken transition-colors group">
                        <div className="w-1.5 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: priorityColors[task.priority] }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{task.title}</p>
                          <p className="text-xs text-text-muted">{project?.title}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={cn("text-xs font-medium", isOverdue ? "text-cp-coral-600" : daysLeft <= 3 ? "text-cp-mustard-700" : "text-text-secondary")}>
                            {isOverdue ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
                          </p>
                          <p className="text-[10px] text-text-muted">{formatDate(task.dueDate)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right sidebar */}
          <div className="space-y-6">
            {/* Active projects */}
            <Card>
              <CardHeader>
                <CardTitle>Active Projects</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {activeProjects.map((project) => {
                    const projectTasks = tasks.filter((t) => t.projectId === project.id);
                    const doneTasks = projectTasks.filter((t) => t.status === "done").length;
                    const progress = projectTasks.length > 0 ? Math.round((doneTasks / projectTasks.length) * 100) : 0;
                    const members = project.memberIds.map((id) => getUserById(id)).filter(Boolean);
                    return (
                      <div key={project.id} className="p-3 rounded-xl hover:bg-surface-sunken transition-colors cursor-pointer card-hover">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
                          <h4 className="text-sm font-semibold truncate">{project.title}</h4>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <Progress value={progress} className="flex-1" color={project.color} />
                          <span className="text-xs text-text-muted font-medium w-8 text-right">{progress}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex -space-x-1.5">
                            {members.slice(0, 3).map((member) => (
                              <div
                                key={member!.id}
                                className="w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-bold text-white"
                                style={{ backgroundColor: member!.avatarColor }}
                                title={member!.name}
                              >
                                {getInitials(member!.name)}
                              </div>
                            ))}
                            {members.length > 3 && (
                              <div className="w-5 h-5 rounded-full border-2 border-white bg-surface-sunken flex items-center justify-center text-[8px] font-medium text-text-muted">
                                +{members.length - 3}
                              </div>
                            )}
                          </div>
                          <span className="text-xs text-text-muted">{projectTasks.length} tasks</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Team activity */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Team</CardTitle>
                  <Users className="w-4 h-4 text-text-muted" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {users.slice(0, 6).map((user) => {
                    const userTasks = tasks.filter((t) => t.assigneeId === user.id && t.status !== "done");
                    return (
                      <div key={user.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-sunken transition-colors">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
                          style={{ backgroundColor: user.avatarColor }}
                        >
                          {getInitials(user.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{user.name}</p>
                          <p className="text-xs text-text-muted">{userTasks.length} active tasks</p>
                        </div>
                        <div className="w-2 h-2 rounded-full bg-cp-teal-400" title="Online" />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
  );
}
