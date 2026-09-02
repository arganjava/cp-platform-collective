import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

interface CreateUserRequest {
  email: string
  password: string
  name: string
  role: "admin" | "guest"
}

interface CreateUserResponse {
  user: { id: string; name: string; email: string; role: "admin" | "guest" } | null
  error: string | null
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

Deno.serve(async (req) => {
  // Only handle POST requests
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    })
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get("authorization")
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Parse request body
    const body: CreateUserRequest = await req.json()
    const { email, password, name, role } = body

    // Validate required fields
    if (!email || !password || !name || !role) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: email, password, name, role" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      )
    }

    // Validate role
    if (role !== "admin" && role !== "guest") {
      return new Response(JSON.stringify({ error: "Invalid role. Must be 'admin' or 'guest'" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Create Supabase clients
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || ""
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || ""
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase environment variables")
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Create admin client
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    })

    // Create anon client to verify current user is admin
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          authorization: authHeader,
        },
      },
    })

    // Get current user
    const {
      data: { user: currentUser },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !currentUser) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Check if current user is admin
    const { data: adminProfile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("auth_user_id", currentUser.id)
      .single()

    if (profileError || adminProfile?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Only admins can create users" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Create auth user using admin API
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: name,
      },
    })

    if (authError || !authData.user) {
      console.error("Auth user creation error:", authError)
      return new Response(
        JSON.stringify({
          error: authError?.message || "Failed to create auth user",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      )
    }

    // Create profile
    const profileId = generateId()
    const { error: insertError } = await supabase.from("profiles").insert({
      id: profileId,
      auth_user_id: authData.user.id,
      name,
      email,
      avatar_color: "var(--primary)",
      role,
    })

    if (insertError) {
      // Rollback - delete the auth user
      await adminSupabase.auth.admin.deleteUser(authData.user.id)
      console.error("Profile creation error:", insertError)
      return new Response(
        JSON.stringify({
          error: insertError.message || "Failed to create profile",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      )
    }

    // Return success response
    const response: CreateUserResponse = {
      user: {
        id: profileId,
        name,
        email,
        role,
      },
      error: null,
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    console.error("Edge function error:", err)
    const message = err instanceof Error ? err.message : String(err)
    return new Response(
      JSON.stringify({
        error: message || "Internal server error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    )
  }
})
