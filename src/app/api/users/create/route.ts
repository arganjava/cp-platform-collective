import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password, role = "guest", avatarColor = "var(--primary)" } = body;

    if (!name || !email) {
      return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
    }

    const validatedRole: "admin" | "guest" = role === "admin" ? "admin" : "guest";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // If Supabase service role key is configured, create the auth user
    if (supabaseUrl && serviceRoleKey) {
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      let authUserId: string | null = null;
      const initialPassword = password && password.length >= 6 ? password : `CP${Math.random().toString(36).slice(-8)}!`;

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password: initialPassword,
        email_confirm: true,
        user_metadata: {
          name: name.trim(),
          role: validatedRole,
        },
      });

      if (authError) {
        if (authError.message.toLowerCase().includes("already registered") || (authError as unknown as { status?: number }).status === 422) {
          const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
          const existingUser = listData?.users?.find(
            (u) => u.email?.toLowerCase() === email.trim().toLowerCase()
          );
          if (existingUser) {
            authUserId = existingUser.id;
            if (password && password.length >= 6) {
              await supabaseAdmin.auth.admin.updateUserById(existingUser.id, { password });
            }
          } else {
            throw authError;
          }
        } else {
          throw authError;
        }
      } else if (authData?.user) {
        authUserId = authData.user.id;
      }

      const { data: profile, error: profileErr } = await supabaseAdmin
        .from("profiles")
        .upsert(
          {
            name: name.trim(),
            email: email.trim().toLowerCase(),
            role: validatedRole,
            avatar_color: avatarColor,
            auth_user_id: authUserId,
            is_deleted: false,
            deleted_at: null,
          },
          { onConflict: "email" }
        )
        .select()
        .single();

      if (profileErr) throw profileErr;

      return NextResponse.json({
        success: true,
        user: profile,
        authUserId,
      });
    }

    // Default response if running in local mode
    return NextResponse.json({
      success: true,
      user: {
        id: `user-${Date.now()}`,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role: validatedRole,
        avatar_color: avatarColor,
        is_deleted: false,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create user";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
