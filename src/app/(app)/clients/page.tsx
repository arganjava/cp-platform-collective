"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { cn, formatDate, generateId } from "@/lib/utils";
import type { Client, Sale } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PageFrame,
  PageHeader,
  SheetSummary,
  SummaryMetric,
  Toolbar,
} from "@/components/page-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  ShieldAlert,
  ArrowLeft,
  DollarSign,
  Receipt,
  Eye,
  TrendingUp,
  Briefcase,
} from "lucide-react";

export default function ClientsPage() {
  const {
    clients,
    sales,
    projects,
    addClient,
    updateClient,
    deleteClient,
    searchQuery,
    currentUserId,
    getUserById,
  } = useStore();

  const currentUser = getUserById(currentUserId);
  const isAdmin = currentUser?.role === "admin";

  const [localSearch, setLocalSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name_asc" | "name_desc" | "revenue_desc" | "deals_desc" | "recent">("name_asc");
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editClientName, setEditClientName] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [viewingClient, setViewingClient] = useState<Client | null>(null);

  // Stats calculation per client
  const clientStats = useMemo(() => {
    const map = new Map<string, { totalRevenue: number; dealCount: number; sales: Sale[] }>();
    
    // Initialize
    clients.forEach((c) => {
      map.set(c.id, { totalRevenue: 0, dealCount: 0, sales: [] });
    });

    sales.forEach((s) => {
      let matchedClientId = s.clientId;
      if (!matchedClientId && s.clientName) {
        const found = clients.find((c) => c.name.toLowerCase() === s.clientName?.toLowerCase());
        if (found) matchedClientId = found.id;
      }

      if (matchedClientId && map.has(matchedClientId)) {
        const entry = map.get(matchedClientId)!;
        entry.totalRevenue += s.amount;
        entry.dealCount += 1;
        entry.sales.push(s);
      }
    });

    return map;
  }, [clients, sales]);

  // Access control
  if (!isAdmin) {
    const roleLabel = currentUser?.role
      ? currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)
      : "Guest";
    return (
      <PageFrame id="clients-access-denied-frame">
        <PageHeader
          title="Clients & Accounts"
          description="Manage client relationships, enterprise partners, and account records."
        />
        <Card className="border border-border p-8 text-center" id="card-clients-restricted">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-4">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h2 className="font-heading text-xl font-bold text-foreground mb-2">
            Access Restricted
          </h2>
          <p className="max-w-md mx-auto text-sm text-muted-foreground mb-6">
            Your current role is set to <strong>{roleLabel}</strong>. Client records and relationship management are strictly restricted to Workspace Administrators.
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

  // Filtered and sorted clients
  const activeSearch = (localSearch || searchQuery).trim().toLowerCase();
  const filteredClients = clients
    .filter((c) => {
      if (!activeSearch) return true;
      return c.name.toLowerCase().includes(activeSearch);
    })
    .sort((a, b) => {
      if (sortBy === "name_asc") return a.name.localeCompare(b.name);
      if (sortBy === "name_desc") return b.name.localeCompare(a.name);
      if (sortBy === "recent") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      const statsA = clientStats.get(a.id) || { totalRevenue: 0, dealCount: 0, sales: [] };
      const statsB = clientStats.get(b.id) || { totalRevenue: 0, dealCount: 0, sales: [] };
      if (sortBy === "revenue_desc") return statsB.totalRevenue - statsA.totalRevenue;
      if (sortBy === "deals_desc") return statsB.dealCount - statsA.dealCount;
      return 0;
    });

  // Overall metrics
  const totalClientsCount = clients.length;
  const totalRevenueAll = sales.reduce((sum, s) => sum + s.amount, 0);
  const totalDealsAll = sales.length;
  const avgDealValue = totalDealsAll > 0 ? totalRevenueAll / totalDealsAll : 0;

  // Actions
  function handleAddClient() {
    const trimmed = newClientName.trim();
    if (!trimmed) {
      setAddError("Client name cannot be empty.");
      return;
    }
    const exists = clients.some((c) => c.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      setAddError("A client with this name already exists.");
      return;
    }

    const now = new Date().toISOString();
    const newClient: Client = {
      id: generateId(),
      name: trimmed,
      createdAt: now,
      createdBy: currentUserId,
      updatedAt: now,
      updatedBy: currentUserId,
    };

    addClient(newClient);
    setNewClientName("");
    setAddError(null);
    setShowAddClient(false);
  }

  function handleOpenEdit(client: Client) {
    setEditingClient(client);
    setEditClientName(client.name);
    setEditError(null);
  }

  function handleSaveEdit() {
    if (!editingClient) return;
    const trimmed = editClientName.trim();
    if (!trimmed) {
      setEditError("Client name cannot be empty.");
      return;
    }
    const exists = clients.some(
      (c) => c.id !== editingClient.id && c.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      setEditError("Another client with this name already exists.");
      return;
    }

    updateClient(editingClient.id, {
      name: trimmed,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUserId,
    });
    setEditingClient(null);
    setEditError(null);
  }

  function handleConfirmDelete() {
    if (!deletingClient) return;
    deleteClient(deletingClient.id);
    setDeletingClient(null);
  }

  const viewingStats = viewingClient ? clientStats.get(viewingClient.id) : null;

  return (
    <PageFrame id="clients-page-frame">
      {/* Header */}
      <PageHeader
        title="Clients & Accounts"
        description="Manage enterprise partners, sponsors, patrons, and institutional client accounts."
        actions={
          <Button
            id="btn-add-client"
            onClick={() => {
              setNewClientName("");
              setAddError(null);
              setShowAddClient(true);
            }}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            <span>Add Client</span>
          </Button>
        }
      />

      {/* Summary Metrics */}
      <SheetSummary id="clients-summary-metrics">
        <SummaryMetric
          id="metric-total-clients"
          label="Total Clients"
          value={totalClientsCount}
          indicator={
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" />
              <span>Registered accounts</span>
            </span>
          }
        />
        <SummaryMetric
          id="metric-total-revenue"
          label="Total Revenue"
          value={`$${totalRevenueAll.toLocaleString()}`}
          indicator={
            <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>From all deals</span>
            </span>
          }
        />
        <SummaryMetric
          id="metric-active-deals"
          label="Total Deals"
          value={totalDealsAll}
          indicator={
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Receipt className="h-3.5 w-3.5" />
              <span>Financial records</span>
            </span>
          }
        />
        <SummaryMetric
          id="metric-avg-deal"
          label="Average Deal"
          value={`$${Math.round(avgDealValue).toLocaleString()}`}
          indicator={
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <DollarSign className="h-3.5 w-3.5" />
              <span>Per transaction</span>
            </span>
          }
        />
      </SheetSummary>

      {/* Toolbar: Search and Sort */}
      <Toolbar className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex-1 max-w-md">
          <Input
            id="input-search-clients"
            placeholder="Search clients by name..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Sort by:</span>
          <Select
            id="select-sort-clients"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="w-[180px]"
          >
            <option value="name_asc">Name (A–Z)</option>
            <option value="name_desc">Name (Z–A)</option>
            <option value="revenue_desc">Highest Revenue</option>
            <option value="deals_desc">Most Deals</option>
            <option value="recent">Recently Created</option>
          </Select>
        </div>
      </Toolbar>

      {/* Clients Table */}
      <Card id="card-clients-table">
        <div className="overflow-x-auto">
          <table className="w-full text-left" id="table-clients">
            <thead>
              <tr className="border-b border-border text-xs font-medium text-subtle-foreground uppercase tracking-wider">
                <th className="py-3 px-4">Client Name</th>
                <th className="py-3 px-4">Deals</th>
                <th className="py-3 px-4 text-right">Total Revenue</th>
                <th className="py-3 px-4">Created</th>
                <th className="py-3 px-4">Updated</th>
                <th className="w-28 text-right py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    <Building2 className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
                    <p className="text-sm font-medium">No clients found</p>
                    <p className="text-xs text-subtle-foreground mt-1">
                      {activeSearch
                        ? `No client matches "${activeSearch}".`
                        : "No clients have been registered yet. Click \"Add Client\" to create one."}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => {
                  const stats = clientStats.get(client.id) || {
                    totalRevenue: 0,
                    dealCount: 0,
                    sales: [],
                  };
                  const creator = getUserById(client.createdBy ?? null);
                  const updater = getUserById(client.updatedBy ?? null);

                  return (
                    <tr
                      key={client.id}
                      id={`client-row-${client.id}`}
                      className="border-b border-border/50 hover:bg-secondary/40 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-semibold text-xs">
                            {client.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <span className="text-sm font-semibold text-foreground block truncate">
                              {client.name}
                            </span>
                            <span className="text-xs text-muted-foreground">ID: {client.id.slice(0, 8)}...</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={stats.dealCount > 0 ? "neutral" : "outline"}
                          className="font-mono text-xs"
                        >
                          {stats.dealCount} {stats.dealCount === 1 ? "deal" : "deals"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-sm font-semibold tabular text-foreground">
                          ${stats.totalRevenue.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">
                        <div>{formatDate(client.createdAt)}</div>
                        {creator && (
                          <div className="text-[11px] text-subtle-foreground truncate max-w-[130px]">
                            by {creator.name}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">
                        <div>{formatDate(client.updatedAt)}</div>
                        {updater && (
                          <div className="text-[11px] text-subtle-foreground truncate max-w-[130px]">
                            by {updater.name}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            aria-label={`View deals for ${client.name}`}
                            onClick={() => setViewingClient(client)}
                            title="View Deals"
                            className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Edit ${client.name}`}
                            onClick={() => handleOpenEdit(client)}
                            title="Edit Client"
                            className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete ${client.name}`}
                            onClick={() => setDeletingClient(client)}
                            title="Delete Client"
                            className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Client Dialog */}
      <Dialog open={showAddClient} onOpenChange={setShowAddClient}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Client</DialogTitle>
            <DialogDescription>
              Register a new organization, sponsor, or patron account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Client Name *</label>
              <Input
                id="input-new-client-name"
                placeholder="e.g., National Arts Council"
                value={newClientName}
                onChange={(e) => {
                  setNewClientName(e.target.value);
                  setAddError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddClient();
                }}
                autoFocus
              />
              {addError && <p className="text-xs text-destructive mt-1.5">{addError}</p>}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowAddClient(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddClient} disabled={!newClientName.trim()}>
                Create Client
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Client Dialog */}
      <Dialog
        open={editingClient !== null}
        onOpenChange={(open) => {
          if (!open) setEditingClient(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
            <DialogDescription>
              Update the name for this client account. Linked sales records will reflect the new name.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Client Name *</label>
              <Input
                id="input-edit-client-name"
                value={editClientName}
                onChange={(e) => {
                  setEditClientName(e.target.value);
                  setEditError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveEdit();
                }}
                autoFocus
              />
              {editError && <p className="text-xs text-destructive mt-1.5">{editError}</p>}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditingClient(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={!editClientName.trim()}>
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Client Dialog */}
      <Dialog
        open={deletingClient !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingClient(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Client</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove &quot;{deletingClient?.name}&quot;?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {deletingClient && (
              <div className="p-3 bg-secondary/50 rounded-lg text-sm text-muted-foreground">
                {(() => {
                  const s = clientStats.get(deletingClient.id);
                  const count = s?.dealCount || 0;
                  if (count > 0) {
                    return (
                      <p>
                        This client currently has <strong>{count}</strong> associated financial deal(s). Deleting this client will dissociate the client link on those sales.
                      </p>
                    );
                  }
                  return <p>This client has no associated deals and can be safely removed.</p>;
                })()}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDeletingClient(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleConfirmDelete}>
                Delete Client
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Deals Dialog */}
      <Dialog
        open={viewingClient !== null}
        onOpenChange={(open) => {
          if (!open) setViewingClient(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <span>{viewingClient?.name}</span>
            </DialogTitle>
            <DialogDescription>
              Financial transactions and deals linked to this client account.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 pt-2">
            {/* Overview pill stats */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-secondary/30 rounded-lg border border-border/50">
              <div>
                <span className="text-xs text-muted-foreground block">Total Revenue</span>
                <span className="text-lg font-bold text-foreground tabular">
                  ${viewingStats?.totalRevenue.toLocaleString() || "0"}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Associated Deals</span>
                <span className="text-lg font-bold text-foreground tabular">
                  {viewingStats?.dealCount || 0}
                </span>
              </div>
            </div>

            {/* List of deals */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Deal History
              </h4>
              {(!viewingStats || viewingStats.sales.length === 0) ? (
                <div className="text-center py-8 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
                  No sales recorded for this client yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {viewingStats.sales.map((deal) => {
                    const project = projects.find((p) => p.id === deal.projectId);
                    return (
                      <div
                        key={deal.id}
                        className="p-3 bg-card border border-border/60 rounded-lg flex items-center justify-between gap-3 text-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">
                              ${deal.amount.toLocaleString()}
                            </span>
                            <Badge variant="neutral" className="text-xs capitalize">
                              {deal.type}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                            {project && (
                              <span className="flex items-center gap-1">
                                <Briefcase className="h-3 w-3" />
                                <span className="truncate max-w-[200px]">{project.title}</span>
                              </span>
                            )}
                            <span>•</span>
                            <span>{formatDate(deal.date)}</span>
                          </div>
                          {deal.notes && (
                            <p className="text-xs text-subtle-foreground mt-1 truncate">
                              {deal.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-between items-center pt-3 border-t border-border mt-2">
            <Link href="/sales" className="text-xs text-primary hover:underline flex items-center gap-1">
              <span>Go to Sales module</span>
            </Link>
            <Button variant="outline" onClick={() => setViewingClient(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageFrame>
  );
}
