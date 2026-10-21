import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const reqUrl = req.nextUrl;
  const code = reqUrl.searchParams.get("code");
  const rawState = reqUrl.searchParams.get("state");
  const errorParam = reqUrl.searchParams.get("error");
  const errorDescription = reqUrl.searchParams.get("error_description");

  let stateData: { profile_id?: string; return_url?: string } = {};
  if (rawState) {
    try {
      stateData = JSON.parse(rawState);
    } catch {
      try {
        stateData = JSON.parse(Buffer.from(rawState, "base64").toString("utf-8"));
      } catch {
        stateData = { profile_id: rawState };
      }
    }
  }

  const returnBase = stateData.return_url || `${reqUrl.origin}/`;

  if (errorParam) {
    const errorMsg = errorDescription || errorParam;
    const dest = new URL(returnBase);
    dest.searchParams.set("google_linked", "error");
    dest.searchParams.set("error", errorMsg);
    return NextResponse.redirect(dest);
  }

  if (!code || !stateData.profile_id) {
    const dest = new URL(returnBase);
    dest.searchParams.set("google_linked", "error");
    dest.searchParams.set("error", "Missing code or profile_id");
    return NextResponse.redirect(dest);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    const dest = new URL(returnBase);
    dest.searchParams.set("google_linked", "error");
    dest.searchParams.set("error", "Supabase credentials not configured");
    return NextResponse.redirect(dest);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("id, name, email, google_oauth")
      .eq("id", stateData.profile_id)
      .maybeSingle();

    if (profileErr || !profile) {
      throw new Error(`Profile not found: ${stateData.profile_id}`);
    }

    const oauthConfig = (profile.google_oauth as Record<string, unknown>) || {};
    const webConfig = (oauthConfig.web || oauthConfig.installed || oauthConfig) as Record<string, unknown>;

    const clientId = (webConfig.client_id || oauthConfig.client_id) as string | undefined;
    const clientSecret = (webConfig.client_secret || oauthConfig.client_secret) as string | undefined;
    const tokenUri = (webConfig.token_uri || oauthConfig.token_uri || "https://oauth2.googleapis.com/token") as string;

    if (!clientId || !clientSecret) {
      throw new Error("Missing client_id or client_secret in profile.google_oauth");
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
      throw new Error(tokenData.error_description || tokenData.error || "Token exchange failed");
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

    const expiresInSec = Number(tokenData.expires_in) || 3600;
    const accessTokenExpire = new Date(Date.now() + expiresInSec * 1000).toISOString();

    const { error: upsertErr } = await supabaseAdmin
      .from("profiles_google_tokens")
      .upsert(
        {
          profile_id: profile.id,
          google_client_id: clientId,
          google_client_secret: clientSecret,
          google_refresh_token: finalRefreshToken,
          access_token: (tokenData.access_token as string) || null,
          access_token_expire: accessTokenExpire,
          created_at: new Date().toISOString(),
        },
        { onConflict: "profile_id" }
      );

    if (upsertErr) {
      throw new Error(`Database error: ${upsertErr.message}`);
    }

    const dest = new URL(returnBase);
    dest.searchParams.set("google_linked", "success");
    dest.searchParams.set("profile_id", profile.id);
    return NextResponse.redirect(dest);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const dest = new URL(returnBase);
    dest.searchParams.set("google_linked", "error");
    dest.searchParams.set("error", errorMsg);
    return NextResponse.redirect(dest);
  }
}
