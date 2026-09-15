"use client";

import React, { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { cn, formatDate, getInitials } from "@/lib/utils";
import type { Sale, SaleStage, SaleStageStatus } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PageFrame,
  PageHeader,
  SheetSummary,
  SummaryMetric,
} from "@/components/page-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Building2,
  ShieldAlert,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Clock,
  TrendingUp,
  Receipt,
  DollarSign,
  Calendar,
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

export default function ClientDetailPage() {
  const params = useParams();
  const clientId = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);

  const {
    clients,
    sales,
    projects,
    saleStages,
    currentUserId,
    getUserById,
  } = useStore();

  const currentUser = getUserById(currentUserId);
  const isAdmin = currentUser?.role === "admin";

  const client = clients.find((c) => c.id === clientId);

  const [expandedSaleIds, setExpandedSaleIds] = useState<Record<string, boolean>>({});

  // Helper: latest sale stage based on created_at
  const getLatestSaleStage = useCallback(
    (saleId: string): SaleStage | null => {
      const matching = saleStages.filter((st) => st.saleId === saleId);
      if (matching.length === 0) return null;
      return [...matching].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];
    },
    [saleStages]
  );

  const toggleExpand = (saleId: string) => {
    setExpandedSaleIds((prev) => ({
      ...prev,
      [saleId]: !prev[saleId],
    }));
  };

  // Associated sales for this client
  const clientSales = useMemo(() => {
    if (!client) return [];
    return sales.filter((s) => {
      if (s.clientId && s.clientId === client.id) return true;
      if (!s.clientId && s.clientName && s.clientName.toLowerCase() === client.name.toLowerCase()) {
        return true;
      }
      return false;
    });
  }, [client, sales]);

  // Sorted sales list
  const filteredClientSales = useMemo(() => {
    return [...clientSales].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [clientSales]);

  // Overall metrics for this client
  const totalRevenue = clientSales.reduce((sum, s) => sum + s.amount, 0);
  const totalDeals = clientSales.length;
  const avgDeal = totalDeals > 0 ? totalRevenue / totalDeals : 0;

  // Access control
  if (!isAdmin) {
    const roleLabel = currentUser?.role
      ? currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)
      : "Guest";
    return (
      <PageFrame id="client-detail-access-denied-frame">
        <PageHeader
          title="Client Detail"
          description="Client account records and financial transactions."
        />
        <Card className="border border-border p-8 text-center" id="card-client-detail-restricted">
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
            <Link href="/clients">
              <Button variant="default" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                <span>Return to Clients</span>
              </Button>
            </Link>
          </div>
        </Card>
      </PageFrame>
    );
  }

  // Client not found
  if (!client) {
    return (
      <PageFrame id="client-not-found-frame">
        <div className="mb-4">
          <Link href="/clients">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Clients</span>
            </Button>
          </Link>
        </div>
        <Card className="border border-border p-12 text-center">
          <Building2 className="mx-auto h-12 w-12 text-muted-foreground/40 mb-3" />
          <h2 className="text-xl font-bold text-foreground mb-2">Client Not Found</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
            The requested client account could not be found or may have been deleted.
          </p>
          <Link href="/clients">
            <Button variant="default" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to List of Clients</span>
            </Button>
          </Link>
        </Card>
      </PageFrame>
    );
  }

  const creator = getUserById(client.createdBy ?? null);
  const updater = getUserById(client.updatedBy ?? null);

  return (
    <PageFrame id="client-detail-page-frame">
      {/* Top Navigation / Back Button */}
      <div className="flex items-center justify-between gap-4 mb-2">
        <Link href="/clients" id="btn-back-to-clients">
          <Button variant="outline" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to list of clients</span>
          </Button>
        </Link>
      </div>

      {/* Client Overview Card */}
      <Card className="border border-border mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-xl">
                {client.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="font-heading text-2xl font-bold text-foreground">
                    {client.name}
                  </h1>
                  <Badge variant="neutral" className="text-xs">
                    Client Account
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2 flex-wrap">
                  <span className="flex items-center gap-1 font-mono">
                    <span>ID:</span>
                    <span className="text-foreground">{client.id}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Created: {formatDate(client.createdAt)}</span>
                    {creator && <span className="text-foreground font-medium">({creator.name})</span>}
                  </span>
                  {client.updatedAt && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>Updated: {formatDate(client.updatedAt)}</span>
                      {updater && <span className="text-foreground font-medium">({updater.name})</span>}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Metrics */}
      <SheetSummary id="client-sales-metrics">
        <SummaryMetric
          id="metric-client-revenue"
          label="Total Revenue"
          value={`$${totalRevenue.toLocaleString()}`}
          indicator={
            <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>Lifetime value</span>
            </span>
          }
        />
        <SummaryMetric
          id="metric-client-deals"
          label="Total Pipeline Deals"
          value={totalDeals}
          indicator={
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Receipt className="h-3.5 w-3.5" />
              <span>Recorded transactions</span>
            </span>
          }
        />
        <SummaryMetric
          id="metric-client-avg-deal"
          label="Average Deal"
          value={`$${Math.round(avgDeal).toLocaleString()}`}
          indicator={
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <DollarSign className="h-3.5 w-3.5" />
              <span>Per pipeline deal</span>
            </span>
          }
        />
      </SheetSummary>

      {/* Pipeline / Sales Section */}
      <div className="space-y-4">
        <div className="pt-2">
          <h2 className="font-heading text-lg font-bold text-foreground">
            Pipeline & Sales History
          </h2>
          <p className="text-xs text-muted-foreground">
            All financial records, revenue deals, and pipeline stage progress for {client.name}.
          </p>
        </div>

        {/* Pipeline Deals Table */}
        <Card id="card-client-sales-table">
          <div className="overflow-x-auto">
            <table className="w-full text-left" id="table-client-sales">
              <thead>
                <tr className="border-b border-border text-xs font-medium text-subtle-foreground uppercase tracking-wider">
                  <th className="w-10 py-3 pl-4 pr-1"></th>
                  <th className="py-3 px-3">Project</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3 text-right">Amount</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Stage Status</th>
                  <th className="py-3 px-3 pr-4">Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredClientSales.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      <Receipt className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
                      <p className="text-sm font-medium">No pipeline deals found</p>
                      <p className="text-xs text-subtle-foreground mt-1">
                        No sales or pipeline deals have been recorded for {client.name} yet.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredClientSales.map((sale) => {
                    const project = projects.find((p) => p.id === sale.projectId);
                    const typeConf = saleTypeConfig[sale.type];
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
                            <div className="flex items-center gap-2">
                              <div
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: project?.color || "var(--primary)" }}
                              />
                              <span className="text-sm font-medium text-foreground truncate max-w-[220px]">
                                {project?.title || "Unknown Project"}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <Badge variant={typeConf.variant}>{typeConf.label}</Badge>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span className="text-sm font-semibold tabular-nums text-foreground">
                              ${sale.amount.toLocaleString()}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-sm text-muted-foreground">
                            {formatDate(sale.date)}
                          </td>
                          <td className="py-3 px-3">
                            {latestMeta ? (
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-medium whitespace-nowrap",
                                  latestMeta.badgeClass
                                )}
                              >
                                <span className={cn("w-1.5 h-1.5 rounded-full", latestMeta.dotClass)} />
                                {latestMeta.label}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">-</span>
                            )}
                          </td>
                          <td className="py-3 px-3 pr-4">
                            <span
                              className="text-sm text-subtle-foreground truncate max-w-[200px] block"
                              title={sale.notes}
                            >
                              {sale.notes || "-"}
                            </span>
                          </td>
                        </tr>

                        {/* Subrow for sale stages */}
                        {isExpanded && (
                          <tr className="bg-secondary/15 dark:bg-muted/10 border-b border-border">
                            <td colSpan={7} className="p-0">
                              <div className="px-6 py-4 space-y-3 bg-secondary/10 dark:bg-muted/5 border-l-4 border-l-primary/60">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-primary" />
                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                                      Pipeline Stages ({stages.length})
                                    </h4>
                                    <span className="text-xs text-muted-foreground">
                                      &bull; Deal Value: ${sale.amount.toLocaleString()}
                                    </span>
                                  </div>
                                </div>

                                {stages.length === 0 ? (
                                  <div className="p-4 rounded border border-dashed border-border bg-background/60 text-center">
                                    <p className="text-xs text-muted-foreground">
                                      No pipeline stages recorded yet for this deal.
                                    </p>
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
                                          const picUser = st.picProfileId
                                            ? getUserById(st.picProfileId)
                                            : null;
                                          const statusMeta = stageStatusStyles[st.status] || {
                                            label: st.status,
                                            badgeClass: "border-border bg-secondary text-foreground",
                                            dotClass: "bg-muted-foreground",
                                          };
                                          return (
                                            <tr
                                              key={st.id}
                                              className="hover:bg-secondary/25 transition-colors"
                                            >
                                              <td className="py-2.5 px-3">
                                                <span
                                                  className={cn(
                                                    "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-medium",
                                                    statusMeta.badgeClass
                                                  )}
                                                >
                                                  <span
                                                    className={cn(
                                                      "w-1.5 h-1.5 rounded-full",
                                                      statusMeta.dotClass
                                                    )}
                                                  />
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
                                                      style={{
                                                        backgroundColor:
                                                          picUser.avatarColor || "var(--primary)",
                                                      }}
                                                    >
                                                      {getInitials(picUser.name)}
                                                    </span>
                                                    <span className="font-medium text-foreground">
                                                      {picUser.name}
                                                    </span>
                                                  </div>
                                                ) : (
                                                  <span className="text-muted-foreground italic">
                                                    Unassigned
                                                  </span>
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
      </div>
    </PageFrame>
  );
}
