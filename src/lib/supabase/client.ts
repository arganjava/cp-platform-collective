import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True when the required public env vars are present. */
export const isSupabaseConfigured = Boolean(url && anonKey);

let browserClient: SupabaseClient | null = null;

/**
 * Lazily-created browser client. Throws a descriptive error when the
 * environment is not configured so callers can surface it instead of
 * crashing silently during render.
 */
export function getSupabase(): SupabaseClient {
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

/**
 * Test-only hook: swap in a pre-authenticated client (e.g. a Node client
 * signed in with the admin account, used by the live integration tests) so
 * the shared data layer runs against real Supabase + RLS. Pass null to reset
 * back to the lazy browser client.
 */
export function setSupabaseClientForTesting(client: SupabaseClient | null) {
  browserClient = client;
}
