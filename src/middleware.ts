import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isWorkspaceEmail } from "@/lib/supabase/email-policy";

function getPublicOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  const host = request.headers.get("host");
  if (host && !host.startsWith("localhost") && !host.startsWith("127.0.0.1")) {
    return `https://${host}`;
  }

  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }

  return request.nextUrl.origin;
}

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
  const isApiRoute = pathname.startsWith("/api");
  const origin = getPublicOrigin(request);

  // API routes handle their own authentication and return JSON, not HTML redirects
  if (isApiRoute) {
    return supabaseResponse;
  }

  // Workspace policy: Accounts must have an active profile in public.profiles,
  // or be an @collectivep.com workspace account or have an authorized role.
  let userRole = user?.user_metadata?.role as string | undefined;
  if (user && user.email) {
    let isAllowed = false;
    if (userRole === "admin" || userRole === "member" || userRole === "guest" || isWorkspaceEmail(user.email)) {
      isAllowed = true;
    } else {
      // Check if user exists in table profiles.email
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, role, is_deleted, deleted_at")
        .ilike("email", user.email.trim())
        .eq("is_deleted", false)
        .is("deleted_at", null)
        .maybeSingle();

      if (profile) {
        isAllowed = true;
        if (!userRole && profile.role) {
          userRole = profile.role;
        }
      }
    }

    if (!isAllowed) {
      try {
        await supabase.auth.signOut();
      } catch {
        // Proceed with the redirect even if the revocation call fails.
      }
      const loginUrl = new URL("/login?error=not-allowed", origin);
      const redirect = NextResponse.redirect(loginUrl);
      // Carry the cleared session cookies from supabaseResponse onto the redirect.
      for (const cookie of supabaseResponse.cookies.getAll()) {
        redirect.cookies.set(cookie);
      }
      return redirect;
    }
  }

  // Admin-only route guard: /users, /reports, /sales are restricted from members & guests
  const isAdminOnlyRoute =
    pathname === "/users" ||
    pathname.startsWith("/users/") ||
    pathname === "/reports" ||
    pathname.startsWith("/reports/") ||
    pathname === "/sales" ||
    pathname.startsWith("/sales/");

  if (user && isAdminOnlyRoute && userRole && userRole !== "admin") {
    return NextResponse.redirect(new URL("/", origin));
  }

  // Signed out users can only reach auth routes.
  if (!user && !isAuthRoute) {
    const loginUrl = new URL("/login", origin);
    if (pathname !== "/") {
      loginUrl.searchParams.set("returnTo", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // Signed in users are bounced away from the login page.
  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL("/", origin));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Run on everything except Next internals and static assets.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
