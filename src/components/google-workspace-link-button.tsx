"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useStore } from "@/lib/store";
import { useSearchParams } from "next/navigation";
import { buildGoogleOAuthUrl, parseGoogleClientSecretJson } from "@/lib/google-oauth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Check,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Unlink,
  Laptop,
  Globe,
  Copy,
  CheckCircle2,
  KeyRound,
} from "lucide-react";

export function GoogleWorkspaceLinkButton() {
  const { currentUserId, getUserById } = useStore();
  const currentUser = getUserById(currentUserId);
  const searchParams = useSearchParams();

  const [isLinked, setIsLinked] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Manual code input for desktop app flow
  const [manualCodeInput, setManualCodeInput] = useState<string>("");
  const [isExchangingCode, setIsExchangingCode] = useState<boolean>(false);
  const [exchangeError, setExchangeError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);

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
  const isDesktop = Boolean(parsed.isDesktop);
  const isLocalhost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

  function getOAuthUrl(customRedirect?: string) {
    if (!currentUser) return null;
    return buildGoogleOAuthUrl({
      profileId: currentUser.id,
      googleOAuth: googleOAuth as Record<string, unknown>,
      returnUrl: window.location.href,
      preferredRedirectUri: customRedirect,
    });
  }

  function handleStartWebOAuth() {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      const authData = getOAuthUrl();
      if (!authData) return;
      window.location.href = authData.url;
    } catch (err) {
      setIsLoading(false);
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to initiate Google OAuth",
      });
    }
  }

  function handleOpenDesktopAuthTab() {
    try {
      const authData = getOAuthUrl("http://localhost");
      if (!authData) return;
      window.open(authData.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setExchangeError(err instanceof Error ? err.message : "Failed to generate Google authorization URL");
    }
  }

  async function handleCopyAuthUrl() {
    try {
      const authData = getOAuthUrl("http://localhost");
      if (!authData) return;
      await navigator.clipboard.writeText(authData.url);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    } catch {
      // ignore clipboard error
    }
  }

  async function handleExchangeDesktopCode(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!manualCodeInput.trim() || !currentUser?.id) return;

    setIsExchangingCode(true);
    setExchangeError(null);

    try {
      const res = await fetch("/api/auth/google/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id: currentUser.id,
          code: manualCodeInput.trim(),
          redirect_uri: "http://localhost",
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to exchange authorization code");
      }

      setIsLinked(true);
      setFeedback({
        type: "success",
        message: "Google Workspace successfully linked! Permissions approved for Calendar, Sheets, Docs, and Drive.",
      });
      setManualCodeInput("");
      setModalOpen(false);
    } catch (err) {
      setExchangeError(err instanceof Error ? err.message : "Failed to link Google Workspace");
    } finally {
      setIsExchangingCode(false);
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
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">OAuth Client ID</span>
                  {isDesktop ? (
                    <Badge variant="accent" className="gap-1 text-[10px]">
                      <Laptop className="h-3 w-3" />
                      Desktop App (Installed)
                    </Badge>
                  ) : (
                    <Badge variant="neutral" className="gap-1 text-[10px]">
                      <Globe className="h-3 w-3" />
                      Web Application
                    </Badge>
                  )}
                </div>
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

            {/* DESKTOP APP SPECIFIC WORKFLOW */}
            {isDesktop ? (
              <div className="space-y-3 rounded-md border border-brand/30 bg-brand/5 p-3.5">
                <div className="flex items-center gap-2">
                  <Laptop className="h-4 w-4 text-brand" />
                  <span className="font-semibold text-foreground">Desktop App OAuth Flow (Loopback)</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Google configured this client for <strong>Desktop applications</strong>. Follow these 2 steps to approve and link:
                </p>

                {exchangeError && (
                  <div className="flex items-center gap-2 border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive rounded">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>{exchangeError}</span>
                  </div>
                )}

                {/* Step 1 */}
                <div className="space-y-1.5 border-l-2 border-brand pl-3">
                  <p className="font-semibold text-foreground">Step 1: Open Google Sign-In & Approve</p>
                  <p className="text-[11px] text-subtle-foreground">
                    Click the button below to sign in with Google and approve permissions. Google will redirect to your browser’s address bar (e.g. <code className="bg-background px-1 py-0.5 rounded text-[10px]">http://localhost/?code=4/0A...</code>).
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleOpenDesktopAuthTab}
                      className="gap-1.5 text-xs font-semibold"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>Open Google Approval Screen</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCopyAuthUrl}
                      className="gap-1 text-xs"
                      title="Copy authorization link to paste in browser"
                    >
                      {copiedUrl ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copiedUrl ? "Copied Link!" : "Copy Link"}</span>
                    </Button>
                  </div>
                </div>

                {/* Step 2 */}
                <form onSubmit={handleExchangeDesktopCode} className="space-y-2 border-l-2 border-brand pl-3 pt-2">
                  <p className="font-semibold text-foreground">Step 2: Paste the Redirected URL or Code</p>
                  <p className="text-[11px] text-subtle-foreground">
                    Copy the URL or authorization code from your browser address bar after clicking &quot;Allow&quot; and paste it below:
                  </p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g. http://localhost/?code=4/0AY0e-g... or 4/0AY0e-g..."
                      value={manualCodeInput}
                      onChange={(e) => {
                        setExchangeError(null);
                        setManualCodeInput(e.target.value);
                      }}
                      className="text-xs font-mono h-9"
                    />
                    <Button
                      type="submit"
                      disabled={!manualCodeInput.trim() || isExchangingCode}
                      className="gap-1.5 text-xs font-semibold shrink-0"
                    >
                      {isExchangingCode ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          <span>Verifying…</span>
                        </>
                      ) : (
                        <>
                          <KeyRound className="h-3.5 w-3.5" />
                          <span>Verify & Link</span>
                        </>
                      )}
                    </Button>
                  </div>
                </form>

                {/* Localhost Direct option */}
                {isLocalhost && (
                  <div className="pt-2 border-t border-border/60">
                    <p className="text-[11px] text-muted-foreground mb-1.5">
                      💡 <strong>Running locally on localhost:</strong> You can also link with 1-click automatic redirect:
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleStartWebOAuth}
                      disabled={isLoading}
                      className="gap-1.5 text-xs"
                    >
                      <RefreshCw className={isLoading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
                      <span>Direct 1-Click Link on Localhost</span>
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              /* WEB APPLICATION WORKFLOW */
              <>
                <div className="rounded border border-border/80 bg-secondary/30 p-2.5 text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">Authorized Redirect URI:</span> Make sure your Google Cloud Console OAuth Client has this URI added:
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

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    onClick={handleStartWebOAuth}
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
              </>
            )}

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-border">
              {isLinked ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleUnlink}
                  disabled={isLoading}
                  className="gap-1 text-destructive hover:bg-destructive/10 text-xs"
                >
                  <Unlink className="h-3.5 w-3.5" />
                  <span>Disconnect</span>
                </Button>
              ) : (
                <span />
              )}

              <Button type="button" variant="ghost" size="sm" onClick={() => setModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
