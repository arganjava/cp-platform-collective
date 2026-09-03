"use client";

import React, { useState } from "react";
import { useStore } from "@/lib/store";
import { cn, formatDate, generateId } from "@/lib/utils";
import type { Sale } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageFrame, PageHeader, SheetSummary, SummaryMetric, ContentGrid, Toolbar } from "@/components/page-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import Link from "next/link";
import {
  Plus,
  Pencil,
  Trash2,
  ShieldAlert,
  ArrowLeft,
} from "lucide-react";

const saleTypeConfig = {
  commission: { label: "Commission", variant: "neutral" as const, color: "var(--primary)" },
  artwork: { label: "Artwork", variant: "neutral" as const, color: "var(--muted-foreground)" },
  workshop: { label: "Workshop", variant: "neutral" as const, color: "var(--destructive)" },
  sponsorship: { label: "Sponsorship", variant: "accent" as const, color: "var(--brand)" },
  grant: { label: "Grant", variant: "neutral" as const, color: "var(--subtle-foreground)" },
};

export default function SalesPage() {
  const { sales, projects, addSale, updateSale, deleteSale, searchQuery, currentUserId, getUserById } = useStore();
  const currentUser = getUserById(currentUserId);
  const isAdmin = currentUser?.role === "admin";

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
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [editSale, setEditSale] = useState<{
    projectId: string;
    amount: string;
    clientName: string;
    type: Sale["type"];
    date: string;
    notes: string;
  }>({ projectId: "", amount: "", clientName: "", type: "commission", date: "", notes: "" });

  if (!isAdmin) {
    const roleLabel = currentUser?.role ? currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1) : "Guest";
    return (
      <PageFrame id="sales-access-denied-frame">
        <PageHeader
          title="Sales & Revenue"
          description="Track sales, revenue streams, and financial records."
        />
        <Card className="border border-border p-8 text-center" id="card-sales-restricted">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-4">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h2 className="font-heading text-xl font-bold text-foreground mb-2">
            Access Restricted
          </h2>
          <p className="max-w-md mx-auto text-sm text-muted-foreground mb-6">
            Your current role is set to <strong>{roleLabel}</strong>. Financial records and the Sales module are strictly restricted to Workspace Administrators.
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

  const query = searchQuery.trim().toLowerCase();
  const filteredSales = sales
    .filter((s) => {
      if (query) {
        const project = projects.find((p) => p.id === s.projectId);
        const haystack = [s.clientName, s.notes, project?.title ?? "", saleTypeConfig[s.type]?.label ?? s.type].join(" ").toLowerCase();
        if (!haystack.includes(query)) return false;
      }
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
    const projectId = newSale.projectId || projects[0]?.id;
    if (!newSale.clientName || !newSale.amount || !projectId) return;
    addSale({
      id: generateId(),
      projectId,
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

  function openEditSale(sale: Sale) {
    setEditingSaleId(sale.id);
    setEditSale({
      projectId: sale.projectId,
      amount: String(sale.amount),
      clientName: sale.clientName,
      type: sale.type,
      date: sale.date,
      notes: sale.notes,
    });
  }

  function handleSaveSale() {
    if (!editingSaleId || !editSale.clientName.trim() || !editSale.amount || !editSale.projectId) return;
    updateSale(editingSaleId, {
      projectId: editSale.projectId,
      amount: parseFloat(editSale.amount),
      clientName: editSale.clientName.trim(),
      type: editSale.type,
      date: editSale.date,
      notes: editSale.notes,
    });
    setEditingSaleId(null);
  }

  function handleDeleteSale(sale: Sale) {
    if (window.confirm(`Delete the sale from "${sale.clientName}"? This cannot be undone.`)) {
      deleteSale(sale.id);
    }
  }

  return (
    <>
      <PageFrame>
        {/* Header */}
        <PageHeader
          title="Sales"
          description="Track revenue across grants, sponsorships, workshops, and product sales"
          actions={<Button size="sm" onClick={() => setShowNewSale(true)}><Plus className="w-4 h-4" /> Log Sale</Button>}
        />
        {/* Summary cards */}
        <SheetSummary className="sm:grid-cols-3">
          <SummaryMetric value={`$${totalRevenue.toLocaleString()}`} label="Total Revenue" indicator={<Badge variant="neutral">{filteredSales.length} entries</Badge>} />
          <SummaryMetric value={`$${Math.round(avgDeal).toLocaleString()}`} label="Average Deal" />
          <SummaryMetric value={revenueByProject.length} label="Revenue Streams" />
        </SheetSummary>

        {/* Revenue breakdown */}
        <ContentGrid>
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
                      <div className="h-5 bg-secondary overflow-hidden">
                        <div
                          className="h-full transition-all duration-500"
                          style={{
                            width: `${(item.total / totalRevenue) * 100}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-semibold w-20 text-right tabular">${item.total.toLocaleString()}</span>
                    <span className="text-xs text-subtle-foreground w-8 text-right tabular">{item.count}</span>
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
                    <div className="flex items-center gap-2 w-56 flex-shrink-0">
                      <div className="w-2.5 h-2.5" style={{ backgroundColor: item.project.color }} />
                      <span className="text-sm font-medium leading-tight" title={item.project.title}>{item.project.title}</span>
                    </div>
                    <div className="flex-1">
                      <div className="h-5 bg-secondary overflow-hidden">
                        <div
                          className="h-full transition-all duration-500"
                          style={{
                            width: `${(item.total / totalRevenue) * 100}%`,
                            backgroundColor: item.project.color,
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-semibold w-20 text-right tabular">${item.total.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </ContentGrid>

        {/* Filters */}
        <Toolbar>
          <Select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">All Types</option>
            {Object.entries(saleTypeConfig).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </Select>
          <Select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
          >
            <option value="all">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </Select>
        </Toolbar>

        {/* Sales table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs font-medium text-subtle-foreground uppercase tracking-wider py-3 px-4">Client</th>
                  <th className="text-left text-xs font-medium text-subtle-foreground uppercase tracking-wider py-3 px-4">Project</th>
                  <th className="text-left text-xs font-medium text-subtle-foreground uppercase tracking-wider py-3 px-4">Type</th>
                  <th className="text-right text-xs font-medium text-subtle-foreground uppercase tracking-wider py-3 px-4">Amount</th>
                  <th className="text-left text-xs font-medium text-subtle-foreground uppercase tracking-wider py-3 px-4">Date</th>
                  <th className="text-left text-xs font-medium text-subtle-foreground uppercase tracking-wider py-3 px-4">Notes</th>
                  <th className="w-24 text-right text-xs font-medium text-subtle-foreground uppercase tracking-wider py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map((sale) => {
                  const project = projects.find((p) => p.id === sale.projectId);
                  const typeConf = saleTypeConfig[sale.type];
                  return (
                    <tr key={sale.id} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
                      <td className="py-3 px-4">
                        <span className="text-sm font-medium">{sale.clientName}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2" style={{ backgroundColor: project?.color }} />
                          <span className="text-sm text-muted-foreground">{project?.title}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={typeConf.variant}>{typeConf.label}</Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-sm font-semibold">${sale.amount.toLocaleString()}</span>
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">{formatDate(sale.date)}</td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-subtle-foreground truncate max-w-[280px] block">{sale.notes}</span>
                      </td>
                      <td className="py-2 px-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            aria-label={`Edit sale from ${sale.clientName}`}
                            onClick={() => openEditSale(sale)}
                            className="flex h-9 w-9 items-center justify-center text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete sale from ${sale.clientName}`}
                            onClick={() => handleDeleteSale(sale)}
                            className="flex h-9 w-9 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </PageFrame>

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
                <Select
                  value={newSale.type}
                  onChange={(e) => setNewSale({ ...newSale, type: e.target.value as "commission" | "artwork" | "workshop" | "sponsorship" | "grant" })}
                >
                  {Object.entries(saleTypeConfig).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Project</label>
              <Select
                value={newSale.projectId}
                onChange={(e) => setNewSale({ ...newSale, projectId: e.target.value })}
              >
                <option value="">Select project...</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Notes</label>
              <Textarea placeholder="Additional details..." value={newSale.notes} onChange={(e) => setNewSale({ ...newSale, notes: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowNewSale(false)}>Cancel</Button>
              <Button onClick={handleCreateSale} disabled={!newSale.clientName.trim() || !newSale.amount || projects.length === 0}>Log Sale</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Sale Dialog */}
      <Dialog open={editingSaleId !== null} onOpenChange={(open) => { if (!open) setEditingSaleId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Sale</DialogTitle>
            <DialogDescription>Update the revenue entry.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Client Name</label>
              <Input placeholder="e.g., National Arts Council" value={editSale.clientName} onChange={(e) => setEditSale({ ...editSale, clientName: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Amount ($)</label>
                <Input type="number" placeholder="0.00" value={editSale.amount} onChange={(e) => setEditSale({ ...editSale, amount: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Type</label>
                <Select value={editSale.type} onChange={(e) => setEditSale({ ...editSale, type: e.target.value as Sale["type"] })}>
                  {Object.entries(saleTypeConfig).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Project</label>
              <Select value={editSale.projectId} onChange={(e) => setEditSale({ ...editSale, projectId: e.target.value })}>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Date</label>
              <Input type="date" value={editSale.date} onChange={(e) => setEditSale({ ...editSale, date: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Notes</label>
              <Textarea placeholder="Additional details..." value={editSale.notes} onChange={(e) => setEditSale({ ...editSale, notes: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditingSaleId(null)}>Cancel</Button>
              <Button onClick={handleSaveSale} disabled={!editSale.clientName.trim() || !editSale.amount || !editSale.projectId}>Save changes</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
