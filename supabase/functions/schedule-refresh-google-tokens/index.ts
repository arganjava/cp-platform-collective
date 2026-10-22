// Supabase Edge Function: schedule-refresh-google-tokens
// Location: supabase/functions/schedule-refresh-google-tokens/index.ts
//
// Scheduled background worker that runs every 5 minutes via Supabase pg_cron.
// Automatically generates and maintains fresh Google Workspace access tokens:
// 1. Queries all rows in public.profiles_google_tokens where google_refresh_token is not null.
// 2. Evaluates expiration:
//    - If access_token is NULL or access_token_expire is NULL: generates and stores new access_token & access_token_expire.
//    - If (access_token_expire - 5 minutes) <= currentTime (i.e. expiring soon or expired): refreshes and replaces access_token & access_token_expire.
// 3. Allows Rabbit Agent to ONLY look at profiles_google_tokens.access_token for instant Google Workspace actions.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

interface RefreshResult {
  profile_id: string;
  status: "refreshed" | "skipped" | "error";
  reason?: string;
  new_expire?: string;
  error?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: "Missing Supabase server configuration" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const now = Date.now();
    const FIVE_MINUTES_MS = 5 * 60 * 1000;

    // 1. Fetch all profiles with a registered google_refresh_token
    const { data: tokenRows, error: fetchErr } = await supabaseAdmin
      .from("profiles_google_tokens")
      .select("id, profile_id, google_client_id, google_client_secret, google_refresh_token, access_token, access_token_expire")
      .not("google_refresh_token", "is", null);

    if (fetchErr) {
      console.error("Error fetching token rows:", fetchErr);
      return new Response(
        JSON.stringify({ error: fetchErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rows = tokenRows || [];
    const results: RefreshResult[] = [];
    let refreshedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const row of rows) {
      const profileId = row.profile_id;
      const refreshToken = row.google_refresh_token?.trim();

      if (!refreshToken) {
        results.push({ profile_id: profileId, status: "skipped", reason: "empty_refresh_token" });
        skippedCount++;
        continue;
      }

      // Check condition:
      // A. access_token is null or empty
      // B. access_token_expire is null
      // C. (access_token_expire - 5 minutes) <= currentTime (expiring in <= 5 mins or expired)
      let needsRefresh = false;
      let refreshReason = "";

      if (!row.access_token) {
        needsRefresh = true;
        refreshReason = "access_token_is_null";
      } else if (!row.access_token_expire) {
        needsRefresh = true;
        refreshReason = "access_token_expire_is_null";
      } else {
        const expireTime = new Date(row.access_token_expire).getTime();
        if (isNaN(expireTime) || (expireTime - FIVE_MINUTES_MS) <= now) {
          needsRefresh = true;
          refreshReason = "access_token_expiring_or_expired";
        }
      }

      if (!needsRefresh) {
        results.push({
          profile_id: profileId,
          status: "skipped",
          reason: `valid_until_${row.access_token_expire}`,
        });
        skippedCount++;
        continue;
      }

      // Resolve client_id and client_secret (fallback to profiles.google_oauth if not in token row)
      let clientId = row.google_client_id;
      let clientSecret = row.google_client_secret;

      if (!clientId || !clientSecret) {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("google_oauth")
          .eq("id", profileId)
          .maybeSingle();

        if (profile?.google_oauth) {
          const conf = profile.google_oauth as Record<string, unknown>;
          const block = (conf.installed || conf.web || conf) as Record<string, unknown>;
          if (!clientId) clientId = (block.client_id || conf.client_id) as string;
          if (!clientSecret) clientSecret = (block.client_secret || conf.client_secret) as string;
        }
      }

      if (!clientId || !clientSecret) {
        results.push({
          profile_id: profileId,
          status: "error",
          error: "missing_client_credentials",
        });
        errorCount++;
        continue;
      }

      // Exchange refresh_token for fresh access_token
      try {
        const params = new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
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
          const errMsg = tokenData.error_description || tokenData.error || `HTTP ${tokenRes.status}`;
          console.error(`Token refresh failed for profile ${profileId}:`, errMsg);
          results.push({
            profile_id: profileId,
            status: "error",
            error: errMsg,
          });
          errorCount++;
          continue;
        }

        const newAccessToken = tokenData.access_token as string;
        const expiresIn = Number(tokenData.expires_in) || 3600;
        const newExpire = new Date(Date.now() + expiresIn * 1000).toISOString();
        const rotatedRefreshToken = tokenData.refresh_token as string | undefined;

        const updateData: Record<string, unknown> = {
          access_token: newAccessToken,
          access_token_expire: newExpire,
        };
        if (rotatedRefreshToken) {
          updateData.google_refresh_token = rotatedRefreshToken;
        }

        const { error: updateErr } = await supabaseAdmin
          .from("profiles_google_tokens")
          .update(updateData)
          .eq("id", row.id);

        if (updateErr) {
          console.error(`Database update failed for profile ${profileId}:`, updateErr);
          results.push({
            profile_id: profileId,
            status: "error",
            error: updateErr.message,
          });
          errorCount++;
        } else {
          results.push({
            profile_id: profileId,
            status: "refreshed",
            reason: refreshReason,
            new_expire: newExpire,
          });
          refreshedCount++;
        }
      } catch (callErr) {
        const errText = callErr instanceof Error ? callErr.message : String(callErr);
        console.error(`Network error refreshing profile ${profileId}:`, errText);
        results.push({
          profile_id: profileId,
          status: "error",
          error: errText,
        });
        errorCount++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        scheduler_run_at: new Date().toISOString(),
        total_rows: rows.length,
        refreshed_count: refreshedCount,
        skipped_count: skippedCount,
        error_count: errorCount,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Scheduler encountered unhandled error:", errorMsg);
    return new Response(
      JSON.stringify({ error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
