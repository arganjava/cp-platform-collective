"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/topbar";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { isAllowedWorkspaceEmail } from "@/lib/supabase/email-policy";
import { ensureProfile, fetchTeamData } from "@/lib/supabase/data";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { AlertCircle, X } from "lucide-react";

type ShellStatus = "loading" | "unconfigured" | "error" | "ready";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const sidebarCollapsed = useStore((s) => s.sidebarCollapsed);
  const initialize = useStore((s) => s.initialize);
  const lastError = useStore((s) => s.lastError);
  const clearError = useStore((s) => s.clearError);
  const [status, setStatus] = useState<ShellStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const hydrate = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setStatus("unconfigured");
      return;
    }
    setStatus("loading");
    setError(null);
    try {
      const supabase = getSupabase();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) {
        // Middleware usually catches this; guard against expired sessions.
        router.replace("/login");
        return;
      }
      if (!isAllowedWorkspaceEmail(user.email)) {
        // Non-workspace Google account — revoke and bounce back to login.
        try {
          await supabase.auth.signOut();
        } catch {
          // The redirect below is what matters.
        }
        router.replace("/login?error=not-allowed");
        return;
      }
      const profile = await ensureProfile(user);
      const data = await fetchTeamData();
      initialize({ ...data, currentUserId: profile.id });
      setStatus("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workspace data.");
      setStatus("error");
    }
  }, [initialize, router]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (status === "loading") {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-background">
        <div className="fixed right-4 top-4 z-50">
          <ThemeToggle />
        </div>
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center bg-brand text-white" aria-hidden="true">
            <span className="font-heading text-xl font-bold">CP</span>
          </div>
          <div className="h-px w-32 overflow-hidden bg-border">
            <div className="h-full w-1/2 animate-[slide-down_0.9s_ease-in-out_infinite] bg-brand" />
          </div>
          <p className="text-xs font-medium uppercase tracking-wider text-subtle-foreground">Loading workspace…</p>
        </div>
      </div>
    );
  }

  if (status === "unconfigured") {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-background px-6">
        <div className="fixed right-4 top-4 z-50">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center bg-brand text-white" aria-hidden="true">
              <span className="font-heading text-lg font-bold">CP</span>
            </div>
            <div>
              <p className="font-heading text-base font-bold leading-tight">CP Platform</p>
              <p className="text-xs leading-tight text-subtle-foreground">Collective Perspectives</p>
            </div>
          </div>
          <div className="border border-border bg-card p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand" aria-hidden="true" />
              <div className="space-y-3">
                <h2 className="font-heading text-lg font-bold tracking-tight">Supabase is not configured</h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  Add <code className="rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
                  <code className="rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to your
                  environment, then run <code className="rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-xs">supabase/setup.sql</code> in your
                  Supabase SQL editor. Refresh once both are in place.
                </p>
                <Button type="button" variant="outline" onClick={() => hydrate()}>
                  Retry
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-background px-6">
        <div className="fixed right-4 top-4 z-50">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-md border border-border bg-card p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" aria-hidden="true" />
            <div className="space-y-3">
              <h2 className="font-heading text-lg font-bold tracking-tight">Could not load the workspace</h2>
              <p className="text-sm leading-6 text-muted-foreground">{error}</p>
              <p className="text-xs leading-5 text-subtle-foreground">
                If this is a fresh Supabase project, make sure <code className="rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-xs">supabase/setup.sql</code> has been run.
              </p>
              <Button type="button" onClick={() => hydrate()}>
                Retry
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className={cn("min-h-screen transition-[margin] duration-200 ease-out", sidebarCollapsed ? "md:ml-[68px]" : "md:ml-[240px]")}>
        <TopBar />
        {lastError && (
          <div role="alert" className="flex items-start gap-3 border-b border-destructive/40 bg-accent px-4 py-3 sm:px-6 lg:px-8">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-accent-foreground">Sync issue — changes may not be saved</p>
              <p className="mt-0.5 break-words text-sm leading-5 text-accent-foreground/90">{lastError}</p>
            </div>
            <button
              type="button"
              onClick={clearError}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center text-accent-foreground transition-colors hover:bg-accent/70"
              aria-label="Dismiss sync error"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
        <main className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
