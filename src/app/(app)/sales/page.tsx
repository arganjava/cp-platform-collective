"use client";

import React, { useState, useMemo, useCallback } from "react";
import { useStore } from "@/lib/store";
import { cn, formatDate, generateId, getInitials } from "@/lib/utils";
import type { Sale, SaleStage, SaleStageStatus } from "@/lib/types";
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
  ChevronDown,
  ChevronRight,
  Layers,
  Clock,
} from "lucide-react";

const saleTypeConfig = {
  commission: { label: "Commission", variant: "neutral" as const, color: "var(--primary)" },
  artwork: { label: "Artwork", variant: "neutral" as const, color: "var(--muted-foreground)" },
  workshop: { label: "Workshop", variant: "neutral" as const, color: "var(--destructive)" },
  sponsorship: { label: "Sponsorship", variant: "accent" as const, color: "var(--brand)" },
  grant: { label: "Grant", variant: "neutral" as const, color: "var(--subtle-foreground)" },
};

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

const stageStatusOptions: SaleStageStatus[] = ["Opportunity", "Discussion", "Closed", "Lost"];

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  return new Intl.DateTimeFormat("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export default function SalesPage() {
  const {
    sales,
    projects,
    clients,
    saleStages,
    addClient,
    addSale,
    updateSale,
    deleteSale,
    addSaleStage,
    searchQuery,
    currentUserId,
    getUserById,
    getClientById,
    getActiveUsers,
  } = useStore();

  const currentUser = getUserById(currentUserId);
  const isAdmin = currentUser?.role === "admin";
  const activeUsers = getActiveUsers();

  const [filterType, setFilterType] = useState<string>("all");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterClient, setFilterClient] = useState<string>("all");
  const [filterStageStatus, setFilterStageStatus] = useState<string>("all");
  const [expandedSaleIds, setExpandedSaleIds] = useState<Record<string, boolean>>({});

  // Sale Modal States
  const [showNewSale, setShowNewSale] = useState(false);
  const [newSale, setNewSale] = useState({
    projectId: "",
    amount: "",
    clientId: "",
    customClientName: "",
    type: "commission" as "commission" | "artwork" | "workshop" | "sponsorship" | "grant",
    notes: "",
  });
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [editSale, setEditSale] = useState<{
    projectId: string;
    amount: string;
    clientId: string;
    customClientName: string;
    type: Sale["type"];
    date: string;
    notes: string;
  }>({ projectId: "", amount: "", clientId: "", customClientName: "", type: "commission", date: "", notes: "" });

  // Sale Stage Modal States
  const [stageModalSaleId, setStageModalSaleId] = useState<string | null>(null);
  const [newStageForm, setNewStageForm] = useState<{
    status: SaleStageStatus;
    date: string;
    picProfileId: string;
    value: string;
  }>({
    status: "Opportunity",
    date: "",
    picProfileId: "",
    value: "",
  });

  const getSaleClientName = useCallback((s: Sale) => {
    if (s.clientId) {
      const client = getClientById(s.clientId);
      if (client) return client.name;
    }
    return s.clientName || "Unnamed Client";
  }, [getClientById]);

  // Retrieve the latest stage for a sale based on latest created_at
  const getLatestSaleStage = useCallback((saleId: string): SaleStage | null => {
    const matching = saleStages.filter((st) => st.saleId === saleId);
    if (matching.length === 0) return null;
    return [...matching].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  }, [saleStages]);

  // Build unique client list for filter
  const clientFilterOptions = useMemo(() => {
    const map = new Map<string, string>();
    clients.forEach((c) => {
      map.set(c.name.toLowerCase(), c.name);
    });
    sales.forEach((s) => {
      const name = getSaleClientName(s);
      if (name && name !== "Unnamed Client") {
        map.set(name.toLowerCase(), name);
      }
    });
    return Array.from(map.entries())
      .map(([key, label]) => ({ value: key, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [clients, sales, getSaleClientName]);

  const toggleExpand = (saleId: string) => {
    setExpandedSaleIds((prev) => ({
      ...prev,
      [saleId]: !prev[saleId],
    }));
  };

  if (!isAdmin) {
    const roleLabel = currentUser?.role ? currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1) : "Guest";
    return (
      <PageFrame id="sales-access-denied-frame">
        <PageHeader
          title="Pipeline"
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
            Your current role is set to <strong>{roleLabel}</strong>. Financial records and the Pipeline module are strictly restricted to Workspace Administrators.
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
      const clientName = getSaleClientName(s);
      if (query) {
        const project = projects.find((p) => p.id === s.projectId);
        const haystack = [clientName, s.notes, project?.title ?? "", saleTypeConfig[s.type]?.label ?? s.type].join(" ").toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (filterType !== "all" && s.type !== filterType) return false;
      if (filterProject !== "all" && s.projectId !== filterProject) return false;
      if (filterClient !== "all" && clientName.toLowerCase() !== filterClient.toLowerCase()) return false;
      if (filterStageStatus !== "all") {
        const latest = getLatestSaleStage(s.id);
        if (!latest || latest.status !== filterStageStatus) return false;
      }
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

  async function handleCreateSale() {
    const projectId = newSale.projectId || projects[0]?.id;
    let finalClientId = newSale.clientId;
    let finalClientName = "";

    if (finalClientId === "__new__" || (!finalClientId && newSale.customClientName.trim())) {
      const trimmed = newSale.customClientName.trim();
      const existing = clients.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
      if (existing) {
        finalClientId = existing.id;
        finalClientName = existing.name;
      } else {
        const newId = generateId();
        const now = new Date().toISOString();
        await addClient({
          id: newId,
          name: trimmed,
          createdAt: now,
          createdBy: currentUserId,
          updatedAt: now,
          updatedBy: currentUserId,
        });
        finalClientId = newId;
        finalClientName = trimmed;
      }
    } else if (finalClientId) {
      const client = getClientById(finalClientId);
      finalClientName = client?.name ?? "";
    }

    if (!finalClientName || !newSale.amount || !projectId) return;

    const newSaleId = generateId();
    addSale({
      id: newSaleId,
      projectId,
      amount: parseFloat(newSale.amount),
      clientId: finalClientId,
      clientName: finalClientName,
      type: newSale.type,
      date: new Date().toISOString().split("T")[0],
      notes: newSale.notes,
      createdAt: new Date().toISOString(),
    });
    setNewSale({ projectId: "", amount: "", clientId: "", customClientName: "", type: "commission", notes: "" });
    setShowNewSale(false);
  }

  function openEditSale(sale: Sale) {
    setEditingSaleId(sale.id);
    let resolvedClientId = sale.clientId || "";
    if (!resolvedClientId && sale.clientName) {
      const clientNameLower = sale.clientName.toLowerCase();
      const matched = clients.find((c) => c.name.toLowerCase() === clientNameLower);
      if (matched) resolvedClientId = matched.id;
    }
    setEditSale({
      projectId: sale.projectId,
      amount: String(sale.amount),
      clientId: resolvedClientId,
      customClientName: resolvedClientId ? "" : (sale.clientName || ""),
      type: sale.type,
      date: sale.date,
      notes: sale.notes,
    });
  }

  async function handleSaveSale() {
    if (!editingSaleId || !editSale.amount || !editSale.projectId) return;
    let finalClientId = editSale.clientId;
    let finalClientName = "";

    if (finalClientId === "__new__" || (!finalClientId && editSale.customClientName.trim())) {
      const trimmed = editSale.customClientName.trim();
      const existing = clients.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
      if (existing) {
        finalClientId = existing.id;
        finalClientName = existing.name;
      } else {
        const newId = generateId();
        const now = new Date().toISOString();
        await addClient({
          id: newId,
          name: trimmed,
          createdAt: now,
          createdBy: currentUserId,
          updatedAt: now,
          updatedBy: currentUserId,
        });
        finalClientId = newId;
        finalClientName = trimmed;
      }
    } else if (finalClientId) {
      const client = getClientById(finalClientId);
      finalClientName = client?.name ?? "";
    }

    if (!finalClientName) return;

    updateSale(editingSaleId, {
      projectId: editSale.projectId,
      amount: parseFloat(editSale.amount),
      clientId: finalClientId,
      clientName: finalClientName,
      type: editSale.type,
      date: editSale.date,
      notes: editSale.notes,
    });
    setEditingSaleId(null);
  }

  function handleDeleteSale(sale: Sale) {
    const clientName = getSaleClientName(sale);
    if (window.confirm(`Delete the pipeline record for "${clientName}"? This cannot be undone.`)) {
      deleteSale(sale.id);
    }
  }

  // Handle Adding Sale Stage
  function openAddStageModal(sale: Sale) {
    setStageModalSaleId(sale.id);
    const now = new Date();
    const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setNewStageForm({
      status: "Opportunity",
      date: localIso,
      picProfileId: currentUserId || "",
      value: String(sale.amount),
    });
  }

  async function handleSaveNewStage() {
    if (!stageModalSaleId) return;
    const nowIso = new Date().toISOString();
    const stageDate = newStageForm.date ? new Date(newStageForm.date).toISOString() : nowIso;
    const createdStage: SaleStage = {
      id: generateId(),
      saleId: stageModalSaleId,
      status: newStageForm.status,
      date: stageDate,
      picProfileId: newStageForm.picProfileId || null,
      value: parseFloat(newStageForm.value) || 0,
      createdAt: nowIso,
      updatedAt: nowIso,
      createdBy: currentUserId,
      updatedBy: currentUserId,
    };
    await addSaleStage(createdStage);
    setExpandedSaleIds((prev) => ({ ...prev, [stageModalSaleId]: true }));
    setStageModalSaleId(null);
  }

  const targetSaleForNewStage = stageModalSaleId ? sales.find((s) => s.id === stageModalSaleId) : null;

  return (
    <>
      <PageFrame>
        {/* Header */}
        <PageHeader
          title="Pipeline"
          description="Track sales deals, pipeline stages, revenue streams, and clients"
          actions={
            <Button size="sm" onClick={() => setShowNewSale(true)}>
              <Plus className="w-4 h-4" /> Log Pipeline
            </Button>
          }
        />

        {/* Summary cards */}
        <SheetSummary className="sm:grid-cols-3">
          <SummaryMetric
            value={`$${totalRevenue.toLocaleString()}`}
            label="Total Revenue"
            indicator={<Badge variant="neutral">{filteredSales.length} deals</Badge>}
          />
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
                            width: `${totalRevenue > 0 ? (item.total / totalRevenue) * 100 : 0}%`,
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
                            width: `${totalRevenue > 0 ? (item.total / totalRevenue) * 100 : 0}%`,
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
            value={filterClient}
            onChange={(e) => setFilterClient(e.target.value)}
            aria-label="Filter by Client name"
          >
            <option value="all">All Clients</option>
            {clientFilterOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
          <Select
            value={filterStageStatus}
            onChange={(e) => setFilterStageStatus(e.target.value)}
            aria-label="Filter by Stage Status"
          >
            <option value="all">All Stage Statuses</option>
            {stageStatusOptions.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </Select>
          <Select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            aria-label="Filter by Type"
          >
            <option value="all">All Types</option>
            {Object.entries(saleTypeConfig).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </Select>
          <Select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            aria-label="Filter by Project"
          >
            <option value="all">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </Select>
        </Toolbar>

        {/* Pipeline Table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="w-10 py-3 pl-4 pr-1 text-left text-xs font-medium text-subtle-foreground uppercase tracking-wider"></th>
                  <th className="text-left text-xs font-medium text-subtle-foreground uppercase tracking-wider py-3 px-3">Client</th>
                  <th className="text-left text-xs font-medium text-subtle-foreground uppercase tracking-wider py-3 px-3">Project</th>
                  <th className="text-left text-xs font-medium text-subtle-foreground uppercase tracking-wider py-3 px-3">Type</th>
                  <th className="text-right text-xs font-medium text-subtle-foreground uppercase tracking-wider py-3 px-3">Amount</th>
                  <th className="text-left text-xs font-medium text-subtle-foreground uppercase tracking-wider py-3 px-3">Date</th>
                  <th className="text-left text-xs font-medium text-subtle-foreground uppercase tracking-wider py-3 px-3">Stage Status</th>
                  <th className="text-left text-xs font-medium text-subtle-foreground uppercase tracking-wider py-3 px-3">Notes</th>
                  <th className="w-36 text-right text-xs font-medium text-subtle-foreground uppercase tracking-wider py-3 pr-4 pl-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                      No pipeline deals match the current filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredSales.map((sale) => {
                    const project = projects.find((p) => p.id === sale.projectId);
                    const typeConf = saleTypeConfig[sale.type];
                    const clientName = getSaleClientName(sale);
                    const stages = saleStages
                      .filter((st) => st.saleId === sale.id)
                      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                    const latestStage = getLatestSaleStage(sale.id);
                    const latestMeta = latestStage ? stageStatusStyles[latestStage.status] : null;
                    const isExpanded = !!expandedSaleIds[sale.id];

                    return (
                      <React.Fragment key={sale.id}>
                        <tr
                          className={cn(
                            "border-b border-border/50 hover:bg-secondary/40 transition-colors",
                            isExpanded && "bg-secondary/20"
                          )}
                        >
                          <td className="py-3 pl-4 pr-1">
                            <button
                              type="button"
                              aria-label={isExpanded ? "Collapse sale stages" : "Expand sale stages"}
                              onClick={() => toggleExpand(sale.id)}
                              className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                          </td>
                          <td className="py-3 px-3">
                            <button
                              type="button"
                              onClick={() => toggleExpand(sale.id)}
                              className="text-left text-sm font-medium text-foreground hover:text-primary transition-colors block"
                            >
                              {clientName}
                            </button>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: project?.color }} />
                              <span className="text-sm text-muted-foreground">{project?.title}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <Badge variant={typeConf.variant}>{typeConf.label}</Badge>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span className="text-sm font-semibold tabular-nums">${sale.amount.toLocaleString()}</span>
                          </td>
                          <td className="py-3 px-3 text-sm text-muted-foreground">{formatDate(sale.date)}</td>
                          <td className="py-3 px-3">
                            {latestMeta ? (
                              <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-medium whitespace-nowrap", latestMeta.badgeClass)}>
                                <span className={cn("w-1.5 h-1.5 rounded-full", latestMeta.dotClass)} />
                                {latestMeta.label}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">-</span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <span className="text-sm text-subtle-foreground truncate max-w-[200px] block" title={sale.notes}>
                              {sale.notes || "-"}
                            </span>
                          </td>
                          <td className="py-2 pr-4 pl-2">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2 text-xs gap-1"
                                onClick={() => openAddStageModal(sale)}
                                title="Add Stage to Pipeline"
                              >
                                <Plus className="h-3.5 w-3.5" />
                                <span>Stage</span>
                              </Button>
                              <button
                                type="button"
                                aria-label={`Edit pipeline record from ${clientName}`}
                                onClick={() => openEditSale(sale)}
                                className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                aria-label={`Delete pipeline record from ${clientName}`}
                                onClick={() => handleDeleteSale(sale)}
                                className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Subrow for sale stages */}
                        {isExpanded && (
                          <tr className="bg-secondary/15 dark:bg-muted/10 border-b border-border">
                            <td colSpan={9} className="p-0">
                              <div className="px-6 py-4 space-y-3 bg-secondary/10 dark:bg-muted/5 border-l-4 border-l-primary/60">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <Layers className="h-4 w-4 text-primary" />
                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                                      Pipeline Stages ({stages.length})
                                    </h4>
                                    <span className="text-xs text-muted-foreground">
                                      &bull; {clientName} &bull; Total Deal: ${sale.amount.toLocaleString()}
                                    </span>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-xs gap-1.5"
                                    onClick={() => openAddStageModal(sale)}
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                    <span>Add Stage</span>
                                  </Button>
                                </div>

                                {stages.length === 0 ? (
                                  <div className="p-4 rounded border border-dashed border-border bg-background/60 text-center">
                                    <p className="text-xs text-muted-foreground">
                                      No pipeline stages recorded yet for this deal.
                                    </p>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="mt-1 text-xs text-primary gap-1"
                                      onClick={() => openAddStageModal(sale)}
                                    >
                                      <Plus className="h-3 w-3" /> Log Opportunity, Discussion, Closed, or Lost stage
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="overflow-x-auto border border-border bg-background rounded-md shadow-xs">
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="border-b border-border bg-secondary/30 text-muted-foreground">
                                          <th className="py-2.5 px-3 text-left font-medium">Stage Status</th>
                                          <th className="py-2.5 px-3 text-left font-medium">Date & Time</th>
                                          <th className="py-2.5 px-3 text-left font-medium">PIC (Person in Charge)</th>
                                          <th className="py-2.5 px-3 text-right font-medium">Stage Value</th>
                                          <th className="py-2.5 px-3 text-right font-medium">Last Updated</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-border/40">
                                        {stages.map((st) => {
                                          const picUser = st.picProfileId ? getUserById(st.picProfileId) : null;
                                          const statusMeta = stageStatusStyles[st.status] || {
                                            label: st.status,
                                            badgeClass: "border-border bg-secondary text-foreground",
                                            dotClass: "bg-muted-foreground",
                                          };
                                          return (
                                            <tr key={st.id} className="hover:bg-secondary/25 transition-colors">
                                              <td className="py-2.5 px-3">
                                                <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-medium", statusMeta.badgeClass)}>
                                                  <span className={cn("w-1.5 h-1.5 rounded-full", statusMeta.dotClass)} />
                                                  {statusMeta.label}
                                                </span>
                                              </td>
                                              <td className="py-2.5 px-3 text-muted-foreground">
                                                <div className="flex items-center gap-1.5">
                                                  <Clock className="h-3.5 w-3.5 text-muted-foreground/70" />
                                                  <span>{formatDateTime(st.date)}</span>
                                                </div>
                                              </td>
                                              <td className="py-2.5 px-3">
                                                {picUser ? (
                                                  <div className="flex items-center gap-2">
                                                    <span
                                                      className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white flex-shrink-0"
                                                      style={{ backgroundColor: picUser.avatarColor || "var(--primary)" }}
                                                    >
                                                      {getInitials(picUser.name)}
                                                    </span>
                                                    <span className="font-medium text-foreground">{picUser.name}</span>
                                                  </div>
                                                ) : (
                                                  <span className="text-muted-foreground italic">Unassigned</span>
                                                )}
                                              </td>
                                              <td className="py-2.5 px-3 text-right font-semibold text-foreground tabular-nums">
                                                ${Number(st.value).toLocaleString()}
                                              </td>
                                              <td className="py-2.5 px-3 text-right text-muted-foreground">
                                                {formatDate(st.updatedAt || st.createdAt)}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </PageFrame>

      {/* New Pipeline Deal Dialog */}
      <Dialog open={showNewSale} onOpenChange={setShowNewSale}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log New Pipeline</DialogTitle>
            <DialogDescription>Record a new revenue or deal entry</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Client</label>
              <Select
                value={newSale.clientId}
                onChange={(e) => setNewSale({ ...newSale, clientId: e.target.value })}
              >
                <option value="">Select a client...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
                <option value="__new__">+ Enter new client...</option>
              </Select>
              {(newSale.clientId === "__new__" || (clients.length === 0 && !newSale.clientId)) && (
                <div className="mt-2">
                  <Input
                    placeholder="e.g., Far East Organization"
                    value={newSale.customClientName}
                    onChange={(e) => setNewSale({ ...newSale, customClientName: e.target.value })}
                    autoFocus
                  />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Amount ($)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={newSale.amount}
                  onChange={(e) => setNewSale({ ...newSale, amount: e.target.value })}
                />
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
              <Textarea
                placeholder="Additional details..."
                value={newSale.notes}
                onChange={(e) => setNewSale({ ...newSale, notes: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowNewSale(false)}>Cancel</Button>
              <Button
                onClick={handleCreateSale}
                disabled={
                  (!newSale.clientId && !newSale.customClientName.trim()) ||
                  (newSale.clientId === "__new__" && !newSale.customClientName.trim()) ||
                  !newSale.amount ||
                  projects.length === 0
                }
              >
                Log Pipeline
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Pipeline Deal Dialog */}
      <Dialog open={editingSaleId !== null} onOpenChange={(open) => { if (!open) setEditingSaleId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Pipeline</DialogTitle>
            <DialogDescription>Update deal details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Client</label>
              <Select
                value={editSale.clientId}
                onChange={(e) => setEditSale({ ...editSale, clientId: e.target.value })}
              >
                <option value="">Select a client...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
                <option value="__new__">+ Enter new client...</option>
              </Select>
              {(editSale.clientId === "__new__" || !editSale.clientId) && (
                <div className="mt-2">
                  <Input
                    placeholder="e.g., Far East Organization"
                    value={editSale.customClientName}
                    onChange={(e) => setEditSale({ ...editSale, customClientName: e.target.value })}
                    autoFocus
                  />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Amount ($)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={editSale.amount}
                  onChange={(e) => setEditSale({ ...editSale, amount: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Type</label>
                <Select
                  value={editSale.type}
                  onChange={(e) => setEditSale({ ...editSale, type: e.target.value as Sale["type"] })}
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
                value={editSale.projectId}
                onChange={(e) => setEditSale({ ...editSale, projectId: e.target.value })}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Date</label>
              <Input
                type="date"
                value={editSale.date}
                onChange={(e) => setEditSale({ ...editSale, date: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Notes</label>
              <Textarea
                placeholder="Additional details..."
                value={editSale.notes}
                onChange={(e) => setEditSale({ ...editSale, notes: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditingSaleId(null)}>Cancel</Button>
              <Button
                onClick={handleSaveSale}
                disabled={
                  (!editSale.clientId && !editSale.customClientName.trim()) ||
                  (editSale.clientId === "__new__" && !editSale.customClientName.trim()) ||
                  !editSale.amount ||
                  !editSale.projectId
                }
              >
                Save changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Stage Modal */}
      <Dialog open={stageModalSaleId !== null} onOpenChange={(open) => { if (!open) setStageModalSaleId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Pipeline Stage</DialogTitle>
            <DialogDescription>
              {targetSaleForNewStage ? (
                <>
                  Record a stage progression for <strong>{getSaleClientName(targetSaleForNewStage)}</strong> (${targetSaleForNewStage.amount.toLocaleString()})
                </>
              ) : (
                "Add a pipeline stage for this deal."
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Stage Status</label>
              <Select
                value={newStageForm.status}
                onChange={(e) => setNewStageForm({ ...newStageForm, status: e.target.value as SaleStageStatus })}
              >
                {stageStatusOptions.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Date & Time</label>
                <Input
                  type="datetime-local"
                  value={newStageForm.date}
                  onChange={(e) => setNewStageForm({ ...newStageForm, date: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Stage Value ($)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={newStageForm.value}
                  onChange={(e) => setNewStageForm({ ...newStageForm, value: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Person in Charge (PIC)</label>
              <Select
                value={newStageForm.picProfileId}
                onChange={(e) => setNewStageForm({ ...newStageForm, picProfileId: e.target.value })}
              >
                <option value="">Unassigned (None)</option>
                {activeUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setStageModalSaleId(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveNewStage}>
                Add Stage
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
