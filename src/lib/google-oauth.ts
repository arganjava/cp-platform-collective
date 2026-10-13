/**
 * Google Workspace OAuth Utility Helpers
 */

export const GOOGLE_WORKSPACE_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "openid",
];

export interface GoogleClientConfig {
  client_id?: string;
  client_secret?: string;
  project_id?: string;
  auth_uri?: string;
  token_uri?: string;
  redirect_uris?: string[];
}

/**
 * Extracts and normalizes client credentials from uploaded client_secret_*.json.
 * Google Cloud Console formats JSON under either "web" or "installed" key, or at root.
 */
export function parseGoogleClientSecretJson(raw: unknown): {
  valid: boolean;
  error?: string;
  config?: GoogleClientConfig;
  rawJson?: Record<string, unknown>;
} {
  try {
    let parsed: Record<string, unknown>;
    if (typeof raw === "string") {
      parsed = JSON.parse(raw);
    } else if (raw && typeof raw === "object") {
      parsed = raw as Record<string, unknown>;
    } else {
      return { valid: false, error: "Invalid JSON format" };
    }

    const clientBlock = (parsed.web || parsed.installed || parsed) as Record<string, unknown>;
    const clientId = (clientBlock.client_id || parsed.client_id) as string | undefined;
    const clientSecret = (clientBlock.client_secret || parsed.client_secret) as string | undefined;

    if (!clientId || typeof clientId !== "string") {
      return {
        valid: false,
        error: "Missing 'client_id' in uploaded file. Please upload a valid client_secret_*.json file from Google Cloud Console.",
      };
    }

    if (!clientSecret || typeof clientSecret !== "string") {
      return {
        valid: false,
        error: "Missing 'client_secret' in uploaded file.",
      };
    }

    return {
      valid: true,
      config: {
        client_id: clientId,
        client_secret: clientSecret,
        project_id: (clientBlock.project_id || parsed.project_id) as string | undefined,
        auth_uri: (clientBlock.auth_uri || parsed.auth_uri || "https://accounts.google.com/o/oauth2/auth") as string,
        token_uri: (clientBlock.token_uri || parsed.token_uri || "https://oauth2.googleapis.com/token") as string,
        redirect_uris: Array.isArray(clientBlock.redirect_uris) ? (clientBlock.redirect_uris as string[]) : undefined,
      },
      rawJson: parsed,
    };
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : "Failed to parse JSON file" };
  }
}

/**
 * Generates the full Google OAuth authorization URL for linking Google Workspace.
 */
export function buildGoogleOAuthUrl(options: {
  profileId: string;
  googleOAuth: Record<string, unknown>;
  returnUrl?: string;
  preferredRedirectUri?: string;
}): { url: string; redirectUri: string; clientId: string } {
  const { profileId, googleOAuth, returnUrl, preferredRedirectUri } = options;

  const parsed = parseGoogleClientSecretJson(googleOAuth);
  if (!parsed.valid || !parsed.config?.client_id) {
    throw new Error(parsed.error || "Invalid Google OAuth configuration on profile");
  }

  const { client_id, auth_uri, redirect_uris } = parsed.config;
  const authBase = auth_uri || "https://accounts.google.com/o/oauth2/auth";

  // Determine redirect URI:
  // 1. If preferredRedirectUri is provided and matches or requested
  // 2. Or check redirect_uris from JSON if available
  // 3. Or default to standard edge function / callback URL
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const edgeFunctionCallback = supabaseUrl ? `${supabaseUrl}/functions/v1/google-oauth-callback` : "";

  let selectedRedirectUri = preferredRedirectUri;
  if (!selectedRedirectUri) {
    if (edgeFunctionCallback) {
      selectedRedirectUri = edgeFunctionCallback;
    } else if (redirect_uris && redirect_uris.length > 0) {
      selectedRedirectUri = redirect_uris[0];
    } else if (typeof window !== "undefined") {
      selectedRedirectUri = `${window.location.origin}/api/auth/google/callback`;
    } else {
      selectedRedirectUri = "http://localhost:3000/api/auth/google/callback";
    }
  }

  const statePayload = JSON.stringify({
    profile_id: profileId,
    return_url: returnUrl || (typeof window !== "undefined" ? window.location.href : "/"),
  });

  const stateParam = typeof btoa !== "undefined" ? btoa(statePayload) : Buffer.from(statePayload).toString("base64");

  const params = new URLSearchParams({
    client_id,
    redirect_uri: selectedRedirectUri,
    response_type: "code",
    scope: GOOGLE_WORKSPACE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: stateParam,
  });

  return {
    url: `${authBase}?${params.toString()}`,
    redirectUri: selectedRedirectUri,
    clientId: client_id,
  };
}
