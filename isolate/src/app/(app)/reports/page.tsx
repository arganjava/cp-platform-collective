"use client";

import React, { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useStore } from "@/lib/store";
import { cn, formatCurrency, formatDate, getInitials } from "@/lib/utils";
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

function taskIntersectsRange(task: { startDate: string; dueDate: string }, range: ReturnType<typeof getPeriodRange>) {
  if (!range.start || !range.end) return true;
  return new Date(task.dueDate) >= range.start && new Date(task.startDate) <= range.end;
}

export default function ReportsPage() {
  const { projects, tasks, sales, users, getUserById, searchQuery } = useStore();
  const [activeTab, setActiveTab] = useState("overview");
  const [period, setPeriod] = useState<ReportPeriod>("all");
  const [projectId, setProjectId] = useState("all");

  const range = useMemo(() => getPeriodRange(period), [period]);
  const query = searchQuery.trim().toLowerCase();
  const selectedProject = projects.find((project) => project.id === projectId);
  const projectLabel = selectedProject?.title || "All projects";

  const filteredSales = useMemo(
    () =>
      sales.filter((sale) => {
        if (projectId !== "all" && sale.projectId !== projectId) return false;
        if (!isDateInRange(sale.date, range)) return false;
        if (query) {
          const project = projects.find((p) => p.id === sale.projectId);
          const haystack = `${sale.clientName} ${sale.notes} ${project?.title ?? ""}`.toLowerCase();
          if (!haystack.includes(query)) return false;
        }
        return true;
      }),
    [projectId, range, sales, query, projects]
  );
  const filteredTasks = useMemo(
    () =>
      tasks.filter((task) => {
        if (projectId !== "all" && task.projectId !== projectId) return false;
        if (!taskIntersectsRange(task, range)) return false;
        if (query) {
          const project = projects.find((p) => p.id === task.projectId);
          const assignee = getUserById(task.assigneeId);
          const haystack = `${task.title} ${project?.title ?? ""} ${assignee?.name ?? ""}`.toLowerCase();
          if (!haystack.includes(query)) return false;
        }
        return true;
      }),
    [projectId, range, tasks, query, projects, getUserById]
  );
  const filteredProjects = useMemo(
    () =>
      projects.filter((project) => {
        if (projectId !== "all" && project.id !== projectId) return false;
        if (query && !`${project.title} ${project.description}`.toLowerCase().includes(query)) return false;
        return true;
      }),
    [projectId, projects, query]
  );

  const totalRevenue = filteredSales.reduce((sum, sale) => sum + sale.amount, 0);
  const completedTasks = filteredTasks.filter((task) => task.status === "done").length;
  const activeProjects = filteredProjects.filter((project) => project.status === "active").length;
  const overdueTasks = filteredTasks.filter((task) => task.status !== "done" && new Date(task.dueDate) < new Date());

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
      const overdue = projectTasks.filter((task) => task.status !== "done" && new Date(task.dueDate) < new Date()).length;
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
          .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];
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
  const reportStatus = `${projectLabel} · ${range.label} · ${filteredSales.length} sales entries, ${filteredTasks.length} tasks`;

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
        projects={projects}
        rangeLabel={range.label}
        onPrint={handlePrint}
      />
      <p className="sr-only" aria-live="polite">Report updated: {reportStatus}</p>
      <ReportMeta rangeLabel={range.label} projectLabel={projectLabel} />

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
              <div className="border-y border-border bg-secondary p-8 text-center text-sm text-subtle-foreground">No sales recorded for this period and project filter.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px]">
                  <caption className="sr-only">Sales detail for {range.label}</caption>
                  <thead>
                    <tr className="border-b border-border">
                      {['Date', 'Client', 'Project', 'Type', 'Amount'].map((heading) => <th key={heading} scope="col" className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-subtle-foreground">{heading}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {[...filteredSales].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((sale) => {
                      const project = projects.find((item) => item.id === sale.projectId);
                      return (
                        <tr key={sale.id} className="border-b border-border/50">
                          <td className="px-3 py-3 text-sm text-muted-foreground">{formatDate(sale.date)}</td>
                          <td className="px-3 py-3 text-sm font-medium">{sale.clientName}</td>
                          <td className="px-3 py-3 text-sm text-muted-foreground">{project?.title || "Unknown project"}</td>
                          <td className="px-3 py-3"><Badge variant={sale.type === "sponsorship" ? "accent" : sale.type === "grant" ? "neutral" : sale.type === "workshop" ? "warning" : "neutral"}>{sale.type}</Badge></td>
                          <td className="px-3 py-3 text-right text-sm font-semibold">{formatCurrency(sale.amount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border font-semibold"><td colSpan={4} className="px-3 py-3 text-sm">Total</td><td className="px-3 py-3 text-right text-sm">{formatCurrency(totalRevenue)}</td></tr>
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
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: member.avatarColor }}>{getInitials(member.name)}</div>
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
