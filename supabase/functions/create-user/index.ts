// Supabase Edge Function: create-user
// Location: supabase/functions/create-user/index.ts
//
// Creates an authenticated user in Supabase Auth using the admin API
// and provisions their team profile with an initial password and role (admin | guest).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface CreateUserPayload {
  email: string;
  password?: string;
  name: string;
  role?: "admin" | "member" | "guest";
  avatarColor?: string;
  avatar_color?: string;
}

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

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
    }

    // Initialize Supabase Admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Parse request body
    const body: CreateUserPayload = await req.json();
    const {
      email,
      password,
      name,
      role = "guest",
      avatarColor = "var(--primary)",
      avatar_color,
    } = body;

    if (!email || !name) {
      return new Response(
        JSON.stringify({ error: "Name and email are required fields." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();
    const resolvedAvatarColor = avatar_color || avatarColor || "var(--primary)";

    // Role validation: 'admin', 'member', and 'guest' are valid
    const validatedRole: "admin" | "member" | "guest" =
      role === "admin" ? "admin" : role === "member" ? "member" : "guest";

    const emailDomain = normalizedEmail.split("@").pop();
    if ((validatedRole === "admin" || validatedRole === "member") && emailDomain !== "collectivep.com") {
      return new Response(
        JSON.stringify({
          error: `${validatedRole === "admin" ? "Administrator" : "Member"} accounts must use an @collectivep.com email address.`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Strict check: profiles.email MUST be unique
    const { data: existingProfileByEmail } = await supabaseAdmin
      .from("profiles")
      .select("id, email, is_deleted")
      .ilike("email", normalizedEmail)
      .maybeSingle();

    if (existingProfileByEmail) {
      return new Response(
        JSON.stringify({
          error: existingProfileByEmail.is_deleted
            ? `A user profile with email ${normalizedEmail} already exists in the archive. Please restore it or use another email.`
            : `A user profile with email ${normalizedEmail} already exists.`,
          code: "PROFILE_EMAIL_EXISTS",
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Generate or use provided password
    const initialPassword =
      password && password.length >= 6
        ? password
        : `CP${Math.random().toString(36).slice(-8)}!`;

    // 2. Create or retrieve the auth user in Supabase Auth
    let authUserId: string | null = null;
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

      // If user already registered in auth, look them up
      if (
        errMsg.includes("already registered") ||
        errMsg.includes("already been registered") ||
        errMsg.includes("already exists") ||
        errStatus === 422
      ) {
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });
        const existingUser = listData?.users?.find(
          (u) => u.email?.toLowerCase() === normalizedEmail
        );
        if (existingUser) {
          authUserId = existingUser.id;
          if (password && password.length >= 6) {
            await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
              password,
              user_metadata: {
                name: trimmedName,
                role: validatedRole,
              },
            });
          }
        }
      } else {
        throw authError;
      }
    } else if (authData?.user) {
      authUserId = authData.user.id;
    }

    // 3. Insert or update the profile in public.profiles.
    // Note: When auth.admin.createUser succeeds for an @collectivep.com account,
    // the DB trigger on_auth_user_created automatically creates a profile row.
    // We update that row with the requested role and avatarColor, or insert if no trigger fired.
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

    if (authUserId) {
      const { data: byAuthId } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("auth_user_id", authUserId)
        .maybeSingle();

      if (byAuthId) {
        const { data: updated, error: updateError } = await supabaseAdmin
          .from("profiles")
          .update(profileData)
          .eq("id", byAuthId.id)
          .select()
          .maybeSingle();

        if (updateError) {
          throw updateError;
        }
        finalProfile = updated || { ...byAuthId, ...profileData };
      }
    }

    if (!finalProfile) {
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("profiles")
        .insert(profileData)
        .select()
        .maybeSingle();

      if (insertError) {
        if (
          insertError.code === "23505" ||
          insertError.message?.toLowerCase().includes("unique") ||
          insertError.message?.toLowerCase().includes("duplicate")
        ) {
          return new Response(
            JSON.stringify({
              error: `A user profile with email ${normalizedEmail} already exists.`,
              code: "PROFILE_EMAIL_EXISTS",
            }),
            {
              status: 409,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        throw insertError;
      }

      finalProfile = inserted;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "User created successfully",
        user: finalProfile,
        authUserId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: unknown) {
    const message = formatError(err);
    return new Response(
      JSON.stringify({
        error: message,
        details: typeof err === "object" && err !== null ? err : undefined,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
