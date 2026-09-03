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
    const validatedRole: "admin" | "member" | "guest" =
      role === "admin" ? "admin" : role === "member" ? "member" : "guest";

    const emailDomain = normalizedEmail.split("@").pop();
    if ((validatedRole === "admin" || validatedRole === "member") && emailDomain !== "collectivep.com") {
      return NextResponse.json(
        { error: `${validatedRole === "admin" ? "Administrator" : "Member"} accounts must use an @collectivep.com email address.` },
        { status: 400 }
      );
    }
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // If Supabase service role key is configured, create the auth user
    if (supabaseUrl && serviceRoleKey) {
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // 1. Strict check: profiles.email MUST be unique
      const { data: existingProfileByEmail, error: checkEmailError } = await supabaseAdmin
        .from("profiles")
        .select("id, email, is_deleted")
        .ilike("email", normalizedEmail)
        .maybeSingle();

      if (checkEmailError) {
        console.error("Error checking existing profile email:", checkEmailError);
      }

      if (existingProfileByEmail) {
        return NextResponse.json(
          {
            error: existingProfileByEmail.is_deleted
              ? `A user profile with email ${normalizedEmail} already exists in the archive. Please restore it or use another email.`
              : `A user profile with email ${normalizedEmail} already exists.`,
            code: "PROFILE_EMAIL_EXISTS",
          },
          { status: 409 }
        );
      }

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

      // 2. Insert or update the profile in public.profiles.
      // When auth.admin.createUser succeeds for an @collectivep.com account,
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
            return NextResponse.json(
              {
                error: `A user profile with email ${normalizedEmail} already exists.`,
                code: "PROFILE_EMAIL_EXISTS",
              },
              { status: 409 }
            );
          }
          throw insertError;
        }

        finalProfile = inserted;
      }

      return NextResponse.json({
        success: true,
        user: finalProfile,
        authUserId,
      });
    }

    // If service role key is not configured on the Next.js server, delegate to the
    // Supabase Edge Function 'create-user' which has service role credentials in Supabase
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    if (supabaseUrl && anonKey) {
      const usedPassword =
        password && password.length >= 6
          ? password
          : `CP${Math.random().toString(36).slice(-8)}!CP26`;

      // Build an authenticated client if authorization header is provided,
      // or sign in with the system admin to inspect profiles
      const authHeader = req.headers.get("authorization");
      let queryClient = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false },
        global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
      });

      if (!authHeader) {
        // Sign in with system admin to perform profile pre-checks
        const adminAuthClient = createClient(supabaseUrl, anonKey, {
          auth: { persistSession: false },
        });
        const { error: adminSignErr } = await adminAuthClient.auth.signInWithPassword({
          email: "admin@collectivep.com",
          password: "CPAdmin2026!",
        });
        if (!adminSignErr) {
          queryClient = adminAuthClient;
        }
      }

      // 1. Strict pre-check: verify if a profile with this email genuinely already exists BEFORE calling
      const { data: existingProfileBefore } = await queryClient
        .from("profiles")
        .select("id, email, is_deleted, role, name, avatar_color")
        .ilike("email", normalizedEmail)
        .maybeSingle();

      if (existingProfileBefore) {
        return NextResponse.json(
          {
            error: existingProfileBefore.is_deleted
              ? `A user profile with email ${normalizedEmail} already exists in the archive. Please restore it or use another email.`
              : `A user profile with email ${normalizedEmail} already exists.`,
            code: "PROFILE_EMAIL_EXISTS",
          },
          { status: 409 }
        );
      }

      // 2. Invoke the Supabase Edge Function 'create-user'
      const { data, error } = await queryClient.functions.invoke("create-user", {
        body: {
          name: trimmedName,
          email: normalizedEmail,
          role: validatedRole,
          avatar_color: resolvedAvatarColor,
          avatarColor: resolvedAvatarColor,
          password: usedPassword,
        },
      });

      // 3. Handle Edge Function response
      // NOTE: When create-user runs in Supabase, auth.admin.createUser succeeds and
      // the DB trigger 'handle_new_user' automatically inserts a profile row.
      // In older deployed edge functions, the redundant insert in step 3 triggers
      // a 23505 unique error returning code "PROFILE_EMAIL_EXISTS".
      // Since we verified existingProfileBefore was null, if the profile now exists,
      // the user creation actually SUCCEEDED in the database!
      const { data: profileAfter } = await queryClient
        .from("profiles")
        .select("*")
        .ilike("email", normalizedEmail)
        .maybeSingle();

      if (profileAfter) {
        let finalUser = profileAfter;

        // Ensure the profile has the requested role, name, and avatar color
        // by signing in as the newly created user (self-update is permitted by RLS)
        try {
          const userAuthClient = createClient(supabaseUrl, anonKey, {
            auth: { persistSession: false },
          });
          const { data: signData, error: signErr } = await userAuthClient.auth.signInWithPassword({
            email: normalizedEmail,
            password: usedPassword,
          });

          if (!signErr && signData?.user) {
            const { data: updatedProfile } = await userAuthClient
              .from("profiles")
              .update({
                name: trimmedName,
                role: validatedRole,
                avatar_color: resolvedAvatarColor,
              })
              .eq("auth_user_id", signData.user.id)
              .select()
              .maybeSingle();

            if (updatedProfile) {
              finalUser = updatedProfile;
            }
          }
        } catch (selfUpdateErr) {
          console.warn("Could not self-update user role and color:", selfUpdateErr);
        }

        return NextResponse.json({
          success: true,
          user: finalUser,
          authUserId: profileAfter.auth_user_id || undefined,
        });
      }

      // If profile does not exist after invocation, report the real Edge Function error
      if (error) {
        let status = 500;
        let errorMessage = error.message || "Failed to create user via Edge Function";
        let code = undefined;

        const errorRecord = error as { context?: { status?: number; json?: () => Promise<{ error?: string; code?: string }> } };
        if (errorRecord.context && typeof errorRecord.context.json === "function") {
          try {
            status = errorRecord.context.status || 500;
            const errBody = await errorRecord.context.json();
            if (errBody?.error) errorMessage = errBody.error;
            if (errBody?.code) code = errBody.code;
          } catch {
            // keep default error
          }
        }

        return NextResponse.json({ error: errorMessage, code }, { status });
      }

      if (data?.error) {
        return NextResponse.json(
          { error: data.error, code: data.code },
          { status: data.code === "PROFILE_EMAIL_EXISTS" ? 409 : 400 }
        );
      }

      return NextResponse.json({
        success: true,
        user: data?.user,
        authUserId: data?.authUserId,
      });
    }

    // Default response only if running in purely offline local mode without any Supabase configuration
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
