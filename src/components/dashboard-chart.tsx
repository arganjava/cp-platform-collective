"use client";

import React from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

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

export function DashboardChart() {
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="completedGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b46ff" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#8b46ff" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="createdGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#14b8a0" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#14b8a0" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4ef" vertical={false} />
          <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#6b6b80" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#6b6b80" }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{
              background: "white",
              border: "1px solid #e4e4ef",
              borderRadius: "10px",
              boxShadow: "0 4px 12px rgba(26,26,46,0.08)",
              fontSize: "12px",
            }}
          />
          <Area type="monotone" dataKey="completed" stroke="#8b46ff" strokeWidth={2} fill="url(#completedGrad)" name="Completed" />
          <Area type="monotone" dataKey="created" stroke="#14b8a0" strokeWidth={2} fill="url(#createdGrad)" name="Created" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
