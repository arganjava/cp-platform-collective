import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  return handleRefresh(req);
}

export async function POST(req: NextRequest) {
  return handleRefresh(req);
}

async function handleRefresh(_req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Server missing Supabase configuration" },
      { status: 500 }
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const now = Date.now();
    const FIVE_MINUTES_MS = 5 * 60 * 1000;

    const { data: tokenRows, error: fetchErr } = await supabaseAdmin
      .from("profiles_google_tokens")
      .select("id, profile_id, google_client_id, google_client_secret, google_refresh_token, access_token, access_token_expire")
      .not("google_refresh_token", "is", null);

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    const rows = tokenRows || [];
    const results = [];
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
      } catch (err) {
        results.push({
          profile_id: profileId,
          status: "error",
          error: err instanceof Error ? err.message : String(err),
        });
        errorCount++;
      }
    }

    return NextResponse.json({
      success: true,
      scheduler_run_at: new Date().toISOString(),
      total_rows: rows.length,
      refreshed_count: refreshedCount,
      skipped_count: skippedCount,
      error_count: errorCount,
      results,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
