"use server";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { User } from "@/lib/types";
import { generateId } from "@/lib/utils";

/**
 * Server action to create a new user with password.
 * This requires admin auth and will:
 * 1. Create auth user via Supabase admin API
 * 2. Create profile in profiles table
 */
export async function createUserWithPassword(
  email: string,
  password: string,
  name: string,
  role: "admin" | "guest"
): Promise<{ user: User | null; error: string | null }> {
  try {
    const cookieStore = await cookies();
    
    // Get current user session to verify they're authenticated
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name: cookieName, value, options }) =>
              cookieStore.set(cookieName, value, options)
            );
          },
        },
      }
    );

    // Get current user (must be admin)
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    if (!currentUser) {
      return { user: null, error: "Not authenticated" };
    }

    // Check if current user is admin
    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("auth_user_id", currentUser.id)
      .single();

    if (adminProfile?.role !== "admin") {
      return { user: null, error: "Only admins can create users" };
    }

    // Validate email domain
    // if (!email.endsWith("@collectivep.com")) {
    //   return { user: null, error: "Email must be @collectivep.com domain" };
    // }

    // Create admin client for user creation
    const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!adminKey) {
      return { user: null, error: "Server configuration error" };
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      adminKey,
      { auth: { persistSession: false } }
    );

    // Create auth user using admin API
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser(
      {
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: name,
        },
      }
    );

    console.log("createUserWithPassword: authError", authError, "authData", authData);

    if (authError || !authData.user) {
      return { user: null, error: authError?.message || "Failed to create auth user" };
    }

    // Create profile
    const profileId = generateId();
    const { error: profileError } = await supabase.from("profiles").insert({
      id: profileId,
      auth_user_id: authData.user.id,
      name,
      email,
      avatar_color: "var(--primary)",
      role,
    });

    if (profileError) {
      // Rollback - delete the auth user
      await adminSupabase.auth.admin.deleteUser(authData.user.id);
      return { user: null, error: profileError.message };
    }

    // Return created user
    const newUser: User = {
      id: profileId,
      name,
      email,
      avatarColor: "var(--primary)",
      role,
    };

    return { user: newUser, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { user: null, error: message };
  }
}

/**
 * Update user password
 */
export async function updateUserPassword(
  newPassword: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name: cookieName, value, options }) =>
              cookieStore.set(cookieName, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
