import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { WORKSPACE_EMAIL_DOMAIN } from "@/lib/supabase/email-policy";

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
    const { id, name, role, avatarColor, avatar_color, is_deleted, deleted_at } = body;

    if (!id) {
      return NextResponse.json({ error: "User ID is required." }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    const authHeader = req.headers.get("authorization");

    // 1. Primary path: If Supabase service role key is configured, perform admin update
    if (supabaseUrl && serviceRoleKey) {
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // Find the profile
      let targetProfile = null;
      const { data: byId } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (byId) {
        targetProfile = byId;
      } else {
        const { data: byAuth } = await supabaseAdmin
          .from("profiles")
          .select("*")
          .eq("auth_user_id", id)
          .maybeSingle();
        if (byAuth) {
          targetProfile = byAuth;
        }
      }

      if (!targetProfile) {
        return NextResponse.json({ error: `User with ID ${id} not found.` }, { status: 404 });
      }

      const targetEmail = (targetProfile.email || "").trim().toLowerCase();
      const domain = targetEmail.split("@").pop()?.toLowerCase();
      const isCollectiveEmail = domain === WORKSPACE_EMAIL_DOMAIN;

      // Validate role changes against email policy
      if (role) {
        if (role === "admin" && !isCollectiveEmail) {
          return NextResponse.json(
            {
              error:
                "Accounts with non-@collectivep.com emails cannot be assigned the Admin role. The Admin role requires an email address with the @collectivep.com domain.",
            },
            { status: 400 }
          );
        }

        if (role === "member" && !isCollectiveEmail) {
          return NextResponse.json(
            {
              error:
                "Accounts with non-@collectivep.com emails cannot be assigned the Member role. The Member role requires an email address with the @collectivep.com domain.",
            },
            { status: 400 }
          );
        }
      }

      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name.trim();
      if (role !== undefined) updateData.role = role;
      if (avatar_color || avatarColor) {
        updateData.avatar_color = avatar_color || avatarColor;
      }
      if (is_deleted !== undefined) updateData.is_deleted = is_deleted;
      if (deleted_at !== undefined) updateData.deleted_at = deleted_at;

      const { data: updated, error: updateError } = await supabaseAdmin
        .from("profiles")
        .update(updateData)
        .eq("id", targetProfile.id)
        .select()
        .maybeSingle();

      if (updateError) {
        throw updateError;
      }

      // Also update auth user metadata if auth_user_id exists
      if (targetProfile.auth_user_id && (name !== undefined || role !== undefined)) {
        try {
          await supabaseAdmin.auth.admin.updateUserById(targetProfile.auth_user_id, {
            user_metadata: {
              ...(name ? { name: name.trim() } : {}),
              ...(role ? { role } : {}),
            },
          });
        } catch (authErr) {
          console.warn("Could not sync auth metadata for user:", authErr);
        }
      }

      return NextResponse.json({
        success: true,
        user: updated || { ...targetProfile, ...updateData },
      });
    }

    // 2. Secondary path: If caller provided an active Supabase user session token,
    // attempt to perform the update through the authenticated user client (subject to RLS)
    if (supabaseUrl && anonKey && authHeader) {
      const authClient = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: authHeader } },
      });

      // Verify caller session
      const {
        data: { user: callerUser },
        error: callerError,
      } = await authClient.auth.getUser();

      if (callerError || !callerUser) {
        return NextResponse.json(
          { error: "Authentication session invalid or expired.", code: "UNAUTHORIZED" },
          { status: 401 }
        );
      }

      // Find the profile
      let targetProfile = null;
      const { data: byId } = await authClient
        .from("profiles")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (byId) {
        targetProfile = byId;
      } else {
        const { data: byAuth } = await authClient
          .from("profiles")
          .select("*")
          .eq("auth_user_id", id)
          .maybeSingle();
        if (byAuth) {
          targetProfile = byAuth;
        }
      }

      if (!targetProfile) {
        return NextResponse.json({ error: `User with ID ${id} not found.` }, { status: 404 });
      }

      const targetEmail = (targetProfile.email || "").trim().toLowerCase();
      const domain = targetEmail.split("@").pop()?.toLowerCase();
      const isCollectiveEmail = domain === WORKSPACE_EMAIL_DOMAIN;

      if (role) {
        if (role === "admin" && !isCollectiveEmail) {
          return NextResponse.json(
            {
              error:
                "Accounts with non-@collectivep.com emails cannot be assigned the Admin role. The Admin role requires an email address with the @collectivep.com domain.",
            },
            { status: 400 }
          );
        }

        if (role === "member" && !isCollectiveEmail) {
          return NextResponse.json(
            {
              error:
                "Accounts with non-@collectivep.com emails cannot be assigned the Member role. The Member role requires an email address with the @collectivep.com domain.",
            },
            { status: 400 }
          );
        }
      }

      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name.trim();
      if (role !== undefined) updateData.role = role;
      if (avatar_color || avatarColor) {
        updateData.avatar_color = avatar_color || avatarColor;
      }
      if (is_deleted !== undefined) updateData.is_deleted = is_deleted;
      if (deleted_at !== undefined) updateData.deleted_at = deleted_at;

      let { data: updated, error: updateError } = await authClient
        .from("profiles")
        .update(updateData)
        .eq("id", targetProfile.id)
        .select()
        .maybeSingle();

      if (updateError) {
        // If updating deleted_at was blocked because of profiles_select_team (deleted_at is null check):
        // Attempt fallback update with is_deleted only so the account status is saved in the database
        if (
          updateError.message?.includes("row-level security") &&
          updateData.deleted_at !== undefined &&
          updateData.is_deleted !== undefined
        ) {
          const fallbackRes = await authClient
            .from("profiles")
            .update({ is_deleted: updateData.is_deleted })
            .eq("id", targetProfile.id)
            .select()
            .maybeSingle();

          if (!fallbackRes.error && fallbackRes.data) {
            return NextResponse.json({
              success: true,
              user: fallbackRes.data,
              warning:
                "User marked as is_deleted=true in database. Run the migration in Supabase SQL editor to enable deleted_at timestamps.",
            });
          }
        }

        return NextResponse.json(
          {
            error: `Database update denied by RLS: ${updateError.message}. Run the admin RLS policy migration in Supabase SQL editor to allow admins to select and update soft-deleted profiles.`,
            code: updateError.code || "RLS_PERMISSION_DENIED",
          },
          { status: 403 }
        );
      }

      if (updated) {
        return NextResponse.json({
          success: true,
          user: updated,
        });
      }
    }

    // 3. Fallback failure: Database could not be updated because service role credentials are missing
    return NextResponse.json(
      {
        error:
          "Database update failed. To edit user roles, configure SUPABASE_SERVICE_ROLE_KEY in your project environment settings, or run the admin RLS policy migration in the Supabase SQL editor.",
        code: "MISSING_SERVICE_ROLE_KEY",
      },
      { status: 500 }
    );
  } catch (error: unknown) {
    const message = formatError(error);
    return NextResponse.json(
      { error: message, details: typeof error === "object" && error !== null ? error : undefined },
      { status: 500 }
    );
  }
}
