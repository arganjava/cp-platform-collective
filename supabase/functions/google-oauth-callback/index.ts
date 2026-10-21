// Supabase Edge Function: google-oauth-callback
// Location: supabase/functions/google-oauth-callback/index.ts
//
// Handles both:
// 1. GET: Standard browser redirect callback from Google OAuth (for Web Application clients).
// 2. POST: Direct code exchange for Desktop / Installed app flows where code or redirect URL is pasted.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

interface StateData {
  profile_id: string;
  return_url?: string;
  is_desktop?: boolean;
}

function parseState(rawState: string | null): StateData | null {
  if (!rawState) return null;
  try {
    return JSON.parse(rawState) as StateData;
  } catch {
    try {
      const decoded = atob(rawState);
      return JSON.parse(decoded) as StateData;
    } catch {
      return { profile_id: rawState };
    }
  }
}

function redirectResponse(targetUrl: string): Response {
  return new Response(
    `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Redirecting to CP Platform...</title>
  <meta http-equiv="refresh" content="0;url=${targetUrl}">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #faf9f7; color: #1a1a1a; }
    .card { background: white; padding: 2rem; border: 1px solid #e5e5e5; text-align: center; max-width: 420px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
  </style>
</head>
<body>
  <div class="card">
    <h2>Connecting Google Workspace...</h2>
    <p>Please wait while we redirect you back to CP Platform.</p>
    <p><a href="${targetUrl}">Click here if not redirected automatically</a></p>
  </div>
</body>
</html>`,
    {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: targetUrl,
        "Content-Type": "text/html; charset=utf-8",
      },
    }
  );
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: "Supabase environment variables missing" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // -------------------------------------------------------------
  // POST Flow: Desktop app code exchange or programmatic exchange
  // -------------------------------------------------------------
  if (req.method === "POST") {
    try {
      const body = await req.json();
      let { profile_id, email: bodyEmail, code: rawCode, redirect_uri } = body || {};

      if (!rawCode) {
        return new Response(
          JSON.stringify({ error: "Authorization code is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Extract code if user pasted a full URL
      let code = String(rawCode).trim();
      let stateFromUrl: string | null = null;
      if (code.includes("code=") || code.includes("http://") || code.includes("https://")) {
        try {
          const parsed = new URL(code.startsWith("http") ? code : `http://localhost/${code}`);
          code = parsed.searchParams.get("code") || code;
          stateFromUrl = parsed.searchParams.get("state");
        } catch {
          const matchCode = code.match(/[?&]code=([^&]+)/);
          if (matchCode) code = decodeURIComponent(matchCode[1]);
          const matchState = code.match(/[?&]state=([^&]+)/);
          if (matchState) stateFromUrl = decodeURIComponent(matchState[1]);
        }
      }

      // If profile_id was not passed directly, try to get it from state
      if (!profile_id && stateFromUrl) {
        const parsedState = parseState(stateFromUrl);
        if (parsedState?.profile_id) {
          profile_id = parsedState.profile_id;
        }
      }

      if (!profile_id) {
        return new Response(
          JSON.stringify({ error: "profile_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Look up profile by id OR auth_user_id OR email
      let profileQuery = supabaseAdmin
        .from("profiles")
        .select("id, auth_user_id, name, email, google_oauth");

      if (bodyEmail) {
        profileQuery = profileQuery.or(`id.eq.${profile_id},auth_user_id.eq.${profile_id},email.ilike.${bodyEmail}`);
      } else {
        profileQuery = profileQuery.or(`id.eq.${profile_id},auth_user_id.eq.${profile_id}`);
      }

      let { data: profile } = await profileQuery.maybeSingle();

      if (!profile) {
        // Fallback: Check auth.users by ID to find email
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
          // ignore auth lookup error
        }
      }

      if (!profile && bodyEmail) {
        const { data: byEmailDirect } = await supabaseAdmin
          .from("profiles")
          .select("id, auth_user_id, name, email, google_oauth")
          .ilike("email", bodyEmail)
          .maybeSingle();
        if (byEmailDirect) profile = byEmailDirect;
      }

      if (!profile) {
        return new Response(
          JSON.stringify({ error: `Profile not found for ID: ${profile_id}` }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // If this row has no google_oauth, check if there is another row for the same email
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
        return new Response(
          JSON.stringify({
            error: `No Google OAuth credentials found for profile ${profile.name || profile.email}. Please upload client_secret_*.json on the /users page.`,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const oauthConfig = (profile.google_oauth as Record<string, unknown>) || {};
      const clientBlock = (oauthConfig.installed || oauthConfig.web || oauthConfig) as Record<string, unknown>;

      const clientId = (clientBlock.client_id || oauthConfig.client_id) as string | undefined;
      const clientSecret = (clientBlock.client_secret || oauthConfig.client_secret) as string | undefined;
      const tokenUri = (clientBlock.token_uri || oauthConfig.token_uri || "https://oauth2.googleapis.com/token") as string;
      const configuredUris = (clientBlock.redirect_uris as string[]) || [];

      if (!clientId || !clientSecret) {
        return new Response(
          JSON.stringify({ error: "Profile google_oauth is missing client_id or client_secret" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const resolvedRedirectUri = redirect_uri || configuredUris[0] || "http://localhost";

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
        return new Response(
          JSON.stringify({ error: tokenData.error_description || tokenData.error || "Token exchange failed" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let finalRefreshToken = tokenData.refresh_token as string | undefined;
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

      const expiresInSec = Number(tokenData.expires_in) || 3600;
      const accessTokenExpire = new Date(Date.now() + expiresInSec * 1000).toISOString();

      const { error: upsertErr } = await supabaseAdmin
        .from("profiles_google_tokens")
        .upsert(
          {
            profile_id: profile.id,
            google_client_id: clientId,
            google_client_secret: clientSecret,
            google_refresh_token: finalRefreshToken || null,
            access_token: (tokenData.access_token as string) || null,
            access_token_expire: accessTokenExpire,
            created_at: new Date().toISOString(),
          },
          { onConflict: "profile_id" }
        );

      if (upsertErr) {
        return new Response(
          JSON.stringify({ error: `Database error saving tokens: ${upsertErr.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          linked: true,
          message: "Google Workspace successfully linked! Permissions approved for Calendar, Sheets, Docs, and Drive.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // -------------------------------------------------------------
  // GET Flow: Web browser redirect from Google OAuth
  // -------------------------------------------------------------
  const reqUrl = new URL(req.url);
  const code = reqUrl.searchParams.get("code");
  const rawState = reqUrl.searchParams.get("state");
  const errorParam = reqUrl.searchParams.get("error");
  const errorDescription = reqUrl.searchParams.get("error_description");

  const stateData = parseState(rawState);
  const returnBase = stateData?.return_url || "https://cockpit.collectivep.com/";

  // Handle Google OAuth rejection / error
  if (errorParam) {
    const errorMsg = errorDescription || errorParam;
    console.error("Google OAuth returned error:", errorParam, errorDescription);
    const redirectUrl = new URL(returnBase);
    redirectUrl.searchParams.set("google_linked", "error");
    redirectUrl.searchParams.set("error", errorMsg);
    return redirectResponse(redirectUrl.toString());
  }

  if (!code) {
    return new Response(
      JSON.stringify({ error: "Missing authorization code from Google OAuth callback" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!stateData?.profile_id) {
    console.error("Missing profile_id in state parameter:", rawState);
    const redirectUrl = new URL(returnBase);
    redirectUrl.searchParams.set("google_linked", "error");
    redirectUrl.searchParams.set("error", "Missing profile ID in state parameter");
    return redirectResponse(redirectUrl.toString());
  }

  try {
    let { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, auth_user_id, name, email, google_oauth")
      .or(`id.eq.${stateData.profile_id},auth_user_id.eq.${stateData.profile_id}`)
      .maybeSingle();

    if (!profile) {
      try {
        const { data: authUserData } = await supabaseAdmin.auth.admin.getUserById(stateData.profile_id);
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
      throw new Error(`Profile not found for ID: ${stateData.profile_id}`);
    }

    const oauthConfig = (profile.google_oauth as Record<string, unknown>) || {};
    const clientBlock = (oauthConfig.installed || oauthConfig.web || oauthConfig) as Record<string, unknown>;

    const clientId = (clientBlock.client_id || oauthConfig.client_id) as string | undefined;
    const clientSecret = (clientBlock.client_secret || oauthConfig.client_secret) as string | undefined;
    const tokenUri = (clientBlock.token_uri || oauthConfig.token_uri || "https://oauth2.googleapis.com/token") as string;

    if (!clientId || !clientSecret) {
      throw new Error("Profile has no valid google_oauth credentials (client_id or client_secret missing)");
    }

    const callbackRedirectUri = `${reqUrl.origin}${reqUrl.pathname}`;

    const tokenParams = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: callbackRedirectUri,
      grant_type: "authorization_code",
    });

    const tokenRes = await fetch(tokenUri, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenParams.toString(),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || tokenData.error) {
      console.error("Google token exchange error:", tokenData);
      throw new Error(tokenData.error_description || tokenData.error || "Token exchange failed");
    }

    let finalRefreshToken = tokenData.refresh_token as string | undefined;
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

    const expiresInSec = Number(tokenData.expires_in) || 3600;
    const accessTokenExpire = new Date(Date.now() + expiresInSec * 1000).toISOString();

    const { error: upsertErr } = await supabaseAdmin
      .from("profiles_google_tokens")
      .upsert(
        {
          profile_id: profile.id,
          google_client_id: clientId,
          google_client_secret: clientSecret,
          google_refresh_token: finalRefreshToken || null,
          access_token: (tokenData.access_token as string) || null,
          access_token_expire: accessTokenExpire,
          created_at: new Date().toISOString(),
        },
        { onConflict: "profile_id" }
      );

    if (upsertErr) {
      throw new Error(`Database error saving tokens: ${upsertErr.message}`);
    }

    const successUrl = new URL(returnBase);
    successUrl.searchParams.set("google_linked", "success");
    successUrl.searchParams.set("profile_id", profile.id);
    return redirectResponse(successUrl.toString());
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("OAuth callback processing error:", errorMsg);
    const failureUrl = new URL(returnBase);
    failureUrl.searchParams.set("google_linked", "error");
    failureUrl.searchParams.set("error", errorMsg);
    return redirectResponse(failureUrl.toString());
  }
});
