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
  role?: "admin" | "guest";
  avatarColor?: string;
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
    const { email, password, name, role = "guest", avatarColor = "var(--primary)" } = body;

    if (!email || !name) {
      return new Response(
        JSON.stringify({ error: "Name and email are required fields." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Role validation: only 'admin' and 'guest' are valid
    const validatedRole: "admin" | "guest" = role === "admin" ? "admin" : "guest";

    // Generate or use provided password
    const initialPassword = password && password.length >= 6 ? password : `CP${Math.random().toString(36).slice(-8)}!`;

    // 1. Create or retrieve the auth user in Supabase Auth
    let authUserId: string | null = null;
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
      // If user already registered in auth, look them up
      if (authError.message.toLowerCase().includes("already registered") || authError.status === 422) {
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = listData?.users?.find(
          (u) => u.email?.toLowerCase() === email.trim().toLowerCase()
        );
        if (existingUser) {
          authUserId = existingUser.id;
          // Optionally update password if provided
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

    // 2. Upsert the profile into public.profiles
    const profilePayload = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role: validatedRole,
      avatar_color: avatarColor,
      auth_user_id: authUserId,
      is_deleted: false,
      deleted_at: null,
    };

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert(profilePayload, { onConflict: "email" })
      .select()
      .single();

    if (profileError) {
      throw profileError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "User created successfully",
        user: profile,
        authUserId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
