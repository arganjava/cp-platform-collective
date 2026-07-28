"use client";

import React, { useState } from "react";
import { useStore } from "@/lib/store";
import { cn, formatDate, generateId } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Plus,
  DollarSign,
  TrendingUp,
  Search,
  CalendarDays,
  ArrowUpRight,
} from "lucide-react";

const saleTypeConfig = {
  commission: { label: "Commission", variant: "purple" as const, color: "#8b46ff" },
  artwork: { label: "Artwork", variant: "teal" as const, color: "#14b8a0" },
  workshop: { label: "Workshop", variant: "mustard" as const, color: "#ffd633" },
  sponsorship: { label: "Sponsorship", variant: "coral" as const, color: "#ff6b4a" },
  grant: { label: "Grant", variant: "default" as const, color: "#8b46ff" },
};

export default function SalesPage() {
  const { sales, projects, addSale } = useStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [showNewSale, setShowNewSale] = useState(false);
  const [newSale, setNewSale] = useState({
    projectId: "",
    amount: "",
    clientName: "",
    type: "commission" as "commission" | "artwork" | "workshop" | "sponsorship" | "grant",
    notes: "",
  });

  const filteredSales = sales
    .filter((s) => {
      if (searchQuery && !s.clientName.toLowerCase().includes(searchQuery.toLowerCase()) && !s.notes.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (filterType !== "all" && s.type !== filterType) return false;
      if (filterProject !== "all" && s.projectId !== filterProject) return false;
      return true;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalRevenue = filteredSales.reduce((sum, s) => sum + s.amount, 0);
  const avgDeal = filteredSales.length > 0 ? totalRevenue / filteredSales.length : 0;

  // Revenue by type
  const revenueByType = Object.keys(saleTypeConfig).map((type) => {
    const typeSales = filteredSales.filter((s) => s.type === type);
    return {
      type,
      ...saleTypeConfig[type as keyof typeof saleTypeConfig],
      total: typeSales.reduce((sum, s) => sum + s.amount, 0),
      count: typeSales.length,
    };
  }).filter((r) => r.total > 0);

  // Revenue by project
  const revenueByProject = projects.map((p) => {
    const projectSales = filteredSales.filter((s) => s.projectId === p.id);
    return {
      project: p,
      total: projectSales.reduce((sum, s) => sum + s.amount, 0),
      count: projectSales.length,
    };
  }).filter((r) => r.total > 0);

  function handleCreateSale() {
    if (!newSale.clientName || !newSale.amount) return;
    addSale({
      id: `sale-${generateId()}`,
      projectId: newSale.projectId || projects[0]?.id || "proj-1",
      amount: parseFloat(newSale.amount),
      clientName: newSale.clientName,
      type: newSale.type,
      date: new Date().toISOString().split("T")[0],
      notes: newSale.notes,
      createdAt: new Date().toISOString(),
    });
    setNewSale({ projectId: "", amount: "", clientName: "", type: "commission", notes: "" });
    setShowNewSale(false);
  }

  return (
    <>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-[family-name:var(--font-heading)] tracking-tight">Sales</h1>
            <p className="text-sm text-text-secondary mt-0.5">Track revenue across grants, sponsorships, workshops, and product sales</p>
          </div>
          <Button size="sm" onClick={() => setShowNewSale(true)}>
            <Plus className="w-4 h-4" /> Log Sale
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="card-hover">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 rounded-xl bg-cp-purple-100 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-cp-purple-600" />
                </div>
                <Badge variant="teal"><ArrowUpRight className="w-3 h-3 mr-0.5" />{filteredSales.length} entries</Badge>
              </div>
              <p className="text-3xl font-bold tracking-tight">${totalRevenue.toLocaleString()}</p>
              <p className="text-sm text-text-secondary">Total Revenue</p>
            </CardContent>
          </Card>
          <Card className="card-hover">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 rounded-xl bg-cp-teal-100 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-cp-teal-600" />
                </div>
              </div>
              <p className="text-3xl font-bold tracking-tight">${Math.round(avgDeal).toLocaleString()}</p>
              <p className="text-sm text-text-secondary">Average Deal Size</p>
            </CardContent>
          </Card>
          <Card className="card-hover">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 rounded-xl bg-cp-coral-100 flex items-center justify-center">
                  <CalendarDays className="w-5 h-5 text-cp-coral-600" />
                </div>
              </div>
              <p className="text-3xl font-bold tracking-tight">{revenueByProject.length}</p>
              <p className="text-sm text-text-secondary">Active Revenue Streams</p>
            </CardContent>
          </Card>
        </div>

        {/* Revenue breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* By type */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue by Type</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {revenueByType.map((item) => (
                  <div key={item.type} className="flex items-center gap-3">
                    <Badge variant={item.variant} className="w-24 justify-center">{item.label}</Badge>
                    <div className="flex-1">
                      <div className="h-5 rounded-full bg-surface-sunken overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${(item.total / totalRevenue) * 100}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-semibold w-20 text-right">${item.total.toLocaleString()}</span>
                    <span className="text-xs text-text-muted w-8 text-right">{item.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* By project */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue by Project</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {revenueByProject.sort((a, b) => b.total - a.total).map((item) => (
                  <div key={item.project.id} className="flex items-center gap-3">
                    <div className="flex items-center gap-2 w-36 flex-shrink-0">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.project.color }} />
                      <span className="text-sm font-medium truncate">{item.project.title}</span>
                    </div>
                    <div className="flex-1">
                      <div className="h-5 rounded-full bg-surface-sunken overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${(item.total / totalRevenue) * 100}%`,
                            backgroundColor: item.project.color,
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-semibold w-20 text-right">${item.total.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <Input placeholder="Search sales..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="h-9 rounded-[10px] border border-border-default bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-cp-purple-500 cursor-pointer"
          >
            <option value="all">All Types</option>
            {Object.entries(saleTypeConfig).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="h-9 rounded-[10px] border border-border-default bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-cp-purple-500 cursor-pointer"
          >
            <option value="all">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </div>

        {/* Sales table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-default">
                  <th className="text-left text-xs font-medium text-text-muted uppercase tracking-wider py-3 px-4">Client</th>
                  <th className="text-left text-xs font-medium text-text-muted uppercase tracking-wider py-3 px-4">Project</th>
                  <th className="text-left text-xs font-medium text-text-muted uppercase tracking-wider py-3 px-4">Type</th>
                  <th className="text-right text-xs font-medium text-text-muted uppercase tracking-wider py-3 px-4">Amount</th>
                  <th className="text-left text-xs font-medium text-text-muted uppercase tracking-wider py-3 px-4">Date</th>
                  <th className="text-left text-xs font-medium text-text-muted uppercase tracking-wider py-3 px-4">Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map((sale) => {
                  const project = projects.find((p) => p.id === sale.projectId);
                  const typeConf = saleTypeConfig[sale.type];
                  return (
                    <tr key={sale.id} className="border-b border-border-default/50 hover:bg-surface-sunken/50 transition-colors">
                      <td className="py-3 px-4">
                        <span className="text-sm font-medium">{sale.clientName}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: project?.color }} />
                          <span className="text-sm text-text-secondary">{project?.title}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={typeConf.variant}>{typeConf.label}</Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-sm font-semibold">${sale.amount.toLocaleString()}</span>
                      </td>
                      <td className="py-3 px-4 text-sm text-text-secondary">{formatDate(sale.date)}</td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-text-muted truncate max-w-[200px] block">{sale.notes}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* New Sale Dialog */}
      <Dialog open={showNewSale} onOpenChange={setShowNewSale}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log New Sale</DialogTitle>
            <DialogDescription>Record a new revenue entry</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Client Name</label>
              <Input placeholder="e.g., National Arts Council" value={newSale.clientName} onChange={(e) => setNewSale({ ...newSale, clientName: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Amount ($)</label>
                <Input type="number" placeholder="0.00" value={newSale.amount} onChange={(e) => setNewSale({ ...newSale, amount: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Type</label>
                <select
                  value={newSale.type}
                  onChange={(e) => setNewSale({ ...newSale, type: e.target.value as "commission" | "artwork" | "workshop" | "sponsorship" | "grant" })}
                  className="w-full h-9 rounded-[10px] border border-border-default bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-cp-purple-500"
                >
                  {Object.entries(saleTypeConfig).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Project</label>
              <select
                value={newSale.projectId}
                onChange={(e) => setNewSale({ ...newSale, projectId: e.target.value })}
                className="w-full h-9 rounded-[10px] border border-border-default bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-cp-purple-500"
              >
                <option value="">Select project...</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Notes</label>
              <Textarea placeholder="Additional details..." value={newSale.notes} onChange={(e) => setNewSale({ ...newSale, notes: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowNewSale(false)}>Cancel</Button>
              <Button onClick={handleCreateSale}>Log Sale</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
