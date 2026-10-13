import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { profile_id, code: rawCode, redirect_uri } = body || {};

    if (!profile_id) {
      return NextResponse.json({ error: "Missing profile_id" }, { status: 400 });
    }

    if (!rawCode || typeof rawCode !== "string") {
      return NextResponse.json({ error: "Missing authorization code" }, { status: 400 });
    }

    // Extract authorization code if user pasted a full URL
    let code = rawCode.trim();
    if (code.includes("code=")) {
      try {
        const parsedUrl = new URL(code);
        code = parsedUrl.searchParams.get("code") || code;
      } catch {
        const match = code.match(/[?&]code=([^&]+)/);
        if (match) {
          code = decodeURIComponent(match[1]);
        }
      }
    }

    if (!code) {
      return NextResponse.json({ error: "Could not extract authorization code from input" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl) {
      return NextResponse.json({ error: "Supabase URL is not configured on the server" }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey || anonKey || "", {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("id, name, email, google_oauth")
      .eq("id", profile_id)
      .maybeSingle();

    if (profileErr || !profile) {
      return NextResponse.json({ error: `Profile not found for ID: ${profile_id}` }, { status: 404 });
    }

    const oauthConfig = (profile.google_oauth as Record<string, unknown>) || {};
    const clientBlock = (oauthConfig.installed || oauthConfig.web || oauthConfig) as Record<string, unknown>;

    const clientId = (clientBlock.client_id || oauthConfig.client_id) as string | undefined;
    const clientSecret = (clientBlock.client_secret || oauthConfig.client_secret) as string | undefined;
    const tokenUri = (clientBlock.token_uri || oauthConfig.token_uri || "https://oauth2.googleapis.com/token") as string;
    const configuredRedirectUris = (clientBlock.redirect_uris as string[]) || [];

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: "Profile google_oauth configuration is missing client_id or client_secret" },
        { status: 400 }
      );
    }

    // For desktop (installed) apps, redirect_uri in token exchange MUST match the redirect_uri used in the auth request
    // Default to redirect_uri from request, or configured redirect_uris[0], or "http://localhost"
    const resolvedRedirectUri = redirect_uri || configuredRedirectUris[0] || "http://localhost";

    const tokenParams = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: resolvedRedirectUri,
      grant_type: "authorization_code",
    });

    const tokenRes = await fetch(tokenUri, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenParams.toString(),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || tokenData.error) {
      const errMsg = tokenData.error_description || tokenData.error || "Token exchange failed with Google OAuth";
      return NextResponse.json({ error: errMsg }, { status: 400 });
    }

    let finalRefreshToken = (tokenData.refresh_token as string | undefined) || null;
    if (!finalRefreshToken) {
      const { data: existingToken } = await supabaseAdmin
        .from("profiles_google_tokens")
        .select("google_refresh_token")
        .eq("profile_id", profile.id)
        .maybeSingle();
      if (existingToken?.google_refresh_token) {
        finalRefreshToken = existingToken.google_refresh_token;
      }
    }

    const { error: upsertErr } = await supabaseAdmin
      .from("profiles_google_tokens")
      .upsert(
        {
          profile_id: profile.id,
          google_client_id: clientId,
          google_client_secret: clientSecret,
          google_refresh_token: finalRefreshToken,
          created_at: new Date().toISOString(),
        },
        { onConflict: "profile_id" }
      );

    if (upsertErr) {
      return NextResponse.json({ error: `Database error saving tokens: ${upsertErr.message}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      linked: true,
      hasRefreshToken: Boolean(finalRefreshToken),
      message: "Google Workspace successfully linked! Permissions approved for Calendar, Sheets, Docs, and Drive.",
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
