// Supabase Edge Function: refresh-google-token
// Location: supabase/functions/refresh-google-token/index.ts
//
// Endpoint for OpenClaw Rabbit Agent (and app clients) to get or refresh Google Workspace access tokens:
// 1. Checks public.profiles_google_tokens for cached access_token & access_token_expire.
// 2. If valid & unexpired (> now + 60s), returns cached token immediately (reused: true).
// 3. If null, expired, or force_refresh requested, exchanges google_refresh_token with Google OAuth.
// 4. Atomically updates public.profiles_google_tokens with fresh access_token & access_token_expire.
// 5. If access_token & access_token_expire are supplied in payload, directly updates/persists them.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    return jsonResponse({ error: "Missing Supabase environment variables on server" }, 500);
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    let profileId: string | null = null;
    let waNumber: string | null = null;
    let forceRefresh = false;
    let explicitAccessToken: string | null = null;
    let explicitExpire: string | null = null;

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      profileId = body.profile_id || body.profileId || null;
      waNumber = body.wa_number || body.waNumber || body.phone || null;
      forceRefresh = Boolean(body.force_refresh || body.forceRefresh);
      explicitAccessToken = body.access_token || body.accessToken || null;
      explicitExpire = body.access_token_expire || body.accessTokenExpire || null;
    } else if (req.method === "GET") {
      const url = new URL(req.url);
      profileId = url.searchParams.get("profile_id") || url.searchParams.get("profileId");
      waNumber = url.searchParams.get("wa_number") || url.searchParams.get("phone");
      forceRefresh = url.searchParams.get("force_refresh") === "true";
    }

    // 1. Resolve profile_id from wa_number if profile_id not provided
    if (!profileId && waNumber) {
      const cleanNumber = String(waNumber).replace(/[^0-9+]/g, "");
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id, name, email")
        .eq("wa_number", cleanNumber)
        .maybeSingle();

      if (profile?.id) {
        profileId = profile.id;
      } else {
        // Try without leading '+' or with leading '+'
        const altNumber = cleanNumber.startsWith("+") ? cleanNumber.slice(1) : `+${cleanNumber}`;
        const { data: altProfile } = await supabaseAdmin
          .from("profiles")
          .select("id, name, email")
          .eq("wa_number", altNumber)
          .maybeSingle();
        if (altProfile?.id) {
          profileId = altProfile.id;
        }
      }
    }

    if (!profileId) {
      return jsonResponse(
        {
          error: "missing_parameter",
          message: "Either profile_id or wa_number must be provided in request body or query params.",
        },
        400
      );
    }

    // 2. Fetch current token row
    const { data: tokenRow, error: tokenFetchErr } = await supabaseAdmin
      .from("profiles_google_tokens")
      .select("id, profile_id, google_client_id, google_client_secret, google_refresh_token, access_token, access_token_expire")
      .eq("profile_id", profileId)
      .maybeSingle();

    if (tokenFetchErr) {
      return jsonResponse({ error: "db_error", message: tokenFetchErr.message }, 500);
    }

    if (!tokenRow) {
      return jsonResponse(
        {
          error: "not_found",
          message: `No Google OAuth record found in profiles_google_tokens for profile_id: ${profileId}. Please ask workspace admin to register OAuth2 Google manually.`,
          profile_id: profileId,
        },
        404
      );
    }

    // 3. Mode: Direct update if caller supplied explicit access_token
    if (explicitAccessToken) {
      let finalExpire = explicitExpire;
      if (!finalExpire) {
        // default 3500 seconds from now
        finalExpire = new Date(Date.now() + 3500 * 1000).toISOString();
      }

      const { error: updateErr } = await supabaseAdmin
        .from("profiles_google_tokens")
        .update({
          access_token: explicitAccessToken,
          access_token_expire: finalExpire,
        })
        .eq("profile_id", profileId);

      if (updateErr) {
        return jsonResponse({ error: "update_failed", message: updateErr.message }, 500);
      }

      return jsonResponse({
        success: true,
        updated: true,
        reused: false,
        profile_id: profileId,
        access_token: explicitAccessToken,
        access_token_expire: finalExpire,
      });
    }

    // 4. Check if existing access_token is still valid & not expired
    const hasActiveToken = Boolean(
      tokenRow.access_token &&
      tokenRow.access_token_expire &&
      new Date(tokenRow.access_token_expire).getTime() > Date.now() + 60_000 // 60s safety buffer
    );

    if (hasActiveToken && !forceRefresh) {
      return jsonResponse({
        success: true,
        reused: true,
        refreshed: false,
        profile_id: profileId,
        access_token: tokenRow.access_token,
        access_token_expire: tokenRow.access_token_expire,
      });
    }

    // 5. Need refresh: check required refresh token credentials
    const refreshToken = tokenRow.google_refresh_token;
    let clientId = tokenRow.google_client_id;
    let clientSecret = tokenRow.google_client_secret;

    // Fallback: If clientId or clientSecret are null, check public.profiles.google_oauth
    if (!clientId || !clientSecret) {
      const { data: profileWithOAuth } = await supabaseAdmin
        .from("profiles")
        .select("google_oauth")
        .eq("id", profileId)
        .maybeSingle();

      if (profileWithOAuth?.google_oauth) {
        const conf = profileWithOAuth.google_oauth as Record<string, unknown>;
        const block = (conf.installed || conf.web || conf) as Record<string, unknown>;
        if (!clientId) clientId = (block.client_id || conf.client_id) as string;
        if (!clientSecret) clientSecret = (block.client_secret || conf.client_secret) as string;
      }
    }

    if (!refreshToken) {
      return jsonResponse(
        {
          error: "missing_refresh_token",
          message: "google_refresh_token is missing. User must link Google Workspace account.",
          profile_id: profileId,
        },
        400
      );
    }

    if (!clientId || !clientSecret) {
      return jsonResponse(
        {
          error: "missing_client_credentials",
          message: "google_client_id or google_client_secret missing for profile.",
          profile_id: profileId,
        },
        400
      );
    }

    // 6. Call Google token endpoint to refresh
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken.trim(),
      client_id: clientId.trim(),
      client_secret: clientSecret.trim(),
    });

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const tokenData = await tokenRes.json().catch(() => ({}));

    if (!tokenRes.ok || tokenData.error) {
      const errCode = tokenData.error || "refresh_failed";
      const errDesc = tokenData.error_description || "Google rejected token refresh request";

      return jsonResponse(
        {
          success: false,
          error: errCode,
          error_description: errDesc,
          message:
            errCode === "invalid_grant"
              ? "Your Google Workspace refresh token was rejected by Google (invalid_grant). Token may have been revoked or rotated. Please ask an admin to re-register OAuth2 Google credentials."
              : `Google OAuth refresh failed: ${errDesc}`,
          profile_id: profileId,
        },
        tokenRes.status >= 400 && tokenRes.status < 500 ? tokenRes.status : 400
      );
    }

    const newAccessToken = tokenData.access_token as string;
    const expiresIn = Number(tokenData.expires_in) || 3600;
    const newExpire = new Date(Date.now() + expiresIn * 1000).toISOString();
    const rotatedRefreshToken = tokenData.refresh_token as string | undefined;

    // 7. Persist regenerated access_token and access_token_expire back to profiles_google_tokens
    const updatePayload: Record<string, unknown> = {
      access_token: newAccessToken,
      access_token_expire: newExpire,
    };
    if (rotatedRefreshToken) {
      updatePayload.google_refresh_token = rotatedRefreshToken;
    }

    const { error: updateErr } = await supabaseAdmin
      .from("profiles_google_tokens")
      .update(updatePayload)
      .eq("profile_id", profileId);

    if (updateErr) {
      console.error("Failed to update access token in profiles_google_tokens:", updateErr);
      // Still return token to caller so their immediate action succeeds, but warn
      return jsonResponse({
        success: true,
        reused: false,
        refreshed: true,
        warning: `Generated access token but failed to persist to DB: ${updateErr.message}`,
        profile_id: profileId,
        access_token: newAccessToken,
        access_token_expire: newExpire,
        expires_in: expiresIn,
      });
    }

    return jsonResponse({
      success: true,
      reused: false,
      refreshed: true,
      profile_id: profileId,
      access_token: newAccessToken,
      access_token_expire: newExpire,
      expires_in: expiresIn,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Unexpected error in refresh-google-token:", errorMsg);
    return jsonResponse({ error: "server_error", message: errorMsg }, 500);
  }
});
