import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { WORKSPACE_EMAIL_DOMAIN, validateEmailForRole } from "@/lib/supabase/email-policy";

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
    const { id, name, role, avatarColor, avatar_color } = body;

    if (!id) {
      return NextResponse.json({ error: "User ID is required." }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // If Supabase service role key is configured, perform admin update
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
      if (targetProfile.auth_user_id) {
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

    // Local / fallback mode
    const trimmedName = typeof name === "string" ? name.trim() : undefined;
    return NextResponse.json({
      success: true,
      user: {
        id,
        ...(trimmedName ? { name: trimmedName } : {}),
        ...(role ? { role } : {}),
        avatar_color: avatar_color || avatarColor,
      },
    });
  } catch (error: unknown) {
    const message = formatError(error);
    return NextResponse.json(
      { error: message, details: typeof error === "object" && error !== null ? error : undefined },
      { status: 500 }
    );
  }
}
