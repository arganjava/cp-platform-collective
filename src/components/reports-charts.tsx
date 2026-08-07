"use client";

import React from "react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatCurrency, formatCompactCurrency } from "@/lib/utils";

const chartInk = "var(--primary)";
const chartMuted = "var(--muted-foreground)";
const chartGrid = "var(--border)";
const chartCoral = "var(--brand)";
const chartPaper = "var(--card)";

const tooltipStyle = {
  background: chartPaper,
  border: "1px solid var(--border)",
  borderRadius: "0px",
  boxShadow: "var(--shadow-md)",
  fontSize: "12px",
  color: chartInk,
};
const axisStyle = { fontSize: 11, fill: chartMuted };

export interface RevenuePoint {
  month: string;
  revenue: number;
}

export interface TaskStatusPoint {
  name: string;
  value: number;
  color: string;
}

export interface ProjectStat {
  id: string;
  title: string;
  color: string;
  status: string;
  completionRate: number;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  revenue: number;
}

export interface TeamStat {
  id: string;
  name: string;
  avatarColor: string;
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
}

interface ChartDataTableProps {
  caption: string;
  columns: string[];
  rows: React.ReactNode[][];
}

export function ChartDataTable({ caption, columns, rows }: ChartDataTableProps) {
  return (
    <details className="mt-4 border-t border-border/70 pt-3">
      <summary className="cursor-pointer text-sm font-semibold text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        View data table
      </summary>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[360px] text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-border">
              {columns.map((column) => (
                <th key={column} scope="col" className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-subtle-foreground">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="border-b border-border/60 last:border-0">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-3 py-2 text-muted-foreground">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function SalesChart({ data }: { data: RevenuePoint[] }) {
  const total = data.reduce((sum, point) => sum + point.revenue, 0);
  return (
    <div>
      <div
        className="h-[300px] w-full"
        role="img"
        aria-label={`Revenue trend across ${data.length} reporting month${data.length === 1 ? "" : "s"}, totalling ${formatCurrency(total)}`}
      >
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
              <XAxis dataKey="month" tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={(value) => formatCompactCurrency(Number(value))} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [formatCurrency(value), "Revenue"]} />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Bar dataKey="revenue" name="Revenue" fill={chartCoral} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center border border-border bg-secondary text-sm text-subtle-foreground">No revenue recorded for this period.</div>
        )}
      </div>
      <ChartDataTable
        caption="Revenue by reporting month"
        columns={["Month", "Revenue"]}
        rows={data.map((point) => [point.month, formatCurrency(point.revenue)])}
      />
    </div>
  );
}

export function TaskChart({ data }: { data: TaskStatusPoint[] }) {
  const total = data.reduce((sum, point) => sum + point.value, 0);
  return (
    <div>
      <div
        className="flex h-[320px] w-full items-center justify-center"
        role="img"
        aria-label={`Task status distribution across ${total} tasks`}
      >
        {total > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ bottom: 20 }}>
              <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value" stroke="none">
                {data.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [value, name]} />
              <Legend wrapperStyle={{ fontSize: "12px" }} formatter={(value: string) => <span style={{ color: chartInk }}>{value}</span>} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-sm text-subtle-foreground">No tasks recorded for this period.</div>
        )}
      </div>
      <ChartDataTable
        caption="Tasks by status"
        columns={["Status", "Tasks"]}
        rows={data.map((point) => [point.name, point.value])}
      />
    </div>
  );
}

export function ProjectProgressChart({ data }: { data: ProjectStat[] }) {
  return (
    <div>
      <div className="h-[300px] w-full" role="img" aria-label="Project completion rates">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={(value) => `${value}%`} />
              <YAxis type="category" dataKey="title" tick={{ ...axisStyle, fontSize: 12 }} axisLine={false} tickLine={false} width={120} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value}%`, "Completion"]} />
              <Bar dataKey="completionRate" name="Completion" fill={chartCoral} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center border border-border bg-secondary text-sm text-subtle-foreground">No project data for this period.</div>
        )}
      </div>
      <ChartDataTable
        caption="Project completion rates"
        columns={["Project", "Completed", "Tasks", "Completion"]}
        rows={data.map((project) => [project.title, project.completedTasks, project.totalTasks, `${project.completionRate}%`])}
      />
    </div>
  );
}

export function TeamChart({ data }: { data: TeamStat[] }) {
  return (
    <div>
      <div className="h-[300px] w-full" role="img" aria-label="Team task workload">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
              <XAxis dataKey="name" tick={{ ...axisStyle, fontSize: 12 }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [value, name]} />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Bar dataKey="totalTasks" name="Total" fill={chartGrid} />
              <Bar dataKey="completedTasks" name="Completed" fill={chartCoral} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center border border-border bg-secondary text-sm text-subtle-foreground">No team workload for this period.</div>
        )}
      </div>
      <ChartDataTable
        caption="Team workload"
        columns={["Team member", "Assigned", "Completed", "Rate"]}
        rows={data.map((member) => [member.name, member.totalTasks, member.completedTasks, `${member.completionRate}%`])}
      />
    </div>
  );
}
