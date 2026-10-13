import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const profileId = req.nextUrl.searchParams.get("profile_id");
  if (!profileId) {
    return NextResponse.json({ error: "profile_id required" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    return NextResponse.json({ linked: false });
  }

  const keyToUse = serviceRoleKey || anonKey;
  if (!keyToUse) {
    return NextResponse.json({ linked: false });
  }

  try {
    const supabase = createClient(supabaseUrl, keyToUse, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase
      .from("profiles_google_tokens")
      .select("id, profile_id, google_client_id, created_at, google_refresh_token")
      .eq("profile_id", profileId)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ linked: false });
    }

    return NextResponse.json({
      linked: true,
      hasRefreshToken: Boolean(data.google_refresh_token),
      clientId: data.google_client_id,
      createdAt: data.created_at,
    });
  } catch (err) {
    console.warn("Error checking google token status:", err);
    return NextResponse.json({ linked: false });
  }
}

export async function DELETE(req: NextRequest) {
  const profileId = req.nextUrl.searchParams.get("profile_id");
  if (!profileId) {
    return NextResponse.json({ error: "profile_id required" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Server credentials missing" }, { status: 500 });
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { error } = await supabase
      .from("profiles_google_tokens")
      .delete()
      .eq("profile_id", profileId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to unlink" }, { status: 500 });
  }
}
