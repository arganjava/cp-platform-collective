"use client";

import React from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const COLORS = ["#8b46ff", "#ff6b4a", "#14b8a0", "#ffd633", "#7c22ff", "#ed4a27"];

const monthlyData = [
  { month: "Apr", revenue: 15000, target: 10000 },
  { month: "May", revenue: 13500, target: 12000 },
  { month: "Jun", revenue: 13200, target: 12000 },
  { month: "Jul", revenue: 17150, target: 15000 },
];

const taskStatusData = [
  { name: "To Do", value: 7, color: "#9898ac" },
  { name: "In Progress", value: 7, color: "#8b46ff" },
  { name: "Review", value: 3, color: "#ffd633" },
  { name: "Done", value: 3, color: "#14b8a0" },
];

const tooltipStyle = {
  background: "white",
  border: "1px solid #e4e4ef",
  borderRadius: "10px",
  boxShadow: "0 4px 12px rgba(26,26,46,0.08)",
  fontSize: "12px",
};

export function SalesChart() {
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={monthlyData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4ef" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6b6b80" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#6b6b80" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`$${value.toLocaleString()}`, ""]} />
          <Legend wrapperStyle={{ fontSize: "11px" }} />
          <Bar dataKey="revenue" name="Revenue" fill="#8b46ff" radius={[6, 6, 0, 0]} />
          <Bar dataKey="target" name="Target" fill="#e4e4ef" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TaskChart() {
  return (
    <div className="h-[280px] w-full flex items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={taskStatusData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={4}
            dataKey="value"
            stroke="none"
          >
            {taskStatusData.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
          <Legend
            wrapperStyle={{ fontSize: "11px" }}
            formatter={(value: string, entry: { color?: string }) => (
              <span style={{ color: "#1a1a2e" }}>{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

interface ProjectStat {
  id: string;
  title: string;
  color: string;
  completionRate: number;
  totalTasks: number;
  completedTasks: number;
  revenue: number;
}

export function ProjectProgressChart({ data }: { data: ProjectStat[] }) {
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4ef" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "#6b6b80" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
          <YAxis
            type="category"
            dataKey="title"
            tick={{ fontSize: 11, fill: "#6b6b80" }}
            axisLine={false}
            tickLine={false}
            width={120}
          />
          <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value}%`, "Completion"]} />
          <Bar dataKey="completionRate" radius={[0, 6, 6, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface TeamStat {
  id: string;
  name: string;
  avatarColor: string;
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
}

export function TeamChart({ data }: { data: TeamStat[] }) {
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4ef" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10, fill: "#6b6b80" }}
            axisLine={false}
            tickLine={false}
            interval={0}
            angle={-20}
            textAnchor="end"
            height={50}
          />
          <YAxis tick={{ fontSize: 11, fill: "#6b6b80" }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: "11px" }} />
          <Bar dataKey="totalTasks" name="Total" fill="#e4e4ef" radius={[6, 6, 0, 0]} />
          <Bar dataKey="completedTasks" name="Completed" fill="#14b8a0" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
