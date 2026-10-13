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
  client_type?: "desktop" | "web";
}

/**
 * Extracts and normalizes client credentials from uploaded client_secret_*.json.
 * Google Cloud Console formats JSON under either "web" or "installed" key, or at root.
 * Desktop apps are identified under "installed" key.
 */
export function parseGoogleClientSecretJson(raw: unknown): {
  valid: boolean;
  error?: string;
  config?: GoogleClientConfig;
  rawJson?: Record<string, unknown>;
  isDesktop?: boolean;
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

    const isDesktop = Boolean(parsed.installed && !parsed.web);
    const clientBlock = (parsed.installed || parsed.web || parsed) as Record<string, unknown>;
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

    const redirectUris = Array.isArray(clientBlock.redirect_uris)
      ? (clientBlock.redirect_uris as string[])
      : Array.isArray(parsed.redirect_uris)
      ? (parsed.redirect_uris as string[])
      : undefined;

    return {
      valid: true,
      isDesktop,
      config: {
        client_id: clientId,
        client_secret: clientSecret,
        project_id: (clientBlock.project_id || parsed.project_id) as string | undefined,
        auth_uri: (clientBlock.auth_uri || parsed.auth_uri || "https://accounts.google.com/o/oauth2/auth") as string,
        token_uri: (clientBlock.token_uri || parsed.token_uri || "https://oauth2.googleapis.com/token") as string,
        redirect_uris: redirectUris,
        client_type: isDesktop ? "desktop" : "web",
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
}): { url: string; redirectUri: string; clientId: string; isDesktop: boolean } {
  const { profileId, googleOAuth, returnUrl, preferredRedirectUri } = options;

  const parsed = parseGoogleClientSecretJson(googleOAuth);
  if (!parsed.valid || !parsed.config?.client_id) {
    throw new Error(parsed.error || "Invalid Google OAuth configuration on profile");
  }

  const { client_id, auth_uri, redirect_uris, client_type } = parsed.config;
  const authBase = auth_uri || "https://accounts.google.com/o/oauth2/auth";
  const isDesktop = client_type === "desktop" || Boolean(parsed.isDesktop);

  // Determine redirect URI:
  // For Desktop (Installed) Apps:
  // Google strictly allows loopback (http://localhost or http://127.0.0.1).
  // Non-loopback URIs are rejected by Google with 400 invalid_request.
  let selectedRedirectUri = preferredRedirectUri;

  if (!selectedRedirectUri) {
    if (isDesktop) {
      // If we are currently browsing on localhost (e.g. localhost:3000 during dev/pm2)
      if (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
        selectedRedirectUri = `${window.location.origin}/api/auth/google/callback`;
      } else if (redirect_uris && redirect_uris.length > 0 && redirect_uris[0].startsWith("http://localhost")) {
        selectedRedirectUri = redirect_uris[0];
      } else {
        selectedRedirectUri = "http://localhost";
      }
    } else {
      // For Web applications:
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
      const edgeFunctionCallback = supabaseUrl ? `${supabaseUrl}/functions/v1/google-oauth-callback` : "";

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
  }

  const statePayload = JSON.stringify({
    profile_id: profileId,
    return_url: returnUrl || (typeof window !== "undefined" ? window.location.href : "/"),
    is_desktop: isDesktop,
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
    isDesktop,
  };
}
