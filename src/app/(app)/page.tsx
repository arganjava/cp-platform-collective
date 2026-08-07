"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useStore } from "@/lib/store";
import { cn, formatDate, getInitials } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PageFrame, TitleBlock, SheetSummary, SummaryMetric } from "@/components/page-layout";
import { CalendarDays, Users } from "lucide-react";

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

  const today = new Date();
  const dateStr = today.toLocaleDateString("en-SG", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
      <PageFrame>
        <TitleBlock
          title="Dashboard"
          description="What needs attention across your projects today."
          meta={
            <>
              <span>{dateStr}</span>
              <span>{activeProjects.length} active projects</span>
              <span>{totalTasks} tasks in flight</span>
            </>
          }
        />

        <SheetSummary>
          <SummaryMetric value={projects.length} label="Projects" indicator={<Badge variant="neutral">{activeProjects.length} active</Badge>} />
          <SummaryMetric value={totalTasks} label="Tasks" indicator={<Badge variant="positive">{completionPct}% done</Badge>} />
          <SummaryMetric value={overdueTasks} label="Overdue" indicator={overdueTasks > 0 ? <Badge variant="danger">{overdueTasks} need attention</Badge> : <Badge variant="positive">On track</Badge>} />
          <SummaryMetric value={`$${(totalRevenue / 1000).toFixed(0)}k`} label="Revenue" indicator={<Badge variant="neutral">+${(thisMonthRevenue / 1000).toFixed(0)}k this month</Badge>} />
        </SheetSummary>

        <div className="grid min-w-0 gap-8 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.9fr)]">
          {/* Left column */}
          <div className="min-w-0 space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Task Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-0 border-y border-border sm:grid-cols-4">
                  {(["todo", "in_progress", "review", "done"] as const).map((status) => {
                    const count = tasks.filter((t) => t.status === status).length;
                    return (
                      <div key={status} className="flex flex-col gap-1 px-4 py-3 border-r border-border last:border-r-0">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2" style={{ backgroundColor: statusColors[status] }} />
                          <span className="text-xs font-medium uppercase tracking-wider text-subtle-foreground">{statusLabels[status]}</span>
                        </div>
                        <p className="text-xl font-bold tabular">{count}</p>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-6">
                  <RechartsArea />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Upcoming Deadlines</CardTitle>
                  <CalendarDays className="w-4 h-4 text-subtle-foreground" aria-hidden="true" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-border">
                  {upcomingDeadlines.map((task) => {
                    const project = projects.find((p) => p.id === task.projectId);
                    const daysLeft = Math.ceil((new Date(task.dueDate).getTime() - new Date().getTime()) / 86400000);
                    const isOverdue = daysLeft < 0;
                    return (
                      <div key={task.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                        <div className="w-1 h-8 flex-shrink-0" style={{ backgroundColor: priorityColors[task.priority] }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{task.title}</p>
                          <p className="text-xs text-subtle-foreground truncate">{project?.title}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={cn("text-xs font-semibold tabular", isOverdue ? "text-destructive" : daysLeft <= 3 ? "text-destructive" : "text-muted-foreground")}>
                            {isOverdue ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
                          </p>
                          <p className="text-xs text-subtle-foreground">{formatDate(task.dueDate)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right column */}
          <div className="min-w-0 space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Active Projects</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-border">
                  {activeProjects.map((project) => {
                    const projectTasks = tasks.filter((t) => t.projectId === project.id);
                    const doneTasks = projectTasks.filter((t) => t.status === "done").length;
                    const progress = projectTasks.length > 0 ? Math.round((doneTasks / projectTasks.length) * 100) : 0;
                    const members = project.memberIds.map((id) => getUserById(id)).filter(Boolean);
                    return (
                      <div key={project.id} className="py-3 first:pt-0 last:pb-0">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 flex-shrink-0" style={{ backgroundColor: project.color }} />
                          <h4 className="text-sm font-semibold truncate flex-1">{project.title}</h4>
                          <span className="text-xs text-subtle-foreground tabular">{projectTasks.length} tasks</span>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <Progress value={progress} label={`${project.title} completion`} className="flex-1" color={project.color} />
                          <span className="text-xs text-subtle-foreground font-medium tabular w-8 text-right">{progress}%</span>
                        </div>
                        <div className="flex -space-x-1.5">
                          {members.slice(0, 4).map((member) => (
                            <div
                              key={member!.id}
                              className="w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white"
                              style={{ backgroundColor: member!.avatarColor }}
                              title={member!.name}
                            >
                              {getInitials(member!.name)}
                            </div>
                          ))}
                          {members.length > 4 && (
                            <div className="w-5 h-5 border-2 border-white bg-secondary flex items-center justify-center text-[10px] font-medium text-subtle-foreground">
                              +{members.length - 4}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Team</CardTitle>
                  <Users className="w-4 h-4 text-subtle-foreground" aria-hidden="true" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-border">
                  {users.slice(0, 6).map((user) => {
                    const userTasks = tasks.filter((t) => t.assigneeId === user.id && t.status !== "done");
                    return (
                      <div key={user.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
                          style={{ backgroundColor: user.avatarColor }}
                        >
                          {getInitials(user.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{user.name}</p>
                          <p className="text-xs text-subtle-foreground tabular">{userTasks.length} active tasks</p>
                        </div>
                        <div className="w-1.5 h-1.5 bg-muted-foreground" title="Online" />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </PageFrame>
  );
}
