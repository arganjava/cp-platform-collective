// Supabase Edge Function: google-oauth-callback
// Location: supabase/functions/google-oauth-callback/index.ts
//
// Handles the Google OAuth 2.0 authorization code callback.
// 1. Reads code & state (profile_id, return_url) from Google's redirect.
// 2. Loads the profile's google_oauth configuration (client_id, client_secret) from public.profiles.
// 3. Exchanges authorization code for Google Workspace access & refresh tokens.
// 4. Stores tokens securely in public.profiles_google_tokens.
// 5. Redirects back to the CP Platform app with status feedback.

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
      // If it's just a raw UUID string
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
    .card { background: white; padding: 2rem; border: 1px solid #e5e5e5; text-align: center; max-width: 420px; }
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

  const reqUrl = new URL(req.url);
  const code = reqUrl.searchParams.get("code");
  const rawState = reqUrl.searchParams.get("state");
  const errorParam = reqUrl.searchParams.get("error");
  const errorDescription = reqUrl.searchParams.get("error_description");

  const stateData = parseState(rawState);
  const returnBase = stateData?.return_url || "https://cp-platform.collectivep.com/";

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

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Supabase environment variables missing");
    const redirectUrl = new URL(returnBase);
    redirectUrl.searchParams.set("google_linked", "error");
    redirectUrl.searchParams.set("error", "Server configuration error");
    return redirectResponse(redirectUrl.toString());
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // 1. Fetch profile to get google_oauth JSON credentials
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("id, name, email, google_oauth")
      .eq("id", stateData.profile_id)
      .maybeSingle();

    if (profileErr || !profile) {
      throw new Error(`Profile not found for ID: ${stateData.profile_id}`);
    }

    const oauthConfig = (profile.google_oauth as Record<string, unknown>) || {};
    const webConfig = (oauthConfig.web || oauthConfig.installed || oauthConfig) as Record<string, unknown>;

    const clientId = (webConfig.client_id || oauthConfig.client_id) as string | undefined;
    const clientSecret = (webConfig.client_secret || oauthConfig.client_secret) as string | undefined;
    const tokenUri = (webConfig.token_uri || oauthConfig.token_uri || "https://oauth2.googleapis.com/token") as string;

    if (!clientId || !clientSecret) {
      throw new Error("Profile has no valid google_oauth credentials (client_id or client_secret missing)");
    }

    // Determine redirect_uri: must match the exact URI registered in Google Console
    // Strip search params to get clean callback URL
    const callbackRedirectUri = `${reqUrl.origin}${reqUrl.pathname}`;

    // 2. Exchange authorization code for tokens
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

    const refreshToken = tokenData.refresh_token as string | undefined;

    // 3. Save into public.profiles_google_tokens
    // If an existing token exists and Google didn't return a new refresh token (re-link without prompt=consent), preserve old
    let finalRefreshToken = refreshToken || null;
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
      console.error("Failed to upsert profiles_google_tokens:", upsertErr);
      throw new Error(`Database error saving tokens: ${upsertErr.message}`);
    }

    console.log(`Successfully linked Google Workspace for profile ${profile.id} (${profile.email})`);

    // 4. Redirect back to CP Platform
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
