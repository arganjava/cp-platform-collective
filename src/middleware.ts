import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAllowedWorkspaceEmail } from "@/lib/supabase/email-policy";

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Not configured yet — pass through so the app can render a setup notice.
  if (!url || !anonKey) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Refreshing the session is important: it keeps the auth cookie valid even
  // when the access token expires.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname === "/login" || pathname.startsWith("/auth");

  // Workspace policy: only @collectivep.com accounts may use the app.
  if (user && !isAllowedWorkspaceEmail(user.email)) {
    try {
      await supabase.auth.signOut();
    } catch {
      // Proceed with the redirect even if the revocation call fails.
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("error", "not-allowed");
    const redirect = NextResponse.redirect(loginUrl);
    // Carry the cleared session cookies from supabaseResponse onto the redirect.
    for (const cookie of supabaseResponse.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
    return redirect;
  }

  // Signed out users can only reach auth routes.
  if (!user && !isAuthRoute) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    // Clear any original query first, then set returnTo (order matters —
    // assigning search after searchParams would wipe the param we just set).
    redirect.search = "";
    redirect.searchParams.set("returnTo", pathname);
    return NextResponse.redirect(redirect);
  }

  // Signed in users are bounced away from the login page.
  if (user && isAuthRoute) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/";
    redirect.search = "";
    return NextResponse.redirect(redirect);
  }

  // Check role-based access for protected routes
  if (user && pathname === "/sales") {
    // Get user profile to check role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("auth_user_id", user.id)
      .single();

    if (profile?.role === "guest") {
      // Redirect guests away from /sales
      const redirect = request.nextUrl.clone();
      redirect.pathname = "/";
      redirect.search = "";
      return NextResponse.redirect(redirect);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Run on everything except Next internals and static assets.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
