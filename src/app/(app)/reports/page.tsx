"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { useStore } from "@/lib/store";
import { cn, formatDate, getInitials } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Download,
  DollarSign,
  CheckSquare,
  FolderKanban,
  Users,
  TrendingUp,
  ArrowUpRight,
  Printer,
} from "lucide-react";

const SalesChart = dynamic(() => import("@/components/reports-charts").then(m => m.SalesChart), { ssr: false });
const TaskChart = dynamic(() => import("@/components/reports-charts").then(m => m.TaskChart), { ssr: false });
const ProjectProgressChart = dynamic(() => import("@/components/reports-charts").then(m => m.ProjectProgressChart), { ssr: false });
const TeamChart = dynamic(() => import("@/components/reports-charts").then(m => m.TeamChart), { ssr: false });

export default function ReportsPage() {
  const { projects, tasks, sales, users } = useStore();
  const [activeTab, setActiveTab] = useState("overview");

  // Compute stats
  const totalRevenue = sales.reduce((sum, s) => sum + s.amount, 0);
  const completedTasks = tasks.filter((t) => t.status === "done").length;
  const totalTasks = tasks.length;
  const activeProjects = projects.filter((p) => p.status === "active").length;

  // Revenue by month
  const monthlySales: Record<string, number> = {};
  sales.forEach((s) => {
    const key = new Date(s.date).toLocaleDateString("en-SG", { month: "short", year: "numeric" });
    monthlySales[key] = (monthlySales[key] || 0) + s.amount;
  });

  // Task completion rate per project
  const projectStats = projects.map((p) => {
    const projTasks = tasks.filter((t) => t.projectId === p.id);
    const done = projTasks.filter((t) => t.status === "done").length;
    return {
      ...p,
      totalTasks: projTasks.length,
      completedTasks: done,
      completionRate: projTasks.length > 0 ? Math.round((done / projTasks.length) * 100) : 0,
      revenue: sales.filter((s) => s.projectId === p.id).reduce((sum, s) => sum + s.amount, 0),
    };
  });

  // Team performance
  const teamStats = users.map((u) => {
    const userTasks = tasks.filter((t) => t.assigneeId === u.id);
    const doneTasks = userTasks.filter((t) => t.status === "done").length;
    return {
      ...u,
      totalTasks: userTasks.length,
      completedTasks: doneTasks,
      completionRate: userTasks.length > 0 ? Math.round((doneTasks / userTasks.length) * 100) : 0,
    };
  });

  function handlePrint() {
    window.print();
  }

  return (
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-[family-name:var(--font-heading)] tracking-tight">Reports</h1>
            <p className="text-sm text-text-secondary mt-0.5">Analytics and insights across projects, sales, and team performance</p>
          </div>
          <div className="flex items-center gap-2 no-print">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4" /> Print
            </Button>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4" /> Export PDF
            </Button>
          </div>
        </div>

        {/* Overview stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="card-hover">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 rounded-xl bg-cp-purple-100 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-cp-purple-600" />
                </div>
                <Badge variant="teal"><ArrowUpRight className="w-3 h-3 mr-0.5" />{sales.length} deals</Badge>
              </div>
              <p className="text-3xl font-bold tracking-tight">${(totalRevenue / 1000).toFixed(1)}k</p>
              <p className="text-sm text-text-secondary">Total Revenue</p>
            </CardContent>
          </Card>
          <Card className="card-hover">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 rounded-xl bg-cp-teal-100 flex items-center justify-center">
                  <CheckSquare className="w-5 h-5 text-cp-teal-600" />
                </div>
              </div>
              <p className="text-3xl font-bold tracking-tight">{completedTasks}/{totalTasks}</p>
              <p className="text-sm text-text-secondary">Tasks Completed</p>
            </CardContent>
          </Card>
          <Card className="card-hover">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 rounded-xl bg-cp-coral-100 flex items-center justify-center">
                  <FolderKanban className="w-5 h-5 text-cp-coral-600" />
                </div>
              </div>
              <p className="text-3xl font-bold tracking-tight">{activeProjects}</p>
              <p className="text-sm text-text-secondary">Active Projects</p>
            </CardContent>
          </Card>
          <Card className="card-hover">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 rounded-xl bg-cp-mustard-100 flex items-center justify-center">
                  <Users className="w-5 h-5 text-cp-mustard-700" />
                </div>
              </div>
              <p className="text-3xl font-bold tracking-tight">{users.length}</p>
              <p className="text-sm text-text-secondary">Team Members</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="no-print">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="sales">Sales Report</TabsTrigger>
            <TabsTrigger value="projects">Project Report</TabsTrigger>
            <TabsTrigger value="team">Team Report</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-cp-purple-500" />
                    Revenue Trend
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <SalesChart />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-cp-teal-500" />
                    Task Status Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <TaskChart />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FolderKanban className="w-4 h-4 text-cp-coral-500" />
                    Project Progress
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ProjectProgressChart data={projectStats} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-cp-mustard-500" />
                    Team Workload
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <TeamChart data={teamStats} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Sales Report Tab */}
          <TabsContent value="sales">
            <Card className="mt-2">
              <CardHeader>
                <CardTitle>Sales Report</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Revenue by project */}
                  <div>
                    <h4 className="text-sm font-semibold mb-3">Revenue by Project</h4>
                    <div className="space-y-3">
                      {projectStats.filter((p) => p.revenue > 0).sort((a, b) => b.revenue - a.revenue).map((p) => (
                        <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-sunken">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                          <span className="text-sm font-medium flex-1">{p.title}</span>
                          <span className="text-sm font-semibold">${p.revenue.toLocaleString()}</span>
                          <div className="w-32">
                            <Progress value={(p.revenue / totalRevenue) * 100} color={p.color} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Sales entries */}
                  <div>
                    <h4 className="text-sm font-semibold mb-3">All Transactions</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border-default">
                            <th className="text-left text-xs font-medium text-text-muted uppercase py-2 px-3">Date</th>
                            <th className="text-left text-xs font-medium text-text-muted uppercase py-2 px-3">Client</th>
                            <th className="text-left text-xs font-medium text-text-muted uppercase py-2 px-3">Type</th>
                            <th className="text-right text-xs font-medium text-text-muted uppercase py-2 px-3">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...sales].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((s) => {
                            const project = projects.find((p) => p.id === s.projectId);
                            return (
                              <tr key={s.id} className="border-b border-border-default/50">
                                <td className="py-2 px-3 text-sm">{formatDate(s.date)}</td>
                                <td className="py-2 px-3 text-sm font-medium">{s.clientName}</td>
                                <td className="py-2 px-3">
                                  <Badge variant={s.type === "sponsorship" ? "coral" : s.type === "grant" ? "purple" : s.type === "workshop" ? "mustard" : "teal"}>
                                    {s.type}
                                  </Badge>
                                </td>
                                <td className="py-2 px-3 text-sm font-semibold text-right">${s.amount.toLocaleString()}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-border-default font-semibold">
                            <td colSpan={3} className="py-2 px-3 text-sm">Total</td>
                            <td className="py-2 px-3 text-sm text-right">${totalRevenue.toLocaleString()}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Projects Report Tab */}
          <TabsContent value="projects">
            <Card className="mt-2">
              <CardHeader>
                <CardTitle>Project Report</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {projectStats.map((p) => (
                    <div key={p.id} className="p-4 rounded-xl border border-border-default hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                          <h4 className="font-semibold">{p.title}</h4>
                        </div>
                        <Badge variant={p.status === "active" ? "success" : p.status === "draft" ? "secondary" : "default"}>
                          {p.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-text-secondary mb-3">{p.description}</p>
                      <div className="grid grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-text-muted">Tasks</p>
                          <p className="text-lg font-bold">{p.completedTasks}/{p.totalTasks}</p>
                        </div>
                        <div>
                          <p className="text-xs text-text-muted">Completion</p>
                          <p className="text-lg font-bold">{p.completionRate}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-text-muted">Revenue</p>
                          <p className="text-lg font-bold">${p.revenue.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-text-muted">Timeline</p>
                          <p className="text-sm font-medium">{formatDate(p.startDate)} — {formatDate(p.endDate)}</p>
                        </div>
                      </div>
                      <Progress value={p.completionRate} className="mt-3" color={p.color} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Team Report Tab */}
          <TabsContent value="team">
            <Card className="mt-2">
              <CardHeader>
                <CardTitle>Team Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {teamStats.sort((a, b) => b.completionRate - a.completionRate).map((member) => (
                    <div key={member.id} className="flex items-center gap-4 p-4 rounded-xl border border-border-default hover:shadow-md transition-shadow">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                        style={{ backgroundColor: member.avatarColor }}
                      >
                        {getInitials(member.name)}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold">{member.name}</h4>
                        <p className="text-xs text-text-muted capitalize">{member.role}</p>
                      </div>
                      <div className="grid grid-cols-3 gap-6 text-center">
                        <div>
                          <p className="text-xs text-text-muted">Assigned</p>
                          <p className="text-lg font-bold">{member.totalTasks}</p>
                        </div>
                        <div>
                          <p className="text-xs text-text-muted">Completed</p>
                          <p className="text-lg font-bold">{member.completedTasks}</p>
                        </div>
                        <div>
                          <p className="text-xs text-text-muted">Rate</p>
                          <p className="text-lg font-bold">{member.completionRate}%</p>
                        </div>
                      </div>
                      <div className="w-24">
                        <Progress value={member.completionRate} color={member.avatarColor} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
  );
}
