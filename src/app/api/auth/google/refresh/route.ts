import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
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
    const body = await req.json().catch(() => ({}));
    let profileId = body.profile_id || body.profileId || null;
    const waNumber = body.wa_number || body.waNumber || body.phone || null;
    const forceRefresh = Boolean(body.force_refresh || body.forceRefresh);
    const explicitAccessToken = body.access_token || body.accessToken || null;
    const explicitExpire = body.access_token_expire || body.accessTokenExpire || null;

    // 1. Resolve profile_id from wa_number if needed
    if (!profileId && waNumber) {
      const cleanNumber = String(waNumber).replace(/[^0-9+]/g, "");
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("wa_number", cleanNumber)
        .maybeSingle();

      if (profile?.id) {
        profileId = profile.id;
      } else {
        const altNumber = cleanNumber.startsWith("+") ? cleanNumber.slice(1) : `+${cleanNumber}`;
        const { data: altProfile } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("wa_number", altNumber)
          .maybeSingle();
        if (altProfile?.id) profileId = altProfile.id;
      }
    }

    if (!profileId) {
      return NextResponse.json(
        { error: "profile_id or wa_number is required" },
        { status: 400 }
      );
    }

    // 2. Fetch token row from profiles_google_tokens
    const { data: tokenRow, error: tokenErr } = await supabaseAdmin
      .from("profiles_google_tokens")
      .select("id, profile_id, google_client_id, google_client_secret, google_refresh_token, access_token, access_token_expire")
      .eq("profile_id", profileId)
      .maybeSingle();

    if (tokenErr) {
      return NextResponse.json({ error: tokenErr.message }, { status: 500 });
    }

    if (!tokenRow) {
      return NextResponse.json(
        {
          error: "not_found",
          message: `No credentials found in profiles_google_tokens for profile_id: ${profileId}. Please ask an admin to register OAuth2 Google manually.`,
          profile_id: profileId,
        },
        { status: 404 }
      );
    }

    // 3. Direct update if caller supplied an explicit access_token
    if (explicitAccessToken) {
      const finalExpire =
        explicitExpire || new Date(Date.now() + 3500 * 1000).toISOString();

      const { error: updateErr } = await supabaseAdmin
        .from("profiles_google_tokens")
        .update({
          access_token: explicitAccessToken,
          access_token_expire: finalExpire,
        })
        .eq("profile_id", profileId);

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        updated: true,
        reused: false,
        profile_id: profileId,
        access_token: explicitAccessToken,
        access_token_expire: finalExpire,
      });
    }

    // 4. Check if current access token is valid and unexpired
    const isValid = Boolean(
      tokenRow.access_token &&
      tokenRow.access_token_expire &&
      new Date(tokenRow.access_token_expire).getTime() > Date.now() + 60_000
    );

    if (isValid && !forceRefresh) {
      return NextResponse.json({
        success: true,
        reused: true,
        refreshed: false,
        profile_id: profileId,
        access_token: tokenRow.access_token,
        access_token_expire: tokenRow.access_token_expire,
      });
    }

    // 5. Need refresh: check refresh credentials
    const refreshToken = tokenRow.google_refresh_token;
    let clientId = tokenRow.google_client_id;
    let clientSecret = tokenRow.google_client_secret;

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
      return NextResponse.json(
        {
          error: "missing_refresh_token",
          message: "google_refresh_token is missing. User must link Google Workspace account.",
          profile_id: profileId,
        },
        { status: 400 }
      );
    }

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        {
          error: "missing_client_credentials",
          message: "google_client_id or google_client_secret is missing.",
          profile_id: profileId,
        },
        { status: 400 }
      );
    }

    // 6. Refresh token against Google
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

      return NextResponse.json(
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
        { status: tokenRes.status >= 400 && tokenRes.status < 500 ? tokenRes.status : 400 }
      );
    }

    const newAccessToken = tokenData.access_token as string;
    const expiresIn = Number(tokenData.expires_in) || 3600;
    const newExpire = new Date(Date.now() + expiresIn * 1000).toISOString();
    const rotatedRefreshToken = tokenData.refresh_token as string | undefined;

    // 7. Persist regenerated token to profiles_google_tokens
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
      return NextResponse.json({
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

    return NextResponse.json({
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
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
