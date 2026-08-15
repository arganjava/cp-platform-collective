"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    error === "not-allowed"
      ? "That Google account isn't part of the Collective Perspectives workspace. Sign in with an @collectivep.com email."
      : null
  );

  async function handleGoogleSignIn() {
    setErrorMessage(null);
    setLoading(true);
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Google sign-in failed. Please try again."
      );
      setLoading(false);
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
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
                <h2 className="font-heading text-lg font-bold tracking-tight">Supabase is not configured yet</h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  Add <code className="rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
                  <code className="rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to your
                  environment (project Keys / API keys), then run <code className="rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-xs">supabase/setup.sql</code> in
                  your Supabase SQL editor to create the schema, storage bucket, and seed data.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.1fr_1fr]">
      {/* ── Brand panel ─────────────────────────────────────────── */}
      <div className="relative hidden overflow-hidden bg-sidebar text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center bg-brand text-white" aria-hidden="true">
            <span className="font-heading text-lg font-bold">CP</span>
          </div>
          <div>
            <p className="font-heading text-base font-bold leading-tight">CP Platform</p>
            <p className="text-xs leading-tight text-sidebar-foreground">Collective Perspectives</p>
          </div>
        </div>

        <div className="max-w-md">
          <p className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-sidebar-primary">Internal workspace</p>
          <h1 className="font-heading text-4xl font-bold leading-tight tracking-tight">
            Redefining Ability.
            <br />
            <span className="text-brand">Reimagining Possibility.</span>
          </h1>
          <p className="mt-4 text-sm leading-6 text-sidebar-foreground">
            Coordinate projects, track tasks, record revenue, and report on delivery — one binder for the whole team.
          </p>
        </div>

        <div className="flex items-center gap-6 border-t border-white/10 pt-6 text-xs text-sidebar-foreground">
          <span>Projects</span>
          <span className="h-1 w-1 rounded-full bg-sidebar-foreground/40" />
          <span>Tasks</span>
          <span className="h-1 w-1 rounded-full bg-sidebar-foreground/40" />
          <span>Sales</span>
          <span className="h-1 w-1 rounded-full bg-sidebar-foreground/40" />
          <span>Reports</span>
        </div>
      </div>

      {/* ── Sign-in panel ──────────────────────────────────────── */}
      <div className="flex min-h-screen flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center bg-brand text-white" aria-hidden="true">
              <span className="font-heading text-lg font-bold">CP</span>
            </div>
            <div>
              <p className="font-heading text-base font-bold leading-tight">CP Platform</p>
              <p className="text-xs leading-tight text-subtle-foreground">Collective Perspectives</p>
            </div>
          </div>

          <div className="mb-6 border-b border-border pb-6">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
              Sign in to the workspace
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Use your @collectivep.com Google account to continue.
            </p>
          </div>

          {errorMessage && (
            <div className="mb-4 flex items-start gap-2.5 border border-destructive/40 bg-accent px-3 py-2.5" role="alert">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" aria-hidden="true" />
              <p className="text-sm leading-5 text-accent-foreground">{errorMessage}</p>
            </div>
          )}

          <Button type="button" size="lg" className="w-full" onClick={handleGoogleSignIn} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Redirecting to Google…
              </>
            ) : (
              <>
                <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z" />
                  <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84Z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52Z" />
                </svg>
                Continue with Google
              </>
            )}
          </Button>

          <div className="mt-6 border border-border bg-secondary px-4 py-3">
            <p className="text-xs leading-5 text-muted-foreground">
              Workspace access is limited to Collective Perspectives staff and partners with an{" "}
              <span className="font-mono font-medium text-foreground">@collectivep.com</span> email.
            </p>
          </div>

          <p className="mt-8 text-center text-xs leading-5 text-subtle-foreground">
            Internal workspace for Collective Perspectives.
            <br />
            Access is provisioned by your administrator.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <LoginForm />
    </Suspense>
  );
}
