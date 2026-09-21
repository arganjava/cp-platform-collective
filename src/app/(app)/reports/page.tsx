"use client";

import React, { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { useStore } from "@/lib/store";
import { cn, formatCurrency, formatDate, getInitials } from "@/lib/utils";
import type { SaleStage, SaleStageStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { PageFrame, PageHeader, SheetSummary, SummaryMetric, ContentGrid } from "@/components/page-layout";
import {
  AttentionProjectList,
  ReportMeta,
  ReportPanel,
  ReportPeriodToolbar,
  type ReportPeriod,
} from "@/components/report-components";
import type { ProjectStat, RevenuePoint, TaskStatusPoint, TeamStat } from "@/components/reports-charts";

const SalesChart = dynamic(() => import("@/components/reports-charts").then((module) => module.SalesChart), { ssr: false });
const TaskChart = dynamic(() => import("@/components/reports-charts").then((module) => module.TaskChart), { ssr: false });
const ProjectProgressChart = dynamic(() => import("@/components/reports-charts").then((module) => module.ProjectProgressChart), { ssr: false });
const TeamChart = dynamic(() => import("@/components/reports-charts").then((module) => module.TeamChart), { ssr: false });

const stageStatusStyles: Record<SaleStageStatus, { label: string; badgeClass: string; dotClass: string }> = {
  Opportunity: {
    label: "Opportunity",
    badgeClass: "border border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
    dotClass: "bg-blue-500",
  },
  Discussion: {
    label: "Discussion",
    badgeClass: "border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    dotClass: "bg-amber-500",
  },
  Closed: {
    label: "Closed",
    badgeClass: "border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    dotClass: "bg-emerald-500",
  },
  Lost: {
    label: "Lost",
    badgeClass: "border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    dotClass: "bg-rose-500",
  },
};

const statusLabels = {
  todo: "To Do",
  in_progress: "In Progress",
  review: "Review",
  done: "Done",
} as const;

const statusColors = {
  todo: "var(--color-status-todo)",
  in_progress: "var(--color-status-progress)",
  review: "var(--color-status-review)",
  done: "var(--color-status-done)",
} as const;

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function getPeriodRange(period: ReportPeriod) {
  const now = new Date();
  if (period === "all") return { start: null, end: null, label: "All available data" };
  if (period === "this-year") {
    return {
      start: new Date(now.getFullYear(), 0, 1),
      end: endOfDay(now),
      label: `1 Jan ${now.getFullYear()} – ${formatDate(now)}`,
    };
  }

  const days = period === "last-30" ? 30 : 90;
  const start = startOfDay(new Date(now.getTime() - (days - 1) * 86400000));
  return { start, end: endOfDay(now), label: `${formatDate(start)} – ${formatDate(now)}` };
}

function isDateInRange(value: string, range: ReturnType<typeof getPeriodRange>) {
  const date = new Date(value);
  return (!range.start || date >= range.start) && (!range.end || date <= range.end);
}

function taskIntersectsRange(task: { startDate?: string; dueDate?: string | null }, range: ReturnType<typeof getPeriodRange>) {
  if (!range.start || !range.end) return true;
  if (!task.dueDate || !task.startDate) return true;
  return new Date(task.dueDate) >= range.start && new Date(task.startDate) <= range.end;
}

function projectIntersectsRange(project: { startDate?: string; endDate?: string }, range: ReturnType<typeof getPeriodRange>) {
  if (!range.start || !range.end) return true;
  if (!project.startDate || !project.endDate) return true;
  return new Date(project.endDate) >= range.start && new Date(project.startDate) <= range.end;
}

export default function ReportsPage() {
  const { projects, tasks, sales, saleStages, users, getUserById, searchQuery, currentUserId } = useStore();
  const currentUser = getUserById(currentUserId);
  const isAdmin = currentUser?.role === "admin";

  const [activeTab, setActiveTab] = useState("overview");
  const [period, setPeriod] = useState<ReportPeriod>("all");
  const [projectId, setProjectId] = useState("all");
  const [stageStatus, setStageStatus] = useState<string>("all");

  const range = useMemo(() => getPeriodRange(period), [period]);
  const query = searchQuery.trim().toLowerCase();
  const selectedProject = projects.find((project) => project.id === projectId);
  const projectLabel = selectedProject?.title || "All projects";

  const getLatestSaleStage = useCallback(
    (saleId: string): SaleStage | null => {
      const matching = saleStages.filter((st) => st.saleId === saleId);
      if (matching.length === 0) return null;
      return [...matching].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];
    },
    [saleStages]
  );

  const filteredSales = useMemo(
    () =>
      sales.filter((sale) => {
        if (projectId !== "all" && sale.projectId !== projectId) return false;
        if (!isDateInRange(sale.date, range)) return false;
        if (stageStatus !== "all") {
          const latest = getLatestSaleStage(sale.id);
          if (!latest || latest.status !== stageStatus) return false;
        }
        if (query) {
          const project = projects.find((p) => p.id === sale.projectId);
          const haystack = `${sale.clientName} ${sale.notes} ${project?.title ?? ""}`.toLowerCase();
          if (!haystack.includes(query)) return false;
        }
        return true;
      }),
    [projectId, range, stageStatus, getLatestSaleStage, sales, query, projects]
  );

  const filteredProjects = useMemo(() => {
    // When a specific stageStatus filter is selected, only projects with sales in that stage status are in view
    const stageSaleProjectIds = stageStatus !== "all" ? new Set(filteredSales.map((s) => s.projectId)) : null;

    return projects.filter((project) => {
      if (projectId !== "all" && project.id !== projectId) return false;

      if (stageSaleProjectIds && !stageSaleProjectIds.has(project.id)) {
        return false;
      }

      if (period !== "all" && stageStatus === "all") {
        const hasSalesInPeriod = sales.some(
          (s) => s.projectId === project.id && isDateInRange(s.date, range)
        );
        const hasTasksInPeriod = tasks.some(
          (t) => t.projectId === project.id && taskIntersectsRange(t, range)
        );
        const intersectsDates = projectIntersectsRange(project, range);
        if (!hasSalesInPeriod && !hasTasksInPeriod && !intersectsDates) {
          return false;
        }
      }

      if (query) {
        const text = `${project.title} ${project.description}`.toLowerCase();
        const hasMatchingSale = filteredSales.some((s) => s.projectId === project.id);
        const hasMatchingTask = tasks.some(
          (t) =>
            t.projectId === project.id &&
            `${t.title} ${t.description || ""}`.toLowerCase().includes(query)
        );
        if (!text.includes(query) && !hasMatchingSale && !hasMatchingTask) {
          return false;
        }
      }

      return true;
    });
  }, [projects, projectId, stageStatus, filteredSales, period, sales, range, tasks, query]);

  const filteredTasks = useMemo(() => {
    const validProjectIds = new Set(filteredProjects.map((p) => p.id));

    return tasks.filter((task) => {
      if (!validProjectIds.has(task.projectId)) return false;
      if (!taskIntersectsRange(task, range)) return false;

      if (query) {
        const project = projects.find((p) => p.id === task.projectId);
        const assignee = getUserById(task.assigneeId);
        const haystack = `${task.title} ${task.description || ""} ${project?.title ?? ""} ${assignee?.name ?? ""}`.toLowerCase();
        const projectMatched = `${project?.title ?? ""} ${project?.description ?? ""}`.toLowerCase().includes(query);
        const saleMatched = filteredSales.some((s) => s.projectId === task.projectId);
        if (!haystack.includes(query) && !projectMatched && !saleMatched) {
          return false;
        }
      }

      return true;
    });
  }, [filteredProjects, tasks, range, query, projects, getUserById, filteredSales]);

  const totalRevenue = filteredSales.reduce((sum, sale) => sum + sale.amount, 0);
  const completedTasks = filteredTasks.filter((task) => task.status === "done").length;
  const activeProjects = filteredProjects.filter((project) => project.status === "active").length;
  const overdueTasks = filteredTasks.filter((task) => task.status !== "done" && task.dueDate && new Date(task.dueDate) < new Date());

  const revenueData = useMemo<RevenuePoint[]>(() => {
    const monthlySales = new Map<string, { label: string; revenue: number; date: number }>();
    filteredSales.forEach((sale) => {
      const date = new Date(sale.date);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const existing = monthlySales.get(key);
      monthlySales.set(key, {
        label: date.toLocaleDateString("en-SG", { month: "short", year: "numeric" }),
        revenue: (existing?.revenue || 0) + sale.amount,
        date: new Date(date.getFullYear(), date.getMonth(), 1).getTime(),
      });
    });
    return [...monthlySales.values()].sort((a, b) => a.date - b.date).map(({ label, revenue }) => ({ month: label, revenue }));
  }, [filteredSales]);

  const taskStatusData = useMemo<TaskStatusPoint[]>(() => {
    return (Object.keys(statusLabels) as Array<keyof typeof statusLabels>).map((status) => ({
      name: statusLabels[status],
      value: filteredTasks.filter((task) => task.status === status).length,
      color: statusColors[status],
    }));
  }, [filteredTasks]);

  const projectStats = useMemo<ProjectStat[]>(() => {
    return filteredProjects.map((project) => {
      const projectTasks = filteredTasks.filter((task) => task.projectId === project.id);
      const projectSales = filteredSales.filter((sale) => sale.projectId === project.id);
      const completed = projectTasks.filter((task) => task.status === "done").length;
      const overdue = projectTasks.filter((task) => task.status !== "done" && task.dueDate && new Date(task.dueDate) < new Date()).length;
      return {
        id: project.id,
        title: project.title,
        color: project.color,
        status: project.status,
        totalTasks: projectTasks.length,
        completedTasks: completed,
        completionRate: projectTasks.length > 0 ? Math.round((completed / projectTasks.length) * 100) : 0,
        overdueTasks: overdue,
        revenue: projectSales.reduce((sum, sale) => sum + sale.amount, 0),
      };
    });
  }, [filteredProjects, filteredSales, filteredTasks]);

  const teamStats = useMemo<TeamStat[]>(() => {
    return users
      .map((user) => {
        const userTasks = filteredTasks.filter((task) => task.assigneeId === user.id);
        const completed = userTasks.filter((task) => task.status === "done").length;
        return {
          id: user.id,
          name: user.name,
          avatarColor: user.avatarColor,
          totalTasks: userTasks.length,
          completedTasks: completed,
          completionRate: userTasks.length > 0 ? Math.round((completed / userTasks.length) * 100) : 0,
        };
      })
      .filter((user) => user.totalTasks > 0)
      .sort((a, b) => b.totalTasks - a.totalTasks);
  }, [filteredTasks, users]);

  const attentionProjects = useMemo(() => {
    return projectStats
      .map((project) => {
        const projectTasks = filteredTasks.filter((task) => task.projectId === project.id);
        const nextTask = [...projectTasks]
          .filter((task) => task.status !== "done")
          .sort((a, b) => {
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
          })[0];
        const owner = getUserById(projects.find((item) => item.id === project.id)?.ownerId || "");
        return {
          id: project.id,
          title: project.title,
          ownerName: owner?.name || "Unassigned",
          completionRate: project.completionRate,
          overdueTasks: project.overdueTasks,
          revenue: formatCurrency(project.revenue),
          nextAction: nextTask?.title || "Review current delivery plan",
        };
      })
      .filter((project) => project.overdueTasks > 0 || project.completionRate < 50)
      .sort((a, b) => b.overdueTasks - a.overdueTasks || a.completionRate - b.completionRate)
      .slice(0, 5);
  }, [filteredTasks, getUserById, projectStats, projects]);

  function handlePrint() {
    window.print();
  }

  const completionLabel = filteredTasks.length > 0 ? `${completedTasks}/${filteredTasks.length}` : "0";
  const stageStatusLabel = stageStatus === "all" ? "All Stage Statuses" : stageStatus;
  const reportStatus = `${projectLabel} · ${stageStatusLabel} · ${range.label} · ${filteredSales.length} sales entries, ${filteredTasks.length} tasks, ${filteredProjects.length} projects`;

  if (!isAdmin) {
    const roleLabel = currentUser?.role ? currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1) : "Guest";
    return (
      <PageFrame id="reports-access-denied-frame">
        <PageHeader
          title="Reports & Analytics"
          description="Financial performance, task throughput, and delivery insights across projects."
        />
        <Card className="border border-border p-8 text-center" id="card-reports-restricted">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-4">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h2 className="font-heading text-xl font-bold text-foreground mb-2">
            Access Restricted
          </h2>
          <p className="max-w-md mx-auto text-sm text-muted-foreground mb-6">
            Your current role is set to <strong>{roleLabel}</strong>. Analytics, financial summaries, and performance reports are strictly restricted to Workspace Administrators.
          </p>
          <div className="flex justify-center">
            <Link href="/">
              <Button variant="default" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                <span>Return to Dashboard</span>
              </Button>
            </Link>
          </div>
        </Card>
      </PageFrame>
    );
  }

  return (
    <PageFrame className="print-content">
      <PageHeader
        title="Reports"
        description="A trustworthy view of delivery and revenue across your selected reporting period."
      />

      <ReportPeriodToolbar
        period={period}
        onPeriodChange={setPeriod}
        projectId={projectId}
        onProjectChange={setProjectId}
        stageStatus={stageStatus}
        onStageStatusChange={setStageStatus}
        projects={projects}
        rangeLabel={range.label}
        onPrint={handlePrint}
      />
      <p className="sr-only" aria-live="polite">Report updated: {reportStatus}</p>
      <ReportMeta rangeLabel={range.label} projectLabel={projectLabel} stageStatusLabel={stageStatusLabel} />

      <SheetSummary>
        <SummaryMetric value={formatCurrency(totalRevenue)} label="Revenue" indicator={<Badge variant="neutral">{filteredSales.length} entries</Badge>} />
        <SummaryMetric value={completionLabel} label="Tasks completed" indicator={<span className="text-xs text-subtle-foreground">{overdueTasks.length} overdue</span>} />
        <SummaryMetric value={activeProjects} label="Active projects" indicator={<span className="text-xs text-subtle-foreground">{filteredProjects.length} in view</span>} />
        <SummaryMetric value={teamStats.length} label="People" indicator={<span className="text-xs text-subtle-foreground">{range.label}</span>} />
      </SheetSummary>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="no-print" aria-label="Report sections">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sales">Sales detail</TabsTrigger>
          <TabsTrigger value="projects">Project detail</TabsTrigger>
          <TabsTrigger value="team">Team detail</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <ContentGrid>
            <ReportPanel title="Revenue trend" description={`${formatCurrency(totalRevenue)} recorded across ${revenueData.length} month${revenueData.length === 1 ? "" : "s"}.`}>
              <SalesChart data={revenueData} />
            </ReportPanel>
            <ReportPanel title="Delivery health" description={`${completedTasks} of ${filteredTasks.length} tasks completed; ${overdueTasks.length} currently overdue.`}>
              <TaskChart data={taskStatusData} />
            </ReportPanel>
          </ContentGrid>

          <ReportPanel title="Needs attention" description="Projects are surfaced when they contain overdue work or are below 50% completion in the selected view.">
            <AttentionProjectList projects={attentionProjects} />
          </ReportPanel>

          <ContentGrid>
            <ReportPanel title="Project progress" description="Completion is calculated from tasks in the selected reporting view.">
              <ProjectProgressChart data={projectStats} />
            </ReportPanel>
            <ReportPanel title="Team workload" description="People with work represented in the selected reporting view.">
              <TeamChart data={teamStats} />
            </ReportPanel>
          </ContentGrid>
        </TabsContent>

        <TabsContent value="sales">
          <ReportPanel title="Sales detail" description={`${filteredSales.length} transaction${filteredSales.length === 1 ? "" : "s"} in ${range.label.toLowerCase()}.`}>
            {filteredSales.length === 0 ? (
              <div className="border-y border-border bg-secondary p-8 text-center text-sm text-subtle-foreground">No sales recorded for the selected period, project, or stage status filters.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px]">
                  <caption className="sr-only">Sales detail for {range.label}</caption>
                  <thead>
                    <tr className="border-b border-border">
                      {['Date', 'Client', 'Project', 'Type', 'Stage Status', 'Amount'].map((heading) => (
                        <th
                          key={heading}
                          scope="col"
                          className={cn(
                            "px-3 py-3 text-xs font-semibold uppercase tracking-wider text-subtle-foreground",
                            heading === "Amount" ? "text-right" : "text-left"
                          )}
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...filteredSales].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((sale) => {
                      const project = projects.find((item) => item.id === sale.projectId);
                      const latestStage = getLatestSaleStage(sale.id);
                      const stageMeta = latestStage ? stageStatusStyles[latestStage.status] : null;
                      return (
                        <tr key={sale.id} className="border-b border-border/50">
                          <td className="px-3 py-3 text-sm text-muted-foreground">{formatDate(sale.date)}</td>
                          <td className="px-3 py-3 text-sm font-medium">{sale.clientName}</td>
                          <td className="px-3 py-3 text-sm text-muted-foreground">{project?.title || "Unknown project"}</td>
                          <td className="px-3 py-3"><Badge variant={sale.type === "sponsorship" ? "accent" : sale.type === "grant" ? "neutral" : sale.type === "workshop" ? "warning" : "neutral"}>{sale.type}</Badge></td>
                          <td className="px-3 py-3">
                            {stageMeta ? (
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-medium whitespace-nowrap",
                                  stageMeta.badgeClass
                                )}
                              >
                                <span className={cn("w-1.5 h-1.5 rounded-full", stageMeta.dotClass)} />
                                {stageMeta.label}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">-</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right text-sm font-semibold">{formatCurrency(sale.amount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border font-semibold"><td colSpan={5} className="px-3 py-3 text-sm">Total</td><td className="px-3 py-3 text-right text-sm">{formatCurrency(totalRevenue)}</td></tr>
                  </tfoot>
                </table>
              </div>
            )}
          </ReportPanel>
        </TabsContent>

        <TabsContent value="projects">
          <ReportPanel title="Project detail" description="Delivery, revenue, and timeline signals for each project in view.">
            <div className="divide-y divide-border">
              {projectStats.map((project) => {
                const sourceProject = projects.find((item) => item.id === project.id);
                return (
                  <article key={project.id} className="py-5 first:pt-0 last:pb-0">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0"><h3 className="font-heading text-base font-semibold">{project.title}</h3><p className="mt-1 text-sm text-muted-foreground">{sourceProject?.description}</p></div>
                      <Badge variant={project.status === "active" ? "positive" : "neutral"}>{project.status}</Badge>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                      <div><p className="text-xs font-semibold uppercase tracking-wider text-subtle-foreground">Tasks</p><p className="mt-1 text-lg font-bold tabular">{project.completedTasks}/{project.totalTasks}</p></div>
                      <div><p className="text-xs font-semibold uppercase tracking-wider text-subtle-foreground">Completion</p><p className="mt-1 text-lg font-bold tabular">{project.completionRate}%</p></div>
                      <div><p className="text-xs font-semibold uppercase tracking-wider text-subtle-foreground">Revenue</p><p className="mt-1 text-lg font-bold tabular">{formatCurrency(project.revenue)}</p></div>
                      <div><p className="text-xs font-semibold uppercase tracking-wider text-subtle-foreground">Overdue</p><p className={cn("mt-1 text-lg font-bold tabular", project.overdueTasks > 0 && "text-destructive")}>{project.overdueTasks}</p></div>
                    </div>
                    <Progress value={project.completionRate} label={`${project.title} completion`} className="mt-4" color={project.color} />
                  </article>
                );
              })}
              {projectStats.length === 0 && <div className="border-y border-border bg-secondary p-8 text-center text-sm text-subtle-foreground">No projects match this report.</div>}
            </div>
          </ReportPanel>
        </TabsContent>

        <TabsContent value="team">
          <ReportPanel title="Team detail" description="Assigned and completed work represented in the selected reporting view.">
            <div className="divide-y divide-border">
              {teamStats.map((member) => (
                <article key={member.id} className="flex flex-col gap-4 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-primary-foreground" style={{ backgroundColor: member.avatarColor }}>{getInitials(member.name)}</div>
                    <div className="min-w-0"><h3 className="truncate font-semibold">{member.name}</h3><p className="text-xs text-subtle-foreground">{member.totalTasks} assigned · {member.completedTasks} completed</p></div>
                  </div>
                  <div className="flex items-center gap-4 sm:w-64"><div className="min-w-0 flex-1"><Progress value={member.completionRate} label={`${member.name} task completion`} color={member.avatarColor} /></div><span className="w-12 text-right text-sm font-semibold">{member.completionRate}%</span></div>
                </article>
              ))}
              {teamStats.length === 0 && <div className="border-y border-border bg-secondary p-8 text-center text-sm text-subtle-foreground">No assigned work matches this report.</div>}
            </div>
          </ReportPanel>
        </TabsContent>
      </Tabs>
    </PageFrame>
  );
}
