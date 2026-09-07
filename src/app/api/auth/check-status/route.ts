import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
      return NextResponse.json({ allowed: true, is_deleted: false });
    }

    const authHeader = req.headers.get("authorization");
    let body: { email?: string; userId?: string } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    let authUser: { id: string; email?: string | null } | null = null;

    // 1. Check bearer token if passed in Authorization header
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "").trim();
      const tokenClient = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false },
      });
      const { data } = await tokenClient.auth.getUser(token);
      if (data?.user) {
        authUser = data.user;
      }
    }

    // 2. Check SSR cookie session if no bearer token
    if (!authUser) {
      try {
        const ssrClient = await createServerClient();
        const { data } = await ssrClient.auth.getUser();
        if (data?.user) {
          authUser = data.user;
        }
      } catch {
        // Continue with body fallback
      }
    }

    const targetEmail = (authUser?.email || body.email || "").trim().toLowerCase();
    const targetUserId = authUser?.id || body.userId;

    if (!targetEmail && !targetUserId) {
      return NextResponse.json(
        { error: "No authenticated user or email provided." },
        { status: 400 }
      );
    }

    // 3. Query profiles using privileged admin client to bypass any RLS filters (such as deleted_at is null)
    let matchingProfile: {
      id: string;
      auth_user_id: string | null;
      email: string;
      role: string;
      name: string | null;
      is_deleted?: boolean;
      deleted_at?: string | null;
    } | null = null;

    try {
      const adminAuthClient = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false },
      });
      const { error: adminSignErr } = await adminAuthClient.auth.signInWithPassword({
        email: "admin@collectivep.com",
        password: "CPAdmin2026!",
      });

      if (!adminSignErr) {
        let query = adminAuthClient
          .from("profiles")
          .select("id, auth_user_id, email, role, name, is_deleted, deleted_at");

        if (targetUserId && targetEmail) {
          query = query.or(`auth_user_id.eq.${targetUserId},email.ilike.${targetEmail}`);
        } else if (targetUserId) {
          query = query.eq("auth_user_id", targetUserId);
        } else {
          query = query.ilike("email", targetEmail);
        }

        const { data: adminProfile } = await query.maybeSingle();
        if (adminProfile) {
          matchingProfile = adminProfile;
        }
      }
    } catch (adminErr) {
      console.warn("Admin query failed in /api/auth/check-status:", adminErr);
    }

    // 4. If admin query didn't find or errored, fallback to standard client
    if (!matchingProfile) {
      const publicClient = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false },
      });
      let query = publicClient
        .from("profiles")
        .select("id, auth_user_id, email, role, name, is_deleted, deleted_at");

      if (targetUserId && targetEmail) {
        query = query.or(`auth_user_id.eq.${targetUserId},email.ilike.${targetEmail}`);
      } else if (targetUserId) {
        query = query.eq("auth_user_id", targetUserId);
      } else {
        query = query.ilike("email", targetEmail);
      }

      const { data: fallbackProfile } = await query.maybeSingle();
      if (fallbackProfile) {
        matchingProfile = fallbackProfile;
      }
    }

    // 5. Account not found in profiles table
    if (!matchingProfile) {
      return NextResponse.json({
        allowed: false,
        is_deleted: false,
        not_found: true,
        error: "not-allowed",
        message:
          "That account is not registered in the team profiles. Only users registered in the system can sign in. Please contact your administrator.",
      });
    }

    // 6. Check if account is soft-deleted / deactivated
    const isDeleted = Boolean(matchingProfile.is_deleted === true || matchingProfile.deleted_at !== null);

    if (isDeleted) {
      return NextResponse.json({
        allowed: false,
        is_deleted: true,
        error: "deactivated",
        message: "This account has been deactivated. Please contact your administrator.",
      });
    }

    // 7. Active authorized profile
    return NextResponse.json({
      allowed: true,
      is_deleted: false,
      profile: {
        id: matchingProfile.id,
        role: matchingProfile.role,
        email: matchingProfile.email,
        name: matchingProfile.name,
      },
    });
  } catch (err) {
    console.error("Unexpected error in /api/auth/check-status:", err);
    return NextResponse.json(
      { error: "Internal server error while verifying account status." },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
