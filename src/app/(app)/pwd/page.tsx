"use client";

import React, { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { formatDate, generateId, getInitials } from "@/lib/utils";
import {
  exportPwdsToCsv,
  generatePwdCsvTemplate,
  PWD_CSV_FIELD_SPECS,
  PWD_CSV_TEMPLATE_HEADERS,
  PWD_CSV_TEMPLATE_SAMPLE_ROWS,
  validateAndParsePwdCsv,
  type PwdCsvValidationResult,
} from "@/lib/pwd-csv";
import type { PwdRecord } from "@/lib/types";
import { Card } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accessibility,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  DollarSign,
  Download,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  Mail,
  Pencil,
  Phone,
  Plus,
  ShieldAlert,
  Sparkles,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";

interface PwdFormState {
  serialNo: string;
  name: string;
  email: string;
  mobilePhone: string;
  primaryTalent: string;
  secondaryRole: string;
  disabilityType: string;
  age: string;
  gender: string;
  standardRate: string;
  currency: string;
  accessibilityRequirements: string;
  previousCollaborations: string;
  portfolioLink: string;
  notes: string;
}

const emptyForm: PwdFormState = {
  serialNo: "",
  name: "",
  email: "",
  mobilePhone: "",
  primaryTalent: "",
  secondaryRole: "",
  disabilityType: "",
  age: "",
  gender: "",
  standardRate: "",
  currency: "SGD",
  accessibilityRequirements: "",
  previousCollaborations: "",
  portfolioLink: "",
  notes: "",
};

function recordToForm(record: PwdRecord): PwdFormState {
  return {
    serialNo: record.serialNo !== null && record.serialNo !== undefined ? String(record.serialNo) : "",
    name: record.name || "",
    email: record.email || "",
    mobilePhone: record.mobilePhone || "",
    primaryTalent: record.primaryTalent || "",
    secondaryRole: record.secondaryRole || "",
    disabilityType: record.disabilityType || "",
    age: record.age !== null && record.age !== undefined ? String(record.age) : "",
    gender: record.gender || "",
    standardRate:
      record.standardRate !== null && record.standardRate !== undefined
        ? String(record.standardRate)
        : "",
    currency: record.currency || "SGD",
    accessibilityRequirements: record.accessibilityRequirements || "",
    previousCollaborations: record.previousCollaborations || "",
    portfolioLink: record.portfolioLink || "",
    notes: record.notes || "",
  };
}

function formatGenderLabel(gender?: string | null): string | null {
  if (!gender) return null;
  const g = gender.trim().toLowerCase();
  if (g === "m" || g === "male") return "Male";
  if (g === "f" || g === "female") return "Female";
  return gender;
}

export default function PwdPage() {
  const {
    pwds,
    addPwd,
    addPwdsBulk,
    updatePwd,
    deletePwd,
    searchQuery,
    currentUserId,
    getUserById,
  } = useStore();

  const currentUser = getUserById(currentUserId);
  const isAdmin = currentUser?.role === "admin";

  const [localSearch, setLocalSearch] = useState("");
  const [sortBy, setSortBy] = useState<
    "name_asc" | "name_desc" | "serial_asc" | "rate_desc" | "recent"
  >("name_asc");

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PwdRecord | null>(null);
  const [formState, setFormState] = useState<PwdFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const [viewingRecord, setViewingRecord] = useState<PwdRecord | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<PwdRecord | null>(null);

  const [showImportModal, setShowImportModal] = useState(false);
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [importValidation, setImportValidation] =
    useState<PwdCsvValidationResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [csvNotice, setCsvNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const disabilityOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of pwds) {
      if (p.disabilityType && p.disabilityType.trim()) {
        set.add(p.disabilityType.trim());
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [pwds]);

  const metrics = useMemo(() => {
    const total = pwds.length;
    const distinctDisabilities = disabilityOptions.length;
    const reachableCount = pwds.filter(
      (p) => Boolean(p.email?.trim() || p.mobilePhone?.trim() || p.portfolioLink?.trim())
    ).length;
    const rates = pwds
      .map((p) => p.standardRate)
      .filter((r): r is number => typeof r === "number" && Number.isFinite(r));
    const avgRate = rates.length > 0 ? rates.reduce((sum, r) => sum + r, 0) / rates.length : 0;
    return { total, distinctDisabilities, reachableCount, avgRate, ratedCount: rates.length };
  }, [pwds, disabilityOptions]);

  const activeSearch = (localSearch || searchQuery).trim().toLowerCase();

  const filteredPwds = useMemo(() => {
    return pwds
      .filter((p) => {
        if (!activeSearch) return true;
        const creatorName = p.createdBy ? getUserById(p.createdBy)?.name : "";
        const updaterName = p.updatedBy ? getUserById(p.updatedBy)?.name : "";
        const haystack = [
          p.name,
          p.email,
          p.mobilePhone,
          p.primaryTalent,
          p.secondaryRole,
          p.disabilityType,
          p.accessibilityRequirements,
          p.previousCollaborations,
          p.notes,
          creatorName,
          updaterName,
          p.serialNo !== null && p.serialNo !== undefined ? String(p.serialNo) : "",
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(activeSearch);
      })
      .sort((a, b) => {
        if (sortBy === "name_asc") return a.name.localeCompare(b.name);
        if (sortBy === "name_desc") return b.name.localeCompare(a.name);
        if (sortBy === "serial_asc") {
          const sa = a.serialNo ?? Number.MAX_SAFE_INTEGER;
          const sb = b.serialNo ?? Number.MAX_SAFE_INTEGER;
          if (sa !== sb) return sa - sb;
          return a.name.localeCompare(b.name);
        }
        if (sortBy === "rate_desc") {
          return (b.standardRate ?? -1) - (a.standardRate ?? -1);
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [pwds, activeSearch, sortBy, getUserById]);

  if (!isAdmin) {
    const roleLabel = currentUser?.role
      ? currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)
      : "Guest";
    return (
      <PageFrame id="pwd-access-denied-frame">
        <PageHeader
          title="PWD Directory"
          description="Manage Persons with Disabilities (PWD) artist & talent profiles, accessibility needs, and rates."
        />
        <Card className="border border-border p-8 text-center" id="card-pwd-restricted">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h2 className="mb-2 font-heading text-xl font-bold text-foreground">
            Access Restricted
          </h2>
          <p className="mx-auto mb-6 max-w-md text-sm text-muted-foreground">
            Your current role is set to <strong>{roleLabel}</strong>. The PWD artist registry and personal contact records are restricted to Workspace Administrators.
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

  function openCreateModal() {
    setEditingRecord(null);
    setFormState(emptyForm);
    setFormError(null);
    setShowFormModal(true);
  }

  function openEditModal(record: PwdRecord) {
    setEditingRecord(record);
    setFormState(recordToForm(record));
    setFormError(null);
    setShowFormModal(true);
  }

  async function handleSaveForm() {
    const trimmedName = formState.name.trim();
    if (!trimmedName) {
      setFormError("Name is required.");
      return;
    }

    const serialNoParsed = formState.serialNo.trim()
      ? Number(formState.serialNo.trim())
      : null;
    if (
      serialNoParsed !== null &&
      (!Number.isInteger(serialNoParsed) || serialNoParsed < 0)
    ) {
      setFormError("S/N must be a valid non-negative integer.");
      return;
    }

    const ageParsed = formState.age.trim() ? Number(formState.age.trim()) : null;
    if (
      ageParsed !== null &&
      (!Number.isInteger(ageParsed) || ageParsed < 0 || ageParsed > 150)
    ) {
      setFormError("Age must be an integer between 0 and 150.");
      return;
    }

    const rateParsed = formState.standardRate.trim()
      ? Number(formState.standardRate.trim())
      : null;
    if (rateParsed !== null && (!Number.isFinite(rateParsed) || rateParsed < 0)) {
      setFormError("Standard Rate / Pay Scale must be a valid non-negative number.");
      return;
    }

    const now = new Date().toISOString();
    const payload = {
      serialNo: serialNoParsed,
      name: trimmedName,
      email: formState.email.trim() || null,
      mobilePhone: formState.mobilePhone.trim() || null,
      primaryTalent: formState.primaryTalent.trim() || null,
      secondaryRole: formState.secondaryRole.trim() || null,
      disabilityType: formState.disabilityType.trim() || null,
      age: ageParsed,
      gender: formState.gender.trim() || null,
      standardRate: rateParsed,
      currency: formState.currency.trim().toUpperCase() || "SGD",
      accessibilityRequirements: formState.accessibilityRequirements.trim() || null,
      previousCollaborations: formState.previousCollaborations.trim() || null,
      portfolioLink: formState.portfolioLink.trim() || null,
      notes: formState.notes.trim() || null,
      updatedAt: now,
      updatedBy: currentUserId ?? null,
    };

    if (editingRecord) {
      updatePwd(editingRecord.id, payload);
    } else {
      const newRecord: PwdRecord = {
        id: generateId(),
        ...payload,
        createdAt: now,
        createdBy: currentUserId ?? null,
      };
      await addPwd(newRecord);
    }

    setShowFormModal(false);
    setEditingRecord(null);
    setFormError(null);
  }

  function handleConfirmDelete() {
    if (!deletingRecord) return;
    deletePwd(deletingRecord.id);
    if (viewingRecord?.id === deletingRecord.id) {
      setViewingRecord(null);
    }
    setDeletingRecord(null);
  }

  function triggerCsvDownload(csvContent: string, fileName: string) {
    const blob = new Blob([`\uFEFF${csvContent}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function handleDownloadTemplate() {
    const templateCsv = generatePwdCsvTemplate();
    triggerCsvDownload(templateCsv, "pwd-import-template.csv");
    setCsvNotice("Downloaded CSV import template (pwd-import-template.csv).");
  }

  function handleExportCsv() {
    const csv = exportPwdsToCsv(filteredPwds);
    const dateStamp = new Date().toISOString().slice(0, 10);
    triggerCsvDownload(csv, `pwd-directory-${dateStamp}.csv`);
    setCsvNotice(`Exported ${filteredPwds.length} PWD record(s) to CSV.`);
  }

  function openImportModal() {
    setImportFileName(null);
    setImportValidation(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setShowImportModal(true);
  }

  async function handleImportFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    try {
      const text = await file.text();
      const result = validateAndParsePwdCsv(text, currentUserId, file.name);
      setImportValidation(result);
    } catch {
      setImportValidation({
        valid: false,
        records: [],
        errors: [
          {
            message: `Could not read "${file.name}". Please ensure it is a valid UTF-8 .csv file.`,
          },
        ],
        warnings: [],
        detectedFormat: "Unreadable file",
        totalDataRows: 0,
      });
    }
  }

  async function handleConfirmImportCsv() {
    if (!importValidation?.valid || importValidation.records.length === 0) return;
    setIsImporting(true);
    try {
      await addPwdsBulk(importValidation.records);
      setCsvNotice(
        `Imported ${importValidation.records.length} PWD record(s) from "${importFileName}".`
      );
      setShowImportModal(false);
      setImportFileName(null);
      setImportValidation(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <PageFrame id="pwd-page-frame">
      <PageHeader
        title="PWD Directory"
        description="Registry of Persons with Disabilities (PWD) artists, talents, accessibility needs, and engagement rates."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              id="btn-download-pwd-template"
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              className="flex items-center gap-1.5"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>CSV Template</span>
            </Button>
            <Button
              id="btn-import-pwd-csv"
              variant="outline"
              size="sm"
              onClick={openImportModal}
              className="flex items-center gap-1.5"
            >
              <Upload className="h-4 w-4" />
              <span>Import CSV</span>
            </Button>
            <Button
              id="btn-export-pwd-csv"
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={filteredPwds.length === 0}
              className="flex items-center gap-1.5"
            >
              <Download className="h-4 w-4" />
              <span>Export CSV</span>
            </Button>
            <Button
              id="btn-add-pwd"
              size="sm"
              onClick={openCreateModal}
              className="flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" />
              <span>Add PWD</span>
            </Button>
          </div>
        }
      />

      {csvNotice && (
        <div
          id="banner-pwd-csv-notice"
          className="flex items-center justify-between gap-3 border border-border bg-secondary/40 px-4 py-2.5 text-sm text-foreground"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
            <span>{csvNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setCsvNotice(null)}
            aria-label="Dismiss notice"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Summary Metrics */}
      <SheetSummary id="pwd-summary-metrics">
        <SummaryMetric
          id="metric-total-pwds"
          label="Total PWD"
          value={metrics.total}
          indicator={
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Accessibility className="h-3.5 w-3.5" />
              <span>Registered talents</span>
            </span>
          }
        />
        <SummaryMetric
          id="metric-disability-types"
          label="Disabilities"
          value={metrics.distinctDisabilities}
          indicator={
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Distinct types</span>
            </span>
          }
        />
        <SummaryMetric
          id="metric-reachable-pwds"
          label="Contact / Portfolio"
          value={metrics.reachableCount}
          indicator={
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              <span>With links or contact</span>
            </span>
          }
        />
        <SummaryMetric
          id="metric-avg-pwd-rate"
          label="Avg Rate"
          value={`$${Math.round(metrics.avgRate).toLocaleString()}`}
          indicator={
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <DollarSign className="h-3.5 w-3.5" />
              <span>{metrics.ratedCount} rated</span>
            </span>
          }
        />
      </SheetSummary>

      {/* Toolbar: Search and Sort */}
      <Toolbar className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex-1 max-w-md">
          <Input
            id="input-search-pwds"
            placeholder="Search by name, talent, disability, phone, or notes..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap text-xs text-muted-foreground">Sort:</span>
          <Select
            id="select-sort-pwds"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="w-[170px]"
          >
            <option value="name_asc">Name (A–Z)</option>
            <option value="name_desc">Name (Z–A)</option>
            <option value="serial_asc">S/N (Ascending)</option>
            <option value="rate_desc">Rate (High–Low)</option>
            <option value="recent">Recently Added</option>
          </Select>
        </div>
      </Toolbar>

      {/* Desktop Table */}
      <Card id="card-pwd-table" className="hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left" id="table-pwds">
            <thead>
              <tr className="border-b border-border text-xs font-medium uppercase tracking-wider text-subtle-foreground">
                <th className="w-16 py-3 px-4">S/N</th>
                <th className="py-3 px-4">Artist / Name</th>
                <th className="py-3 px-4">Disability</th>
                <th className="py-3 px-4">Primary Talent / Role</th>
                <th className="py-3 px-4 text-right">Rate / Pay Scale</th>
                <th className="py-3 px-4">Contact &amp; Portfolio</th>
                <th className="py-3 px-4">Created By</th>
                <th className="py-3 px-4">Updated By</th>
                <th className="w-32 py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPwds.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted-foreground">
                    <Accessibility className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                    <p className="text-sm font-medium">No PWD records found</p>
                    <p className="mt-1 text-xs text-subtle-foreground">
                      {activeSearch
                        ? `No PWD record matches "${activeSearch}".`
                        : 'Click "Add PWD" to create a new record.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredPwds.map((record) => {
                  const genderLabel = formatGenderLabel(record.gender);
                  const demoParts = [
                    record.age !== null && record.age !== undefined ? `Age ${record.age}` : null,
                    genderLabel,
                  ].filter(Boolean);
                  const creator = getUserById(record.createdBy ?? null);
                  const updater = getUserById(record.updatedBy ?? null);

                  return (
                    <tr
                      key={record.id}
                      id={`pwd-row-${record.id}`}
                      className="border-b border-border/50 transition-colors hover:bg-secondary/40"
                    >
                      <td className="py-3 px-4 font-mono text-xs text-muted-foreground">
                        {record.serialNo !== null && record.serialNo !== undefined
                          ? record.serialNo
                          : "—"}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-primary/10 text-xs font-semibold text-primary">
                            {getInitials(record.name)}
                          </div>
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => setViewingRecord(record)}
                              className="block truncate text-left text-sm font-semibold text-foreground transition-colors hover:text-primary"
                            >
                              {record.name}
                            </button>
                            {demoParts.length > 0 && (
                              <span className="text-xs text-muted-foreground">
                                {demoParts.join(" · ")}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {record.disabilityType ? (
                          <Badge variant="neutral">{record.disabilityType}</Badge>
                        ) : (
                          <span className="text-xs text-subtle-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="max-w-[260px]">
                          <p className="truncate text-sm text-foreground">
                            {record.primaryTalent || "—"}
                          </p>
                          {record.secondaryRole && (
                            <p className="truncate text-xs text-muted-foreground">
                              Role 2: {record.secondaryRole}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right tabular">
                        {record.standardRate !== null && record.standardRate !== undefined ? (
                          <span className="text-sm font-semibold text-foreground">
                            {record.currency || "SGD"}{" "}
                            {Number(record.standardRate).toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-xs text-subtle-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                          {record.email && (
                            <span className="flex items-center gap-1 truncate max-w-[180px]">
                              <Mail className="h-3 w-3 shrink-0" />
                              <span className="truncate">{record.email}</span>
                            </span>
                          )}
                          {record.mobilePhone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3 shrink-0" />
                              <span>{record.mobilePhone}</span>
                            </span>
                          )}
                          {record.portfolioLink && (
                            <a
                              href={record.portfolioLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                            >
                              <ExternalLink className="h-3 w-3 shrink-0" />
                              <span>Portfolio</span>
                            </a>
                          )}
                          {!record.email && !record.mobilePhone && !record.portfolioLink && (
                            <span className="text-subtle-foreground">—</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">
                        <div className="font-medium text-foreground truncate max-w-[140px]">
                          {creator ? creator.name : "—"}
                        </div>
                        <div className="text-[11px] text-subtle-foreground">
                          {formatDate(record.createdAt)}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">
                        <div className="font-medium text-foreground truncate max-w-[140px]">
                          {updater ? updater.name : "—"}
                        </div>
                        <div className="text-[11px] text-subtle-foreground">
                          {formatDate(record.updatedAt)}
                        </div>
                      </td>
                      <td className="py-2 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            aria-label={`View ${record.name}`}
                            onClick={() => setViewingRecord(record)}
                            title="View Details"
                            className="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Edit ${record.name}`}
                            onClick={() => openEditModal(record)}
                            title="Edit Record"
                            className="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete ${record.name}`}
                            onClick={() => setDeletingRecord(record)}
                            title="Delete Record"
                            className="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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

      {/* Mobile Cards */}
      <div className="space-y-3 md:hidden">
        {filteredPwds.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            <Accessibility className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm font-medium">No PWD records found</p>
          </Card>
        ) : (
          filteredPwds.map((record) => {
            const creator = getUserById(record.createdBy ?? null);
            const updater = getUserById(record.updatedBy ?? null);
            return (
              <Card key={record.id} className="p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {record.serialNo !== null && record.serialNo !== undefined && (
                        <span className="font-mono text-xs text-muted-foreground">
                          #{record.serialNo}
                        </span>
                      )}
                      <h3 className="truncate text-sm font-semibold text-foreground">
                        {record.name}
                      </h3>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {record.primaryTalent || "No primary talent listed"}
                    </p>
                  </div>
                  {record.standardRate !== null && record.standardRate !== undefined && (
                    <span className="shrink-0 text-sm font-semibold tabular text-foreground">
                      {record.currency || "SGD"} {Number(record.standardRate).toLocaleString()}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {record.disabilityType && <Badge variant="neutral">{record.disabilityType}</Badge>}
                  {record.secondaryRole && <Badge variant="outline">{record.secondaryRole}</Badge>}
                  {record.portfolioLink && (
                    <a
                      href={record.portfolioLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span>Portfolio</span>
                    </a>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                  <div className="truncate">
                    Created by: <span className="font-medium text-foreground">{creator?.name || "—"}</span>
                  </div>
                  <div className="truncate text-right">
                    Updated by: <span className="font-medium text-foreground">{updater?.name || "—"}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-border pt-2">
                  <Button variant="outline" size="sm" onClick={() => setViewingRecord(record)}>
                    View
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openEditModal(record)}>
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeletingRecord(record)}
                  >
                    Delete
                  </Button>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* View Detail Dialog */}
      <Dialog
        open={viewingRecord !== null}
        onOpenChange={(open) => {
          if (!open) setViewingRecord(null);
        }}
      >
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewingRecord?.name}</DialogTitle>
            <DialogDescription>
              Full PWD artist &amp; talent profile details.
            </DialogDescription>
          </DialogHeader>
          {viewingRecord && (
            <div className="space-y-4 pt-2 text-sm">
              <div className="grid grid-cols-2 gap-3 border border-border bg-secondary/30 p-3">
                <div>
                  <span className="block text-[11px] uppercase tracking-wider text-subtle-foreground">
                    Disability Type
                  </span>
                  <span className="font-medium text-foreground">
                    {viewingRecord.disabilityType || "—"}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] uppercase tracking-wider text-subtle-foreground">
                    Standard Rate / Pay Scale
                  </span>
                  <span className="font-medium tabular text-foreground">
                    {viewingRecord.standardRate !== null &&
                    viewingRecord.standardRate !== undefined
                      ? `${viewingRecord.currency || "SGD"} ${Number(
                          viewingRecord.standardRate
                        ).toLocaleString()}`
                      : "—"}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] uppercase tracking-wider text-subtle-foreground">
                    S/N
                  </span>
                  <span className="font-mono text-foreground">
                    {viewingRecord.serialNo ?? "—"}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] uppercase tracking-wider text-subtle-foreground">
                    Age / Gender
                  </span>
                  <span className="text-foreground">
                    {[
                      viewingRecord.age !== null && viewingRecord.age !== undefined
                        ? `Age ${viewingRecord.age}`
                        : null,
                      formatGenderLabel(viewingRecord.gender),
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </span>
                </div>
              </div>

              <div className="space-y-2.5">
                <div>
                  <span className="block text-xs font-medium uppercase tracking-wider text-subtle-foreground">
                    Primary Talent / Art Form (Role)
                  </span>
                  <p className="mt-0.5 text-foreground">{viewingRecord.primaryTalent || "—"}</p>
                </div>
                {viewingRecord.secondaryRole && (
                  <div>
                    <span className="block text-xs font-medium uppercase tracking-wider text-subtle-foreground">
                      Secondary Role (Role 2)
                    </span>
                    <p className="mt-0.5 text-foreground">{viewingRecord.secondaryRole}</p>
                  </div>
                )}
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div>
                    <span className="block text-xs font-medium uppercase tracking-wider text-subtle-foreground">
                      Email
                    </span>
                    <p className="mt-0.5 text-foreground">{viewingRecord.email || "—"}</p>
                  </div>
                  <div>
                    <span className="block text-xs font-medium uppercase tracking-wider text-subtle-foreground">
                      Mobile Telephone
                    </span>
                    <p className="mt-0.5 text-foreground">{viewingRecord.mobilePhone || "—"}</p>
                  </div>
                </div>
                <div>
                  <span className="block text-xs font-medium uppercase tracking-wider text-subtle-foreground">
                    Accessibility Requirements
                  </span>
                  <p className="mt-0.5 whitespace-pre-wrap text-foreground">
                    {viewingRecord.accessibilityRequirements || "—"}
                  </p>
                </div>
                <div>
                  <span className="block text-xs font-medium uppercase tracking-wider text-subtle-foreground">
                    Previous Collaborations
                  </span>
                  <p className="mt-0.5 whitespace-pre-wrap text-foreground">
                    {viewingRecord.previousCollaborations || "—"}
                  </p>
                </div>
                <div>
                  <span className="block text-xs font-medium uppercase tracking-wider text-subtle-foreground">
                    Portfolio Link
                  </span>
                  {viewingRecord.portfolioLink ? (
                    <a
                      href={viewingRecord.portfolioLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 inline-flex items-center gap-1.5 text-primary hover:underline break-all"
                    >
                      <span>{viewingRecord.portfolioLink}</span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    </a>
                  ) : (
                    <p className="mt-0.5 text-foreground">—</p>
                  )}
                </div>
                {viewingRecord.notes && (
                  <div>
                    <span className="block text-xs font-medium uppercase tracking-wider text-subtle-foreground">
                      Notes
                    </span>
                    <p className="mt-0.5 whitespace-pre-wrap text-foreground">
                      {viewingRecord.notes}
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-2.5 border-t border-border pt-3 sm:grid-cols-2">
                <div>
                  <span className="block text-xs font-medium uppercase tracking-wider text-subtle-foreground">
                    Created By
                  </span>
                  <p className="mt-0.5 text-foreground">
                    {getUserById(viewingRecord.createdBy ?? null)?.name || "—"}
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      ({formatDate(viewingRecord.createdAt)})
                    </span>
                  </p>
                </div>
                <div>
                  <span className="block text-xs font-medium uppercase tracking-wider text-subtle-foreground">
                    Updated By
                  </span>
                  <p className="mt-0.5 text-foreground">
                    {getUserById(viewingRecord.updatedBy ?? null)?.name || "—"}
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      ({formatDate(viewingRecord.updatedAt)})
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const rec = viewingRecord;
                    setViewingRecord(null);
                    openEditModal(rec);
                  }}
                >
                  Edit Record
                </Button>
                <Button size="sm" onClick={() => setViewingRecord(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create / Edit Dialog */}
      <Dialog
        open={showFormModal}
        onOpenChange={(open) => {
          if (!open) {
            setShowFormModal(false);
            setEditingRecord(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRecord ? "Edit PWD Record" : "Add PWD Record"}</DialogTitle>
            <DialogDescription>
              Unified profile fields supporting CO3 Artists Database and ELI Grant List records.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-subtle-foreground">
                  Artist / Full Name *
                </label>
                <Input
                  id="input-pwd-name"
                  placeholder="e.g., Jackie Chionh"
                  value={formState.name}
                  onChange={(e) => {
                    setFormState((s) => ({ ...s, name: e.target.value }));
                    setFormError(null);
                  }}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-subtle-foreground">
                  S/N
                </label>
                <Input
                  id="input-pwd-serial"
                  type="number"
                  min={0}
                  placeholder="e.g., 1"
                  value={formState.serialNo}
                  onChange={(e) =>
                    setFormState((s) => ({ ...s, serialNo: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-subtle-foreground">
                  Type of Disability
                </label>
                <Input
                  id="input-pwd-disability"
                  placeholder="e.g., Autism, Partial use of body"
                  value={formState.disabilityType}
                  onChange={(e) =>
                    setFormState((s) => ({ ...s, disabilityType: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-subtle-foreground">
                  Age
                </label>
                <Input
                  id="input-pwd-age"
                  type="number"
                  min={0}
                  max={150}
                  placeholder="e.g., 36"
                  value={formState.age}
                  onChange={(e) => setFormState((s) => ({ ...s, age: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-subtle-foreground">
                  Gender
                </label>
                <Select
                  id="input-pwd-gender"
                  value={formState.gender}
                  onChange={(e) =>
                    setFormState((s) => ({ ...s, gender: e.target.value }))
                  }
                >
                  <option value="">Unspecified</option>
                  <option value="m">Male (m)</option>
                  <option value="f">Female (f)</option>
                  <option value="non-binary">Non-binary</option>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-subtle-foreground">
                  Primary Talent / Art Form (Role)
                </label>
                <Input
                  id="input-pwd-talent"
                  placeholder="e.g., Quilling & Paper Jewelry"
                  value={formState.primaryTalent}
                  onChange={(e) =>
                    setFormState((s) => ({ ...s, primaryTalent: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-subtle-foreground">
                  Secondary Role (Role 2)
                </label>
                <Input
                  id="input-pwd-secondary-role"
                  placeholder="e.g., DMS"
                  value={formState.secondaryRole}
                  onChange={(e) =>
                    setFormState((s) => ({ ...s, secondaryRole: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-subtle-foreground">
                  Standard Rate / Pay Scale
                </label>
                <Input
                  id="input-pwd-rate"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="e.g., 200 or 1500"
                  value={formState.standardRate}
                  onChange={(e) =>
                    setFormState((s) => ({ ...s, standardRate: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-subtle-foreground">
                  Currency
                </label>
                <Select
                  id="input-pwd-currency"
                  value={formState.currency}
                  onChange={(e) =>
                    setFormState((s) => ({ ...s, currency: e.target.value }))
                  }
                >
                  <option value="SGD">SGD</option>
                  <option value="USD">USD</option>
                  <option value="MYR">MYR</option>
                  <option value="EUR">EUR</option>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-subtle-foreground">
                  Email
                </label>
                <Input
                  id="input-pwd-email"
                  type="email"
                  placeholder="artist@example.com"
                  value={formState.email}
                  onChange={(e) => setFormState((s) => ({ ...s, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-subtle-foreground">
                  Mobile Telephone
                </label>
                <Input
                  id="input-pwd-phone"
                  placeholder="+65 9123 4567"
                  value={formState.mobilePhone}
                  onChange={(e) =>
                    setFormState((s) => ({ ...s, mobilePhone: e.target.value }))
                  }
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-subtle-foreground">
                Portfolio Link
              </label>
              <Input
                id="input-pwd-portfolio"
                type="url"
                placeholder="https://www.artforgood.sg/featured-artists"
                value={formState.portfolioLink}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, portfolioLink: e.target.value }))
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-subtle-foreground">
                Accessibility Requirements
              </label>
              <Textarea
                id="input-pwd-accessibility"
                rows={2}
                placeholder="e.g., Wheelchair ramp access, quiet prep room, sign language interpreter..."
                value={formState.accessibilityRequirements}
                onChange={(e) =>
                  setFormState((s) => ({
                    ...s,
                    accessibilityRequirements: e.target.value,
                  }))
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-subtle-foreground">
                Previous Collaborations
              </label>
              <Textarea
                id="input-pwd-collaborations"
                rows={2}
                placeholder="Past performances, exhibitions, commissions, or partners..."
                value={formState.previousCollaborations}
                onChange={(e) =>
                  setFormState((s) => ({
                    ...s,
                    previousCollaborations: e.target.value,
                  }))
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-subtle-foreground">
                Notes
              </label>
              <Textarea
                id="input-pwd-notes"
                rows={2}
                placeholder="Additional grant or coordination notes..."
                value={formState.notes}
                onChange={(e) => setFormState((s) => ({ ...s, notes: e.target.value }))}
              />
            </div>

            {formError && <p className="text-xs text-destructive">{formError}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowFormModal(false);
                  setEditingRecord(null);
                }}
              >
                Cancel
              </Button>
              <Button
                id="btn-save-pwd"
                onClick={handleSaveForm}
                disabled={!formState.name.trim()}
              >
                {editingRecord ? "Save Changes" : "Create PWD Record"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deletingRecord !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingRecord(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete PWD Record</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove &quot;{deletingRecord?.name}&quot; from the PWD directory?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setDeletingRecord(null)}>
              Cancel
            </Button>
            <Button
              id="btn-confirm-delete-pwd"
              variant="destructive"
              onClick={handleConfirmDelete}
            >
              Delete Record
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import CSV Dialog with Template & Strict Validation */}
      <Dialog
        open={showImportModal}
        onOpenChange={(open) => {
          if (!open) {
            setShowImportModal(false);
          }
        }}
      >
        <DialogContent
          id="dialog-import-pwd-csv"
          className="sm:max-w-3xl max-h-[90vh] overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle>Import PWD Directory CSV</DialogTitle>
            <DialogDescription>
              Upload a comma-separated (.csv) file matching the template below. All imported records are automatically audited with your user profile under Created By and Updated By.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2 text-sm">
            {/* Mandatory Fields & Format Summary */}
            <div className="border border-border bg-secondary/30 p-3.5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  CSV Template &amp; Mandatory Fields
                </span>
                <Button
                  id="btn-download-pwd-template-modal"
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download CSV Template (.csv)</span>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">Mandatory column:</strong>{" "}
                <code className="bg-secondary px-1 py-0.5 text-foreground">Artist Name</code>{" "}
                (or <code className="bg-secondary px-1 py-0.5 text-foreground">Name</code> /{" "}
                <code className="bg-secondary px-1 py-0.5 text-foreground">Full Name</code>) must be present and non-empty on every data row. All other columns are optional and validated for format if filled. Also supports CO3 Artists Database and ELI Grant List CSVs.
              </p>

              {/* Column Specification Table */}
              <div className="max-h-48 overflow-auto border border-border bg-background">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 border-b border-border bg-secondary/60 text-[11px] uppercase tracking-wider text-subtle-foreground">
                    <tr>
                      <th className="py-1.5 px-2.5">Column Header</th>
                      <th className="py-1.5 px-2.5">Requirement</th>
                      <th className="py-1.5 px-2.5">Accepted Format</th>
                      <th className="py-1.5 px-2.5">Example Row</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PWD_CSV_FIELD_SPECS.map((spec) => (
                      <tr key={spec.header} className="border-b border-border/50 last:border-b-0">
                        <td className="py-1.5 px-2.5 font-medium text-foreground whitespace-nowrap">
                          {spec.header}
                        </td>
                        <td className="py-1.5 px-2.5 whitespace-nowrap">
                          {spec.required ? (
                            <Badge variant="accent">Mandatory</Badge>
                          ) : (
                            <Badge variant="neutral">Optional</Badge>
                          )}
                        </td>
                        <td className="py-1.5 px-2.5 text-muted-foreground">{spec.format}</td>
                        <td className="py-1.5 px-2.5 font-mono text-[11px] text-muted-foreground">
                          {spec.example}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Sample CSV Row Preview */}
              <div className="space-y-1">
                <span className="block text-[11px] font-medium uppercase tracking-wider text-subtle-foreground">
                  Template Sample (Columns &amp; Rows)
                </span>
                <div className="overflow-x-auto border border-border bg-background">
                  <table className="w-full text-left text-[11px]">
                    <thead>
                      <tr className="border-b border-border bg-secondary/40 text-subtle-foreground">
                        {PWD_CSV_TEMPLATE_HEADERS.map((col) => (
                          <th key={col} className="whitespace-nowrap py-1 px-2 font-medium">
                            {col}
                            {col === "Artist Name" ? " *" : ""}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {PWD_CSV_TEMPLATE_SAMPLE_ROWS.map((row, idx) => (
                        <tr key={idx} className="border-b border-border/40 last:border-b-0">
                          {PWD_CSV_TEMPLATE_HEADERS.map((col) => (
                            <td
                              key={col}
                              className="whitespace-nowrap py-1 px-2 font-mono text-muted-foreground"
                            >
                              {row[col] || "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* File Picker */}
            <div className="space-y-2">
              <label
                htmlFor="input-import-pwd-csv-file"
                className="block text-xs font-medium uppercase tracking-wider text-subtle-foreground"
              >
                Select CSV File to Validate &amp; Import
              </label>
              <div className="flex flex-wrap items-center gap-3 border border-dashed border-border p-4 bg-secondary/10">
                <input
                  id="input-import-pwd-csv-file"
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleImportFileChange}
                  className="block w-full text-xs text-muted-foreground file:mr-3 file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground hover:file:bg-secondary cursor-pointer"
                />
              </div>
            </div>

            {/* Validation Results */}
            {importValidation && !importValidation.valid && (
              <div
                id="pwd-csv-validation-errors"
                className="border border-destructive/50 bg-destructive/10 p-3.5 space-y-2"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>
                    CSV Validation Failed ({importValidation.errors.length}{" "}
                    {importValidation.errors.length === 1 ? "issue" : "issues"} found)
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Fix the errors below in your CSV file or download the CSV template and re-upload.
                </p>
                <ul className="max-h-40 overflow-y-auto space-y-1 pl-5 list-disc text-xs text-destructive">
                  {importValidation.errors.map((err, idx) => (
                    <li key={idx}>{err.message}</li>
                  ))}
                </ul>
              </div>
            )}

            {importValidation && importValidation.valid && (
              <div
                id="pwd-csv-validation-success"
                className="border border-primary/40 bg-primary/5 p-3.5 space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                    <span>
                      Ready to import {importValidation.records.length} valid PWD{" "}
                      {importValidation.records.length === 1 ? "record" : "records"}
                    </span>
                  </div>
                  <Badge variant="neutral">{importValidation.detectedFormat}</Badge>
                </div>

                <div className="max-h-40 overflow-auto border border-border bg-background">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-border bg-secondary/40 text-[11px] uppercase tracking-wider text-subtle-foreground">
                      <tr>
                        <th className="py-1.5 px-2.5">S/N</th>
                        <th className="py-1.5 px-2.5">Artist Name</th>
                        <th className="py-1.5 px-2.5">Disability</th>
                        <th className="py-1.5 px-2.5">Primary Talent</th>
                        <th className="py-1.5 px-2.5 text-right">Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importValidation.records.slice(0, 5).map((rec, idx) => (
                        <tr key={idx} className="border-b border-border/50 last:border-b-0">
                          <td className="py-1.5 px-2.5 font-mono text-muted-foreground">
                            {rec.serialNo ?? "—"}
                          </td>
                          <td className="py-1.5 px-2.5 font-medium text-foreground">
                            {rec.name}
                          </td>
                          <td className="py-1.5 px-2.5 text-muted-foreground">
                            {rec.disabilityType || "—"}
                          </td>
                          <td className="py-1.5 px-2.5 text-muted-foreground truncate max-w-[200px]">
                            {rec.primaryTalent || "—"}
                          </td>
                          <td className="py-1.5 px-2.5 text-right tabular text-foreground">
                            {rec.standardRate !== null && rec.standardRate !== undefined
                              ? `${rec.currency} ${rec.standardRate.toLocaleString()}`
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {importValidation.records.length > 5 && (
                    <p className="px-2.5 py-1.5 text-[11px] text-muted-foreground border-t border-border">
                      Showing first 5 of {importValidation.records.length} validated records.
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowImportModal(false)}
              >
                Cancel
              </Button>
              <Button
                id="btn-confirm-import-pwd-csv"
                type="button"
                disabled={
                  !importValidation?.valid ||
                  importValidation.records.length === 0 ||
                  isImporting
                }
                onClick={handleConfirmImportCsv}
              >
                {isImporting
                  ? "Importing..."
                  : importValidation?.valid
                    ? `Import ${importValidation.records.length} Record${
                        importValidation.records.length === 1 ? "" : "s"
                      }`
                    : "Import Records"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageFrame>
  );
}
