"use client";

import React from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const data = [
  { week: "Week 1", completed: 4, created: 6 },
  { week: "Week 2", completed: 7, created: 5 },
  { week: "Week 3", completed: 5, created: 8 },
  { week: "Week 4", completed: 9, created: 4 },
  { week: "Week 5", completed: 6, created: 7 },
  { week: "Week 6", completed: 8, created: 3 },
  { week: "Week 7", completed: 11, created: 5 },
  { week: "Week 8", completed: 7, created: 6 },
];

const chartInk = "var(--primary)";
const chartCoral = "var(--brand)";
const chartGrid = "var(--border)";
const chartMuted = "var(--muted-foreground)";

export function DashboardChart() {
  return (
    <div className="h-[220px] w-full" aria-label="Task activity over the last eight weeks">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
          <XAxis dataKey="week" tick={{ fontSize: 11, fill: chartMuted }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: chartMuted }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "0px", boxShadow: "var(--shadow-md)", fontSize: "12px", color: chartInk }} />
          <Line type="monotone" dataKey="completed" stroke={chartCoral} strokeWidth={2} dot={{ r: 3, fill: chartCoral, stroke: "none" }} name="Completed" />
          <Line type="monotone" dataKey="created" stroke={chartInk} strokeWidth={1.5} strokeDasharray="4 3" dot={false} name="Created" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
