// Supabase Edge Function: manage-calendar
// Location: supabase/functions/manage-calendar/index.ts
//
// Standalone Edge Function for Google Calendar event management using GoogleAuth

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Pustaka Google Auth khusus untuk runtime Deno / Edge.
 * Menginisialisasi autentikasi Google JWT Service Account dan mendapatkan token akses yang valid secara otomatis.
 */
export class GoogleAuth {
  private scope: string[];
  private credentials: {
    client_email?: string;
    private_key?: string;
  };

  constructor(options: {
    scope?: string[];
    credentials: { client_email?: string; private_key?: string };
  }) {
    this.scope = options.scope || ["https://www.googleapis.com/auth/calendar"];
    this.credentials = options.credentials;
  }

  async getToken(): Promise<string> {
    if (!this.credentials?.client_email || !this.credentials?.private_key) {
      throw new Error("Missing client_email or private_key in service account credentials");
    }

    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 3600;

    const header = { alg: "RS256", typ: "JWT" };
    const claims = {
      iss: this.credentials.client_email,
      scope: this.scope.join(" "),
      aud: "https://oauth2.googleapis.com/token",
      exp,
      iat,
    };

    const enc = new TextEncoder();
    const b64Url = (bytes: Uint8Array) => {
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    };

    const headerB64 = b64Url(enc.encode(JSON.stringify(header)));
    const claimsB64 = b64Url(enc.encode(JSON.stringify(claims)));
    const signingInput = `${headerB64}.${claimsB64}`;

    // Normalisasi private key (baik dengan newline asli maupun newline ter-escape)
    const rawKey = this.credentials.private_key.replace(/\\n/g, "\n");
    const cleanPem = rawKey
      .replace(/-----BEGIN [A-Z ]+-----/g, "")
      .replace(/-----END [A-Z ]+-----/g, "")
      .replace(/\s+/g, "");

    const binaryDer = Uint8Array.from(atob(cleanPem), (c) => c.charCodeAt(0));

    const cryptoKey = await crypto.subtle.importKey(
      "pkcs8",
      binaryDer.buffer,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBuffer = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      enc.encode(signingInput)
    );

    const signatureB64 = b64Url(new Uint8Array(signatureBuffer));
    const jwt = `${signingInput}.${signatureB64}`;

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      throw new Error(`Google token exchange failed (${tokenResponse.status}): ${errText}`);
    }

    const tokenData = await tokenResponse.json();
    return tokenData.access_token;
  }
}

/**
 * Exchanges a Google OAuth refresh token for a fresh access token.
 */
async function getGoogleAccessTokenFromRefreshToken(
  refreshToken: string,
  clientId?: string | null,
  clientSecret?: string | null
): Promise<string> {
  const params = new URLSearchParams();
  params.set("grant_type", "refresh_token");
  params.set("refresh_token", refreshToken.trim());
  if (clientId && clientId.trim()) {
    params.set("client_id", clientId.trim());
  }
  if (clientSecret && clientSecret.trim()) {
    params.set("client_secret", clientSecret.trim());
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google token refresh failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error("Google token refresh did not return an access_token");
  }
  return data.access_token;
}

