import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True when the required public env vars are present. */
export const isSupabaseConfigured = Boolean(url && anonKey);

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Lazily-created browser client. Throws a descriptive error when the
 * environment is not configured so callers can surface it instead of
 * crashing silently during render.
 */
export function getSupabase() {
  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your environment."
    );
  }
  if (!browserClient) {
    browserClient = createBrowserClient(url, anonKey);
  }
  return browserClient;
}
