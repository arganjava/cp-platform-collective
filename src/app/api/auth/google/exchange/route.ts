import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let { profile_id, code: rawCode, redirect_uri } = body || {};

    if (!rawCode || typeof rawCode !== "string") {
      return NextResponse.json({ error: "Missing authorization code" }, { status: 400 });
    }

    // Extract authorization code and state if user pasted a full URL
    let code = rawCode.trim();
    let stateFromUrl: string | null = null;
    if (code.includes("code=") || code.includes("http://") || code.includes("https://")) {
      try {
        const parsedUrl = new URL(code.startsWith("http") ? code : `http://localhost/${code}`);
        code = parsedUrl.searchParams.get("code") || code;
        stateFromUrl = parsedUrl.searchParams.get("state");
      } catch {
        const match = code.match(/[?&]code=([^&]+)/);
        if (match) code = decodeURIComponent(match[1]);
        const stateMatch = code.match(/[?&]state=([^&]+)/);
        if (stateMatch) stateFromUrl = decodeURIComponent(stateMatch[1]);
      }
    }

    if (!code) {
      return NextResponse.json({ error: "Could not extract authorization code from input" }, { status: 400 });
    }

    // If profile_id is not passed, attempt to parse from state in URL
    if (!profile_id && stateFromUrl) {
      try {
        const decoded = JSON.parse(Buffer.from(stateFromUrl, "base64").toString("utf-8"));
        if (decoded?.profile_id) profile_id = decoded.profile_id;
      } catch {
        try {
          const parsed = JSON.parse(stateFromUrl);
          if (parsed?.profile_id) profile_id = parsed.profile_id;
        } catch {
          // ignore
        }
      }
    }

    if (!profile_id) {
      return NextResponse.json({ error: "Missing profile_id" }, { status: 400 });
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

    // Match profile by id OR auth_user_id (crucial: auth users have auth.uid() matching auth_user_id)
    let { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, auth_user_id, name, email, google_oauth")
      .or(`id.eq.${profile_id},auth_user_id.eq.${profile_id}`)
      .maybeSingle();

    if (!profile) {
      // Fallback: check auth user by ID to find email
      try {
        const { data: authUserData } = await supabaseAdmin.auth.admin.getUserById(profile_id);
        if (authUserData?.user?.email) {
          const { data: byEmail } = await supabaseAdmin
            .from("profiles")
            .select("id, auth_user_id, name, email, google_oauth")
            .ilike("email", authUserData.user.email)
            .maybeSingle();
          if (byEmail) profile = byEmail;
        }
      } catch {
        // ignore
      }
    }

    if (!profile) {
      return NextResponse.json({ error: `Profile not found for ID: ${profile_id}` }, { status: 404 });
    }

    // If this profile row has no google_oauth, check if there's another profile row with the same email
    if (!profile.google_oauth && profile.email) {
      const { data: sibling } = await supabaseAdmin
        .from("profiles")
        .select("google_oauth")
        .ilike("email", profile.email)
        .not("google_oauth", "is", null)
        .maybeSingle();
      if (sibling?.google_oauth) {
        profile.google_oauth = sibling.google_oauth;
      }
    }

    if (!profile.google_oauth) {
      return NextResponse.json(
        {
          error: `No Google OAuth credentials found for profile ${profile.name || profile.email}. Please upload client_secret_*.json on the /users page.`,
        },
        { status: 400 }
      );
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
          profile_id: profile.id, // primary key
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