serve(async (req: Request) => {
  // Menangani preflight request CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, calendarId = "primary", eventId, eventData } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    let rawRefreshToken: string | null = null;
    let clientId: string | null = null;
    let clientSecret: string | null = null;
    let apiKey: string | null = null;
    let credentials: any = null;

    // 1. Ambil config terkait Google dari public.app_config (fallback ke Deno.env)
    if (supabaseUrl && supabaseServiceKey) {
      try {
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const { data: configRows } = await supabaseAdmin
          .from("app_config")
          .select("key, value")
          .in("key", [
            "GOOGLE_REFRESH_TOKEN",
            "GOOGLE_CLIENT_ID",
            "GOOGLE_CLIENT_SECRET",
            "GOOGLE_OAUTH_CLIENT_ID",
            "GOOGLE_OAUTH_CLIENT_SECRET",
            "GOOGLE_SERVICE_ACCOUNT_KEY",
            "GOOGLE_CALENDAR_API_KEY",
          ]);

        if (Array.isArray(configRows)) {
          for (const row of configRows) {
            if (row.key === "GOOGLE_REFRESH_TOKEN") rawRefreshToken = row.value;
            if (row.key === "GOOGLE_CLIENT_ID" || row.key === "GOOGLE_OAUTH_CLIENT_ID") clientId = row.value;
            if (row.key === "GOOGLE_CLIENT_SECRET" || row.key === "GOOGLE_OAUTH_CLIENT_SECRET") clientSecret = row.value;
            if (row.key === "GOOGLE_SERVICE_ACCOUNT_KEY") {
              credentials = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
            }
            if (row.key === "GOOGLE_CALENDAR_API_KEY") apiKey = row.value;
          }
        }
      } catch (dbErr) {
        console.warn("Could not query Google credentials from app_config:", dbErr);
      }
    }

    if (!rawRefreshToken) rawRefreshToken = Deno.env.get("GOOGLE_REFRESH_TOKEN") || null;
    if (!clientId) clientId = Deno.env.get("GOOGLE_CLIENT_ID") || Deno.env.get("GOOGLE_OAUTH_CLIENT_ID") || null;
    if (!clientSecret) clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET") || Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET") || null;

    let refreshToken = rawRefreshToken;
    if (rawRefreshToken && typeof rawRefreshToken === "string" && rawRefreshToken.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(rawRefreshToken);
        if (parsed.refresh_token || parsed.refreshToken) refreshToken = parsed.refresh_token || parsed.refreshToken;
        if (!clientId && (parsed.client_id || parsed.clientId)) clientId = parsed.client_id || parsed.clientId;
        if (!clientSecret && (parsed.client_secret || parsed.clientSecret)) clientSecret = parsed.client_secret || parsed.clientSecret;
      } catch (_e) {
        // treat as raw
      }
    }

    let token: string | null = null;
    if (refreshToken) {
      token = await getGoogleAccessTokenFromRefreshToken(refreshToken, clientId, clientSecret);
    } else if (credentials) {
      const auth = new GoogleAuth({
        scope: ["https://www.googleapis.com/auth/calendar"],
        credentials,
      });
      token = await auth.getToken();
    } else {
      apiKey = apiKey || Deno.env.get("GOOGLE_CALENDAR_API_KEY") || null;
    }

    if (!token && !apiKey) {
      throw new Error("Missing GOOGLE_REFRESH_TOKEN or other credentials in app_config or environment secrets");
    }

    let url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
    let method = "POST";

    // Jika operasinya adalah UPDATE, sesuaikan URL dan Method HTTP
    if (action === "update") {
      if (!eventId) throw new Error("eventId is required for update action");
      url = `${url}/${encodeURIComponent(eventId)}`;
      method = "PUT";
    }

    const queryParams = new URLSearchParams({ sendUpdates: "all" });
    if (apiKey) {
      queryParams.set("key", apiKey);
    }

    const requestHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      requestHeaders["X-Goog-Api-Key"] = apiKey;
    }
    if (token) {
      requestHeaders["Authorization"] = `Bearer ${token}`;
    }

    // Pastikan eventData memiliki time range valid jika start & end ditentukan (cegah error timeRangeEmpty)
    if (eventData && (eventData.start || eventData.end)) {
      const startVal = eventData.start?.dateTime || eventData.start?.date;
      const endVal = eventData.end?.dateTime || eventData.end?.date;
      const startDate = startVal ? new Date(startVal) : new Date();
      let endDate = endVal ? new Date(endVal) : null;
      if (!endDate || isNaN(endDate.getTime()) || endDate.getTime() <= startDate.getTime()) {
        const safeEndDate = new Date(startDate.getTime() + 60 * 60 * 1000);
        if (eventData.start?.dateTime || !eventData.start?.date) {
          eventData.end = {
            ...(eventData.end || {}),
            dateTime: safeEndDate.toISOString(),
            timeZone: eventData.end?.timeZone || eventData.start?.timeZone || "Asia/Singapore",
          };
        } else {
          eventData.end = {
            ...(eventData.end || {}),
            date: safeEndDate.toISOString().split("T")[0],
          };
        }
      }
    }

    // 3. Panggil HTTP REST API Google Calendar langsung
    const response = await fetch(`${url}?${queryParams.toString()}`, {
      method: method,
      headers: requestHeaders,
      body: JSON.stringify(eventData),
    });

    const result = await response.json();

    if (!response.ok) {
      return new Response(JSON.stringify({ error: result }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
