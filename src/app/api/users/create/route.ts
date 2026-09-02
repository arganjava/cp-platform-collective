import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function formatError(err: unknown): string {
  if (!err) return "An unexpected error occurred.";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  if (typeof err === "object") {
    const record = err as Record<string, unknown>;
    if (typeof record.message === "string" && record.message) return record.message;
    if (typeof record.error_description === "string" && record.error_description) return record.error_description;
    if (typeof record.error === "string" && record.error) return record.error;
    if (typeof record.msg === "string" && record.msg) return record.msg;
    if (typeof record.details === "string" && record.details) return record.details;
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password, role = "guest", avatarColor = "var(--primary)", avatar_color } = body;

    if (!name || !email) {
      return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();
    const resolvedAvatarColor = avatar_color || avatarColor || "var(--primary)";
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
        email: normalizedEmail,
        password: initialPassword,
        email_confirm: true,
        user_metadata: {
          name: trimmedName,
          role: validatedRole,
        },
      });

      if (authError) {
        const errMsg = (authError.message || "").toLowerCase();
        const errStatus = (authError as unknown as { status?: number }).status;
        if (
          errMsg.includes("already registered") ||
          errMsg.includes("already been registered") ||
          errMsg.includes("already exists") ||
          errStatus === 422
        ) {
          const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
          const existingUser = listData?.users?.find(
            (u) => u.email?.toLowerCase() === normalizedEmail
          );
          if (existingUser) {
            authUserId = existingUser.id;
            if (password && password.length >= 6) {
              await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
                password,
                user_metadata: { name: trimmedName, role: validatedRole },
              });
            }
          }
        } else {
          throw authError;
        }
      } else if (authData?.user) {
        authUserId = authData.user.id;
      }

      // Safe profile lookup, update or insert in public.profiles
      let existingProfile = null;

      if (authUserId) {
        const { data: byAuthId } = await supabaseAdmin
          .from("profiles")
          .select("*")
          .eq("auth_user_id", authUserId)
          .maybeSingle();
        if (byAuthId) {
          existingProfile = byAuthId;
        }
      }

      if (!existingProfile) {
        const { data: byEmail } = await supabaseAdmin
          .from("profiles")
          .select("*")
          .ilike("email", normalizedEmail)
          .maybeSingle();
        if (byEmail) {
          existingProfile = byEmail;
        }
      }

      const profileData: Record<string, unknown> = {
        name: trimmedName,
        email: normalizedEmail,
        role: validatedRole,
        avatar_color: resolvedAvatarColor,
        is_deleted: false,
        deleted_at: null,
      };

      if (authUserId) {
        profileData.auth_user_id = authUserId;
      }

      let finalProfile = null;

      if (existingProfile) {
        const { data: updated, error: updateError } = await supabaseAdmin
          .from("profiles")
          .update(profileData)
          .eq("id", existingProfile.id)
          .select()
          .maybeSingle();

        if (updateError) {
          throw updateError;
        }
        finalProfile = updated || { ...existingProfile, ...profileData };
      } else {
        const { data: inserted, error: insertError } = await supabaseAdmin
          .from("profiles")
          .insert(profileData)
          .select()
          .maybeSingle();

        if (insertError) {
          const { data: fallbackProfile } = await supabaseAdmin
            .from("profiles")
            .select("*")
            .ilike("email", normalizedEmail)
            .maybeSingle();

          if (fallbackProfile) {
            finalProfile = fallbackProfile;
          } else {
            throw insertError;
          }
        } else {
          finalProfile = inserted;
        }
      }

      return NextResponse.json({
        success: true,
        user: finalProfile,
        authUserId,
      });
    }

    // Default response if running in local mode
    return NextResponse.json({
      success: true,
      user: {
        id: `user-${Date.now()}`,
        name: trimmedName,
        email: normalizedEmail,
        role: validatedRole,
        avatar_color: resolvedAvatarColor,
        is_deleted: false,
      },
    });
  } catch (error: unknown) {
    const message = formatError(error);
    return NextResponse.json({ error: message, details: typeof error === "object" && error !== null ? error : undefined }, { status: 500 });
  }
}
