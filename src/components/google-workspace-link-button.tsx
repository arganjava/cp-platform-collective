"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useStore } from "@/lib/store";
import { useSearchParams, useRouter } from "next/navigation";
import { buildGoogleOAuthUrl, parseGoogleClientSecretJson } from "@/lib/google-oauth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Calendar,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Mail,
  Check,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Unlink,
} from "lucide-react";

export function GoogleWorkspaceLinkButton() {
  const { currentUserId, getUserById } = useStore();
  const currentUser = getUserById(currentUserId);
  const searchParams = useSearchParams();
  const router = useRouter();

  const [isLinked, setIsLinked] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const googleOAuth = currentUser?.googleOAuth as Record<string, unknown> | null | undefined;
  const hasConfig = Boolean(googleOAuth && Object.keys(googleOAuth).length > 0);

  const checkTokenStatus = useCallback(async () => {
    if (!currentUser?.id || !hasConfig) {
      setIsLinked(false);
      return;
    }
    try {
      const res = await fetch(`/api/auth/google/status?profile_id=${encodeURIComponent(currentUser.id)}`);
      if (res.ok) {
        const data = await res.json();
        setIsLinked(Boolean(data.linked && data.hasRefreshToken));
      }
    } catch {
      // ignore status check failure
    }
  }, [currentUser?.id, hasConfig]);

  useEffect(() => {
    checkTokenStatus();
  }, [checkTokenStatus]);

  // Handle URL callback feedback
  useEffect(() => {
    const linkedStatus = searchParams?.get("google_linked");
    const errorParam = searchParams?.get("error");
    if (linkedStatus === "success") {
      setFeedback({
        type: "success",
        message: "Google Workspace successfully linked! Permissions approved for Calendar, Sheets, Docs, and Drive.",
      });
      setIsLinked(true);
      // Clean up URL parameter cleanly
      const url = new URL(window.location.href);
      url.searchParams.delete("google_linked");
      url.searchParams.delete("profile_id");
      window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
    } else if (linkedStatus === "error") {
      setFeedback({
        type: "error",
        message: errorParam || "Failed to link Google Workspace. Please verify your redirect URI in Google Cloud Console.",
      });
      const url = new URL(window.location.href);
      url.searchParams.delete("google_linked");
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
    }
  }, [searchParams]);

  if (!hasConfig || !currentUser) {
    return null;
  }

  const parsed = parseGoogleClientSecretJson(googleOAuth);
  const clientId = parsed.config?.client_id || "";

  function handleStartOAuth() {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      const { url } = buildGoogleOAuthUrl({
        profileId: currentUser.id,
        googleOAuth: googleOAuth as Record<string, unknown>,
        returnUrl: window.location.href,
      });
      // Redirect to Google OAuth consent
      window.location.href = url;
    } catch (err) {
      setIsLoading(false);
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to initiate Google OAuth",
      });
    }
  }

  async function handleUnlink() {
    if (!currentUser?.id) return;
    if (!confirm("Are you sure you want to disconnect Google Workspace?")) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/auth/google/status?profile_id=${encodeURIComponent(currentUser.id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setIsLinked(false);
        setFeedback({
          type: "success",
          message: "Google Workspace disconnected successfully.",
        });
        setModalOpen(false);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      {/* Toast / Banner if there is recent feedback */}
      {feedback && (
        <div
          role="alert"
          className={`fixed bottom-4 right-4 z-50 flex max-w-md items-center justify-between gap-3 border p-3.5 text-xs shadow-lg ${
            feedback.type === "success"
              ? "border-emerald-500/40 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-200"
              : "border-destructive/40 bg-destructive/10 text-destructive"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header Button */}
      {isLinked ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setModalOpen(true)}
          className="h-9 gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-xs font-semibold text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
          title="Google Workspace is connected. Click to view permissions or re-authenticate."
        >
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          <span className="hidden sm:inline">Linked to Google Workspace</span>
          <span className="sm:hidden">Google Linked</span>
          <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          onClick={() => setModalOpen(true)}
          className="h-9 gap-1.5 bg-primary text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-90"
          id="btn-link-google-workspace"
        >
          <FolderOpen className="h-3.5 w-3.5" />
          <span>Link to google workspace</span>
        </Button>
      )}

      {/* Confirmation & Scopes Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-5 w-5 text-brand" />
              <span>Google Workspace Authorization</span>
            </DialogTitle>
            <DialogDescription>
              Authorize CP Platform to access Google Workspace resources using your uploaded OAuth credentials.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2 text-xs">
            {/* Detected Client Info */}
            <div className="rounded-md border border-border bg-secondary/40 p-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">OAuth Client ID</span>
                <Badge variant={parsed.valid ? "positive" : "danger"} className="text-[10px]">
                  {parsed.valid ? "Valid JSON" : "Invalid JSON"}
                </Badge>
              </div>
              <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{clientId || "Unknown Client ID"}</p>
              {parsed.config?.project_id && (
                <p className="mt-0.5 text-[11px] text-subtle-foreground">Project: {parsed.config.project_id}</p>
              )}
            </div>

            {/* Approved Workspace Applications */}
            <div>
              <p className="mb-2 font-semibold uppercase tracking-wider text-subtle-foreground">
                Google Workspace Applications to Approve
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="flex items-start gap-2.5 rounded border border-border bg-card p-2.5">
                  <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                  <div>
                    <span className="font-semibold text-foreground">Google Calendar</span>
                    <p className="text-[11px] text-muted-foreground">Sync check dates, deadlines & meeting invites</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 rounded border border-border bg-card p-2.5">
                  <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <span className="font-semibold text-foreground">Google Sheets</span>
                    <p className="text-[11px] text-muted-foreground">Export budgets, pipelines & project metrics</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 rounded border border-border bg-card p-2.5">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                  <div>
                    <span className="font-semibold text-foreground">Google Docs</span>
                    <p className="text-[11px] text-muted-foreground">Read and write project briefs & artist notes</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 rounded border border-border bg-card p-2.5">
                  <FolderOpen className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <div>
                    <span className="font-semibold text-foreground">Google Drive</span>
                    <p className="text-[11px] text-muted-foreground">Access deliverables, media files & attachments</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Redirect URI hint */}
            <div className="rounded border border-border/80 bg-secondary/30 p-2.5 text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground">Important Callback Setup:</span> Ensure your Google Cloud Console OAuth Client has the redirect URI authorized:
              <div className="mt-1 flex flex-col gap-1 font-mono text-[10px] text-foreground">
                <code className="break-all rounded bg-background px-1.5 py-0.5 border border-border">
                  {typeof window !== "undefined"
                    ? `${window.location.origin}/api/auth/google/callback`
                    : "http://localhost:3000/api/auth/google/callback"}
                </code>
                {process.env.NEXT_PUBLIC_SUPABASE_URL && (
                  <code className="break-all rounded bg-background px-1.5 py-0.5 border border-border">
                    {`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/google-oauth-callback`}
                  </code>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-border">
              {isLinked ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleUnlink}
                  disabled={isLoading}
                  className="gap-1 text-destructive hover:bg-destructive/10"
                >
                  <Unlink className="h-3.5 w-3.5" />
                  <span>Disconnect</span>
                </Button>
              ) : (
                <Button type="button" variant="ghost" size="sm" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
              )}

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={handleStartOAuth}
                  disabled={isLoading || !parsed.valid}
                  className="gap-1.5 font-semibold"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Connecting…</span>
                    </>
                  ) : (
                    <>
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>{isLinked ? "Re-authorize Google Workspace" : "Approve & Link to Google"}</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
