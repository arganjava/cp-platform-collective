"use client";

import React from "react";
import { AlertTriangle, CalendarRange, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";

export type ReportPeriod = "all" | "last-30" | "last-90" | "this-year";

export interface ReportPeriodToolbarProps {
  period: ReportPeriod;
  onPeriodChange: (period: ReportPeriod) => void;
  projectId: string;
  onProjectChange: (projectId: string) => void;
  projects: Array<{ id: string; title: string }>;
  rangeLabel: string;
  onPrint: () => void;
}

export function ReportPeriodToolbar({
  period,
  onPeriodChange,
  projectId,
  onProjectChange,
  projects,
  rangeLabel,
  onPrint,
}: ReportPeriodToolbarProps) {
  return (
    <form aria-label="Report filters" className="flex flex-col gap-3 border border-border bg-card p-4 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="min-w-0 flex-1 sm:min-w-52">
        <label htmlFor="report-period" className="mb-1.5 block text-sm font-semibold text-foreground">Reporting period</label>
        <Select
          id="report-period"
          value={period}
          onChange={(event) => onPeriodChange(event.target.value as ReportPeriod)}
        >
          <option value="all">All available data</option>
          <option value="last-30">Last 30 days</option>
          <option value="last-90">Last 90 days</option>
          <option value="this-year">This year</option>
        </Select>
      </div>
      <div className="min-w-0 flex-1 sm:min-w-52">
        <label htmlFor="report-project" className="mb-1.5 block text-sm font-semibold text-foreground">Project</label>
        <Select
          id="report-project"
          value={projectId}
          onChange={(event) => onProjectChange(event.target.value)}
        >
          <option value="all">All projects</option>
          {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
        </Select>
      </div>
      <div className="flex min-h-10 items-center gap-2 text-sm text-muted-foreground sm:px-2" aria-live="polite">
        <CalendarRange className="h-4 w-4 shrink-0 text-subtle-foreground" aria-hidden="true" />
        <span>{rangeLabel}</span>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onPrint} className="no-print">
        <Printer className="h-4 w-4" aria-hidden="true" />
        Print / save PDF
      </Button>
    </form>
  );
}

export function ReportPanel({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export interface AttentionProject {
  id: string;
  title: string;
  ownerName: string;
  completionRate: number;
  overdueTasks: number;
  revenue: string;
  nextAction: string;
}

export function AttentionProjectList({ projects }: { projects: AttentionProject[] }) {
  if (projects.length === 0) {
    return (
      <div className="border border-border bg-secondary p-5" role="status">
        <p className="font-semibold text-foreground">No projects need attention in this period.</p>
        <p className="mt-1 text-sm text-muted-foreground">Delivery and deadline signals are currently on track.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {projects.map((project) => (
        <article key={project.id} className="py-4 first:pt-0 last:pb-0">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
                <h3 className="truncate font-heading text-base font-semibold text-foreground">{project.title}</h3>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">Owner: {project.ownerName}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2 text-sm">
              {project.overdueTasks > 0 && <Badge variant="danger">{project.overdueTasks} overdue</Badge>}
              <Badge variant="warning">{project.completionRate}% complete</Badge>
            </div>
          </div>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            <div><p className="text-xs font-semibold uppercase tracking-wider text-subtle-foreground">Next action</p><p className="mt-1 text-foreground">{project.nextAction}</p></div>
            <div><p className="text-xs font-semibold uppercase tracking-wider text-subtle-foreground">Revenue in period</p><p className="mt-1 font-semibold text-foreground tabular">{project.revenue}</p></div>
            <div><p className="text-xs font-semibold uppercase tracking-wider text-subtle-foreground">Delivery status</p><p className="mt-1 text-foreground">{project.overdueTasks > 0 ? "Needs coordinator review" : "Monitor progress"}</p></div>
          </div>
        </article>
      ))}
    </div>
  );
}

export function ReportMeta({ rangeLabel, projectLabel }: { rangeLabel: string; projectLabel: string }) {
  return <p className="report-print-meta hidden text-sm text-muted-foreground print:block">Reporting period: {rangeLabel} · Project: {projectLabel}</p>;
}
