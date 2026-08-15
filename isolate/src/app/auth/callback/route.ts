import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAllowedWorkspaceEmail } from "@/lib/supabase/email-policy";

/**
 * OAuth + email-confirmation callback. Supabase redirects here with a
 * `code` (and optional `next`) after the user authenticates; we exchange the
 * code for a session, which sets the auth cookies via the server client.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!isAllowedWorkspaceEmail(user?.email)) {
        // Non-workspace Google account — revoke the session and bounce back.
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/login?error=not-allowed`);
      }
      const redirectTo = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
      return NextResponse.redirect(`${origin}${redirectTo}`);
    }
  }

  // Fallback: return to the login page (with the intended path preserved).
  return NextResponse.redirect(`${origin}/login`);
}
