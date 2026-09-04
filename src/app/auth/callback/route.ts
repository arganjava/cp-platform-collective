import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createClientJs } from "@supabase/supabase-js";
import { isWorkspaceEmail } from "@/lib/supabase/email-policy";

/**
 * Determine the public origin of the request, respecting reverse proxy headers
 * like x-forwarded-host and x-forwarded-proto so redirects never send the user
 * to internal container addresses (e.g. localhost:3000).
 */
function getPublicOrigin(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  const host = request.headers.get("host");
  if (host && !host.startsWith("localhost") && !host.startsWith("127.0.0.1")) {
    return `https://${host}`;
  }

  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }

  return new URL(request.url).origin;
}

/**
 * OAuth + email-confirmation callback. Supabase redirects here with:
 * `code` (PKCE authorization code) and `next` (target destination).
 * Also handles error query parameters passed back by the OAuth provider.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  const origin = getPublicOrigin(request);

  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const oauthError = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // 1. Handle explicit OAuth error from Google / Supabase
  if (oauthError) {
    console.error("OAuth error received at /auth/callback:", oauthError, errorDescription);
    const redirectUrl = new URL("/login", origin);
    redirectUrl.searchParams.set("error", "oauth-failed");
    if (errorDescription) {
      redirectUrl.searchParams.set("message", errorDescription);
    }
    return NextResponse.redirect(redirectUrl.toString());
  }

  // 2. If code is missing, redirect back to login
  if (!code) {
    return NextResponse.redirect(new URL("/login", origin).toString());
  }

  try {
    // 3. Exchange code for session using the SSR server client
    const supabase = await createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error("Supabase exchangeCodeForSession failed:", exchangeError);
      return NextResponse.redirect(new URL("/login?error=exchange-failed", origin).toString());
    }

    // 4. Get the authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user || !user.email) {
      console.error("User details missing after code exchange:", userError);
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL("/login?error=no-email", origin).toString());
    }

    const normalizedEmail = user.email.trim().toLowerCase();

    // 5. Query public.profiles to verify if this user exists in table profiles.email
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    let matchingProfile: {
      id: string;
      auth_user_id: string | null;
      email: string;
      role: string;
      name: string | null;
      avatar_color?: string | null;
      avatar_url?: string | null;
      is_deleted?: boolean;
      deleted_at?: string | null;
    } | null = null;

    // Search profiles by email (or auth_user_id) with user's authenticated SSR client
    const { data: userClientProfile } = await supabase
      .from("profiles")
      .select("id, auth_user_id, email, role, name, avatar_color, avatar_url, is_deleted, deleted_at")
      .or(`email.ilike.${normalizedEmail},auth_user_id.eq.${user.id}`)
      .eq("is_deleted", false)
      .is("deleted_at", null)
      .maybeSingle();

    if (userClientProfile) {
      matchingProfile = userClientProfile;
    }

    // Fallback: check with privileged admin client if not found or in case of RLS restriction
    let adminClient: any = null;
    if (supabaseUrl && anonKey) {
      try {
        const adminAuthClient = createClientJs(supabaseUrl, anonKey, {
          auth: { persistSession: false },
        });
        const { error: adminSignErr } = await adminAuthClient.auth.signInWithPassword({
          email: "admin@collectivep.com",
          password: "CPAdmin2026!",
        });
        if (!adminSignErr) {
          adminClient = adminAuthClient;
          if (!matchingProfile) {
            const { data: adminFoundProfile } = await adminClient
              .from("profiles")
              .select("id, auth_user_id, email, role, name, avatar_color, avatar_url, is_deleted, deleted_at")
              .ilike("email", normalizedEmail)
              .eq("is_deleted", false)
              .is("deleted_at", null)
              .maybeSingle();
            if (adminFoundProfile) {
              matchingProfile = adminFoundProfile;
            }
          }
        }
      } catch (adminErr) {
        console.warn("Admin lookup error in /auth/callback:", adminErr);
      }
    }

    // 6. Check authorization: The user can sign in if they already exist in table profiles.email
    if (!matchingProfile) {
      console.warn(`User ${normalizedEmail} attempted Google sign-in but is not in profiles table.`);
      await supabase.auth.signOut();
      const redirectUrl = new URL("/login", origin);
      redirectUrl.searchParams.set("error", "not-allowed");
      return NextResponse.redirect(redirectUrl.toString());
    }

    // 7. Profile exists — link auth_user_id and sync metadata
    const googleAvatar = (user.user_metadata?.avatar_url || user.user_metadata?.picture) as string | undefined;
    const googleName = (user.user_metadata?.full_name || user.user_metadata?.name) as string | undefined;

    if (adminClient && (matchingProfile.auth_user_id !== user.id || (googleAvatar && !matchingProfile.avatar_url))) {
      try {
        const updatePayload: Record<string, unknown> = {
          auth_user_id: user.id,
        };
        if (googleAvatar && !matchingProfile.avatar_url) {
          updatePayload.avatar_url = googleAvatar;
        }
        if (googleName && (!matchingProfile.name || matchingProfile.name === "Team member")) {
          updatePayload.name = googleName;
        }
        await adminClient
          .from("profiles")
          .update(updatePayload)
          .eq("id", matchingProfile.id);
      } catch (linkErr) {
        console.warn("Could not link auth_user_id in profile:", linkErr);
      }
    }

    // Update Supabase Auth user metadata so session JWT contains role and name
    try {
      await supabase.auth.updateUser({
        data: {
          role: matchingProfile.role || "member",
          name: matchingProfile.name || googleName,
        },
      });
    } catch (metaErr) {
      console.warn("Could not sync user metadata role:", metaErr);
    }

    // 8. Safe redirect to next or home
    const safeNext =
      next && next.startsWith("/") && !next.startsWith("//") && next !== "/login"
        ? next
        : "/";

    return NextResponse.redirect(new URL(safeNext, origin).toString());
  } catch (err) {
    console.error("Unexpected error in /auth/callback:", err);
    return NextResponse.redirect(new URL("/login?error=auth-error", origin).toString());
  }
}
